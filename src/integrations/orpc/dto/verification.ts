import z from "zod";

/** Resume section item ids are stored as UUID-shaped strings; PostgreSQL accepts some values Zod's `.uuid()` rejects. */
export const resumeItemIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, "Invalid item id");

const verificationStatusItemSchema = z.object({
  id: z.string().uuid(),
  sectionType: z.enum(["skill", "project", "experience", "identity"]),
  itemId: z.string(),
  itemLabel: z.string(),
  status: z.enum(["pending", "claimed", "verdict_pending", "verified", "rejected", "issue"]),
  badgeVisible: z.boolean(),
  submittedAt: z.date(),
  assessmentInstructionsUrl: z.string().nullable().optional(),
  assessmentAcceptedAt: z.date().nullable().optional(),
  assessmentSolutionSubmittedAt: z.date().nullable().optional(),
  assessmentSolutionFileUrl: z.string().nullable().optional(),
  assessmentSolutionLinkUrl: z.string().nullable().optional(),
});

const verificationStatusOutputSchema = z.array(verificationStatusItemSchema);

export const verificationDto = {
  statusOutput: verificationStatusOutputSchema,
  requestSkill: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: resumeItemIdSchema,
      itemLabel: z.string().min(1),
    }),
  },
  requestProject: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: resumeItemIdSchema,
      itemLabel: z.string().min(1),
    }),
  },
  uploadDocument: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: resumeItemIdSchema,
      file: z.instanceof(File),
      documentType: z.enum(["payslip", "contract", "freelancer_link"]),
    }),
  },
  submitAssessmentSolution: {
    input: z
      .object({
        resumeId: z.string().uuid(),
        itemId: resumeItemIdSchema,
        file: z.instanceof(File).optional(),
        solutionUrl: z.string().url().optional(),
      })
      .refine((value) => Boolean(value.file || value.solutionUrl), {
        message: "Provide a file or solution URL",
      }),
  },
  requestExperience: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: resumeItemIdSchema,
      itemLabel: z.string().min(1),
      method: z.enum(["document_upload", "freelancer_link"]),
      documentId: z.string().uuid().optional(),
      freelancerUrl: z.string().url().optional(),
    }),
  },
  getStatus: {
    input: z.object({
      resumeId: z.string().uuid(),
    }),
  },
  getPublicStatus: {
    input: z.object({
      resumeId: z.string().uuid(),
    }),
    output: verificationStatusOutputSchema,
  },
  getPrinterStatus: {
    input: z.object({
      resumeId: z.string().uuid(),
      token: z.string().min(1),
    }),
    output: verificationStatusOutputSchema,
  },
  getHistory: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: resumeItemIdSchema,
    }),
  },
  getPublicTimeline: {
    input: z.object({
      resumeId: z.string().uuid(),
    }),
    output: z.object({
      enabled: z.boolean(),
      entries: z.array(
        z.object({
          id: z.string().uuid(),
          sectionType: z.enum(["skill", "project", "experience", "identity"]),
          itemLabel: z.string(),
          status: z.enum(["pending", "claimed", "verdict_pending", "verified", "rejected", "issue"]),
          submittedAt: z.date(),
          resolvedAt: z.date().nullable(),
          verifiedBy: z.string().nullable(),
        }),
      ),
    }),
  },
  toggleBadge: {
    input: z.object({
      requestId: z.string().uuid(),
      visible: z.boolean(),
    }),
  },
  toggleTimeline: {
    input: z.object({
      resumeId: z.string().uuid(),
      show: z.boolean(),
    }),
  },
  listTimelineSettings: {
    output: z.array(
      z.object({
        resumeId: z.string().uuid(),
        name: z.string(),
        showTimeline: z.boolean(),
      }),
    ),
  },
  getBadgeDetail: {
    input: z.object({
      requestId: z.string().uuid(),
    }),
  },
};
