import { ORPCError } from "@orpc/client";
import z from "zod";

import { skillVerdictAdminProcedure } from "../context";
import {
  getGlobalJobSearchSettingsRow,
  getPublicGlobalJobSearchSettings,
  upsertGlobalJobSearchSettings,
} from "../services/global-job-search-settings";
import { jobsService } from "../services/jobs";

export const adminJobSearchRouter = {
  getSettings: skillVerdictAdminProcedure.handler(async () => {
    const pub = await getPublicGlobalJobSearchSettings();
    if (!pub) {
      return {
        hasRow: false,
        apiKeySet: false,
        connectionTestOk: false,
      } as const;
    }
    return { hasRow: true, ...pub };
  }),

  testConnection: skillVerdictAdminProcedure
    .input(z.object({ apiKey: z.string().min(1) }))
    .errors({
      BAD_GATEWAY: {
        message: "The JSearch API returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async ({ input }) => {
      try {
        return await jobsService.testConnection(input.apiKey);
      } catch (error) {
        throw new ORPCError("BAD_GATEWAY", {
          message: error instanceof Error ? error.message : "Connection test failed",
        });
      }
    }),

  testStoredConnection: skillVerdictAdminProcedure
    .errors({
      BAD_GATEWAY: {
        message: "The JSearch API returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async () => {
      const row = await getGlobalJobSearchSettingsRow();
      if (!row?.apiKey) {
        throw new ORPCError("BAD_REQUEST", { message: "No API key saved yet" });
      }
      try {
        return await jobsService.testConnection(row.apiKey);
      } catch (error) {
        throw new ORPCError("BAD_GATEWAY", {
          message: error instanceof Error ? error.message : "Connection test failed",
        });
      }
    }),

  setSettings: skillVerdictAdminProcedure
    .input(z.object({ apiKey: z.string() }))
    .errors({
      BAD_GATEWAY: {
        message: "The JSearch API returned an error or is unreachable.",
        status: 502,
      },
    })
    .handler(async ({ input, context }) => {
      const existing = await getGlobalJobSearchSettingsRow();
      const apiKey = input.apiKey.trim().length > 0 ? input.apiKey.trim() : (existing?.apiKey ?? "");
      if (!apiKey) {
        throw new ORPCError("BAD_REQUEST", { message: "API key is required" });
      }

      let testOk = false;
      try {
        const result = await jobsService.testConnection(apiKey);
        testOk = result.success;
      } catch (error) {
        await upsertGlobalJobSearchSettings(apiKey, false, context.user.id);
        throw new ORPCError("BAD_GATEWAY", {
          message: error instanceof Error ? error.message : "Connection test failed",
        });
      }

      await upsertGlobalJobSearchSettings(apiKey, testOk, context.user.id);
      return { testOk };
    }),
};
