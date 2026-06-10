import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";

import type { ResumeData } from "@/schema/resume/data";

import { db } from "@/integrations/drizzle/client";
import {
  resume,
  resumeVerificationSettings,
  reviewerProfiles,
  user,
  verificationDocuments,
  verificationMetadata,
  verificationRequests,
} from "@/integrations/drizzle/schema";
import {
  sendAssessmentSolutionSubmittedEmail,
  sendIdentityVerificationRequestedEmail,
  sendSkillAssessmentAcceptedEmail,
  sendVerdictAwaitingFinalApprovalEmail,
  sendVerificationStatusEmail,
} from "@/integrations/email/verification";
import { env } from "@/utils/env";
import { validateAssessmentSolutionFile } from "@/utils/verification-assessment-solution";
import { validateVerificationDocumentFile } from "@/utils/verification-documents";
import { resolveCanonicalSkillLabel } from "@/utils/verification/common-reviewer-skills";
import {
  buildRedactedRelatedExperience,
  buildReviewerSkillContext,
  formatReviewerCaseId,
  mapReviewerDocumentUrl,
} from "@/utils/verification/reviewer-context";
import {
  findSkillCategoryForVerificationId,
  findVerifiableSkillUnit,
  normalizeSkillLabel,
  reviewerCanReviewSkill,
} from "@/utils/verification/skills";

import { getStorageService, toPublicFileUrl, toStorageKey, uploadFile } from "./storage";

const REVIEWER_WORKFLOW_SECTION_TYPES = ["skill", "project"] as const;
const ASSESSMENT_SOLUTION_DOCUMENT_TYPES = ["assessment_solution", "assessment_solution_link"] as const;

const ACTIVE_STATUSES = ["pending", "claimed", "verdict_pending", "verified"] as const;
const FINAL_STATUSES = ["verified", "rejected", "issue"] as const;

/** Shown on badges as "pending" clock; hidden from public resume + non-owner PDF. */
const PENDING_LIKE_STATUSES = new Set<string>(["pending", "claimed", "verdict_pending"]);

function stripPendingLikeStatuses<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => !PENDING_LIKE_STATUSES.has(r.status));
}

function assertReviewerWorkflowRequest(request: { sectionType: string }) {
  if (!(REVIEWER_WORKFLOW_SECTION_TYPES as readonly string[]).includes(request.sectionType)) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Request must be a skill or project verification request",
    });
  }
}

function mapDocumentToPublicUrl(doc: { fileUrl: string; documentType: string }) {
  if (doc.documentType === "freelancer_link" || doc.documentType === "assessment_solution_link") {
    return doc.fileUrl;
  }

  return toPublicFileUrl(toStorageKey(doc.fileUrl));
}

function isExternalVerificationLink(documentType: string) {
  return documentType === "freelancer_link" || documentType === "assessment_solution_link";
}

type ReviewerAttributionSnapshot = {
  reviewerSnapshotFirstName: string;
  reviewerSnapshotLastName: string | null;
  reviewerSnapshotTitle: string | null;
  reviewerPublicProfileUrl: string | null;
};

async function getReviewerAttributionSnapshot(requestId: string): Promise<ReviewerAttributionSnapshot | null> {
  const metadataRows = await db
    .select({
      reviewerSnapshotFirstName: verificationMetadata.reviewerSnapshotFirstName,
      reviewerSnapshotLastName: verificationMetadata.reviewerSnapshotLastName,
      reviewerSnapshotTitle: verificationMetadata.reviewerSnapshotTitle,
      reviewerPublicProfileUrl: verificationMetadata.reviewerPublicProfileUrl,
    })
    .from(verificationMetadata)
    .where(
      and(
        eq(verificationMetadata.verificationRequestId, requestId),
        inArray(verificationMetadata.action, ["verdict_submitted", "claimed"]),
      ),
    )
    .orderBy(desc(verificationMetadata.actedAt));

  for (const metadata of metadataRows) {
    if (metadata.reviewerSnapshotFirstName) {
      return {
        reviewerSnapshotFirstName: metadata.reviewerSnapshotFirstName,
        reviewerSnapshotLastName: metadata.reviewerSnapshotLastName,
        reviewerSnapshotTitle: metadata.reviewerSnapshotTitle,
        reviewerPublicProfileUrl: metadata.reviewerPublicProfileUrl,
      };
    }
  }

  return null;
}

function buildReviewerBadgeFromSnapshot(snapshot: ReviewerAttributionSnapshot) {
  const displayName = [snapshot.reviewerSnapshotFirstName, snapshot.reviewerSnapshotLastName].filter(Boolean).join(" ");

  const label = snapshot.reviewerSnapshotTitle
    ? `${displayName} \u2014 ${snapshot.reviewerSnapshotTitle}`
    : displayName;

  return {
    type: "reviewer" as const,
    label,
    profileUrl: snapshot.reviewerPublicProfileUrl,
  };
}

async function sendFinalStatusEmail(
  request: { userId: string; itemLabel: string; sectionType: string },
  status: "verified" | "rejected" | "issue",
) {
  try {
    const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, request.userId)).limit(1);

    if (userData?.email) {
      await sendVerificationStatusEmail(status, {
        to: userData.email,
        itemLabel: request.itemLabel,
        sectionType: request.sectionType,
      });
    }
  } catch {
    // Email failures should not block the main flow
  }
}

type SkillProjectRequestRow = {
  id: string;
  userId: string;
  resumeId: string | null;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  submittedAt: Date;
  claimedAt?: Date | null;
  resolvedAt?: Date | null;
  claimedByAdminId?: string | null;
  proposedVerdict?: "verified" | "rejected" | "issue" | null;
  reviewerNote?: string | null;
  assessmentAcceptedAt?: Date | null;
};

type ExperienceRequestRow = {
  id: string;
  userId: string;
  resumeId: string | null;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  method: string | null;
  submittedAt: Date;
  resolvedAt?: Date | null;
  reviewerNote?: string | null;
};

type IdentityRequestRow = {
  id: string;
  userId: string;
  resumeId: string | null;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  method: string | null;
  submittedAt: Date;
  calendarLinkSentAt?: Date | null;
  resolvedAt?: Date | null;
  reviewerNote?: string | null;
};

type DirectAdminReviewAttribution = {
  reviewedBy: { id: string; name: string; email: string } | null;
  reviewedAt: Date | null;
};

export type AdminVerificationListInput = {
  page: number;
  pageSize: number;
  query?: string;
  statuses?: ("verified" | "rejected" | "issue")[];
  method?: "document_upload" | "freelancer_link" | "identity_call";
};

export type AdminPendingVerdictsListInput = AdminVerificationListInput & {
  proposed?: ("verified" | "rejected" | "issue")[];
  types?: ("skill" | "project")[];
};

export type PaginatedListResult<T> = {
  items: T[];
  total: number;
  totalUnfiltered: number;
  page: number;
  pageSize: number;
};

function buildVerificationSearchCondition(query: string) {
  const pattern = `%${query.slice(0, 200)}%`;
  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(user.username, pattern),
    ilike(user.displayUsername, pattern),
    ilike(verificationRequests.itemLabel, pattern),
  )!;
}

function buildAdminVerificationListFilters(input: AdminVerificationListInput, includeStatuses: boolean) {
  const filters: SQL[] = [];
  if (input.query) filters.push(buildVerificationSearchCondition(input.query));
  if (includeStatuses && input.statuses && input.statuses.length > 0) {
    filters.push(inArray(verificationRequests.status, input.statuses));
  }
  if (input.method) filters.push(eq(verificationRequests.method, input.method));
  return filters;
}

function buildPendingVerdictsListFilters(input: AdminPendingVerdictsListInput) {
  const filters = buildAdminVerificationListFilters(input, false);
  if (input.proposed && input.proposed.length > 0) {
    filters.push(inArray(verificationRequests.proposedVerdict, input.proposed));
  }
  if (input.types && input.types.length > 0) {
    filters.push(inArray(verificationRequests.sectionType, input.types));
  }
  return filters;
}

async function countVerificationRequests(
  baseWhere: SQL | undefined,
  filteredWhere: SQL | undefined,
  needsUserJoin: boolean,
) {
  const [unfilteredRow] = await db.select({ total: count() }).from(verificationRequests).where(baseWhere);
  const totalUnfiltered = unfilteredRow?.total ?? 0;

  if (!filteredWhere) {
    return { total: totalUnfiltered, totalUnfiltered };
  }

  if (needsUserJoin) {
    const [filteredRow] = await db
      .select({ total: count() })
      .from(verificationRequests)
      .innerJoin(user, eq(verificationRequests.userId, user.id))
      .where(filteredWhere);
    return { total: filteredRow?.total ?? 0, totalUnfiltered };
  }

  const [filteredRow] = await db.select({ total: count() }).from(verificationRequests).where(filteredWhere);
  return { total: filteredRow?.total ?? 0, totalUnfiltered };
}

function selectVerificationRequestRows(
  select: Parameters<typeof db.select>[0],
  filteredWhere: SQL | undefined,
  orderBy: SQL,
  limit: number,
  offset: number,
  needsUserJoin: boolean,
) {
  const baseQuery = db.select(select).from(verificationRequests);
  return (needsUserJoin ? baseQuery.innerJoin(user, eq(verificationRequests.userId, user.id)) : baseQuery)
    .where(filteredWhere)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);
}

