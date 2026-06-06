import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";

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
  sendIdentityVerificationRequestedEmail,
  sendSkillAssessmentAcceptedEmail,
  sendVerificationStatusEmail,
} from "@/integrations/email/verification";
import { env } from "@/utils/env";

import { getStorageService, uploadFile } from "./storage";

const ACTIVE_STATUSES = ["pending", "claimed", "verdict_pending", "verified"] as const;
const FINAL_STATUSES = ["verified", "rejected", "issue"] as const;

/** Shown on badges as "pending" clock; hidden from public resume + non-owner PDF. */
const PENDING_LIKE_STATUSES = new Set<string>(["pending", "claimed", "verdict_pending"]);

function stripPendingLikeStatuses<T extends { status: string }>(rows: T[]): T[] {
  return rows.filter((r) => !PENDING_LIKE_STATUSES.has(r.status));
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
  claimedByAdminId?: string | null;
  proposedVerdict?: "verified" | "rejected" | "issue" | null;
  reviewerNote?: string | null;
  assessmentAcceptedAt?: Date | null;
};

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

    return {
      id: r.id,
      sectionType: r.sectionType,
      itemId: r.itemId,
      itemLabel: r.itemLabel,
      status: r.status,
      submittedAt: r.submittedAt,
      claimedAt: r.claimedAt ?? null,
      proposedVerdict: r.proposedVerdict ?? null,
      reviewerNote: r.reviewerNote ?? null,
      assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
      assessmentInstructionsUrl: instructionsDoc?.fileUrl ?? null,
      user: applicantUser,
      resume: applicantResume,
      documents: requestDocs.map((d) => ({
        id: d.id,
        fileUrl: d.fileUrl,
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    };
  });
}

async function attachAssessmentFields<
  T extends { id: string; status: string; sectionType: string; assessmentAcceptedAt?: Date | null },
