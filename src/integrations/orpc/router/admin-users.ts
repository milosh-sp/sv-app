import { ORPCError } from "@orpc/client";
import { and, count, desc, eq, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@/integrations/drizzle/client";
import {
  account,
  adminRoleEnum,
  adminRoles,
  apikey,
  resume,
  resumeStatistics,
  session,
  user,
  verificationDocuments,
  verificationRequests,
} from "@/integrations/drizzle/schema";
import { defaultWorkAuthorizationData, type ResumeData, workAuthorizationSchema } from "@/schema/resume/data";

import { skillVerdictAdminProcedure } from "../context";

const listUsersInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  /** Case-insensitive match on name, email, username, display username. */
  query: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim() ?? "";
      return t.length > 0 ? t : undefined;
    }),
  roleFilter: z.enum(["all", "user", "skill_verdict_admin", "reviewer_admin"]).default("all"),
});

function searchOrCondition(query: string) {
  const pattern = `%${query.slice(0, 200)}%`;
  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(user.username, pattern),
    ilike(user.displayUsername, pattern),
  )!;
}

const setUserAdminRoleInputSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.enum(adminRoleEnum.enumValues), z.null()]),
});

const getUserOverviewInputSchema = z.object({
  userId: z.string().uuid(),
});

const RESUME_ITEMS_LIMIT = 8;
const APPROVED_EXPERIENCE_LIMIT = 6;
const UPLOADED_DOCUMENTS_LIMIT = 10;

function resolveLatestWorkAuthorization(
  resumes: Array<{ updatedAt: Date; workAuthorization: ResumeData["workAuthorization"] | null }>,
) {
  if (resumes.length === 0) return null;

  const latest = resumes.reduce(
    (acc, row) => {
      if (!acc || row.updatedAt > acc.updatedAt) return row;
      return acc;
    },
    null as { updatedAt: Date; workAuthorization: ResumeData["workAuthorization"] | null } | null,
  );

  if (!latest?.workAuthorization) return null;

  const parsed = workAuthorizationSchema.safeParse(latest.workAuthorization);
  if (parsed.success) return parsed.data;
  return structuredClone(defaultWorkAuthorizationData);
}

