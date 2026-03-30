import { ORPCError } from "@orpc/client";
import { AISDKError } from "ai";
import { OllamaError } from "ai-sdk-ollama";
import z from "zod";

import { skillVerdictAdminProcedure } from "../context";
import { aiCredentialsSchema, aiProviderSchema, aiService } from "../services/ai";
import {
  getGlobalAiSettingsRow,
  getPublicGlobalAiSettings,
  upsertGlobalAiSettings,
} from "../services/global-ai-settings";

const setGlobalAiInputSchema = z.object({
  provider: aiProviderSchema,
  model: z.string().min(1),
  apiKey: z.string(),
  baseURL: z.string(),
});

export const adminAiRouter = {
  getSettings: skillVerdictAdminProcedure.handler(async () => {
    const pub = await getPublicGlobalAiSettings();
    if (!pub) {
      return {
        hasRow: false,
        provider: "openai" as z.infer<typeof aiProviderSchema>,
        model: "",
        baseURL: "",
        apiKeySet: false,
        connectionTestOk: false,
      } as const;
    }
    return { hasRow: true, ...pub };
  }),

  testConnection: skillVerdictAdminProcedure
    .input(aiCredentialsSchema)
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async ({ input }) => {
      try {
        return await aiService.testConnection(input);
      } catch (error) {
        if (error instanceof AISDKError || error instanceof OllamaError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        throw error;
      }
    }),

  testStoredConnection: skillVerdictAdminProcedure
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async () => {
      const row = await getGlobalAiSettingsRow();
      if (!row?.apiKey) {
        throw new ORPCError("BAD_REQUEST", { message: "No API key saved yet" });
      }
      const parsed = aiProviderSchema.safeParse(row.provider);
      const creds = {
        provider: parsed.success ? parsed.data : ("openai" as const),
        model: row.model,
        apiKey: row.apiKey,
        baseURL: row.baseURL,
      };
      try {
        return await aiService.testConnection(creds);
      } catch (error) {
        if (error instanceof AISDKError || error instanceof OllamaError) {
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        throw error;
      }
    }),

  setSettings: skillVerdictAdminProcedure
    .input(setGlobalAiInputSchema)
    .errors({
      BAD_GATEWAY: {
        message: "The AI provider returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async ({ input, context }) => {
      const existing = await getGlobalAiSettingsRow();
      const apiKey = input.apiKey.trim().length > 0 ? input.apiKey.trim() : (existing?.apiKey ?? "");
      if (!apiKey) {
        throw new ORPCError("BAD_REQUEST", { message: "API key is required" });
      }

      const creds = {
        provider: input.provider,
        model: input.model,
        apiKey,
        baseURL: input.baseURL,
      };

      let testOk = false;
      try {
        testOk = await aiService.testConnection(creds);
      } catch (error) {
        if (error instanceof AISDKError || error instanceof OllamaError) {
          await upsertGlobalAiSettings(creds, false, context.user.id);
          throw new ORPCError("BAD_GATEWAY", { message: error.message });
        }

        throw error;
      }

      await upsertGlobalAiSettings(creds, testOk, context.user.id);
      return { testOk };
    }),
};
