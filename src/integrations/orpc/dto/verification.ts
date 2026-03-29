import z from "zod";

export const verificationDto = {
  requestSkill: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: z.string().uuid(),
      itemLabel: z.string().min(1),
    }),
  },
  requestProject: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: z.string().uuid(),
      itemLabel: z.string().min(1),
    }),
  },
  uploadDocument: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: z.string().uuid(),
      fileUrl: z.string().min(1),
      documentType: z.enum(["payslip", "contract", "freelancer_link"]),
    }),
  },
  requestExperience: {
    input: z.object({
      resumeId: z.string().uuid(),
      itemId: z.string().uuid(),
      itemLabel: z.string().min(1),
      method: z.enum(["document_upload", "freelancer_link"]),
      documentId: z.string().uuid().optional(),
    }),
  },
  getStatus: {
    input: z.object({
      resumeId: z.string().uuid(),
    }),
  },
  getHistory: {
    input: z.object({
      itemId: z.string().uuid(),
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
  getBadgeDetail: {
    input: z.object({
      requestId: z.string().uuid(),
    }),
  },
};
