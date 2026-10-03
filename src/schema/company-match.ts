import z from "zod";

export const companyMatchItemSchema = z.object({
  resumeId: z.string().uuid(),
  matchScore: z.number().min(0).max(100),
  matchReason: z.string().min(1),
});

export const companyMatchOutputSchema = z.object({
  matches: z.array(companyMatchItemSchema),
});

export type CompanyMatchOutput = z.infer<typeof companyMatchOutputSchema>;
