import { ORPCError } from "@orpc/client";
import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { match } from "ts-pattern";

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
import { getGlobalAiCredentialsForService } from "./global-ai-settings";

// ponytail: single-shot AI rank over at most 40 resumes; upgrade to embeddings/prefilter when the pool is large.
const MATCH_POOL_CAP = 40;

type WorkAuthorizationFilters = {
  workAuthRegions: ("eu" | "usa" | "uk")[];
  sponsorshipRequired?: "yes" | "no" | "case_by_case" | "unknown";
  workAuthStatusByRegion?: { eu?: string; usa?: string; uk?: string };
  authorizationFreshnessDays?: number;
};

const getWorkAuthStatusColumn = (region: "eu" | "usa" | "uk") =>
  match(region)
    .with("eu", () => schema.resume.workAuthEuStatus)
    .with("usa", () => schema.resume.workAuthUsaStatus)
    .with("uk", () => schema.resume.workAuthUkStatus)
    .exhaustive();

const getWorkAuthSponsorshipColumn = (region: "eu" | "usa" | "uk") =>
  match(region)
    .with("eu", () => schema.resume.workAuthEuSponsorshipRequired)
    .with("usa", () => schema.resume.workAuthUsaSponsorshipRequired)
    .with("uk", () => schema.resume.workAuthUkSponsorshipRequired)
    .exhaustive();

const getWorkAuthorizationConditions = (filters: WorkAuthorizationFilters) => {
  const conditions = [];

  if (filters.workAuthRegions.length > 0) {
    const regionConditions = filters.workAuthRegions.map(
      (region) => sql`${getWorkAuthStatusColumn(region)} <> 'not_authorized'`,
    );
    conditions.push(or(...regionConditions));
  }

  if (filters.sponsorshipRequired) {
    const regions = filters.workAuthRegions.length > 0 ? filters.workAuthRegions : (["eu", "usa", "uk"] as const);
    const sponsorshipConditions = regions.map((region) =>
      eq(getWorkAuthSponsorshipColumn(region), filters.sponsorshipRequired!),
    );
    if (sponsorshipConditions.length > 0) {
      conditions.push(or(...sponsorshipConditions));
    }
  }

  if (filters.workAuthStatusByRegion) {
    if (filters.workAuthStatusByRegion.eu)
      conditions.push(eq(schema.resume.workAuthEuStatus, filters.workAuthStatusByRegion.eu));
    if (filters.workAuthStatusByRegion.usa)
      conditions.push(eq(schema.resume.workAuthUsaStatus, filters.workAuthStatusByRegion.usa));
    if (filters.workAuthStatusByRegion.uk)
      conditions.push(eq(schema.resume.workAuthUkStatus, filters.workAuthStatusByRegion.uk));
  }

  if (filters.authorizationFreshnessDays) {
    const threshold = new Date(Date.now() - filters.authorizationFreshnessDays * 24 * 60 * 60 * 1000);
    conditions.push(gte(schema.resume.workAuthUpdatedAt, threshold));
  }

  // Consent only matters when filtering on work-auth fields — not for pool membership.
  if (conditions.length > 0) {
    conditions.unshift(eq(schema.resume.workAuthConsentToShare, true));
  }

  return conditions;
};

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
  const workAuthConditions = getWorkAuthorizationConditions(filters);

  return await db
    .select({
      resumeId: schema.resume.id,
      candidateUserId: schema.resume.userId,
      username: schema.user.username,
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
          candidateEmail: null as string | null,
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
        candidateEmail: null as string | null,
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

    const [pending] = await db
      .select({ id: schema.companyContactRequests.id })
      .from(schema.companyContactRequests)
      .where(
        and(
          eq(schema.companyContactRequests.companyUserId, input.companyUserId),
          eq(schema.companyContactRequests.candidateUserId, input.candidateUserId),
          eq(schema.companyContactRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (pending) {
      throw new ORPCError("CONFLICT", { message: "A pending contact request already exists for this candidate." });
    }

    const id = generateId();
    await db.insert(schema.companyContactRequests).values({
      id,
      companyUserId: input.companyUserId,
      candidateUserId: input.candidateUserId,
      resumeId: input.resumeId ?? null,
      status: "pending",
    });

    await sendCompanyContactRequestedEmail({
      to: candidate.email,
      companyName: input.companyName,
      respondUrl: `${env.APP_URL}/dashboard/contact-requests`,
    });

    return { id, status: "pending" as const };
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
      candidateEmail: row.status === "accepted" ? row.candidateEmail : null,
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
      companyEmail: row.status === "accepted" ? row.companyEmail : null,
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

    await db
      .update(schema.companyContactRequests)
      .set({ status: input.decision, respondedAt: new Date() })
      .where(eq(schema.companyContactRequests.id, input.id));

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
