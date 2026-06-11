import z from "zod";

import { reviewerAdminProcedure, skillVerdictAdminProcedure } from "../context";
import { verificationService } from "../services/verification";

const verificationListQuerySchema = z
  .string()
  .max(200)
  .optional()
  .transform((s) => {
    const trimmed = s?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : undefined;
  });

const verificationListBaseInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  query: verificationListQuerySchema,
  statuses: z.array(z.enum(["verified", "rejected", "issue"])).optional(),
  method: z.enum(["document_upload", "freelancer_link", "identity_call"]).optional(),
});

const pendingVerdictsListInputSchema = verificationListBaseInputSchema.extend({
  proposed: z.array(z.enum(["verified", "rejected", "issue"])).optional(),
  types: z.array(z.enum(["skill", "project"])).optional(),
});

export const adminVerificationRouter = {
  listQueue: reviewerAdminProcedure.handler(async ({ context }) => {
    return await verificationService.listQueue(context.user.id);
  }),

  acceptCase: reviewerAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        file: z.instanceof(File),
        message: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.acceptCase({
        requestId: input.requestId,
        adminId: context.user.id,
        file: input.file,
        message: input.message,
      });
    }),

  listMyCases: reviewerAdminProcedure.handler(async ({ context }) => {
    return await verificationService.listMyCases(context.user.id);
  }),

  listMyCaseHistory: reviewerAdminProcedure.handler(async ({ context }) => {
    return await verificationService.listMyCaseHistory(context.user.id);
  }),

  submitVerdict: reviewerAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        verdict: z.enum(["verified", "rejected", "issue"]),
        notes: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.submitVerdict({
        requestId: input.requestId,
        adminId: context.user.id,
        verdict: input.verdict,
        notes: input.notes,
      });
    }),

  downloadReviewerDocument: reviewerAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        documentId: z.string().uuid(),
      }),
    )
    .handler(async ({ context, input }) => {
      const doc = await verificationService.downloadReviewerDocument({
        requestId: input.requestId,
        documentId: input.documentId,
        adminId: context.user.id,
      });

      return {
        id: doc.id,
        documentType: doc.documentType,
        contentType: doc.contentType,
        size: doc.size,
      };
    }),

  getDocuments: skillVerdictAdminProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .handler(async ({ input }) => {
      return await verificationService.getDocuments(input.requestId);
    }),

  downloadDocument: skillVerdictAdminProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .handler(async ({ input }) => {
      const doc = await verificationService.downloadDocument(input.documentId);
      return {
        id: doc.id,
        fileUrl: doc.fileUrl,
        documentType: doc.documentType,
        contentType: doc.contentType,
        size: doc.size,
      };
    }),

  listExperienceQueue: skillVerdictAdminProcedure.input(verificationListBaseInputSchema).handler(async ({ input }) => {
    return await verificationService.listExperienceQueue(input);
  }),

  listExperienceHistory: skillVerdictAdminProcedure
    .input(verificationListBaseInputSchema)
    .handler(async ({ input }) => {
      return await verificationService.listExperienceHistory(input);
    }),

  reviewExperience: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["verified", "rejected", "issue"]),
        notes: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.reviewExperience({
        requestId: input.requestId,
        adminId: context.user.id,
        action: input.action,
        notes: input.notes,
      });
    }),

  listPendingVerdicts: skillVerdictAdminProcedure.input(pendingVerdictsListInputSchema).handler(async ({ input }) => {
    return await verificationService.listPendingVerdicts(input);
  }),

  confirmVerdict: skillVerdictAdminProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      return await verificationService.confirmVerdict({
        requestId: input.requestId,
        adminId: context.user.id,
      });
    }),

  overrideVerdict: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["verified", "rejected", "issue"]),
        reason: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.overrideVerdict({
        requestId: input.requestId,
        adminId: context.user.id,
        action: input.action,
        reason: input.reason,
      });
    }),

  listVerdictHistory: skillVerdictAdminProcedure.input(pendingVerdictsListInputSchema).handler(async ({ input }) => {
    return await verificationService.listVerdictHistory(input);
  }),

  overrideConcludedVerdict: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["verified", "rejected", "issue"]),
        reason: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.overrideConcludedVerdict({
        requestId: input.requestId,
        adminId: context.user.id,
        action: input.action,
        reason: input.reason,
      });
    }),

  listIdentityQueue: skillVerdictAdminProcedure.input(verificationListBaseInputSchema).handler(async ({ input }) => {
    return await verificationService.listIdentityQueue(input);
  }),

  listIdentityHistory: skillVerdictAdminProcedure.input(verificationListBaseInputSchema).handler(async ({ input }) => {
    return await verificationService.listIdentityHistory(input);
  }),

  reviewIdentity: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["verified", "rejected", "issue"]),
        notes: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await verificationService.reviewIdentity({
        requestId: input.requestId,
        adminId: context.user.id,
        action: input.action,
        notes: input.notes,
      });
    }),
};
