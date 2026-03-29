import z from "zod";

import { publicProcedure, reviewerAdminProcedure, skillVerdictAdminProcedure } from "../context";
import { reviewerProfileService } from "../services/reviewer-profile";

export const adminReviewerProfilesRouter = {
  create: skillVerdictAdminProcedure
    .input(
      z.object({
        adminId: z.string().uuid(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .handler(async ({ input }) => {
      return await reviewerProfileService.create(input);
    }),

  updateDirect: skillVerdictAdminProcedure
    .input(
      z.object({
        adminId: z.string().uuid(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
      }),
    )
    .handler(async ({ input }) => {
      return await reviewerProfileService.updateDirect(input);
    }),

  listChangeRequests: skillVerdictAdminProcedure.handler(async () => {
    return await reviewerProfileService.listChangeRequests();
  }),

  resolveChangeRequest: skillVerdictAdminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        action: z.enum(["approved", "rejected"]),
        rejectionReason: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await reviewerProfileService.resolveChangeRequest({
        ...input,
        resolvedByAdminId: context.user.id,
      });
    }),
};

export const reviewerProfileRouter = {
  get: reviewerAdminProcedure.handler(async ({ context }) => {
    return await reviewerProfileService.getByAdminId(context.user.id);
  }),

  giveConsent: reviewerAdminProcedure.handler(async ({ context }) => {
    return await reviewerProfileService.giveConsent(context.user.id);
  }),

  requestChange: reviewerAdminProcedure
    .input(
      z.object({
        firstName: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      return await reviewerProfileService.requestChange({
        adminId: context.user.id,
        ...input,
      });
    }),

  getChangeRequestStatus: reviewerAdminProcedure.handler(async ({ context }) => {
    return await reviewerProfileService.getChangeRequestStatus(context.user.id);
  }),
};

export const publicReviewerProfileRouter = {
  get: publicProcedure.input(z.object({ adminId: z.string().uuid() })).handler(async ({ input }) => {
    return await reviewerProfileService.getPublicProfile(input.adminId);
  }),
};