>(rows: T[]) {
  const inAssessmentIds = rows
    .filter((r) => r.status === "claimed" && (r.sectionType === "skill" || r.sectionType === "project"))
    .map((r) => r.id);

  if (inAssessmentIds.length === 0) {
    return rows.map((r) => ({
      ...r,
      assessmentInstructionsUrl: null as string | null,
      assessmentAcceptedAt: r.assessmentAcceptedAt ?? null,
    }));
  }

  const docs = await db
    .select({
      verificationRequestId: verificationDocuments.verificationRequestId,
      fileUrl: verificationDocuments.fileUrl,
    })
    .from(verificationDocuments)
    .where(
      and(
        inArray(verificationDocuments.verificationRequestId, inAssessmentIds),
        eq(verificationDocuments.documentType, "assessment_instructions"),
      ),
    );

  const instructionsByRequestId = new Map(docs.map((d) => [d.verificationRequestId, d.fileUrl]));

  return rows.map((r) => ({
    ...r,
    assessmentInstructionsUrl:
      r.status === "claimed" && (r.sectionType === "skill" || r.sectionType === "project")
        ? (instructionsByRequestId.get(r.id) ?? null)
        : null,
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

async function buildVerifierLabelMap(verificationRequestIds: string[]) {
  if (verificationRequestIds.length === 0) {
    return new Map<string, string>();
  }

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
    verifierByRequestId.set(metadata.verificationRequestId, getVerificationActorLabel(metadata));
  }

  return verifierByRequestId;
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
    await guardActiveRequest(input.userId, input.resumeId, input.itemId);

    const [request] = await db
      .insert(verificationRequests)
      .values({
        userId: input.userId,
        resumeId: input.resumeId,
        sectionType: "skill",
        itemId: input.itemId,
        itemLabel: input.itemLabel,
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
        fileUrl: result.url,
        documentType: input.documentType,
      })
      .returning();

    return doc!;
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
      .limit(1);

    if (!metadata?.reviewerSnapshotFirstName) {
      return { type: "reviewer" as const, label: "Verified", profileUrl: null };
    }

    const displayName = [metadata.reviewerSnapshotFirstName, metadata.reviewerSnapshotLastName]
      .filter(Boolean)
      .join(" ");

    const label = metadata.reviewerSnapshotTitle
      ? `${displayName} \u2014 ${metadata.reviewerSnapshotTitle}`
      : displayName;

    return {
      type: "reviewer" as const,
      label,
      profileUrl: metadata.reviewerPublicProfileUrl,
    };
  },

  // --- Admin: Reviewer procedures ---

  listQueue: async () => {
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

    return await enrichSkillProjectRequests(requests);
  },

  acceptCase: async (input: { requestId: string; adminId: string; file: File; message?: string }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        claimedByAdminId: verificationRequests.claimedByAdminId,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: "Request is not pending" });
    }

    if (request.claimedByAdminId) {
      throw new ORPCError("CONFLICT", { message: "Request is already claimed" });
    }

    if (!request.resumeId) {
      throw new ORPCError("BAD_REQUEST", { message: "Request is missing a resume" });
    }

    const [profile] = await db
      .select()
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, input.adminId))
      .limit(1);

    if (!profile) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    const fileBuffer = await input.file.arrayBuffer();
    const data = new Uint8Array(fileBuffer);

    const uploadResult = await uploadFile({
      userId: request.userId,
      resumeId: request.resumeId,
      itemId: request.itemId,
      data,
      contentType: input.file.type || "application/octet-stream",
      type: "document",
    });

    const acceptedAt = new Date();

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: "claimed",
        claimedAt: acceptedAt,
        claimedByAdminId: input.adminId,
        assessmentAcceptedAt: acceptedAt,
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    await db.insert(verificationDocuments).values({
      verificationRequestId: input.requestId,
      fileUrl: uploadResult.url,
      documentType: "assessment_instructions",
    });

    await db.insert(verificationMetadata).values({
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

    try {
      const [userData] = await db.select({ email: user.email }).from(user).where(eq(user.id, request.userId)).limit(1);

      if (userData?.email) {
        const reviewerName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
        await sendSkillAssessmentAcceptedEmail({
          to: userData.email,
          itemLabel: request.itemLabel,
          reviewerName,
          message: input.message,
          instructionsUrl: uploadResult.url,
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

    return await enrichSkillProjectRequests(requests);
  },

  submitVerdict: async (input: {
    requestId: string;
    adminId: string;
    verdict: "verified" | "rejected" | "issue";
    notes?: string;
  }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        claimedByAdminId: verificationRequests.claimedByAdminId,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Verification request not found" });
    }

    if (request.status !== "claimed") {
      throw new ORPCError("BAD_REQUEST", { message: "Request must be in claimed status" });
    }

    if (request.claimedByAdminId !== input.adminId) {
      throw new ORPCError("FORBIDDEN", { message: "Only the claiming reviewer can submit a verdict" });
    }

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
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

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

    return updated!;
  },

  // --- Admin: Skill Verdict Admin procedures ---

  listExperienceQueue: async () => {
    const requests = await db
      .select({
        id: verificationRequests.id,
        userId: verificationRequests.userId,
        resumeId: verificationRequests.resumeId,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        method: verificationRequests.method,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.status, "pending"), eq(verificationRequests.sectionType, "experience")))
      .orderBy(desc(verificationRequests.submittedAt));

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
        user: applicantUser,
        resume: applicantResume,
        documents: (docsByRequestId.get(r.id) ?? []).map((d) => ({
          id: d.id,
          fileUrl: d.fileUrl,
          documentType: d.documentType,
          uploadedAt: d.uploadedAt,
        })),
      };
    });
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

  listPendingVerdicts: async () => {
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
        proposedVerdict: verificationRequests.proposedVerdict,
        reviewerNote: verificationRequests.reviewerNote,
        assessmentAcceptedAt: verificationRequests.assessmentAcceptedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.status, "verdict_pending"))
      .orderBy(desc(verificationRequests.submittedAt));

    if (requests.length === 0) return [];

    const requestIds = requests.map((r) => r.id);
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

    return enriched.map((item) => {
      const metadata = verdictMetadataByRequestId.get(item.id);
      const reviewerName = metadata
        ? [metadata.reviewerSnapshotFirstName, metadata.reviewerSnapshotLastName].filter(Boolean).join(" ")
        : null;

      return {
        ...item,
        reviewerName,
        reviewerTitle: metadata?.reviewerSnapshotTitle ?? null,
        reviewerPublicProfileUrl: metadata?.reviewerPublicProfileUrl ?? null,
        verdictNotes: metadata?.notes ?? item.reviewerNote,
      };
    });
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
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: verdictToMetadataAction(finalStatus),
    });

    await sendFinalStatusEmail(
      { userId: request.userId, itemLabel: request.itemLabel, sectionType: request.sectionType },
      finalStatus,
    );

    return updated!;
  },

  overrideVerdict: async (input: {
    requestId: string;
    adminId: string;
    action: "verified" | "rejected" | "issue";
    reason: string;
  }) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
        userId: verificationRequests.userId,
        itemLabel: verificationRequests.itemLabel,
        sectionType: verificationRequests.sectionType,
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

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: input.action,
        resolvedAt: new Date(),
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: "overridden",
      notes: input.reason,
    });

    if (isFinalStatus(input.action)) {
      await sendFinalStatusEmail(
        { userId: request.userId, itemLabel: request.itemLabel, sectionType: request.sectionType },
        input.action,
      );
    }

    return updated!;
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

  listIdentityQueue: async () => {
    const requests = await db
      .select({
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
      })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.status, "pending"), eq(verificationRequests.sectionType, "identity")))
      .orderBy(desc(verificationRequests.submittedAt));

    if (requests.length === 0) return [];

    const requestIds = requests.map((r) => r.id);
    const userIds = [...new Set(requests.map((r) => r.userId))];

    const users = userIds.length > 0 ? await db.select().from(user).where(inArray(user.id, userIds)) : [];

    // Identity requests have resumeId: null — fetch latest resume per user for context
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
      calendarLinkSentAt: r.calendarLinkSentAt,
      user: userById.get(r.userId) ?? null,
      resume: latestResumeByUserId.get(r.userId) ?? null,
      documents: (docsByRequestId.get(r.id) ?? []).map((d) => ({
        id: d.id,
        fileUrl: d.fileUrl,
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    }));
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

    return await db
      .select({
        id: verificationDocuments.id,
        fileUrl: verificationDocuments.fileUrl,
        documentType: verificationDocuments.documentType,
        uploadedAt: verificationDocuments.uploadedAt,
      })
      .from(verificationDocuments)
      .where(eq(verificationDocuments.verificationRequestId, requestId));
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

    const storageService = getStorageService();
    const result = await storageService.read(doc.fileUrl);

    if (!result) {
      throw new ORPCError("NOT_FOUND", { message: "Document file not found in storage" });
    }

    return {
      id: doc.id,
      fileUrl: doc.fileUrl,
      documentType: doc.documentType,
      contentType: result.contentType ?? "application/octet-stream",
      size: result.size,
      data: result.data,
    };
  },
};
