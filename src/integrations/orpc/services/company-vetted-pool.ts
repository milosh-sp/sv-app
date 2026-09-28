import { and, eq, exists, inArray, sql } from "drizzle-orm";

import { schema } from "@/integrations/drizzle";
import { db } from "@/integrations/drizzle/client";

/**
 * Correlated EXISTS: user has verified identity.
 */
export function hasVerifiedIdentityExists() {
  return exists(
    db
      .select({ one: sql`1` })
      .from(schema.verificationRequests)
      .where(
        and(
          eq(schema.verificationRequests.userId, schema.resume.userId),
          eq(schema.verificationRequests.sectionType, "identity"),
          eq(schema.verificationRequests.status, "verified"),
        ),
      ),
  );
}

/**
 * Correlated EXISTS: user has at least one verified skill, experience, or project.
 */
export function hasVerifiedSkillExperienceOrProjectExists() {
  return exists(
    db
      .select({ one: sql`1` })
      .from(schema.verificationRequests)
      .where(
        and(
          eq(schema.verificationRequests.userId, schema.resume.userId),
          inArray(schema.verificationRequests.sectionType, ["skill", "experience", "project"]),
          eq(schema.verificationRequests.status, "verified"),
        ),
      ),
  );
}

/** Full vetted-employer visibility gates (public + identity + verified item).
 * Work-auth consent is not required here — it only gates sharing/filtering of work-auth details. */
export function vettedEmployerVisibilityConditions() {
  return [eq(schema.resume.isPublic, true), hasVerifiedIdentityExists(), hasVerifiedSkillExperienceOrProjectExists()];
}
