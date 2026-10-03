import { companyProcedure, protectedProcedure } from "../context";
import { companyDto } from "../dto/company";
import { companyService } from "../services/company";

export const companyRouter = {
  matchCandidates: companyProcedure
    .input(companyDto.matchCandidates.input)
    .output(companyDto.matchCandidates.output)
    .handler(async ({ context, input }) => {
      return await companyService.matchCandidates(context.user.id, input);
    }),

  listSaved: companyProcedure
    .input(companyDto.listSaved.input)
    .output(companyDto.listSaved.output)
    .handler(async ({ context, input }) => {
      return await companyService.listSaved(context.user.id, input.listType);
    }),

  setSaved: companyProcedure
    .input(companyDto.setSaved.input)
    .output(companyDto.setSaved.output)
    .handler(async ({ context, input }) => {
      return await companyService.setSaved({
        companyUserId: context.user.id,
        candidateUserId: input.candidateUserId,
        resumeId: input.resumeId,
        listType: input.listType,
        saved: input.saved,
      });
    }),

  createContactRequest: companyProcedure
    .input(companyDto.createContactRequest.input)
    .output(companyDto.createContactRequest.output)
    .handler(async ({ context, input }) => {
      return await companyService.createContactRequest({
        companyUserId: context.user.id,
        companyName: context.user.name,
        candidateUserId: input.candidateUserId,
        resumeId: input.resumeId,
      });
    }),

  listContactRequests: companyProcedure
    .input(companyDto.listContactRequests.input)
    .output(companyDto.listContactRequests.output)
    .handler(async ({ context, input }) => {
      return await companyService.listContactRequests(context.user.id, input);
    }),

  listMyContactRequests: protectedProcedure
    .input(companyDto.listMyContactRequests.input)
    .output(companyDto.listMyContactRequests.output)
    .handler(async ({ context, input }) => {
      return await companyService.listMyContactRequests(context.user.id, input);
    }),

  respondToContactRequest: protectedProcedure
    .input(companyDto.respondToContactRequest.input)
    .output(companyDto.respondToContactRequest.output)
    .handler(async ({ context, input }) => {
      return await companyService.respondToContactRequest({
        candidateUserId: context.user.id,
        candidateName: context.user.name,
        candidateEmail: context.user.email,
        id: input.id,
        decision: input.decision,
      });
    }),
};
