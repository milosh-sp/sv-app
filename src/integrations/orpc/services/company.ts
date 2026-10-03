import { ORPCError } from "@orpc/client";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import type { ResumeData } from "@/schema/resume/data";

import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";
import {
  sendCompanyContactAcceptedEmail,
  sendCompanyContactDeclinedEmail,
  sendCompanyContactRequestedEmail,
} from "@/integrations/email/company-contact";
import { env } from "@/utils/env";
import { generateId } from "@/utils/string";

import { aiService } from "./ai";
import { vettedEmployerVisibilityConditions } from "./company-vetted-pool";
import { emailSharedOnAccept } from "./company-visibility";
import { getGlobalAiCredentialsForService } from "./global-ai-settings";
import { getWorkAuthorizationConditions, type WorkAuthorizationFilters } from "./resume-work-authorization";

// ponytail: single-shot AI rank over at most 40 resumes; upgrade to embeddings/prefilter when the pool is large.
const MATCH_POOL_CAP = 40;

function experienceTitlesFromData(data: ResumeData): string[] {
  return (data.sections.experience.items ?? [])
    .filter((item) => !item.hidden)
    .slice(0, 3)
    .map((item) => [item.position, item.company].filter(Boolean).join(" @ "))
    .filter((title) => title.length > 0);
}

async function loadVerifiedLabelsByUserIds(
  userIds: string[],
  sectionType: "skill" | "experience" | "project",
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;

  const rows = await db
    .select({
      userId: schema.verificationRequests.userId,
      itemLabel: schema.verificationRequests.itemLabel,
    })
    .from(schema.verificationRequests)
    .where(
      and(
        inArray(schema.verificationRequests.userId, userIds),
        eq(schema.verificationRequests.sectionType, sectionType),
        eq(schema.verificationRequests.status, "verified"),
      ),
    );

  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    if (!list.includes(row.itemLabel)) list.push(row.itemLabel);
    map.set(row.userId, list);
  }

  return map;
}

async function loadVerifiedIdentityUserIds(userIds: string[]): Promise<Set<string>> {
  const verified = new Set<string>();
  if (userIds.length === 0) return verified;

  const rows = await db
    .select({ userId: schema.verificationRequests.userId })
    .from(schema.verificationRequests)
    .where(
      and(
        inArray(schema.verificationRequests.userId, userIds),
        eq(schema.verificationRequests.sectionType, "identity"),
        eq(schema.verificationRequests.status, "verified"),
      ),
    );

  for (const row of rows) verified.add(row.userId);
  return verified;
}

async function loadListFlags(companyUserId: string, candidateUserIds: string[]) {
  const favorite = new Set<string>();
  const toContact = new Set<string>();
  if (candidateUserIds.length === 0) return { favorite, toContact };

  const rows = await db
    .select({
      candidateUserId: schema.companySavedCandidates.candidateUserId,
      listType: schema.companySavedCandidates.listType,
    })
    .from(schema.companySavedCandidates)
    .where(
      and(
        eq(schema.companySavedCandidates.companyUserId, companyUserId),
        inArray(schema.companySavedCandidates.candidateUserId, candidateUserIds),
      ),
    );

  for (const row of rows) {
    if (row.listType === "favorite") favorite.add(row.candidateUserId);
    if (row.listType === "to_contact") toContact.add(row.candidateUserId);
  }

  return { favorite, toContact };
}

async function loadLatestContactByCandidate(companyUserId: string, candidateUserIds: string[]) {
  const map = new Map<string, { id: string; status: "pending" | "accepted" | "declined" }>();
  if (candidateUserIds.length === 0) return map;

  const rows = await db
    .select({
      id: schema.companyContactRequests.id,
      candidateUserId: schema.companyContactRequests.candidateUserId,
      status: schema.companyContactRequests.status,
    })
    .from(schema.companyContactRequests)
    .where(
      and(
        eq(schema.companyContactRequests.companyUserId, companyUserId),
        inArray(schema.companyContactRequests.candidateUserId, candidateUserIds),
      ),
    )
    .orderBy(desc(schema.companyContactRequests.createdAt));

  for (const row of rows) {
    if (!map.has(row.candidateUserId)) {
      map.set(row.candidateUserId, { id: row.id, status: row.status });
    }
  }

  return map;
}

