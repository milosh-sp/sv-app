import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/integrations/drizzle/client";
import { reviewerProfileChangeRequests, reviewerProfiles } from "@/integrations/drizzle/schema";
import { normalizeReviewerSkills } from "@/utils/verification/skills";

export const reviewerProfileService = {
  create: async (input: {
    adminId: string;
    firstName: string;
    lastName: string;
    title: string;
    reviewerSkills?: string[];
  }) => {
    const publicProfileUrl = `/reviewer/${input.adminId}`;

    const [existing] = await db
      .select({ id: reviewerProfiles.id })
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, input.adminId))
      .limit(1);

    if (existing) {
      throw new ORPCError("CONFLICT", { message: "A reviewer profile already exists for this admin" });
    }

    const [profile] = await db
      .insert(reviewerProfiles)
      .values({
        adminId: input.adminId,
        firstName: input.firstName,
        lastName: input.lastName,
        title: input.title,
        publicProfileUrl,
        reviewerSkills: normalizeReviewerSkills(input.reviewerSkills ?? []),
      })
      .returning();

    return profile!;
  },

  getByAdminIdOrNull: async (adminId: string) => {
    const [profile] = await db.select().from(reviewerProfiles).where(eq(reviewerProfiles.adminId, adminId)).limit(1);
    return profile ?? null;
  },

  updateDirect: async (input: {
    adminId: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    reviewerSkills?: string[];
  }) => {
    const updates: Record<string, unknown> = {};
    if (input.firstName !== undefined) updates.firstName = input.firstName;
    if (input.lastName !== undefined) updates.lastName = input.lastName;
    if (input.title !== undefined) updates.title = input.title;
    if (input.reviewerSkills !== undefined) updates.reviewerSkills = normalizeReviewerSkills(input.reviewerSkills);

    if (Object.keys(updates).length === 0) {
      throw new ORPCError("BAD_REQUEST", { message: "No fields to update" });
    }

    const [updated] = await db
      .update(reviewerProfiles)
      .set(updates)
      .where(eq(reviewerProfiles.adminId, input.adminId))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    return updated;
  },

  getByAdminId: async (adminId: string) => {
    const [profile] = await db.select().from(reviewerProfiles).where(eq(reviewerProfiles.adminId, adminId)).limit(1);

    if (!profile) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    return profile;
  },

  getPublicProfile: async (adminId: string) => {
    const [profile] = await db
      .select({
        firstName: reviewerProfiles.firstName,
        lastName: reviewerProfiles.lastName,
        title: reviewerProfiles.title,
        publicProfileUrl: reviewerProfiles.publicProfileUrl,
        createdAt: reviewerProfiles.createdAt,
      })
      .from(reviewerProfiles)
      .where(eq(reviewerProfiles.adminId, adminId))
      .limit(1);

    if (!profile) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    return profile;
  },

  giveConsent: async (adminId: string) => {
    const [updated] = await db
      .update(reviewerProfiles)
      .set({
        consentGiven: true,
        consentGivenAt: new Date(),
      })
      .where(eq(reviewerProfiles.adminId, adminId))
      .returning();

    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Reviewer profile not found" });
    }

    return updated;
  },

  requestChange: async (input: { adminId: string; firstName?: string; title?: string }) => {
    if (!input.firstName && !input.title) {
      throw new ORPCError("BAD_REQUEST", { message: "At least one field must be provided" });
    }

    const [pendingRequest] = await db
      .select({ id: reviewerProfileChangeRequests.id })
      .from(reviewerProfileChangeRequests)
      .where(
        and(
          eq(reviewerProfileChangeRequests.adminId, input.adminId),
          eq(reviewerProfileChangeRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (pendingRequest) {
      throw new ORPCError("CONFLICT", { message: "A pending change request already exists" });
    }

    const [request] = await db
      .insert(reviewerProfileChangeRequests)
      .values({
        adminId: input.adminId,
        requestedFirstName: input.firstName ?? null,
        requestedTitle: input.title ?? null,
      })
      .returning();

    return request!;
  },

  getChangeRequestStatus: async (adminId: string) => {
    const [request] = await db
      .select()
      .from(reviewerProfileChangeRequests)
      .where(eq(reviewerProfileChangeRequests.adminId, adminId))
      .orderBy(reviewerProfileChangeRequests.requestedAt)
      .limit(1);

    return request ?? null;
  },

  listChangeRequests: async () => {
    return await db
      .select()
      .from(reviewerProfileChangeRequests)
      .where(eq(reviewerProfileChangeRequests.status, "pending"));
  },

  resolveChangeRequest: async (input: {
    requestId: string;
    action: "approved" | "rejected";
    resolvedByAdminId: string;
    rejectionReason?: string;
  }) => {
    const [request] = await db
      .select()
      .from(reviewerProfileChangeRequests)
      .where(eq(reviewerProfileChangeRequests.id, input.requestId))
      .limit(1);

    if (!request) {
      throw new ORPCError("NOT_FOUND", { message: "Change request not found" });
    }

    if (request.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: "Change request is not pending" });
    }

    const [updated] = await db
      .update(reviewerProfileChangeRequests)
      .set({
        status: input.action,
        resolvedAt: new Date(),
        resolvedByAdminId: input.resolvedByAdminId,
        rejectionReason: input.action === "rejected" ? (input.rejectionReason ?? null) : null,
      })
      .where(eq(reviewerProfileChangeRequests.id, input.requestId))
      .returning();

    if (input.action === "approved") {
      const profileUpdates: Record<string, unknown> = {};
      if (request.requestedFirstName) profileUpdates.firstName = request.requestedFirstName;
      if (request.requestedTitle) profileUpdates.title = request.requestedTitle;

      if (Object.keys(profileUpdates).length > 0) {
        await db.update(reviewerProfiles).set(profileUpdates).where(eq(reviewerProfiles.adminId, request.adminId));
      }
    }

    return updated!;
  },
};
