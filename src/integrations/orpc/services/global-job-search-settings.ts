import { eq, sql } from "drizzle-orm";

import { db } from "@/integrations/drizzle/client";
import { globalJobSearchSettings } from "@/integrations/drizzle/schema";

export const GLOBAL_JOB_SEARCH_SETTINGS_ID = "default" as const;

export type GlobalJobSearchSettingsPublic = {
  apiKeySet: boolean;
  connectionTestOk: boolean;
};

function rowIsUsable(row: typeof globalJobSearchSettings.$inferSelect): boolean {
  return row.connectionTestOk && row.apiKey.length > 0;
}

export async function getGlobalJobSearchSettingsRow() {
  const [row] = await db
    .select()
    .from(globalJobSearchSettings)
    .where(eq(globalJobSearchSettings.id, GLOBAL_JOB_SEARCH_SETTINGS_ID))
    .limit(1);
  return row ?? null;
}

export async function getPublicGlobalJobSearchSettings(): Promise<GlobalJobSearchSettingsPublic | null> {
  const row = await getGlobalJobSearchSettingsRow();
  if (!row) return null;
  return {
    apiKeySet: row.apiKey.length > 0,
    connectionTestOk: row.connectionTestOk,
  };
}

export async function getGlobalJobSearchApiKeyForService(): Promise<string | null> {
  const row = await getGlobalJobSearchSettingsRow();
  if (!row || !rowIsUsable(row)) return null;
  return row.apiKey;
}

export async function upsertGlobalJobSearchSettings(
  apiKey: string,
  connectionTestOk: boolean,
  updatedByUserId: string,
) {
  await db
    .insert(globalJobSearchSettings)
    .values({
      id: GLOBAL_JOB_SEARCH_SETTINGS_ID,
      apiKey,
      connectionTestOk,
      updatedByUserId,
    })
    .onConflictDoUpdate({
      target: globalJobSearchSettings.id,
      set: {
        apiKey,
        connectionTestOk,
        updatedByUserId,
        updatedAt: sql`now()`,
      },
    });
}