async function fetchPaginatedVerificationRequestRows<TRow>(
  input: AdminVerificationListInput,
  config: {
    baseConditions: SQL[];
    includeStatuses: boolean;
    fetchRows: (filteredWhere: SQL | undefined, limit: number, offset: number) => Promise<TRow[]>;
  },
): Promise<{ rows: TRow[]; total: number; totalUnfiltered: number }> {
  const { page, pageSize } = input;
  const offset = (page - 1) * pageSize;
  const baseWhere = and(...config.baseConditions);
  const optionalFilters = buildAdminVerificationListFilters(input, config.includeStatuses);
  const filteredWhere = optionalFilters.length > 0 ? and(baseWhere, ...optionalFilters) : baseWhere;
  const needsUserJoin = Boolean(input.query);

  const { total, totalUnfiltered } = await countVerificationRequests(baseWhere, filteredWhere, needsUserJoin);

  if (total === 0) {
    return { rows: [], total: 0, totalUnfiltered };
  }

  const rows = await config.fetchRows(filteredWhere, pageSize, offset);
  return { rows, total, totalUnfiltered };
}

function toPaginatedResult<T>(
  items: T[],
  total: number,
  totalUnfiltered: number,
  input: { page: number; pageSize: number },
): PaginatedListResult<T> {
  return {
    items,
    total,
    totalUnfiltered,
    page: input.page,
    pageSize: input.pageSize,
  };
}

