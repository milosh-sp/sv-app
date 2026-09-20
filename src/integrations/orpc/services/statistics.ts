import { count } from "drizzle-orm";
import fs from "node:fs/promises";
import { dirname, join } from "node:path";

import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";

const CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

const LAST_KNOWN = {
  users: 978_528,
  resumes: 1_336_307,
} as const;

const getCachePath = (key: string) => join(process.cwd(), "data", "statistics", `${key}.txt`);

const readCache = async (key: string): Promise<number | null> => {
  try {
    const filePath = getCachePath(key);
    const [stats, contents] = await Promise.all([fs.stat(filePath), fs.readFile(filePath, "utf-8")]);

    if (stats.mtimeMs < Date.now() - CACHE_DURATION_MS) return null;

    const value = Number.parseInt(contents, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, value: number) => {
  try {
    const filePath = getCachePath(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, String(value), "utf-8");
  } catch {
    // Ignore errors, cache is not critical
  }
};

const getCachedCount = async (
  key: string,
  lastKnown: number,
  fetcher: () => Promise<number | null>,
): Promise<number> => {
  const cached = await readCache(key);
  if (cached !== null) return cached;

  try {
    const value = await fetcher();
    if (value !== null) {
      await writeCache(key, value);
      return value;
    }
  } catch {
    // Ignore errors, use last known value
  }

  return lastKnown;
};

const getCountFromDatabase = async (table: typeof schema.user | typeof schema.resume): Promise<number | null> => {
  const [result] = await db.select({ count: count() }).from(table);
  return result.count;
};

export const statisticsService = {
  user: {
    getCount: () => {
      return getCachedCount("users", LAST_KNOWN.users, () => getCountFromDatabase(schema.user));
    },
  },
  resume: {
    getCount: () => {
      return getCachedCount("resumes", LAST_KNOWN.resumes, () => getCountFromDatabase(schema.resume));
    },
  },
};
