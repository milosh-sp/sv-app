import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/integrations/drizzle/client";
import { sendVerificationStatusEmail } from "@/integrations/email/verification";
import {
  resumeVerificationSettings,
  reviewerProfiles,
  user,
  verificationDocuments,
  verificationMetadata,
  verificationRequests,
} from "@/integrations/drizzle/schema";

import { getStorageService, uploadFile } from "./storage";

const ACTIVE_STATUSES = ["pending", "claimed", "verdict_pending", "approved"] as const;
const FINAL_STATUSES = ["approved", "rejected", "issue"] as const;

async function sendFinalStatusEmail(
  request: { userId: string; itemLabel: string; sectionType: string },
  status: "approved" | "rejected" | "issue",
) {
  try {
    const [userData] = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, request.userId))
      .limit(1);

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

function isFinalStatus(status: string): status is (typeof FINAL_STATUSES)[number] {
  return (FINAL_STATUSES as readonly string[]).includes(status);
}

async function guardActiveRequest(userId: string, resumeId: string | null, itemId: string) {
  const conditions = [
    eq(verificationRequests.userId, userId),
    eq(verificationRequests.itemId, itemId),
    inArray(verificationRequests.status, [...ACTIVE_STATUSES]),
  ];

  if (resumeId) {
    conditions.push(eq(verificationRequests.resumeId, resumeId));
  }

  const [existing] = await db
    .select({ id: verificationRequests.id, status: verificationRequests.status })
    .from(verificationRequests)
    .where(and(...conditions))
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

    return request!;
  },

  getAllStatuses: async (userId: string) => {
    return await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        badgeVisible: verificationRequests.badgeVisible,
        submittedAt: verificationRequests.submittedAt,
        resumeId: verificationRequests.resumeId,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.submittedAt));
  },

  getIdentityStatus: async (userId: string) => {
    const [request] = await db
      .select({
        id: verificationRequests.id,
        status: verificationRequests.status,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.userId, userId),
          eq(verificationRequests.sectionType, "identity"),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);

    return request ?? null;
  },

  getStatus: async (input: { userId: string; resumeId: string }) => {
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
      .where(
        and(
          eq(verificationRequests.userId, input.userId),
          eq(verificationRequests.resumeId, input.resumeId),
        ),
      );
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

  getHistory: async (input: { userId: string; itemId: string }) => {
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
          eq(verificationRequests.itemId, input.itemId),
        ),
      )
      .orderBy(desc(verificationRequests.submittedAt));

    return requests;
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

    if (request.status !== "approved") {
      throw new ORPCError("BAD_REQUEST", { message: "Badge visibility can only be toggled for approved requests" });
    }

    const [updated] = await db
      .update(verificationRequests)
      .set({ badgeVisible: input.visible })
      .where(eq(verificationRequests.id, input.requestId))
      .returning({ id: verificationRequests.id, badgeVisible: verificationRequests.badgeVisible });

    return updated!;
  },

  toggleTimeline: async (input: { userId: string; resumeId: string; show: boolean }) => {
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

    if (!request || request.status !== "approved") {
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
          inArray(verificationMetadata.action, ["approved", "overridden"]),
        ),
      )
      .limit(1);

    if (!metadata?.reviewerSnapshotFirstName) {
      return { type: "reviewer" as const, label: "Verified", profileUrl: null };
    }

    const displayName = [
      metadata.reviewerSnapshotFirstName,
      metadata.reviewerSnapshotLastName,
    ]
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
    return await db
      .select({
        id: verificationRequests.id,
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
      );
  },

  claimCase: async (input: { requestId: string; adminId: string }) => {
    const [request] = await db
      .select({ id: verificationRequests.id, status: verificationRequests.status, claimedByAdminId: verificationRequests.claimedByAdminId })
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

    const [updated] = await db
      .update(verificationRequests)
      .set({
        status: "claimed",
        claimedAt: new Date(),
        claimedByAdminId: input.adminId,
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "reviewer_admin",
      action: "claimed",
    });

    return updated!;
  },

  listMyCases: async (adminId: string) => {
    return await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        claimedAt: verificationRequests.claimedAt,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.claimedByAdminId, adminId),
          inArray(verificationRequests.status, ["claimed", "verdict_pending"]),
        ),
      );
  },

  submitVerdict: async (input: {
    requestId: string;
    adminId: string;
    verdict: "approved" | "rejected" | "issue";
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
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        method: verificationRequests.method,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.status, "pending"),
          eq(verificationRequests.sectionType, "experience"),
        ),
      );

    const requestIds = requests.map((r) => r.id);

    if (requestIds.length === 0) return requests.map((r) => ({ ...r, documents: [] as { id: string; fileUrl: string; documentType: string; uploadedAt: Date }[] }));

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

    return requests.map((r) => ({
      ...r,
      documents: (docsByRequestId.get(r.id) ?? []).map((d) => ({
        id: d.id,
        fileUrl: d.fileUrl,
        documentType: d.documentType,
        uploadedAt: d.uploadedAt,
      })),
    }));
  },

  reviewExperience: async (input: {
    requestId: string;
    adminId: string;
    action: "approved" | "rejected" | "issue";
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

    const metadataAction = input.action === "issue" ? "flagged" as const : input.action;

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
    return await db
      .select({
        id: verificationRequests.id,
        sectionType: verificationRequests.sectionType,
        itemId: verificationRequests.itemId,
        itemLabel: verificationRequests.itemLabel,
        status: verificationRequests.status,
        submittedAt: verificationRequests.submittedAt,
      })
      .from(verificationRequests)
      .where(eq(verificationRequests.status, "verdict_pending"));
  },

  confirmVerdict: async (input: { requestId: string; adminId: string }) => {
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
        status: "approved",
        resolvedAt: new Date(),
      })
      .where(eq(verificationRequests.id, input.requestId))
      .returning();

    await db.insert(verificationMetadata).values({
      verificationRequestId: input.requestId,
      adminId: input.adminId,
      adminRole: "skill_verdict_admin",
      action: "approved",
    });

    await sendFinalStatusEmail(
      { userId: request.userId, itemLabel: request.itemLabel, sectionType: request.sectionType },
      "approved",
    );

    return updated!;
  },

  overrideVerdict: async (input: {
    requestId: string;
    adminId: string;
    action: "approved" | "rejected" | "issue";
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
