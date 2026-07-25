import z from "zod";

import {
    sponsorshipRequirementSchema,
    workAuthorizationRegionSchema,
    workAuthorizationStatusSchema,
} from "@/schema/resume/data";

const workAuthFiltersSchema = z.object({
  workAuthRegions: z.array(workAuthorizationRegionSchema).optional().default([]),
  sponsorshipRequired: sponsorshipRequirementSchema.optional(),
  workAuthStatusByRegion: z
    .object({
      eu: workAuthorizationStatusSchema.optional(),
      usa: workAuthorizationStatusSchema.optional(),
      uk: workAuthorizationStatusSchema.optional(),
    })
    .optional(),
  authorizationFreshnessDays: z.number().int().min(1).optional(),
});

export const companyContactStatusSchema = z.enum(["pending", "accepted", "declined"]);
export const companySavedListTypeSchema = z.enum(["favorite", "to_contact"]);

const candidateCardSchema = z.object({
  resumeId: z.string().uuid().nullable(),
  candidateUserId: z.string().uuid(),
  displayName: z.string(),
  headline: z.string(),
  verifiedSkills: z.array(z.string()),
  experienceTitles: z.array(z.string()),
  isFavorite: z.boolean(),
  isToContact: z.boolean(),
  contactStatus: companyContactStatusSchema.nullable(),
  contactRequestId: z.string().uuid().nullable(),
  /** Only populated when contactStatus is accepted. */
  candidateEmail: z.string().email().nullable(),
});

const matchResultSchema = candidateCardSchema.extend({
  matchScore: z.number().min(0).max(100),
  matchReason: z.string(),
});

export const companyDto = {
  matchCandidates: {
    input: workAuthFiltersSchema.extend({
      jobDescription: z.string().trim().min(20).max(20_000),
    }),
    output: z.array(matchResultSchema),
  },

  listSaved: {
    input: z.object({
      listType: companySavedListTypeSchema.optional(),
    }),
    output: z.array(candidateCardSchema.extend({ listType: companySavedListTypeSchema, savedAt: z.date() })),
  },

  setSaved: {
    input: z.object({
      candidateUserId: z.string().uuid(),
      resumeId: z.string().uuid().nullable().optional(),
      listType: companySavedListTypeSchema,
      saved: z.boolean(),
    }),
    output: z.object({ ok: z.literal(true) }),
  },

  createContactRequest: {
    input: z.object({
      candidateUserId: z.string().uuid(),
      resumeId: z.string().uuid().nullable().optional(),
    }),
    output: z.object({
      id: z.string().uuid(),
      status: z.literal("pending"),
    }),
  },

  listContactRequests: {
    input: z.object({
      status: companyContactStatusSchema.optional(),
      query: z
        .string()
        .max(200)
        .optional()
        .transform((s) => {
          const t = s?.trim() ?? "";
          return t.length > 0 ? t : undefined;
        }),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        candidateUserId: z.string().uuid(),
        resumeId: z.string().uuid().nullable(),
        candidateName: z.string(),
        candidateEmail: z.string().email().nullable(),
        status: companyContactStatusSchema,
        createdAt: z.date(),
        respondedAt: z.date().nullable(),
      }),
    ),
  },

  listMyContactRequests: {
    input: z.object({
      status: companyContactStatusSchema.optional(),
    }),
    output: z.array(
      z.object({
        id: z.string().uuid(),
        companyUserId: z.string().uuid(),
        companyName: z.string(),
        companyEmail: z.string().email().nullable(),
        resumeId: z.string().uuid().nullable(),
        status: companyContactStatusSchema,
        createdAt: z.date(),
        respondedAt: z.date().nullable(),
      }),
    ),
  },

  respondToContactRequest: {
    input: z.object({
      id: z.string().uuid(),
      decision: z.enum(["accepted", "declined"]),
    }),
    output: z.object({
      id: z.string().uuid(),
      status: z.enum(["accepted", "declined"]),
    }),
  },
};