export const adminUsersRouter = {
  listUsers: skillVerdictAdminProcedure.input(listUsersInputSchema).handler(async ({ input }) => {
    const { page, pageSize, query, roleFilter } = input;
    const offset = (page - 1) * pageSize;

    const filters = [];
    if (query) filters.push(searchOrCondition(query));
    if (roleFilter === "user") filters.push(isNull(adminRoles.role));
    if (roleFilter === "skill_verdict_admin") filters.push(eq(adminRoles.role, "skill_verdict_admin"));
    if (roleFilter === "reviewer_admin") filters.push(eq(adminRoles.role, "reviewer_admin"));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
      .select({ total: count() })
      .from(user)
      .leftJoin(adminRoles, eq(user.id, adminRoles.userId))
      .where(where);
    const total = totalRow?.total ?? 0;

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayUsername: user.displayUsername,
        createdAt: user.createdAt,
        adminRole: adminRoles.role,
      })
      .from(user)
      .leftJoin(adminRoles, eq(user.id, adminRoles.userId))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      users: rows,
      total,
      page,
      pageSize,
    };
  }),

  setUserAdminRole: skillVerdictAdminProcedure
    .input(setUserAdminRoleInputSchema)
    .handler(async ({ context, input }) => {
      const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).limit(1);
      if (!target) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      if (input.userId === context.user.id && (input.role === null || input.role === "reviewer_admin")) {
        const [other] = await db
          .select({ userId: adminRoles.userId })
          .from(adminRoles)
          .where(and(eq(adminRoles.role, "skill_verdict_admin"), ne(adminRoles.userId, context.user.id)))
          .limit(1);
        if (!other) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Assign another Skill Verdict Admin before changing your own role.",
          });
        }
      }

      if (input.role === null) {
        await db.delete(adminRoles).where(eq(adminRoles.userId, input.userId));
        return { ok: true as const };
      }

      await db
        .insert(adminRoles)
        .values({ userId: input.userId, role: input.role })
        .onConflictDoUpdate({
          target: adminRoles.userId,
          set: { role: input.role },
        });

      return { ok: true as const };
    }),

  getUserOverview: skillVerdictAdminProcedure.input(getUserOverviewInputSchema).handler(async ({ input }) => {
    const [userRow] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayUsername: user.displayUsername,
        image: user.image,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        adminRole: adminRoles.role,
        adminRoleAssignedAt: adminRoles.createdAt,
      })
      .from(user)
      .leftJoin(adminRoles, eq(user.id, adminRoles.userId))
      .where(eq(user.id, input.userId))
      .limit(1);

    if (!userRow) {
      throw new ORPCError("NOT_FOUND", { message: "User not found" });
    }

    const now = new Date();
    const [
      [totalSessionsRow],
      [activeSessionsRow],
      recentSessionsRows,
      accountRows,
      resumeRows,
      resumeStatisticsRows,
      verificationRows,
      apiKeyRows,
    ] = await Promise.all([
      db.select({ total: count() }).from(session).where(eq(session.userId, input.userId)),
      db
        .select({ total: count() })
        .from(session)
        .where(and(eq(session.userId, input.userId), gt(session.expiresAt, now))),
      db
        .select({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          expiresAt: session.expiresAt,
          createdAt: session.createdAt,
        })
        .from(session)
        .where(eq(session.userId, input.userId))
        .orderBy(desc(session.createdAt))
        .limit(5),
      db
        .select({
          providerId: account.providerId,
        })
        .from(account)
        .where(eq(account.userId, input.userId)),
      db
        .select({
          id: resume.id,
          name: resume.name,
          slug: resume.slug,
          isPublic: resume.isPublic,
          isLocked: resume.isLocked,
          updatedAt: resume.updatedAt,
          workAuthorization: sql<ResumeData["workAuthorization"]>`${resume.data}->'workAuthorization'`,
        })
        .from(resume)
        .where(eq(resume.userId, input.userId)),
      db
        .select({
          views: resumeStatistics.views,
          downloads: resumeStatistics.downloads,
          lastViewedAt: resumeStatistics.lastViewedAt,
          lastDownloadedAt: resumeStatistics.lastDownloadedAt,
        })
        .from(resumeStatistics)
        .innerJoin(resume, eq(resumeStatistics.resumeId, resume.id))
        .where(eq(resume.userId, input.userId)),
      db
        .select({
          id: verificationRequests.id,
          sectionType: verificationRequests.sectionType,
          itemLabel: verificationRequests.itemLabel,
          status: verificationRequests.status,
          method: verificationRequests.method,
          reviewerNote: verificationRequests.reviewerNote,
          submittedAt: verificationRequests.submittedAt,
          resolvedAt: verificationRequests.resolvedAt,
        })
        .from(verificationRequests)
        .where(eq(verificationRequests.userId, input.userId)),
      db
        .select({
          enabled: apikey.enabled,
          requestCount: apikey.requestCount,
          lastRequest: apikey.lastRequest,
        })
        .from(apikey)
        .where(eq(apikey.referenceId, input.userId)),
    ]);

    const providerIds = Array.from(new Set(accountRows.map((row) => row.providerId)));
    const lastResumeUpdatedAt = resumeRows.reduce<Date | null>((latest, row) => {
      if (!latest || row.updatedAt > latest) return row.updatedAt;
      return latest;
    }, null);
    const workAuthorization = resolveLatestWorkAuthorization(resumeRows);
    const sortedResumeItems = [...resumeRows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const resumeItems = sortedResumeItems.slice(0, RESUME_ITEMS_LIMIT);
    const resumeItemsHiddenCount = Math.max(0, sortedResumeItems.length - resumeItems.length);

    const resumeSummary = resumeRows.reduce(
      (acc, row) => {
        if (row.isPublic) acc.publicCount += 1;
        if (row.isLocked) acc.lockedCount += 1;
        return acc;
      },
      { total: resumeRows.length, publicCount: 0, lockedCount: 0 },
    );

    const resumeEngagement = resumeStatisticsRows.reduce(
      (acc, row) => {
        acc.totalViews += row.views;
        acc.totalDownloads += row.downloads;
        if (!acc.lastViewedAt || (row.lastViewedAt && row.lastViewedAt > acc.lastViewedAt)) {
          acc.lastViewedAt = row.lastViewedAt;
        }
        if (!acc.lastDownloadedAt || (row.lastDownloadedAt && row.lastDownloadedAt > acc.lastDownloadedAt)) {
          acc.lastDownloadedAt = row.lastDownloadedAt;
        }
        return acc;
      },
      {
        totalViews: 0,
        totalDownloads: 0,
        lastViewedAt: null as Date | null,
        lastDownloadedAt: null as Date | null,
      },
    );

    const verificationSummary = verificationRows.reduce(
      (acc, row) => {
        if (row.status === "pending") acc.pending += 1;
        if (row.status === "claimed") acc.claimed += 1;
        if (row.status === "verdict_pending") acc.verdictPending += 1;
        if (row.status === "verified") acc.verified += 1;
        if (row.status === "rejected") acc.rejected += 1;
        if (row.status === "issue") acc.issue += 1;
        if (!acc.lastSubmittedAt || row.submittedAt > acc.lastSubmittedAt) {
          acc.lastSubmittedAt = row.submittedAt;
        }
        if (!acc.lastResolvedAt || (row.resolvedAt && row.resolvedAt > acc.lastResolvedAt)) {
          acc.lastResolvedAt = row.resolvedAt;
        }
        return acc;
      },
      {
        total: verificationRows.length,
        pending: 0,
        claimed: 0,
        verdictPending: 0,
        verified: 0,
        rejected: 0,
        issue: 0,
        lastSubmittedAt: null as Date | null,
        lastResolvedAt: null as Date | null,
      },
    );
    const approvedIdentityRow = verificationRows
      .filter((row) => row.sectionType === "identity" && row.status === "verified")
      .sort((a, b) => {
        const aTime = (a.resolvedAt ?? a.submittedAt).getTime();
        const bTime = (b.resolvedAt ?? b.submittedAt).getTime();
        return bTime - aTime;
      })[0];
    const approvedExperienceRows = verificationRows
      .filter((row) => row.sectionType === "experience" && row.status === "verified")
      .sort((a, b) => {
        const aTime = (a.resolvedAt ?? a.submittedAt).getTime();
        const bTime = (b.resolvedAt ?? b.submittedAt).getTime();
        return bTime - aTime;
      });
    const approvedExperienceItems = approvedExperienceRows.slice(0, APPROVED_EXPERIENCE_LIMIT);
    const approvedExperienceHiddenCount = Math.max(0, approvedExperienceRows.length - approvedExperienceItems.length);
    const allRequestIds = verificationRows.map((row) => row.id);
    const allDocumentsRows =
      allRequestIds.length > 0
        ? await db
            .select({
              verificationRequestId: verificationDocuments.verificationRequestId,
              fileUrl: verificationDocuments.fileUrl,
              documentType: verificationDocuments.documentType,
              uploadedAt: verificationDocuments.uploadedAt,
            })
            .from(verificationDocuments)
            .where(inArray(verificationDocuments.verificationRequestId, allRequestIds))
            .orderBy(desc(verificationDocuments.uploadedAt))
        : [];
    const documentsByRequestId = allDocumentsRows.reduce(
      (acc, row) => {
        const existing = acc.get(row.verificationRequestId) ?? [];
        existing.push({
          fileUrl: row.fileUrl,
          documentType: row.documentType,
          uploadedAt: row.uploadedAt,
        });
        acc.set(row.verificationRequestId, existing);
        return acc;
      },
      new Map<
        string,
        Array<{
          fileUrl: string;
          documentType: "payslip" | "contract" | "freelancer_link" | "assessment_instructions";
          uploadedAt: Date;
        }>
      >(),
    );
    const verificationRowsById = new Map(verificationRows.map((row) => [row.id, row]));
    const uploadedDocumentItems = allDocumentsRows
      .map((doc) => {
        const request = verificationRowsById.get(doc.verificationRequestId);
        if (!request) return null;
        return {
          verificationRequestId: doc.verificationRequestId,
          sectionType: request.sectionType,
          itemLabel: request.itemLabel,
          status: request.status,
          method: request.method,
          fileUrl: doc.fileUrl,
          documentType: doc.documentType,
          uploadedAt: doc.uploadedAt,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const uploadedDocuments = uploadedDocumentItems.slice(0, UPLOADED_DOCUMENTS_LIMIT);
    const uploadedDocumentsHiddenCount = Math.max(0, uploadedDocumentItems.length - uploadedDocuments.length);

    const apiKeysSummary = apiKeyRows.reduce(
      (acc, row) => {
        if (row.enabled) acc.enabled += 1;
        acc.totalRequestCount += row.requestCount;
        if (!acc.lastRequestAt || (row.lastRequest && row.lastRequest > acc.lastRequestAt)) {
          acc.lastRequestAt = row.lastRequest;
        }
        return acc;
      },
      {
        total: apiKeyRows.length,
        enabled: 0,
        totalRequestCount: 0,
        lastRequestAt: null as Date | null,
      },
    );

    return {
      user: userRow,
      sessions: {
        total: totalSessionsRow?.total ?? 0,
        active: activeSessionsRow?.total ?? 0,
        recent: recentSessionsRows,
      },
      authProviders: {
        totalLinkedAccounts: accountRows.length,
        providerIds,
      },
      resumes: {
        ...resumeSummary,
        lastUpdatedAt: lastResumeUpdatedAt,
        ...resumeEngagement,
        items: resumeItems,
        hiddenCount: resumeItemsHiddenCount,
      },
      workAuthorization,
      verification: {
        ...verificationSummary,
        approvedIdentity: approvedIdentityRow
          ? {
              id: approvedIdentityRow.id,
              itemLabel: approvedIdentityRow.itemLabel,
              method: approvedIdentityRow.method,
              reviewerNote: approvedIdentityRow.reviewerNote,
              submittedAt: approvedIdentityRow.submittedAt,
              resolvedAt: approvedIdentityRow.resolvedAt,
              documents: documentsByRequestId.get(approvedIdentityRow.id) ?? [],
            }
          : null,
        approvedExperience: {
          items: approvedExperienceItems.map((row) => ({
            id: row.id,
            itemLabel: row.itemLabel,
            method: row.method,
            reviewerNote: row.reviewerNote,
            submittedAt: row.submittedAt,
            resolvedAt: row.resolvedAt,
            documents: documentsByRequestId.get(row.id) ?? [],
          })),
          hiddenCount: approvedExperienceHiddenCount,
        },
        uploadedDocuments: {
          items: uploadedDocuments,
          hiddenCount: uploadedDocumentsHiddenCount,
        },
      },
      apiKeys: apiKeysSummary,
    };
  }),
};
