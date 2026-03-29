import { env } from "@/utils/env";

import { protectedProcedure, publicProcedure } from "../context";
import { verificationDto } from "../dto/verification";
import { verificationService } from "../services/verification";

export const verificationRouter = {
  requestSkill: protectedProcedure.input(verificationDto.requestSkill.input).handler(async ({ context, input }) => {
    return await verificationService.requestSkill({
      userId: context.user.id,
      ...input,
    });
  }),

  requestProject: protectedProcedure.input(verificationDto.requestProject.input).handler(async ({ context, input }) => {
    return await verificationService.requestProject({
      userId: context.user.id,
      ...input,
    });
  }),

  uploadDocument: protectedProcedure.input(verificationDto.uploadDocument.input).handler(async ({ context, input }) => {
    return await verificationService.uploadDocument({
      userId: context.user.id,
      ...input,
    });
  }),

  requestExperience: protectedProcedure
    .input(verificationDto.requestExperience.input)
    .handler(async ({ context, input }) => {
      return await verificationService.requestExperience({
        userId: context.user.id,
        ...input,
      });
    }),

  requestIdentity: protectedProcedure.handler(async ({ context }) => {
    return await verificationService.requestIdentity(context.user.id);
  }),

  getStatus: protectedProcedure.input(verificationDto.getStatus.input).handler(async ({ context, input }) => {
    return await verificationService.getStatus({
      userId: context.user.id,
      ...input,
    });
  }),

  getHistory: protectedProcedure.input(verificationDto.getHistory.input).handler(async ({ context, input }) => {
    return await verificationService.getHistory({
      userId: context.user.id,
      ...input,
    });
  }),

  toggleBadge: protectedProcedure.input(verificationDto.toggleBadge.input).handler(async ({ context, input }) => {
    return await verificationService.toggleBadge({
      userId: context.user.id,
      ...input,
    });
  }),

  toggleTimeline: protectedProcedure.input(verificationDto.toggleTimeline.input).handler(async ({ context, input }) => {
    return await verificationService.toggleTimeline({
      userId: context.user.id,
      ...input,
    });
  }),

  listTimelineSettings: protectedProcedure
    .output(verificationDto.listTimelineSettings.output)
    .handler(async ({ context }) => {
      return await verificationService.listTimelineSettingsForUser(context.user.id);
    }),

  getAllStatuses: protectedProcedure.handler(async ({ context }) => {
    return await verificationService.getAllStatuses(context.user.id);
  }),

  getCalLink: protectedProcedure.handler(async () => {
    return env.CAL_COM_LINK ?? null;
  }),

  getIdentityStatus: protectedProcedure.handler(async ({ context }) => {
    return await verificationService.getIdentityStatus(context.user.id);
  }),

  cancelIdentity: protectedProcedure.handler(async ({ context }) => {
    return await verificationService.cancelIdentity(context.user.id);
  }),

  getBadgeDetail: publicProcedure.input(verificationDto.getBadgeDetail.input).handler(async ({ input }) => {
    return await verificationService.getBadgeDetail(input.requestId);
  }),
};
