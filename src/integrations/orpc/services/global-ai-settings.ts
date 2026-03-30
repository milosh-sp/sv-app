import { eq, sql } from "drizzle-orm";

import { db } from "@/integrations/drizzle/client";
import { globalAiSettings } from "@/integrations/drizzle/schema";

import type z from "zod";

import { aiCredentialsSchema, aiProviderSchema } from "./ai";

export const GLOBAL_AI_SETTINGS_ID = "default" as const;

export type GlobalAiSettingsPublic = {
  provider: z.infer<typeof aiProviderSchema>;
  model: string;
  baseURL: string;
  apiKeySet: boolean;
  connectionTestOk: boolean;
};

function rowIsUsable(row: typeof globalAiSettings.$inferSelect): boolean {
  return row.connectionTestOk && row.model.length > 0 && row.apiKey.length > 0;
}

export async function getGlobalAiSettingsRow() {
  const [row] = await db
    .select()
    .from(globalAiSettings)
    .where(eq(globalAiSettings.id, GLOBAL_AI_SETTINGS_ID))
    .limit(1);
  return row ?? null;
}

export function isGlobalAiAvailable(row: typeof globalAiSettings.$inferSelect | null): boolean {
  if (!row) return false;
  return rowIsUsable(row);
}

export async function getGlobalAiCredentialsForService(): Promise<z.infer<typeof aiCredentialsSchema> | null> {
  const row = await getGlobalAiSettingsRow();
  if (!row || !rowIsUsable(row)) return null;
  const parsed = aiCredentialsSchema.safeParse({
    provider: row.provider,
    model: row.model,
    apiKey: row.apiKey,
    baseURL: row.baseURL,
  });
  return parsed.success ? parsed.data : null;
}

export async function getPublicGlobalAiSettings(): Promise<GlobalAiSettingsPublic | null> {
  const row = await getGlobalAiSettingsRow();
  if (!row) return null;
  const parsedProvider = aiProviderSchema.safeParse(row.provider);
  return {
    provider: parsedProvider.success ? parsedProvider.data : "openai",
    model: row.model,
    baseURL: row.baseURL,
    apiKeySet: row.apiKey.length > 0,
    connectionTestOk: row.connectionTestOk,
  };
}

export async function upsertGlobalAiSettings(
  creds: z.infer<typeof aiCredentialsSchema>,
  connectionTestOk: boolean,
  updatedByUserId: string,
) {
  await db
    .insert(globalAiSettings)
    .values({
      id: GLOBAL_AI_SETTINGS_ID,
      provider: creds.provider,
      model: creds.model,
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
      connectionTestOk,
      updatedByUserId,
    })
    .onConflictDoUpdate({
      target: globalAiSettings.id,
      set: {
        provider: creds.provider,
        model: creds.model,
        apiKey: creds.apiKey,
        baseURL: creds.baseURL,
        connectionTestOk,
        updatedByUserId,
        updatedAt: sql`now()`,
      },
    });
}
