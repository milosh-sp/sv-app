import z from "zod";

import { reviewerAdminProcedure, skillVerdictAdminProcedure } from "../context";
import { verificationService } from "../services/verification";

export const adminVerificationRouter = {
  listQueue: reviewerAdminProcedure.handler(async () => {
    return await verificationService.listQueue();
  }),

  claimCase: reviewerAdminProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      return await verificationService.claimCase({
        requestId: input.requestId,
        adminId: context.user.id,
      });
    }),

  listMyCases: reviewerAdminProcedure.handler(async ({ context }) => {
    return await verificationService.listMyCases(context.user.id);
  }),

  submitVerdict: reviewerAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        verdict: z.enum(["approved", "rejected", "issue"]),
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

  listExperienceQueue: skillVerdictAdminProcedure.handler(async () => {
    return await verificationService.listExperienceQueue();
  }),

  reviewExperience: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["approved", "rejected", "issue"]),
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

  listPendingVerdicts: skillVerdictAdminProcedure.handler(async () => {
    return await verificationService.listPendingVerdicts();
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
        action: z.enum(["approved", "rejected", "issue"]),
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
};
