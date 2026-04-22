import { ORPCError } from "@orpc/client";
import { type } from "@orpc/server";
import { AISDKError, type UIMessage } from "ai";
import { OllamaError } from "ai-sdk-ollama";
import z, { flattenError, ZodError } from "zod";

import { jobResultSchema } from "@/schema/jobs";
import { type ResumeData, resumeDataSchema } from "@/schema/resume/data";
import { tailorOutputSchema } from "@/schema/tailor";

import { protectedProcedure } from "../context";
import { aiProviderSchema, aiService, fileInputSchema } from "../services/ai";
import { getGlobalAiCredentialsForService } from "../services/global-ai-settings";

async function requireGlobalAiCredentials() {
  const creds = await getGlobalAiCredentialsForService();
  if (!creds) {
    throw new ORPCError("SERVICE_UNAVAILABLE", {
      message: "AI integration is not configured. Contact an administrator.",
    });
  }
  return creds;
}

export const aiRouter = {
  getAvailability: protectedProcedure
    .route({
      method: "GET",
      path: "/ai/availability",
      tags: ["AI"],
      operationId: "getAiAvailability",
      summary: "Whether global AI is configured and ready",
      description:
        "Returns whether a Skill Verdict admin has saved and verified global AI credentials. Used to enable AI features for signed-in users.",
    })
    .output(
      z.object({
        configured: z.boolean(),
        provider: aiProviderSchema.nullable(),
        model: z.string().nullable(),
      }),
    )
    .handler(async () => {
      const creds = await getGlobalAiCredentialsForService();
      if (!creds) {
        return { configured: false, provider: null, model: null };
      }
      return {
        configured: true,
        provider: creds.provider,
        model: creds.model,
      };
    }),

  parsePdf: protectedProcedure
    .route({
      method: "POST",
      path: "/ai/parse-pdf",
      tags: ["AI"],
      operationId: "parseResumePdf",
      summary: "Parse a PDF file into resume data",
      description:
        "Extracts structured resume data from a PDF file using the globally configured AI provider. Requires authentication.",
      successDescription: "The PDF was successfully parsed into structured resume data.",
    })
    .input(z.object({ file: fileInputSchema }))
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
      BAD_REQUEST: {
        message: "The AI returned an improperly formatted structure.",
        status: 400,
      },
      SERVICE_UNAVAILABLE: {
        message: "AI integration is not configured.",
        status: 503,
      },
    })
    .handler(async ({ input }): Promise<ResumeData> => {
      const creds = await requireGlobalAiCredentials();
      try {
        return await aiService.parsePdf({ ...creds, ...input });
      } catch (error) {
        if (error instanceof AISDKError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        if (error instanceof ZodError) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid resume data structure",
            cause: flattenError(error),
          });
        }
        throw error;
      }
    }),

  parseDocx: protectedProcedure
    .route({
      method: "POST",
      path: "/ai/parse-docx",
      tags: ["AI"],
      operationId: "parseResumeDocx",
      summary: "Parse a DOCX file into resume data",
      description:
        "Extracts structured resume data from a DOCX or DOC file using the globally configured AI provider. Requires authentication.",
      successDescription: "The DOCX was successfully parsed into structured resume data.",
    })
    .input(
      z.object({
        file: fileInputSchema,
        mediaType: z.enum([
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ]),
      }),
    )
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
      BAD_REQUEST: {
        message: "The AI returned an improperly formatted structure.",
        status: 400,
      },
      SERVICE_UNAVAILABLE: {
        message: "AI integration is not configured.",
        status: 503,
      },
    })
    .handler(async ({ input }) => {
      const creds = await requireGlobalAiCredentials();
      try {
        return await aiService.parseDocx({ ...creds, ...input });
      } catch (error) {
        if (error instanceof AISDKError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        if (error instanceof ZodError) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid resume data structure",
            cause: flattenError(error),
          });
        }

        throw error;
      }
    }),

  chat: protectedProcedure
    .route({
      method: "POST",
      path: "/ai/chat",
      tags: ["AI"],
      operationId: "aiChat",
      summary: "Chat with AI to modify resume",
      description: "Streams a chat response using the globally configured AI provider. Requires authentication.",
    })
    .input(
      type<{
        messages: UIMessage[];
        resumeData: ResumeData;
      }>(),
    )
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
      SERVICE_UNAVAILABLE: {
        message: "AI integration is not configured.",
        status: 503,
      },
    })
    .handler(async ({ input }) => {
      const creds = await requireGlobalAiCredentials();
      try {
        return await aiService.chat({ ...creds, ...input });
      } catch (error) {
        if (error instanceof AISDKError || error instanceof OllamaError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        throw error;
      }
    }),

  tailorResume: protectedProcedure
    .route({
      method: "POST",
      path: "/ai/tailor-resume",
      tags: ["AI"],
      operationId: "tailorResume",
      summary: "Auto-tailor resume for a job posting",
      description:
        "Uses the globally configured AI provider to tailor a resume for a job posting. Requires authentication.",
      successDescription: "Structured tailoring output returned successfully.",
    })
    .input(
      z.object({
        resumeData: resumeDataSchema,
        job: jobResultSchema,
      }),
    )
    .output(tailorOutputSchema)
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
      BAD_REQUEST: {
        message: "The AI returned an improperly formatted structure.",
        status: 400,
      },
      SERVICE_UNAVAILABLE: {
        message: "AI integration is not configured.",
        status: 503,
      },
    })
    .handler(async ({ input }) => {
      const creds = await requireGlobalAiCredentials();
      try {
        return await aiService.tailorResume({ ...creds, ...input });
      } catch (error) {
        if (error instanceof AISDKError || error instanceof OllamaError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        if (error instanceof ZodError) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Invalid resume data structure",
            cause: flattenError(error),
          });
        }

        throw error;
      }
    }),
};
