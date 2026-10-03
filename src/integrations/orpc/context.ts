import type { User } from "better-auth";

import { ORPCError, os } from "@orpc/server";
import { eq } from "drizzle-orm";

import type { Locale } from "@/utils/locale";

import { type AdminRole, getEffectiveDashboardMode, parseDashboardModeFromCookieHeader } from "@/utils/dashboard-mode";
import { env } from "@/utils/env";

import { auth, verifyOAuthToken } from "../auth/config";
import { db } from "../drizzle/client";
import { adminRoles, user } from "../drizzle/schema";

interface ORPCContext {
  locale: Locale;
  reqHeaders?: Headers;
}

type AuthSource = "api-key" | "bearer" | "session";

async function getUserFromBearerToken(headers: Headers): Promise<User | null> {
  try {
    const authHeader = headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const payload = await verifyOAuthToken(authHeader.slice(7));
    if (!payload?.sub) return null;

    const [userResult] = await db.select().from(user).where(eq(user.id, payload.sub)).limit(1);
    return userResult ?? null;
  } catch {
    return null;
  }
}

async function getUserFromHeaders(headers: Headers): Promise<User | null> {
  try {
    const result = await auth.api.getSession({ headers });
    if (!result || !result.user) return null;

    return result.user;
  } catch {
    return null;
  }
}

async function getUserFromApiKey(apiKey: string): Promise<User | null> {
  try {
    const result = await auth.api.verifyApiKey({ body: { key: apiKey } });
    if (!result.key || !result.valid) return null;

    const [userResult] = await db.select().from(user).where(eq(user.id, result.key.referenceId)).limit(1);
    if (!userResult) return null;

    return userResult;
  } catch {
    return null;
  }
}

const base = os.$context<ORPCContext>();

export const publicProcedure = base.use(async ({ context, next }) => {
  const headers = context.reqHeaders ?? new Headers();
  const apiKey = headers.get("x-api-key");
  let user: User | null = null;
  let authSource: AuthSource | null = null;

  if (apiKey) {
    user = await getUserFromApiKey(apiKey);
    if (user) authSource = "api-key";
  }

  if (!user) {
    user = await getUserFromBearerToken(headers);
    if (user) authSource = "bearer";
  }

  if (!user) {
    user = await getUserFromHeaders(headers);
    if (user) authSource = "session";
  }

  return next({
    context: {
      ...context,
      user: user ?? null,
      authSource,
    },
  });
});

export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  if (context.authSource === "session" && !context.user.emailVerified) {
    throw new ORPCError("FORBIDDEN", {
      message: "Please verify your email address before continuing.",
    });
  }

  return next({
    context: {
      ...context,
      user: context.user,
    },
  });
});

/**
 * Server-only procedure that can only be called from server-side code (e.g., loaders).
 * Rejects requests from the browser with a 401 UNAUTHORIZED error.
 */
export const serverOnlyProcedure = publicProcedure.use(async ({ context, next }) => {
  const headers = context.reqHeaders ?? new Headers();
  const isDebugBypassEnabled = env.FLAG_DEBUG_PRINTER && process.env.NODE_ENV === "development";

  // Check for the custom header that indicates this is a server-side call
  // Server-side calls using createRouterClient have this header set
  const isServerSideCall = isDebugBypassEnabled || headers.get("x-server-side-call") === "true";

  // If the header is not present, this is a client-side HTTP request - reject it
  if (!isServerSideCall) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "This endpoint can only be called from server-side code",
    });
  }

  return next({ context });
});

export const skillVerdictAdminProcedure = protectedProcedure.use(async ({ context, next }) => {
  const [role] = await db.select().from(adminRoles).where(eq(adminRoles.userId, context.user.id)).limit(1);

  if (!role || role.role !== "skill_verdict_admin") {
    throw new ORPCError("FORBIDDEN", { message: "Skill Verdict Admin role required" });
  }

  return next({ context: { ...context, adminRole: "skill_verdict_admin" as const } });
});

export const reviewerAdminProcedure = protectedProcedure.use(async ({ context, next }) => {
  const [role] = await db.select().from(adminRoles).where(eq(adminRoles.userId, context.user.id)).limit(1);

  if (!role || role.role !== "reviewer_admin") {
    throw new ORPCError("FORBIDDEN", { message: "Reviewer Admin role required" });
  }

  const cookieMode = parseDashboardModeFromCookieHeader(context.reqHeaders ?? new Headers());
  if (getEffectiveDashboardMode(role.role, cookieMode) === "user") {
    throw new ORPCError("FORBIDDEN", {
      message: "Reviewer actions are unavailable while in User Mode. Switch to Reviewer Mode to continue.",
    });
  }

  return next({ context: { ...context, adminRole: "reviewer_admin" as const } });
});

const requireRoles = <const R extends NonNullable<AdminRole>>(...roles: R[]) =>
  protectedProcedure.use(async ({ context, next }) => {
    const [row] = await db
      .select({ role: adminRoles.role })
      .from(adminRoles)
      .where(eq(adminRoles.userId, context.user.id))
      .limit(1);

    if (!row || !(roles as AdminRole[]).includes(row.role)) {
      throw new ORPCError("FORBIDDEN", { message: `Role required: ${roles.join(" or ")}` });
    }

    return next({ context: { ...context, adminRole: row.role as R } });
  });

export const companyProcedure = requireRoles("company");

/** Company accounts, or Skill Verdict admins (for debugging employer search). */
export const companyOrSkillVerdictAdminProcedure = requireRoles("company", "skill_verdict_admin");