async function enrichSkillProjectRequests(requests: SkillProjectRequestRow[]) {
  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const userIds = [...new Set(requests.map((r) => r.userId))];
  const resumeIds = [...new Set(requests.map((r) => r.resumeId).filter((id): id is string => id != null))];

  const users = userIds.length > 0 ? await db.select().from(user).where(inArray(user.id, userIds)) : [];

  const resumeRows =
    resumeIds.length > 0
      ? await db
          .select({
            id: resume.id,
            name: resume.name,
            slug: resume.slug,
            tags: resume.tags,
            isPublic: resume.isPublic,
            isLocked: resume.isLocked,
            data: resume.data,
            userId: resume.userId,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt,
          })
          .from(resume)
          .where(inArray(resume.id, resumeIds))
      : [];

  const docs = await db
    .select({
      id: verificationDocuments.id,
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
      documentType: verificationDocuments.documentType,
      uploadedAt: verificationDocuments.uploadedAt,
    })
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.verificationRequestId, requestIds));

  const userById = new Map(users.map((u) => [u.id, u]));
  const resumeById = new Map(resumeRows.map((row) => [row.id, row]));
  const docsByRequestId = new Map<string, typeof docs>();

  for (const doc of docs) {
    const existing = docsByRequestId.get(doc.verificationRequestId) ?? [];
    existing.push(doc);
    docsByRequestId.set(doc.verificationRequestId, existing);
  }

  return requests.map((r) => {
    const applicantUser = userById.get(r.userId) ?? null;
    let applicantResume: (typeof resumeRows)[number] | null = null;
    if (r.resumeId) {
      const row = resumeById.get(r.resumeId);
      if (row && row.userId === r.userId) applicantResume = row;
    }

    const requestDocs = docsByRequestId.get(r.id) ?? [];
    const instructionsDoc = requestDocs.find((d) => d.documentType === "assessment_instructions");

    const resumeData = applicantResume?.data as ResumeData | undefined;

    return {
      id: r.id,
      sectionType: r.sectionType,
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      parentItemLabel: resolveParentItemLabel(resumeData, r.sectionType, r.itemId),
      status: r.status,
      submittedAt: r.submittedAt,
      claimedAt: r.claimedAt ?? null,
      resolvedAt: r.resolvedAt ?? null,
      proposedVerdict: r.proposedVerdict ?? null,
      reviewerNote: r.reviewerNote ?? null,
      assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
      assessmentInstructionsUrl: instructionsDoc ? mapDocumentToPublicUrl(instructionsDoc) : null,
      user: applicantUser,
      resume: applicantResume,
      documents: requestDocs.map((d) => ({
        id: d.id,
        fileUrl: mapDocumentToPublicUrl(d),
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    };
  });
}

async function enrichSkillProjectRequestsForReviewer(requests: SkillProjectRequestRow[]) {
  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const resumeIds = [...new Set(requests.map((r) => r.resumeId).filter((id): id is string => id != null))];

  const resumeRows =
    resumeIds.length > 0
      ? await db
          .select({
            id: resume.id,
            data: resume.data,
            userId: resume.userId,
          })
          .from(resume)
          .where(inArray(resume.id, resumeIds))
      : [];

  const docs = await db
    .select({
      id: verificationDocuments.id,
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
      documentType: verificationDocuments.documentType,
      uploadedAt: verificationDocuments.uploadedAt,
    })
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.verificationRequestId, requestIds));

  const resumeById = new Map(resumeRows.map((row) => [row.id, row]));
  const docsByRequestId = new Map<string, typeof docs>();

  for (const doc of docs) {
    const existing = docsByRequestId.get(doc.verificationRequestId) ?? [];
    existing.push(doc);
    docsByRequestId.set(doc.verificationRequestId, existing);
  }

  return requests.map((r) => {
    let applicantResume: (typeof resumeRows)[number] | null = null;
    if (r.resumeId) {
      const row = resumeById.get(r.resumeId);
      if (row && row.userId === r.userId) applicantResume = row;
    }

    const requestDocs = docsByRequestId.get(r.id) ?? [];
    const instructionsDoc = requestDocs.find((d) => d.documentType === "assessment_instructions");
    const resumeData = applicantResume?.data as ResumeData | undefined;
    const parentItemLabel = resolveParentItemLabel(resumeData, r.sectionType, r.itemId);
    const skillContext = buildReviewerSkillContext(resumeData, r.sectionType, r.itemId, r.itemLabel);
    const relatedExperience =
      r.sectionType === "skill" ? buildRedactedRelatedExperience(resumeData, r.itemLabel, parentItemLabel) : [];

    return {
      id: r.id,
      caseLabel: formatReviewerCaseId(r.id),
      sectionType: r.sectionType,
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      parentItemLabel,
      status: r.status,
      submittedAt: r.submittedAt,
      claimedAt: r.claimedAt ?? null,
      resolvedAt: r.resolvedAt ?? null,
      proposedVerdict: r.proposedVerdict ?? null,
      reviewerNote: r.reviewerNote ?? null,
      assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
      assessmentInstructionsUrl: instructionsDoc
        ? mapReviewerDocumentUrl(r.id, instructionsDoc.id, instructionsDoc.documentType, instructionsDoc.fileUrl)
        : null,
      skillContext,
      relatedExperience,
      documents: requestDocs.map((d) => ({
        id: d.id,
        fileUrl: mapReviewerDocumentUrl(r.id, d.id, d.documentType, d.fileUrl),
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    };
  });
}

async function assertReviewerDocumentAccess(requestId: string, adminId: string) {
  const [request] = await db
    .select({
      id: verificationRequests.id,
      sectionType: verificationRequests.sectionType,
      itemLabel: verificationRequests.itemLabel,
      status: verificationRequests.status,
      claimedByAdminId: verificationRequests.claimedByAdminId,
    })
    .from(verificationRequests)
    .where(eq(verificationRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
  }

  if (!(REVIEWER_WORKFLOW_SECTION_TYPES as readonly string[]).includes(request.sectionType)) {
    throw new ORPCError("FORBIDDEN", { message: "Document access is limited to skill and project requests" });
  }

  if (request.claimedByAdminId === adminId) {
    return request;
  }

  if (request.status === "pending") {
    const [profile] = await db
      .select({ reviewerSkills: reviewerProfiles.reviewerSkills })
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, adminId))
      .limit(1);

    if (!profile) {
      throw new ORPCError("FORBIDDEN", { message: "Reviewer profile not found" });
    }

    if (request.sectionType === "project" || reviewerCanReviewSkill(profile.reviewerSkills, request.itemLabel)) {
      return request;
    }
  }

  throw new ORPCError("FORBIDDEN", { message: "You do not have access to this document" });
}

async function enrichExperienceRequests(requests: ExperienceRequestRow[]) {
  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const userIds = [...new Set(requests.map((r) => r.userId))];
  const resumeIds = [...new Set(requests.map((r) => r.resumeId).filter((id): id is string => id != null))];

  const users = userIds.length > 0 ? await db.select().from(user).where(inArray(user.id, userIds)) : [];

  const resumeRows =
    resumeIds.length > 0
      ? await db
          .select({
            id: resume.id,
            name: resume.name,
            slug: resume.slug,
            tags: resume.tags,
            isPublic: resume.isPublic,
            isLocked: resume.isLocked,
            data: resume.data,
            userId: resume.userId,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt,
          })
          .from(resume)
          .where(inArray(resume.id, resumeIds))
      : [];

  const userById = new Map(users.map((u) => [u.id, u]));
  const resumeById = new Map(resumeRows.map((row) => [row.id, row]));

  const docs = await db
    .select({
      id: verificationDocuments.id,
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
      documentType: verificationDocuments.documentType,
      uploadedAt: verificationDocuments.uploadedAt,
    })
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.verificationRequestId, requestIds));

  const docsByRequestId = new Map<string, typeof docs>();
  for (const doc of docs) {
    const existing = docsByRequestId.get(doc.verificationRequestId) ?? [];
    existing.push(doc);
    docsByRequestId.set(doc.verificationRequestId, existing);
  }

  return requests.map((r) => {
    const applicantUser = userById.get(r.userId) ?? null;
    let applicantResume: (typeof resumeRows)[number] | null = null;
    if (r.resumeId) {
      const row = resumeById.get(r.resumeId);
      if (row && row.userId === r.userId) applicantResume = row;
    }

    return {
      id: r.id,
      sectionType: r.sectionType,
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      status: r.status,
      method: r.method,
      submittedAt: r.submittedAt,
      resolvedAt: r.resolvedAt ?? null,
      reviewerNote: r.reviewerNote ?? null,
      user: applicantUser,
      resume: applicantResume,
      documents: (docsByRequestId.get(r.id) ?? []).map((d) => ({
        id: d.id,
        fileUrl: mapDocumentToPublicUrl(d),
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    };
  });
}

async function enrichIdentityRequests(requests: IdentityRequestRow[]) {
  if (requests.length === 0) return [];

  const requestIds = requests.map((r) => r.id);
  const userIds = [...new Set(requests.map((r) => r.userId))];

  const users = userIds.length > 0 ? await db.select().from(user).where(inArray(user.id, userIds)) : [];

  const allResumeRows =
    userIds.length > 0
      ? await db
          .select({
            id: resume.id,
            name: resume.name,
            slug: resume.slug,
            tags: resume.tags,
            isPublic: resume.isPublic,
            isLocked: resume.isLocked,
            data: resume.data,
            userId: resume.userId,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt,
          })
          .from(resume)
          .where(inArray(resume.userId, userIds))
          .orderBy(desc(resume.updatedAt))
      : [];

  const latestResumeByUserId = new Map<string, (typeof allResumeRows)[number]>();
  for (const row of allResumeRows) {
    if (!latestResumeByUserId.has(row.userId)) {
      latestResumeByUserId.set(row.userId, row);
    }
  }

  const docs = await db
    .select({
      id: verificationDocuments.id,
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
      documentType: verificationDocuments.documentType,
      uploadedAt: verificationDocuments.uploadedAt,
    })
    .from(verificationDocuments)
    .where(inArray(verificationDocuments.verificationRequestId, requestIds));

  const docsByRequestId = new Map<string, typeof docs>();
  for (const doc of docs) {
    const existing = docsByRequestId.get(doc.verificationRequestId) ?? [];
    existing.push(doc);
    docsByRequestId.set(doc.verificationRequestId, existing);
  }

  const userById = new Map(users.map((u) => [u.id, u]));

  return requests.map((r) => ({
    id: r.id,
    sectionType: r.sectionType,
    itemId: r.itemId,
    itemLabel: r.itemLabel,
    status: r.status,
    method: r.method,
    submittedAt: r.submittedAt,
    calendarLinkSentAt: r.calendarLinkSentAt ?? null,
    resolvedAt: r.resolvedAt ?? null,
    reviewerNote: r.reviewerNote ?? null,
    user: userById.get(r.userId) ?? null,
    resume: latestResumeByUserId.get(r.userId) ?? null,
    documents: (docsByRequestId.get(r.id) ?? []).map((d) => ({
      id: d.id,
      fileUrl: mapDocumentToPublicUrl(d),
      documentType: d.documentType,
      uploadedAt: d.uploadedAt,
    })),
  }));
}

async function buildDirectAdminReviewAttributionMap(verificationRequestIds: string[]) {
  if (verificationRequestIds.length === 0) {
    return new Map<string, DirectAdminReviewAttribution>();
  }

  const metadataRows = await db
    .select({
      verificationRequestId: verificationMetadata.verificationRequestId,
      adminId: verificationMetadata.adminId,
      actedAt: verificationMetadata.actedAt,
    })
    .from(verificationMetadata)
    .where(
      and(
        inArray(verificationMetadata.verificationRequestId, verificationRequestIds),
        eq(verificationMetadata.adminRole, "skill_verdict_admin"),
        inArray(verificationMetadata.action, ["verified", "rejected", "flagged"]),
      ),
    )
    .orderBy(desc(verificationMetadata.actedAt));

  const latestMetadataByRequestId = new Map<string, (typeof metadataRows)[number]>();
  for (const metadata of metadataRows) {
    if (!latestMetadataByRequestId.has(metadata.verificationRequestId)) {
      latestMetadataByRequestId.set(metadata.verificationRequestId, metadata);
    }
  }

  const adminIds = [...new Set(metadataRows.map((m) => m.adminId))];
  const adminUsers =
    adminIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(inArray(user.id, adminIds))
      : [];

  const adminById = new Map(adminUsers.map((admin) => [admin.id, admin]));

  const attributionByRequestId = new Map<string, DirectAdminReviewAttribution>();
  for (const [requestId, metadata] of latestMetadataByRequestId) {
    const admin = adminById.get(metadata.adminId);
    attributionByRequestId.set(requestId, {
      reviewedBy: admin ? { id: admin.id, name: admin.name, email: admin.email } : null,
      reviewedAt: metadata.actedAt,
    });
  }

  return attributionByRequestId;
}

function attachDirectAdminReviewAttribution<T extends { id: string }>(
  items: T[],
  attributionByRequestId: Map<string, DirectAdminReviewAttribution>,
) {
  return items.map((item) => {
    const attribution = attributionByRequestId.get(item.id);
    return {
      ...item,
      reviewedBy: attribution?.reviewedBy ?? null,
      reviewedAt: attribution?.reviewedAt ?? null,
    };
  });
}

async function attachAssessmentFields<
  T extends { id: string; status: string; sectionType: string; assessmentAcceptedAt?: Date | null },
>(rows: T[]) {
  const skillProjectRows = rows.filter((r) => r.sectionType === "skill" || r.sectionType === "project");
  const skillProjectIds = skillProjectRows.map((r) => r.id);
  const inAssessmentIds = skillProjectRows.filter((r) => r.status === "claimed").map((r) => r.id);

  if (skillProjectIds.length === 0) {
    return rows.map((r) => ({
      ...r,
      assessmentInstructionsUrl: null as string | null,
      assessmentSolutionSubmittedAt: null as Date | null,
      assessmentSolutionFileUrl: null as string | null,
      assessmentSolutionLinkUrl: null as string | null,
      assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
    }));
  }

  const docs = await db
    .select({
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
      documentType: verificationDocuments.documentType,
      uploadedAt: verificationDocuments.uploadedAt,
    })
    .from(verificationDocuments)
    .where(
      and(
        inArray(verificationDocuments.verificationRequestId, skillProjectIds),
        inArray(verificationDocuments.documentType, ["assessment_instructions", ...ASSESSMENT_SOLUTION_DOCUMENT_TYPES]),
      ),
    );

  const instructionsByRequestId = new Map<string, string>();
  const solutionFileByRequestId = new Map<string, string>();
  const solutionLinkByRequestId = new Map<string, string>();
  const solutionSubmittedAtByRequestId = new Map<string, Date>();

  for (const doc of docs) {
    if (doc.documentType === "assessment_instructions") {
      instructionsByRequestId.set(
        doc.verificationRequestId,
        mapDocumentToPublicUrl({ fileUrl: doc.fileUrl, documentType: doc.documentType }),
      );
      continue;
    }

    if (doc.documentType === "assessment_solution") {
      solutionFileByRequestId.set(
        doc.verificationRequestId,
        mapDocumentToPublicUrl({ fileUrl: doc.fileUrl, documentType: doc.documentType }),
      );
    }

    if (doc.documentType === "assessment_solution_link") {
      solutionLinkByRequestId.set(
        doc.verificationRequestId,
        mapDocumentToPublicUrl({ fileUrl: doc.fileUrl, documentType: doc.documentType }),
      );
    }

    const existingSubmittedAt = solutionSubmittedAtByRequestId.get(doc.verificationRequestId);
    if (!existingSubmittedAt || doc.uploadedAt > existingSubmittedAt) {
      solutionSubmittedAtByRequestId.set(doc.verificationRequestId, doc.uploadedAt);
    }
  }

  return rows.map((r) => ({
    ...r,
    assessmentInstructionsUrl:
      r.status === "claimed" && inAssessmentIds.includes(r.id) ? (instructionsByRequestId.get(r.id) ?? null) : null,
    assessmentSolutionSubmittedAt: solutionSubmittedAtByRequestId.get(r.id) ?? null,
    assessmentSolutionFileUrl: solutionFileByRequestId.get(r.id) ?? null,
    assessmentSolutionLinkUrl: solutionLinkByRequestId.get(r.id) ?? null,
    assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
  }));
}

function verdictToMetadataAction(verdict: "verified" | "rejected" | "issue") {
  return verdict === "issue" ? ("flagged" as const) : verdict;
}

function isFinalStatus(status: string): status is (typeof FINAL_STATUSES)[number] {
  return (FINAL_STATUSES as readonly string[]).includes(status);
}

function getVerificationActorLabel(metadata: {
  reviewerSnapshotFirstName: string | null;
  reviewerSnapshotLastName: string | null;
  adminRole: string;
}) {
  const displayName = [metadata.reviewerSnapshotFirstName, metadata.reviewerSnapshotLastName].filter(Boolean).join(" ");
  if (displayName) return displayName;

  if (metadata.adminRole === "skill_verdict_admin") return "Skill Verdict Admin";
  if (metadata.adminRole === "reviewer_admin") return "Reviewer Admin";
  return "Admin Reviewer";
}

async function buildReviewerAttributionLabelMap(requestIds: string[]) {
  if (requestIds.length === 0) {
    return new Map<string, string>();
  }

  const metadataRows = await db
    .select({
      verificationRequestId: verificationMetadata.verificationRequestId,
      reviewerSnapshotFirstName: verificationMetadata.reviewerSnapshotFirstName,
      reviewerSnapshotLastName: verificationMetadata.reviewerSnapshotLastName,
    })
    .from(verificationMetadata)
    .where(
      and(
        inArray(verificationMetadata.verificationRequestId, requestIds),
        inArray(verificationMetadata.action, ["verdict_submitted", "claimed"]),
      ),
    )
    .orderBy(desc(verificationMetadata.actedAt));

  const labelByRequestId = new Map<string, string>();
  for (const metadata of metadataRows) {
    if (labelByRequestId.has(metadata.verificationRequestId) || !metadata.reviewerSnapshotFirstName) {
      continue;
    }
    labelByRequestId.set(
      metadata.verificationRequestId,
      [metadata.reviewerSnapshotFirstName, metadata.reviewerSnapshotLastName].filter(Boolean).join(" "),
    );
  }

  return labelByRequestId;
}

async function buildVerifierLabelMap(verificationRequestIds: string[]) {
  if (verificationRequestIds.length === 0) {
    return new Map<string, string>();
  }

  const requestRows = await db
    .select({
      id: verificationRequests.id,
      sectionType: verificationRequests.sectionType,
    })
    .from(verificationRequests)
    .where(inArray(verificationRequests.id, verificationRequestIds));

  const skillProjectIds = requestRows
    .filter((r) => (REVIEWER_WORKFLOW_SECTION_TYPES as readonly string[]).includes(r.sectionType))
    .map((r) => r.id);

  const reviewerAttributionLabels = await buildReviewerAttributionLabelMap(skillProjectIds);

  const metadataRows = await db
    .select({
      verificationRequestId: verificationMetadata.verificationRequestId,
      adminRole: verificationMetadata.adminRole,
      reviewerSnapshotFirstName: verificationMetadata.reviewerSnapshotFirstName,
      reviewerSnapshotLastName: verificationMetadata.reviewerSnapshotLastName,
      actedAt: verificationMetadata.actedAt,
    })
    .from(verificationMetadata)
    .where(
      and(
        inArray(verificationMetadata.verificationRequestId, verificationRequestIds),
        inArray(verificationMetadata.action, ["verified", "overridden"]),
      ),
    )
    .orderBy(desc(verificationMetadata.actedAt));

  const verifierByRequestId = new Map<string, string>();
  for (const metadata of metadataRows) {
    if (verifierByRequestId.has(metadata.verificationRequestId)) {
      continue;
    }

    const reviewerLabel = reviewerAttributionLabels.get(metadata.verificationRequestId);
    if (reviewerLabel) {
      verifierByRequestId.set(metadata.verificationRequestId, reviewerLabel);
      continue;
    }

    verifierByRequestId.set(metadata.verificationRequestId, getVerificationActorLabel(metadata));
  }

  return verifierByRequestId;
}

async function loadResumeSkillItems(userId: string, resumeId: string) {
  const [resumeRow] = await db
    .select({ data: resume.data })
    .from(resume)
    .where(and(eq(resume.id, resumeId), eq(resume.userId, userId)))
    .limit(1);

  if (!resumeRow) {
    throw new ORPCError("NOT_FOUND", { message: "Resume not found" });
  }

  const data = resumeRow.data as ResumeData;
  return data.sections.skills.items;
}

function resolveParentItemLabel(
  resumeData: ResumeData | null | undefined,
  sectionType: string,
  itemId: string,
): string | null {
  if (sectionType !== "skill" || !resumeData) return null;

  const category = findSkillCategoryForVerificationId(resumeData.sections.skills.items, itemId);
  if (!category) return null;

  return category.parentItemLabel === category.itemLabel ? null : category.parentItemLabel;
}

async function guardActiveRequest(userId: string, resumeId: string | null, itemId: string) {
  const baseConditions = [eq(verificationRequests.userId, userId), eq(verificationRequests.itemId, itemId)];

  if (resumeId) {
    baseConditions.push(eq(verificationRequests.resumeId, resumeId));
  }

  const [existing] = await db
    .select({ id: verificationRequests.id, status: verificationRequests.status })
    .from(verificationRequests)
    .where(and(...baseConditions, inArray(verificationRequests.status, [...ACTIVE_STATUSES])))
    .limit(1);

  if (existing) {
    throw new ORPCError("CONFLICT", {
      message: `An active verification request already exists (status: ${existing.status})`,
    });
  }
}

export const verificationService = {
  requestSkill: async (input: { userId: string; resumeId: string; itemId: string; itemLabel: string }) => {
    const skillItems = await loadResumeSkillItems(input.userId, input.resumeId);
    const unit = findVerifiableSkillUnit(skillItems, input.itemId);

    if (!unit) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Invalid skill item. Request verification for an individual skill, not a skill category.",
      });
    }

    if (normalizeSkillLabel(unit.itemLabel) !== normalizeSkillLabel(input.itemLabel)) {
      throw new ORPCError("BAD_REQUEST", { message: "Skill label does not match the resume item" });
    }

    await guardActiveRequest(input.userId, input.resumeId, unit.itemId);

    const [request] = await db
      .insert(verificationRequests)
      .values({
        userId: input.userId,
        resumeId: input.resumeId,
        sectionType: "skill",
        itemId: unit.itemId,
        itemLabel: resolveCanonicalSkillLabel(unit.itemLabel),
        status: "pending",
      })
      .returning();

    return request!;
  },

  requestProject: async (input: { userId: string; resumeId: string; itemId: string; itemLabel: string }) => {
    await guardActiveRequest(input.userId, input.resumeId, input.itemId);

    const [request] = await db
      .insert(verificationRequests)
      .values({
        userId: input.userId,
        resumeId: input.resumeId,
        sectionType: "project",
        itemId: input.itemId,
        itemLabel: input.itemLabel,
        status: "pending",
      })
      .returning();

    return request!;
  },

  uploadDocument: async (input: {
    userId: string;
    resumeId: string;
    itemId: string;
    file: File;
    documentType: "payslip" | "contract" | "freelancer_link";
  }) => {
    const [req] = await db
      .select({ id: verificationRequests.id })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.resumeId, input.resumeId),
          eq(verificationRequests.itemId, input.itemId),
          eq(verificationRequests.userId, input.userId),
          eq(verificationRequests.sectionType, "experience"),
          eq(verificationRequests.status, "pending"),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    if (!req) {
      throw new ORPCError("NOT_FOUND", {
        message: "No verification request found for this item. Submit a verification request first.",
      });
    }

    const fileBuffer = await input.file.arrayBuffer();
    const data = new Uint8Array(fileBuffer);

    const result = await uploadFile({
      userId: input.userId,
      resumeId: input.resumeId,
      itemId: input.itemId,
      data,
      contentType: input.file.type || "application/octet-stream",
      type: "document",
    });

    const [doc] = await db
      .insert(verificationDocuments)
      .values({
        verificationRequestId: req.id,
        fileUrl: result.key,
        documentType: input.documentType,
      })
      .returning();

    return {
      ...doc!,
      fileUrl: mapDocumentToPublicUrl({ fileUrl: doc!.fileUrl, documentType: doc!.documentType }),
    };
  },

  submitAssessmentSolution: async (input: {
    userId: string;
    resumeId: string;
    itemId: string;
    file?: File;
    solutionUrl?: string;
  }) => {
    if (!input.file && !input.solutionUrl?.trim()) {
      throw new ORPCError("BAD_REQUEST", { message: "Provide a file or solution URL" });
    }

    if (input.file) {
      try {
        validateAssessmentSolutionFile(input.file);
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Invalid solution file",
        });
      }
    }

    const [request] = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
        status: verificationRequests.status,
        claimedByAdminId: verificationRequests.claimedByAdminId,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.userId, input.userId),
          eq(verificationRequests.resumeId, input.resumeId),
          eq(verificationRequests.itemId, input.itemId),
          inArray(verificationRequests.sectionType, [...REVIEWER_WORKFLOW_SECTION_TYPES]),
          eq(verificationRequests.status, "claimed"),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", {
        message: "No active assessment found for this item. Assessment instructions must be accepted first.",
      });
    }

    if (!request.claimedByAdminId) {
      throw new ORPCError("BAD_REQUEST", { message: "Assessment has no assigned reviewer" });
    }

    assertReviewerWorkflowRequest(request);

    const existingSolutionDocs = await db
      .select({ id: verificationDocuments.id })
      .from(verificationDocuments)
      .where(
        and(
          eq(verificationDocuments.verificationRequestId, request.id),
          inArray(verificationDocuments.documentType, [...ASSESSMENT_SOLUTION_DOCUMENT_TYPES]),
        ),
      )
      .limit(1);

    if (existingSolutionDocs.length > 0) {
      throw new ORPCError("CONFLICT", { message: "A solution has already been submitted for this assessment" });
    }

    const insertedDocs: Array<{ fileUrl: string; documentType: string; uploadedAt: Date }> = [];

    if (input.file) {
      const fileBuffer = await input.file.arrayBuffer();
      const data = new Uint8Array(fileBuffer);
      const uploadResult = await uploadFile({
        userId: input.userId,
        resumeId: input.resumeId,
        itemId: input.itemId,
        data,
        contentType: input.file.type || "application/octet-stream",
        type: "document",
      });

      const [fileDoc] = await db
        .insert(verificationDocuments)
        .values({
          verificationRequestId: request.id,
          fileUrl: uploadResult.key,
          documentType: "assessment_solution",
        })
        .returning({
          fileUrl: verificationDocuments.fileUrl,
          documentType: verificationDocuments.documentType,
          uploadedAt: verificationDocuments.uploadedAt,
        });

      insertedDocs.push(fileDoc!);
    }

    if (input.solutionUrl?.trim()) {
      const [linkDoc] = await db
        .insert(verificationDocuments)
        .values({
          verificationRequestId: request.id,
          fileUrl: input.solutionUrl.trim(),
          documentType: "assessment_solution_link",
        })
        .returning({
          fileUrl: verificationDocuments.fileUrl,
          documentType: verificationDocuments.documentType,
          uploadedAt: verificationDocuments.uploadedAt,
        });

      insertedDocs.push(linkDoc!);
    }

    await db.insert(verificationMetadata).values({
      verificationRequestId: request.id,
      adminId: request.claimedByAdminId,
      adminRole: "reviewer_admin",
      action: "solution_submitted",
      notes: null,
    });

    const latestSubmittedAt = insertedDocs.reduce<Date | null>((latest, doc) => {
      if (!latest || doc.uploadedAt > latest) return doc.uploadedAt;
      return latest;
    }, null);

    const solutionFileDoc = insertedDocs.find((doc) => doc.documentType === "assessment_solution");
    const solutionLinkDoc = insertedDocs.find((doc) => doc.documentType === "assessment_solution_link");

    try {
      const [[reviewerUser], [applicantUser]] = await Promise.all([
        db.select({ email: user.email }).from(user).where(eq(user.id, request.claimedByAdminId!)).limit(1),
        db.select({ name: user.name }).from(user).where(eq(user.id, input.userId)).limit(1),
      ]);

      if (reviewerUser?.email) {
        await sendAssessmentSolutionSubmittedEmail({
          to: reviewerUser.email,
          itemLabel: request.itemLabel,
          applicantName: applicantUser?.name,
          reviewerQueueUrl: `${env.APP_URL}/dashboard/reviewer/queue`,
        });
      }
    } catch {
      // Email failures should not block the main flow
    }

    return {
      requestId: request.id,
      assessmentSolutionSubmittedAt: latestSubmittedAt,
      assessmentSolutionFileUrl: solutionFileDoc
        ? mapDocumentToPublicUrl({ fileUrl: solutionFileDoc.fileUrl, documentType: solutionFileDoc.documentType })
        : null,
      assessmentSolutionLinkUrl: solutionLinkDoc
        ? mapDocumentToPublicUrl({ fileUrl: solutionLinkDoc.fileUrl, documentType: solutionLinkDoc.documentType })
        : null,
    };
  },

  requestExperience: async (input: {
    userId: string;
    resumeId: string;
    itemId: string;
    itemLabel: string;
    method: "document_upload" | "freelancer_link";
    documentId?: string;
    freelancerUrl?: string;
  }) => {
    await guardActiveRequest(input.userId, input.resumeId, input.itemId);

    const [request] = await db
      .insert(verificationRequests)
      .values({
        userId: input.userId,
        resumeId: input.resumeId,
        sectionType: "experience",
        itemId: input.itemId,
        itemLabel: input.itemLabel,
        status: "pending",
        method: input.method,
      })
      .returning();

    if (input.method === "freelancer_link" && input.freelancerUrl) {
      await db.insert(verificationDocuments).values({
        verificationRequestId: request!.id,
        fileUrl: input.freelancerUrl,
        documentType: "freelancer_link",
      });
    }

    return request!;
  },

  requestIdentity: async (userId: string) => {
    const itemId = userId;

    await guardActiveRequest(userId, null, itemId);

    const [request] = await db
      .insert(verificationRequests)
      .values({
        userId,
        resumeId: null,
        sectionType: "identity",
        itemId,
        itemLabel: "Identity Verification",
        status: "pending",
        method: "identity_call",
        calendarLinkSentAt: new Date(),
      })
      .returning();

    try {
      const calLink = env.CAL_COM_LINK;
      if (calLink) {
        const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);

        if (userData?.email) {
          await sendIdentityVerificationRequestedEmail({ to: userData.email, calLink });
        }
      }
    } catch {
      // Email failures should not block the main flow
    }

    return request!;
  },

  getAllStatuses: async (userId: string) => {
    const rows = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
        resumeId: verificationRequests.resumeId,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.submittedAt));

    return await attachAssessmentFields(rows);
  },

  getIdentityStatus: async (userId: string) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.userId, userId), eq(verificationRequests.sectionType, "identity")))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    return request ?? null;
  },

  getStatus: async (input: { userId: string; resumeId: string }) => {
    const sectionStatuses = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.userId, input.userId), eq(verificationRequests.resumeId, input.resumeId)));

    const enrichedSectionStatuses = await attachAssessmentFields(sectionStatuses);

    const [identityStatus] = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.userId, input.userId), eq(verificationRequests.sectionType, "identity")))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    if (!identityStatus) {
      return enrichedSectionStatuses;
    }

    const [enrichedIdentityStatus] = await attachAssessmentFields([identityStatus]);
    return [...enrichedSectionStatuses, enrichedIdentityStatus!];
  },

  getStatusByResumeId: async (resumeId: string) => {
    return await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.resumeId, resumeId));
  },

  getPublicStatus: async (resumeId: string) => {
    const [resumeRow] = await db
      .select({
        userId: resume.userId,
        isPublic: resume.isPublic,
      })
      .from(resume)
      .where(eq(resume.id, resumeId))
      .limit(1);

    if (!resumeRow || !resumeRow.isPublic) {
      return [];
    }

    const sectionStatuses = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.resumeId, resumeId));

    const [identityStatus] = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.userId, resumeRow.userId), eq(verificationRequests.sectionType, "identity")))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    if (!identityStatus) {
      return stripPendingLikeStatuses(sectionStatuses);
    }

    return stripPendingLikeStatuses([...sectionStatuses, identityStatus]);
  },

  getPrinterStatus: async (resumeId: string, options?: { includePendingLike?: boolean }) => {
    const [resumeRow] = await db
      .select({
        userId: resume.userId,
      })
      .from(resume)
      .where(eq(resume.id, resumeId))
      .limit(1);

    if (!resumeRow) {
      return [];
    }

    const sectionStatuses = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.resumeId, resumeId));

    const [identityStatus] = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.userId, resumeRow.userId), eq(verificationRequests.sectionType, "identity")))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    if (!identityStatus) {
      return options?.includePendingLike === false ? stripPendingLikeStatuses(sectionStatuses) : sectionStatuses;
    }

    const combined = [...sectionStatuses, identityStatus];
    return options?.includePendingLike === false ? stripPendingLikeStatuses(combined) : combined;
  },

  getHistory: async (input: { userId: string; resumeId: string; itemId: string }) => {
    const requests = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        submittedAt: verificationRequests.submittedAt,
        resolvedAt: verificationRequests.resolvedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.userId, input.userId),
          eq(verificationRequests.resumeId, input.resumeId),
          eq(verificationRequests.itemId, input.itemId),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt));

    if (requests.length === 0) {
      return [];
    }

    const verifierByRequestId = await buildVerifierLabelMap(requests.map((request) => request.id));

    return requests.map((request) => ({
      ...request,
      verifiedBy: request.status === "verified" ? (verifierByRequestId.get(request.id) ?? null) : null,
    }));
  },

  getPublicTimeline: async (input: { resumeId: string }) => {
    const [resumeRow] = await db
      .select({
        id: resume.id,
        isPublic: resume.isPublic,
      })
      .from(resume)
      .where(eq(resume.id, input.resumeId))
      .limit(1);

    if (!resumeRow || !resumeRow.isPublic) {
      return { enabled: false, entries: [] };
    }

    const [settings] = await db
      .select({
        showTimeline: resumeVerificationSettings.showTimeline,
      })
      .from(resumeVerificationSettings)
      .where(eq(resumeVerificationSettings.resumeId, input.resumeId))
      .limit(1);

    if (!settings?.showTimeline) {
      return { enabled: false, entries: [] };
    }

    const entries = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        submittedAt: verificationRequests.submittedAt,
        resolvedAt: verificationRequests.resolvedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.resumeId, input.resumeId))
      .orderBy(desc(verificationRequests.submittedAt));

    if (entries.length === 0) {
      return { enabled: true, entries: [] };
    }

    const verifierByRequestId = await buildVerifierLabelMap(entries.map((entry) => entry.id));
    const entriesWithVerifier = entries.map((entry) => ({
      ...entry,
      verifiedBy: entry.status === "verified" ? (verifierByRequestId.get(entry.id) ?? null) : null,
    }));

    return { enabled: true, entries: stripPendingLikeStatuses(entriesWithVerifier) };
  },

  toggleBadge: async (input: { userId: string; requestId: string; visible: boolean }) => {
    const [request] = await db
      .select({ status: verificationRequests.status, userId: verificationRequests.userId })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.userId !== input.userId) {
      throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
    }

    if (request.status !== "verified") {
      throw new ORPCError("BAD_REQUEST", { message: "Badge visibility can only be toggled for verified requests" });
    }

    const [updated] = await db
      .update(verificationRequests)
      .set({ badgeVisible: input.visible })
      .where(eq(verificationRequests.id, input.requestId))
      .returning({ id: verificationRequests.id, badgeVisible: verificationRequests.badgeVisible });

    return updated!;
  },

  listTimelineSettingsForUser: async (userId: string) => {
    const publicResumes = await db
      .select({ id: resume.id, name: resume.name })
      .from(resume)
      .where(and(eq(resume.userId, userId), eq(resume.isPublic, true)));

    if (publicResumes.length === 0) {
      return [];
    }

    const resumeIds = publicResumes.map((r) => r.id);
    const settingsRows = await db
      .select({
        resumeId: resumeVerificationSettings.resumeId,
        showTimeline: resumeVerificationSettings.showTimeline,
      })
      .from(resumeVerificationSettings)
      .where(inArray(resumeVerificationSettings.resumeId, resumeIds));

    const settingsByResumeId = new Map(settingsRows.map((s) => [s.resumeId, s.showTimeline]));

    return publicResumes.map((r) => ({
      resumeId: r.id,
      name: r.name,
      showTimeline: settingsByResumeId.get(r.id) ?? false,
    }));
  },

  toggleTimeline: async (input: { userId: string; resumeId: string; show: boolean }) => {
    const [owned] = await db
      .select({ id: resume.id })
      .from(resume)
      .where(and(eq(resume.id, input.resumeId), eq(resume.userId, input.userId)))
      .limit(1);

    if (!owned) {
      throw new ORPCError("NOT_FOUND", { message: "Resume not found" });
    }

    const [existing] = await db
      .select({ id: resumeVerificationSettings.id })
      .from(resumeVerificationSettings)
      .where(eq(resumeVerificationSettings.resumeId, input.resumeId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(resumeVerificationSettings)
        .set({ showTimeline: input.show })
        .where(eq(resumeVerificationSettings.resumeId, input.resumeId))
        .returning();

      return updated!;
    }

    const [created] = await db
      .insert(resumeVerificationSettings)
      .values({ resumeId: input.resumeId, showTimeline: input.show })
      .returning();

    return created!;
  },

  getBadgeDetail: async (requestId: string) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        sectionType: verificationRequests.sectionType,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);

    if (!request || request.status !== "verified") {
      return null;
    }

    if (request.sectionType === "identity") {
      return { type: "identity" as const, label: "Identity Verified" };
    }

    if (request.sectionType === "experience") {
      return { type: "experience" as const, label: "Verified by Skill Verdict Admin" };
    }

    const [metadata] = await db
      .select({
        reviewerSnapshotFirstName: verificationMetadata.reviewerSnapshotFirstName,
        reviewerSnapshotLastName: verificationMetadata.reviewerSnapshotLastName,
        reviewerSnapshotTitle: verificationMetadata.reviewerSnapshotTitle,
        reviewerPublicProfileUrl: verificationMetadata.reviewerPublicProfileUrl,
      })
      .from(verificationMetadata)
      .where(
        and(
          eq(verificationMetadata.verificationRequestId, requestId),
          inArray(verificationMetadata.action, ["verified", "overridden"]),
        ),
      )
      .orderBy(desc(verificationMetadata.actedAt))
      .limit(1);

    if (metadata?.reviewerSnapshotFirstName) {
      return buildReviewerBadgeFromSnapshot({
        reviewerSnapshotFirstName: metadata.reviewerSnapshotFirstName,
        reviewerSnapshotLastName: metadata.reviewerSnapshotLastName,
        reviewerSnapshotTitle: metadata.reviewerSnapshotTitle,
        reviewerPublicProfileUrl: metadata.reviewerPublicProfileUrl,
      });
    }

    const attributionSnapshot = await getReviewerAttributionSnapshot(requestId);
    if (attributionSnapshot) {
      return buildReviewerBadgeFromSnapshot(attributionSnapshot);
    }

    return { type: "reviewer" as const, label: "Verified", profileUrl: null };
  },

  // --- Admin: Reviewer procedures ---

  listQueue: async (adminId: string) => {
    const [profile] = await db
      .select({ reviewerSkills: reviewerProfiles.reviewerSkills })
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, adminId))
      .limit(1);

    if (!profile || profile.reviewerSkills.length === 0) {
      return [];
    }

    const requests = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.status, "pending"),
          inArray(verificationRequests.sectionType, ["skill", "project"]),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt));

    const filtered = requests.filter((request) => {
      if (request.sectionType === "project") return true;
      return reviewerCanReviewSkill(profile.reviewerSkills, request.itemLabel);
    });

    return await enrichSkillProjectRequestsForReviewer(filtered);
  },

  acceptCase: async (input: { requestId: string; adminId: string; file: File; message?: string }) => {
    try {
      validateVerificationDocumentFile(input.file);
    } catch (error) {
      throw new ORPCError("BAD_REQUEST", {
        message: error instanceof Error ? error.message : "Invalid document file",
      });
    }

    const [profile] = await db
      .select()
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, input.adminId))
      .limit(1);

    if (!profile) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    const [pendingRequest] = await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        claimedByAdminId: verificationRequests.claimedByAdminId,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!pendingRequest) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (
      pendingRequest.sectionType === "skill" &&
      !reviewerCanReviewSkill(profile.reviewerSkills, pendingRequest.itemLabel)
    ) {
      throw new ORPCError("FORBIDDEN", {
        message: "This skill is not in your assigned reviewable skills",
      });
    }

    const acceptedAt = new Date();

    const [claimed] = await db
      .update(verificationRequests)
      .set({
        status: "claimed",
        claimedAt: acceptedAt,
        claimedByAdminId: input.adminId,
        assessmentAcceptedAt: acceptedAt,
      })
      .where(
        and(
          eq(verificationRequests.id, input.requestId),
          eq(verificationRequests.status, "pending"),
          isNull(verificationRequests.claimedByAdminId),
          inArray(verificationRequests.sectionType, [...REVIEWER_WORKFLOW_SECTION_TYPES]),
        ),
      )
      .returning({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
      });

    if (!claimed) {
      const [exists] = await db
        .select({ id: verificationRequests.id })
        .from(verificationRequests)
        .where(eq(verificationRequests.id, input.requestId))
        .limit(1);

      if (!exists) {
        throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
      }

      throw new ORPCError("CONFLICT", { message: "Request is not available to accept" });
    }

    if (!claimed.resumeId) {
      throw new ORPCError("BAD_REQUEST", { message: "Request is missing a resume" });
    }

    assertReviewerWorkflowRequest(claimed);

    const fileBuffer = await input.file.arrayBuffer();
    const data = new Uint8Array(fileBuffer);
    const storageService = getStorageService();

    let uploadResult: Awaited<ReturnType<typeof uploadFile>>;
    try {
      uploadResult = await uploadFile({
        userId: claimed.userId,
        resumeId: claimed.resumeId,
        itemId: claimed.itemId,
        data,
        contentType: input.file.type || "application/octet-stream",
        type: "document",
      });
    } catch {
      await db
        .update(verificationRequests)
        .set({
          status: "pending",
          claimedAt: null,
          claimedByAdminId: null,
          assessmentAcceptedAt: null,
        })
        .where(eq(verificationRequests.id, input.requestId));

      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to upload assessment instructions" });
    }

    let updated: (typeof claimed & { status: string }) | undefined;
    try {
      updated = await db.transaction(async (tx) => {
        await tx.insert(verificationDocuments).values({
          verificationRequestId: input.requestId,
          fileUrl: uploadResult.key,
          documentType: "assessment_instructions",
        });

        await tx.insert(verificationMetadata).values({
          verificationRequestId: input.requestId,
          adminId: input.adminId,
          adminRole: "reviewer_admin",
          action: "claimed",
          notes: input.message ?? null,
          reviewerSnapshotFirstName: profile.firstName,
          reviewerSnapshotLastName: profile.lastName,
          reviewerSnapshotTitle: profile.title,
          reviewerPublicProfileUrl: profile.publicProfileUrl,
        });

        const [row] = await tx
          .select()
          .from(verificationRequests)
          .where(eq(verificationRequests.id, input.requestId))
          .limit(1);

        return row;
      });
    } catch {
      await db
        .update(verificationRequests)
        .set({
          status: "pending",
          claimedAt: null,
          claimedByAdminId: null,
          assessmentAcceptedAt: null,
        })
        .where(eq(verificationRequests.id, input.requestId));

      await storageService.delete(uploadResult.key);

      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to record assessment acceptance" });
    }

    try {
      const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, claimed.userId)).limit(1);

      if (userData?.email) {
        const reviewerName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
        await sendSkillAssessmentAcceptedEmail({
          to: userData.email,
          itemLabel: claimed.itemLabel,
          reviewerName,
          message: input.message,
          verificationDashboardUrl: `${env.APP_URL}/dashboard/verification`,
        });
      }
    } catch {
      // Email failures should not block the main flow
    }

    return updated!;
  },

  listMyCases: async (adminId: string) => {
    const requests = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        claimedAt: verificationRequests.claimedAt,
        submittedAt: verificationRequests.submittedAt,
        proposedVerdict: verificationRequests.proposedVerdict,
        reviewerNote: verificationRequests.reviewerNote,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.claimedByAdminId, adminId),
          inArray(verificationRequests.status, ["claimed", "verdict_pending"]),
        ),
      )
      .orderBy(desc(verificationRequests.claimedAt));

    return await enrichSkillProjectRequestsForReviewer(requests);
  },

  listMyCaseHistory: async (adminId: string) => {
    const requests = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        claimedAt: verificationRequests.claimedAt,
        resolvedAt: verificationRequests.resolvedAt,
        submittedAt: verificationRequests.submittedAt,
        proposedVerdict: verificationRequests.proposedVerdict,
        reviewerNote: verificationRequests.reviewerNote,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.claimedByAdminId, adminId),
          inArray(verificationRequests.status, [...FINAL_STATUSES]),
          inArray(verificationRequests.sectionType, [...REVIEWER_WORKFLOW_SECTION_TYPES]),
        ),
      )
      .orderBy(desc(verificationRequests.resolvedAt));

    return await enrichSkillProjectRequestsForReviewer(requests);
  },

  submitVerdict: async (input: {
    requestId: string;
    adminId: string;
    verdict: "verified" | "rejected" | "issue";
    notes?: string;
  }) => {
    const [profile] = await db
      .select()
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, input.adminId))
      .limit(1);

    if (!profile) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    if (!profile.consentGiven) {
      throw new ORPCError("FORBIDDEN", { message: "Consent must be given before submitting verdicts" });
    }

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: "verdict_pending",
        reviewerNote: input.notes ?? null,
        proposedVerdict: input.verdict,
      })
      .where(
        and(
          eq(verificationRequests.id, input.requestId),
          eq(verificationRequests.status, "claimed"),
          eq(verificationRequests.claimedByAdminId, input.adminId),
          inArray(verificationRequests.sectionType, [...REVIEWER_WORKFLOW_SECTION_TYPES]),
        ),
      )
      .returning();

    if (!updated) {
      const [existing] = await db
        .select({
          id: verificationRequests.id,
          status: verificationRequests.status,
          claimedByAdminId: verificationRequests.claimedByAdminId,
          sectionType: verificationRequests.sectionType,
        })
        .from(verificationRequests)
        .where(eq(verificationRequests.id, input.requestId))
        .limit(1);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
      }

      assertReviewerWorkflowRequest(existing);

      if (existing.claimedByAdminId !== input.adminId) {
        throw new ORPCError("FORBIDDEN", { message: "Only the claiming reviewer can submit a verdict" });
      }

      throw new ORPCError("BAD_REQUEST", { message: "Request must be in claimed status" });
    }

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "reviewer_admin",
      action: "verdict_submitted",
      notes: input.notes ?? null,
      reviewerSnapshotFirstName: profile.firstName,
      reviewerSnapshotLastName: profile.lastName,
      reviewerSnapshotTitle: profile.title,
      reviewerPublicProfileUrl: profile.publicProfileUrl,
    });

    try {
      const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, updated.userId)).limit(1);

      if (userData?.email) {
        const reviewerName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
        await sendVerdictAwaitingFinalApprovalEmail({
          to: userData.email,
          itemLabel: updated.itemLabel,
          sectionType: updated.sectionType,
          reviewerName,
          verificationDashboardUrl: `${env.APP_URL}/dashboard/verification`,
        });
      }
    } catch {
      // Email failures should not block the main flow
    }

    return updated;
  },

  // --- Admin: Skill Verdict Admin procedures ---

  listExperienceQueue: async (input: AdminVerificationListInput) => {
    const needsUserJoin = Boolean(input.query);
    const { rows, total, totalUnfiltered } = await fetchPaginatedVerificationRequestRows(input, {
      baseConditions: [eq(verificationRequests.status, "pending"), eq(verificationRequests.sectionType, "experience")],
      includeStatuses: false,
      fetchRows: async (filteredWhere, limit, offset) => {
        const rows = await selectVerificationRequestRows(
          {
            id: verificationRequests.id,
            userId: verificationRequests.userId,
            resumeId: verificationRequests.resumeId,
            sectionType: verificationRequests.sectionType,
            itemId: verificationRequests.itemId,
            itemLabel: verificationRequests.itemLabel,
            status: verificationRequests.status,
            method: verificationRequests.method,
            submittedAt: verificationRequests.submittedAt,
          },
          filteredWhere,
          desc(verificationRequests.submittedAt),
          limit,
          offset,
          needsUserJoin,
        );
        return rows as ExperienceRequestRow[];
      },
    });

    const items = await enrichExperienceRequests(rows);
    return toPaginatedResult(items, total, totalUnfiltered, input);
  },

  listExperienceHistory: async (input: AdminVerificationListInput) => {
    const needsUserJoin = Boolean(input.query);
    const statusCondition =
      input.statuses && input.statuses.length > 0
        ? inArray(verificationRequests.status, input.statuses)
        : inArray(verificationRequests.status, [...FINAL_STATUSES]);

    const { rows, total, totalUnfiltered } = await fetchPaginatedVerificationRequestRows(input, {
      baseConditions: [eq(verificationRequests.sectionType, "experience"), statusCondition],
      includeStatuses: false,
      fetchRows: async (filteredWhere, limit, offset) => {
        const rows = await selectVerificationRequestRows(
          {
            id: verificationRequests.id,
            userId: verificationRequests.userId,
            resumeId: verificationRequests.resumeId,
            sectionType: verificationRequests.sectionType,
            itemId: verificationRequests.itemId,
            itemLabel: verificationRequests.itemLabel,
            status: verificationRequests.status,
            method: verificationRequests.method,
            submittedAt: verificationRequests.submittedAt,
            resolvedAt: verificationRequests.resolvedAt,
            reviewerNote: verificationRequests.reviewerNote,
          },
          filteredWhere,
          desc(verificationRequests.resolvedAt),
          limit,
          offset,
          needsUserJoin,
        );
        return rows as ExperienceRequestRow[];
      },
    });

    if (rows.length === 0) {
      return toPaginatedResult([], total, totalUnfiltered, input);
    }

    const enriched = await enrichExperienceRequests(rows);
    const attribution = await buildDirectAdminReviewAttributionMap(rows.map((r) => r.id));
    const items = attachDirectAdminReviewAttribution(enriched, attribution);
    return toPaginatedResult(items, total, totalUnfiltered, input);
  },

  reviewExperience: async (input: {
    requestId: string;
    adminId: string;
    action: "verified" | "rejected" | "issue";
    notes?: string;
  }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        sectionType: verificationRequests.sectionType,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.status !== "pending" || request.sectionType !== "experience") {
      throw new ORPCError("BAD_REQUEST", { message: "Request must be a pending experience request" });
    }

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: input.action,
        resolvedAt: new Date(),
        reviewerNote: input.notes ?? null,
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    const metadataAction = input.action === "issue" ? ("flagged" as const) : input.action;

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: metadataAction,
      notes: input.notes ?? null,
    });

    if (isFinalStatus(input.action)) {
      await sendFinalStatusEmail(
        { userId: request.userId!, itemLabel: request.itemLabel!, sectionType: request.sectionType! },
        input.action,
      );
    }

    return updated!;
  },

  listPendingVerdicts: async (input: AdminPendingVerdictsListInput) => {
    const { page, pageSize } = input;
    const offset = (page - 1) * pageSize;
    const baseWhere = eq(verificationRequests.status, "verdict_pending");
    const optionalFilters = buildPendingVerdictsListFilters(input);
    const filteredWhere = optionalFilters.length > 0 ? and(baseWhere, ...optionalFilters) : baseWhere;
    const needsUserJoin = Boolean(input.query);

    const { total, totalUnfiltered } = await countVerificationRequests(baseWhere, filteredWhere, needsUserJoin);

    if (total === 0) {
      return toPaginatedResult([], 0, totalUnfiltered, input);
    }

    const baseQuery = db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        submittedAt: verificationRequests.submittedAt,
        proposedVerdict: verificationRequests.proposedVerdict,
        reviewerNote: verificationRequests.reviewerNote,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
        claimedByAdminId: verificationRequests.claimedByAdminId,
      })
      .from(verificationRequests);

    const requests = await (
      needsUserJoin ? baseQuery.innerJoin(user, eq(verificationRequests.userId, user.id)) : baseQuery
    )
      .where(filteredWhere)
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(pageSize)
      .offset(offset);

    if (requests.length === 0) {
      return toPaginatedResult([], total, totalUnfiltered, input);
    }

    const requestIds = requests.map((r) => r.id);
    const reviewerAdminIds = [
      ...new Set(requests.map((r) => r.claimedByAdminId).filter((id): id is string => id != null)),
    ];

    const reviewerProfileRows =
      reviewerAdminIds.length > 0
        ? await db
            .select({
              adminId: reviewerProfiles.adminId,
              reviewerSkills: reviewerProfiles.reviewerSkills,
            })
            .from(reviewerProfiles)
            .where(inArray(reviewerProfiles.adminId, reviewerAdminIds))
        : [];

    const reviewerSkillsByAdminId = new Map(reviewerProfileRows.map((row) => [row.adminId, row.reviewerSkills]));

    const metadataRows = await db
      .select({
        verificationRequestId: verificationMetadata.verificationRequestId,
        reviewerSnapshotFirstName: verificationMetadata.reviewerSnapshotFirstName,
        reviewerSnapshotLastName: verificationMetadata.reviewerSnapshotLastName,
        reviewerSnapshotTitle: verificationMetadata.reviewerSnapshotTitle,
        reviewerPublicProfileUrl: verificationMetadata.reviewerPublicProfileUrl,
        notes: verificationMetadata.notes,
        actedAt: verificationMetadata.actedAt,
      })
      .from(verificationMetadata)
      .where(
        and(
          inArray(verificationMetadata.verificationRequestId, requestIds),
          eq(verificationMetadata.action, "verdict_submitted"),
        ),
      )
      .orderBy(desc(verificationMetadata.actedAt));

    const verdictMetadataByRequestId = new Map<string, (typeof metadataRows)[number]>();
    for (const metadata of metadataRows) {
      if (!verdictMetadataByRequestId.has(metadata.verificationRequestId)) {
        verdictMetadataByRequestId.set(metadata.verificationRequestId, metadata);
      }
    }

    const enriched = await enrichSkillProjectRequests(requests);

    const claimedByAdminIdByRequestId = new Map(requests.map((r) => [r.id, r.claimedByAdminId ?? null]));

    return toPaginatedResult(
      enriched.map((item) => {
        const metadata = verdictMetadataByRequestId.get(item.id);
        const reviewerName = metadata
          ? [metadata.reviewerSnapshotFirstName, metadata.reviewerSnapshotLastName].filter(Boolean).join(" ")
          : null;
        const reviewerAdminId = claimedByAdminIdByRequestId.get(item.id) ?? null;

        return {
          ...item,
          reviewerName,
          reviewerTitle: metadata?.reviewerSnapshotTitle ?? null,
          reviewerPublicProfileUrl: metadata?.reviewerPublicProfileUrl ?? null,
          reviewerAdminId,
          reviewerSkills: reviewerAdminId ? (reviewerSkillsByAdminId.get(reviewerAdminId) ?? []) : [],
          verdictNotes: metadata?.notes ?? item.reviewerNote,
          verdictSubmittedAt: metadata?.actedAt ?? null,
        };
      }),
      total,
      totalUnfiltered,
      input,
    );
  },

  confirmVerdict: async (input: { requestId: string; adminId: string }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
        proposedVerdict: verificationRequests.proposedVerdict,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.status !== "verdict_pending") {
      throw new ORPCError("BAD_REQUEST", { message: "Request must be in verdict_pending status" });
    }

    if (!request.proposedVerdict) {
      throw new ORPCError("BAD_REQUEST", { message: "Request is missing a proposed verdict" });
    }

    const finalStatus = request.proposedVerdict;

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: finalStatus,
        resolvedAt: new Date(),
      })
      .where(and(eq(verificationRequests.id, input.requestId), eq(verificationRequests.status, "verdict_pending")))
      .returning({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
        proposedVerdict: verificationRequests.proposedVerdict,
      });

    if (!updated) {
      throw new ORPCError("CONFLICT", { message: "Verdict was already finalized" });
    }

    const attributionSnapshot =
      finalStatus === "verified" ? await getReviewerAttributionSnapshot(input.requestId) : null;

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: verdictToMetadataAction(finalStatus),
      reviewerSnapshotFirstName: attributionSnapshot?.reviewerSnapshotFirstName ?? null,
      reviewerSnapshotLastName: attributionSnapshot?.reviewerSnapshotLastName ?? null,
      reviewerSnapshotTitle: attributionSnapshot?.reviewerSnapshotTitle ?? null,
      reviewerPublicProfileUrl: attributionSnapshot?.reviewerPublicProfileUrl ?? null,
    });

    await sendFinalStatusEmail(
      { userId: updated.userId, itemLabel: updated.itemLabel, sectionType: updated.sectionType },
      finalStatus,
    );

    return updated;
  },

  overrideVerdict: async (input: {
    requestId: string;
    adminId: string;
    action: "verified" | "rejected" | "issue";
    reason: string;
  }) => {
    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: input.action,
        resolvedAt: new Date(),
      })
      .where(and(eq(verificationRequests.id, input.requestId), eq(verificationRequests.status, "verdict_pending")))
      .returning({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
      });

    if (!updated) {
      const [existing] = await db
        .select({ id: verificationRequests.id, status: verificationRequests.status })
        .from(verificationRequests)
        .where(eq(verificationRequests.id, input.requestId))
        .limit(1);

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
      }

      if (existing.status !== "verdict_pending") {
        throw new ORPCError("BAD_REQUEST", { message: "Request must be in verdict_pending status" });
      }

      throw new ORPCError("CONFLICT", { message: "Verdict was already finalized" });
    }

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: "overridden",
      notes: input.reason,
    });

    if (isFinalStatus(input.action)) {
      await sendFinalStatusEmail(
        { userId: updated.userId, itemLabel: updated.itemLabel, sectionType: updated.sectionType },
        input.action,
      );
    }

    return updated;
  },

  cancelIdentity: async (userId: string) => {
    const [request] = await db
      .select({ id: verificationRequests.id, status: verificationRequests.status })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.userId, userId),
          eq(verificationRequests.sectionType, "identity"),
          eq(verificationRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", {
        message: "No cancellable identity verification request found.",
      });
    }

    await db.delete(verificationRequests).where(eq(verificationRequests.id, request.id));
  },

  listIdentityQueue: async (input: AdminVerificationListInput) => {
    const needsUserJoin = Boolean(input.query);
    const { rows, total, totalUnfiltered } = await fetchPaginatedVerificationRequestRows(input, {
      baseConditions: [eq(verificationRequests.status, "pending"), eq(verificationRequests.sectionType, "identity")],
      includeStatuses: false,
      fetchRows: async (filteredWhere, limit, offset) => {
        const rows = await selectVerificationRequestRows(
          {
            id: verificationRequests.id,
            userId: verificationRequests.userId,
            resumeId: verificationRequests.resumeId,
            sectionType: verificationRequests.sectionType,
            itemId: verificationRequests.itemId,
            itemLabel: verificationRequests.itemLabel,
            status: verificationRequests.status,
            method: verificationRequests.method,
            submittedAt: verificationRequests.submittedAt,
            calendarLinkSentAt: verificationRequests.calendarLinkSentAt,
          },
          filteredWhere,
          desc(verificationRequests.submittedAt),
          limit,
          offset,
          needsUserJoin,
        );
        return rows as IdentityRequestRow[];
      },
    });

    const items = await enrichIdentityRequests(rows);
    return toPaginatedResult(items, total, totalUnfiltered, input);
  },

  listIdentityHistory: async (input: AdminVerificationListInput) => {
    const needsUserJoin = Boolean(input.query);
    const statusCondition =
      input.statuses && input.statuses.length > 0
        ? inArray(verificationRequests.status, input.statuses)
        : inArray(verificationRequests.status, [...FINAL_STATUSES]);

    const { rows, total, totalUnfiltered } = await fetchPaginatedVerificationRequestRows(input, {
      baseConditions: [eq(verificationRequests.sectionType, "identity"), statusCondition],
      includeStatuses: false,
      fetchRows: async (filteredWhere, limit, offset) => {
        const rows = await selectVerificationRequestRows(
          {
            id: verificationRequests.id,
            userId: verificationRequests.userId,
            resumeId: verificationRequests.resumeId,
            sectionType: verificationRequests.sectionType,
            itemId: verificationRequests.itemId,
            itemLabel: verificationRequests.itemLabel,
            status: verificationRequests.status,
            method: verificationRequests.method,
            submittedAt: verificationRequests.submittedAt,
            calendarLinkSentAt: verificationRequests.calendarLinkSentAt,
            resolvedAt: verificationRequests.resolvedAt,
            reviewerNote: verificationRequests.reviewerNote,
          },
          filteredWhere,
          desc(verificationRequests.resolvedAt),
          limit,
          offset,
          needsUserJoin,
        );
        return rows as IdentityRequestRow[];
      },
    });

    if (rows.length === 0) {
      return toPaginatedResult([], total, totalUnfiltered, input);
    }

    const enriched = await enrichIdentityRequests(rows);
    const attribution = await buildDirectAdminReviewAttributionMap(rows.map((r) => r.id));
    const items = attachDirectAdminReviewAttribution(enriched, attribution);
    return toPaginatedResult(items, total, totalUnfiltered, input);
  },

  reviewIdentity: async (input: {
    requestId: string;
    adminId: string;
    action: "verified" | "rejected" | "issue";
    notes?: string;
  }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        sectionType: verificationRequests.sectionType,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.status !== "pending" || request.sectionType !== "identity") {
      throw new ORPCError("BAD_REQUEST", { message: "Request must be a pending identity request" });
    }

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: input.action,
        resolvedAt: new Date(),
        reviewerNote: input.notes ?? null,
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    const metadataAction = input.action === "issue" ? ("flagged" as const) : input.action;

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: metadataAction,
      notes: input.notes ?? null,
    });

    if (isFinalStatus(input.action)) {
      await sendFinalStatusEmail(
        { userId: request.userId, itemLabel: request.itemLabel, sectionType: request.sectionType },
        input.action,
      );
    }

    return updated!;
  },

  // --- Admin: Document access ---

  getDocuments: async (requestId: string) => {
    const [request] = await db
      .select({ id: verificationRequests.id })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    const docs = await db
      .select({
        id: verificationDocuments.id,
        fileUrl: verificationDocuments.fileUrl,
        documentType: verificationDocuments.documentType,
        uploadedAt: verificationDocuments.uploadedAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.verificationRequestId, requestId));

    return docs.map((doc) => ({
      ...doc,
      fileUrl: mapDocumentToPublicUrl(doc),
    }));
  },

  downloadDocument: async (documentId: string) => {
    const [doc] = await db
      .select({
        id: verificationDocuments.id,
        fileUrl: verificationDocuments.fileUrl,
        documentType: verificationDocuments.documentType,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      throw new ORPCError("NOT_FOUND", { message: "Document not found" });
    }

    if (isExternalVerificationLink(doc.documentType)) {
      throw new ORPCError("BAD_REQUEST", { message: "External links cannot be downloaded" });
    }

    const storageService = getStorageService();
    const storageKey = toStorageKey(doc.fileUrl);
    const result = await storageService.read(storageKey);

    if (!result) {
      throw new ORPCError("NOT_FOUND", { message: "Document file not found in storage" });
    }

    return {
      id: doc.id,
      fileUrl: mapDocumentToPublicUrl(doc),
      documentType: doc.documentType,
      contentType: result.contentType ?? "application/octet-stream",
      size: result.size,
      data: result.data,
    };
  },

  downloadReviewerDocument: async (input: { requestId: string; documentId: string; adminId: string }) => {
    await assertReviewerDocumentAccess(input.requestId, input.adminId);

    const [doc] = await db
      .select({
        id: verificationDocuments.id,
        verificationRequestId: verificationDocuments.verificationRequestId,
        fileUrl: verificationDocuments.fileUrl,
        documentType: verificationDocuments.documentType,
      })
      .from(verificationDocuments)
      .where(
        and(
          eq(verificationDocuments.id, input.documentId),
          eq(verificationDocuments.verificationRequestId, input.requestId),
        ),
      )
      .limit(1);

    if (!doc) {
      throw new ORPCError("NOT_FOUND", { message: "Document not found" });
    }

    if (isExternalVerificationLink(doc.documentType)) {
      throw new ORPCError("BAD_REQUEST", { message: "External links cannot be downloaded" });
    }

    const storageService = getStorageService();
    const storageKey = toStorageKey(doc.fileUrl);
    const result = await storageService.read(storageKey);

    if (!result) {
      throw new ORPCError("NOT_FOUND", { message: "Document file not found in storage" });
    }

    return {
      id: doc.id,
      documentType: doc.documentType,
      contentType: result.contentType ?? "application/octet-stream",
      size: result.size,
      data: result.data,
    };
  },
};