async function loadVettedPool(filters: WorkAuthorizationFilters) {
  const workAuthConditions = getWorkAuthorizationConditions(filters, true);

  return await db
    .select({
      resumeId: schema.resume.id,
      candidateUserId: schema.resume.userId,
      username: schema.user.username,
      email: schema.user.email,
      slug: schema.resume.slug,
      updatedAt: schema.resume.updatedAt,
      basics: sql<ResumeData["basics"]>`${schema.resume.data}->'basics'`,
      data: schema.resume.data,
    })
    .from(schema.resume)
    .innerJoin(schema.user, eq(schema.user.id, schema.resume.userId))
    .where(and(...vettedEmployerVisibilityConditions(), ...workAuthConditions))
    .orderBy(desc(schema.resume.updatedAt))
    .limit(MATCH_POOL_CAP);
}

export const companyService = {
  matchCandidates: async (companyUserId: string, input: WorkAuthorizationFilters & { jobDescription: string }) => {
    const creds = await getGlobalAiCredentialsForService();
    if (!creds) {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "AI integration is not configured. Contact an administrator.",
      });
    }

    const pool = await loadVettedPool(input);
    if (pool.length === 0) return [];

    const userIds = pool.map((row) => row.candidateUserId);
    const [skillsByUser, experiencesByUser, identityVerified, listFlags, contacts] = await Promise.all([
      loadVerifiedLabelsByUserIds(userIds, "skill"),
      loadVerifiedLabelsByUserIds(userIds, "experience"),
      loadVerifiedIdentityUserIds(userIds),
      loadListFlags(companyUserId, userIds),
      loadLatestContactByCandidate(companyUserId, userIds),
    ]);

    const summaries = pool.map((row) => ({
      resumeId: row.resumeId,
      username: row.username,
      slug: row.slug,
      displayName: row.basics.name || "Candidate",
      headline: row.basics.headline || "",
      identityVerified: identityVerified.has(row.candidateUserId),
      verifiedSkills: skillsByUser.get(row.candidateUserId) ?? [],
      verifiedExperiences: experiencesByUser.get(row.candidateUserId) ?? [],
      experienceTitles: experienceTitlesFromData(row.data),
    }));

    const aiResult = await aiService.matchCandidates({
      ...creds,
      jobDescription: input.jobDescription,
      candidates: summaries.map(({ resumeId, displayName, headline, verifiedSkills, experienceTitles }) => ({
        resumeId,
        displayName,
        headline,
        verifiedSkills,
        experienceTitles,
      })),
    });

    const byResumeId = new Map(pool.map((row) => [row.resumeId, row]));
    const summaryByResumeId = new Map(summaries.map((row) => [row.resumeId, row]));

    return aiResult.matches
      .map((matchItem) => {
        const row = byResumeId.get(matchItem.resumeId);
        const summary = summaryByResumeId.get(matchItem.resumeId);
        if (!row || !summary) return null;

        const contact = contacts.get(row.candidateUserId);
        return {
          resumeId: row.resumeId,
          candidateUserId: row.candidateUserId,
          username: summary.username,
          slug: summary.slug,
          displayName: summary.displayName,
          headline: summary.headline,
          identityVerified: summary.identityVerified,
          verifiedSkills: summary.verifiedSkills,
          verifiedExperiences: summary.verifiedExperiences,
          experienceTitles: summary.experienceTitles,
          matchScore: matchItem.matchScore,
          matchReason: matchItem.matchReason,
          isFavorite: listFlags.favorite.has(row.candidateUserId),
          isToContact: listFlags.toContact.has(row.candidateUserId),
          contactStatus: contact?.status ?? null,
          contactRequestId: contact?.id ?? null,
          candidateEmail: emailSharedOnAccept(contact?.status, row.email),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.matchScore - a.matchScore);
  },

  listSaved: async (companyUserId: string, listType?: "favorite" | "to_contact") => {
    const conditions = [eq(schema.companySavedCandidates.companyUserId, companyUserId)];
    if (listType) conditions.push(eq(schema.companySavedCandidates.listType, listType));

    const saved = await db
      .select({
        candidateUserId: schema.companySavedCandidates.candidateUserId,
        resumeId: schema.companySavedCandidates.resumeId,
        listType: schema.companySavedCandidates.listType,
        savedAt: schema.companySavedCandidates.createdAt,
        candidateName: schema.user.name,
        candidateEmail: schema.user.email,
        username: schema.user.username,
      })
      .from(schema.companySavedCandidates)
      .innerJoin(schema.user, eq(schema.user.id, schema.companySavedCandidates.candidateUserId))
      .where(and(...conditions))
      .orderBy(desc(schema.companySavedCandidates.createdAt));

    if (saved.length === 0) return [];

    const userIds = [...new Set(saved.map((row) => row.candidateUserId))];
    const resumeIds = [...new Set(saved.map((row) => row.resumeId).filter((id): id is string => Boolean(id)))];

    const [skillsByUser, experiencesByUser, identityVerified, contacts, listFlags, resumes] = await Promise.all([
      loadVerifiedLabelsByUserIds(userIds, "skill"),
      loadVerifiedLabelsByUserIds(userIds, "experience"),
      loadVerifiedIdentityUserIds(userIds),
      loadLatestContactByCandidate(companyUserId, userIds),
      loadListFlags(companyUserId, userIds),
      resumeIds.length > 0
        ? db
            .select({
              id: schema.resume.id,
              slug: schema.resume.slug,
              basics: sql<ResumeData["basics"]>`${schema.resume.data}->'basics'`,
              data: schema.resume.data,
            })
            .from(schema.resume)
            .where(inArray(schema.resume.id, resumeIds))
        : Promise.resolve([]),
    ]);

    const resumeById = new Map(resumes.map((row) => [row.id, row]));

    return saved.map((row) => {
      const resume = row.resumeId ? resumeById.get(row.resumeId) : undefined;
      const contact = contacts.get(row.candidateUserId);
      return {
        resumeId: row.resumeId,
        candidateUserId: row.candidateUserId,
        username: row.username,
        slug: resume?.slug ?? null,
        displayName: resume?.basics.name || row.candidateName,
        headline: resume?.basics.headline || "",
        identityVerified: identityVerified.has(row.candidateUserId),
        verifiedSkills: skillsByUser.get(row.candidateUserId) ?? [],
        verifiedExperiences: experiencesByUser.get(row.candidateUserId) ?? [],
        experienceTitles: resume ? experienceTitlesFromData(resume.data) : [],
        isFavorite: listFlags.favorite.has(row.candidateUserId),
        isToContact: listFlags.toContact.has(row.candidateUserId),
        contactStatus: contact?.status ?? null,
        contactRequestId: contact?.id ?? null,
        candidateEmail: emailSharedOnAccept(contact?.status, row.candidateEmail),
        listType: row.listType,
        savedAt: row.savedAt,
      };
    });
  },

  setSaved: async (input: {
    companyUserId: string;
    candidateUserId: string;
    resumeId?: string | null;
    listType: "favorite" | "to_contact";
    saved: boolean;
  }) => {
    if (input.saved) {
      await db
        .insert(schema.companySavedCandidates)
        .values({
          id: generateId(),
          companyUserId: input.companyUserId,
          candidateUserId: input.candidateUserId,
          resumeId: input.resumeId ?? null,
          listType: input.listType,
        })
        .onConflictDoNothing();
    } else {
      await db
        .delete(schema.companySavedCandidates)
        .where(
          and(
            eq(schema.companySavedCandidates.companyUserId, input.companyUserId),
            eq(schema.companySavedCandidates.candidateUserId, input.candidateUserId),
            eq(schema.companySavedCandidates.listType, input.listType),
          ),
        );
    }

    return { ok: true as const };
  },

  createContactRequest: async (input: {
    companyUserId: string;
    companyName: string;
    candidateUserId: string;
    resumeId?: string | null;
  }) => {
    if (input.companyUserId === input.candidateUserId) {
      throw new ORPCError("BAD_REQUEST", { message: "Cannot contact yourself." });
    }

    const [candidate] = await db
      .select({ id: schema.user.id, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, input.candidateUserId))
      .limit(1);

    if (!candidate) throw new ORPCError("NOT_FOUND", { message: "Candidate not found." });

    // The partial unique index on pending (company, candidate) pairs makes this insert the duplicate check.
    const [created] = await db
      .insert(schema.companyContactRequests)
      .values({
        id: generateId(),
        companyUserId: input.companyUserId,
        candidateUserId: input.candidateUserId,
        resumeId: input.resumeId ?? null,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ id: schema.companyContactRequests.id });

    if (!created) {
      throw new ORPCError("CONFLICT", { message: "A pending contact request already exists for this candidate." });
    }

    await sendCompanyContactRequestedEmail({
      to: candidate.email,
      companyName: input.companyName,
      respondUrl: `${env.APP_URL}/dashboard/contact-requests`,
    });

    return { id: created.id, status: "pending" as const };
  },

  listContactRequests: async (
    companyUserId: string,
    input: { status?: "pending" | "accepted" | "declined"; query?: string },
  ) => {
    const conditions = [eq(schema.companyContactRequests.companyUserId, companyUserId)];
    if (input.status) conditions.push(eq(schema.companyContactRequests.status, input.status));
    if (input.query) conditions.push(ilike(schema.user.name, `%${input.query.slice(0, 200)}%`));

    const rows = await db
      .select({
        id: schema.companyContactRequests.id,
        candidateUserId: schema.companyContactRequests.candidateUserId,
        resumeId: schema.companyContactRequests.resumeId,
        status: schema.companyContactRequests.status,
        createdAt: schema.companyContactRequests.createdAt,
        respondedAt: schema.companyContactRequests.respondedAt,
        candidateName: schema.user.name,
        candidateEmail: schema.user.email,
      })
      .from(schema.companyContactRequests)
      .innerJoin(schema.user, eq(schema.user.id, schema.companyContactRequests.candidateUserId))
      .where(and(...conditions))
      .orderBy(desc(schema.companyContactRequests.createdAt));

    return rows.map((row) => ({
      id: row.id,
      candidateUserId: row.candidateUserId,
      resumeId: row.resumeId,
      candidateName: row.candidateName,
      candidateEmail: emailSharedOnAccept(row.status, row.candidateEmail),
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
    }));
  },

  listMyContactRequests: async (candidateUserId: string, input: { status?: "pending" | "accepted" | "declined" }) => {
    const conditions = [eq(schema.companyContactRequests.candidateUserId, candidateUserId)];
    if (input.status) conditions.push(eq(schema.companyContactRequests.status, input.status));

    const rows = await db
      .select({
        id: schema.companyContactRequests.id,
        companyUserId: schema.companyContactRequests.companyUserId,
        resumeId: schema.companyContactRequests.resumeId,
        status: schema.companyContactRequests.status,
        createdAt: schema.companyContactRequests.createdAt,
        respondedAt: schema.companyContactRequests.respondedAt,
        companyName: schema.user.name,
        companyEmail: schema.user.email,
      })
      .from(schema.companyContactRequests)
      .innerJoin(schema.user, eq(schema.user.id, schema.companyContactRequests.companyUserId))
      .where(and(...conditions))
      .orderBy(desc(schema.companyContactRequests.createdAt));

    return rows.map((row) => ({
      id: row.id,
      companyUserId: row.companyUserId,
      companyName: row.companyName,
      companyEmail: emailSharedOnAccept(row.status, row.companyEmail),
      resumeId: row.resumeId,
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
    }));
  },

  respondToContactRequest: async (input: {
    candidateUserId: string;
    candidateName: string;
    candidateEmail: string;
    id: string;
    decision: "accepted" | "declined";
  }) => {
    const [request] = await db
      .select({
        id: schema.companyContactRequests.id,
        status: schema.companyContactRequests.status,
        companyUserId: schema.companyContactRequests.companyUserId,
      })
      .from(schema.companyContactRequests)
      .where(
        and(
          eq(schema.companyContactRequests.id, input.id),
          eq(schema.companyContactRequests.candidateUserId, input.candidateUserId),
        ),
      )
      .limit(1);

    if (!request) throw new ORPCError("NOT_FOUND");
    if (request.status !== "pending") {
      throw new ORPCError("CONFLICT", { message: "This contact request was already answered." });
    }

    const [company] = await db
      .select({ name: schema.user.name, email: schema.user.email })
      .from(schema.user)
      .where(eq(schema.user.id, request.companyUserId))
      .limit(1);

    if (!company) throw new ORPCError("NOT_FOUND", { message: "Company account not found." });

    const [updated] = await db
      .update(schema.companyContactRequests)
      .set({ status: input.decision, respondedAt: new Date() })
      .where(and(eq(schema.companyContactRequests.id, input.id), eq(schema.companyContactRequests.status, "pending")))
      .returning({ id: schema.companyContactRequests.id });

    if (!updated) {
      throw new ORPCError("CONFLICT", { message: "This contact request was already answered." });
    }

    if (input.decision === "accepted") {
      await Promise.all([
        sendCompanyContactAcceptedEmail({
          to: company.email,
          otherPartyName: input.candidateName,
          otherPartyEmail: input.candidateEmail,
          isCompany: true,
        }),
        sendCompanyContactAcceptedEmail({
          to: input.candidateEmail,
          otherPartyName: company.name,
          otherPartyEmail: company.email,
          isCompany: false,
        }),
      ]);
    } else {
      await sendCompanyContactDeclinedEmail({
        to: company.email,
        candidateName: input.candidateName,
      });
    }

    return { id: input.id, status: input.decision };
  },
};
