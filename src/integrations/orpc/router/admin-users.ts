import { ORPCError } from "@orpc/client";
import { and, count, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import z from "zod";

import { db } from "@/integrations/drizzle/client";
import { adminRoleEnum, adminRoles, user } from "@/integrations/drizzle/schema";

import { skillVerdictAdminProcedure } from "../context";

const listUsersInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  /** Case-insensitive match on name, email, username, display username. */
  query: z
    .string()
    .max(200)
    .optional()
    .transform((s) => {
      const t = s?.trim() ?? "";
      return t.length > 0 ? t : undefined;
    }),
  roleFilter: z.enum(["all", "user", "skill_verdict_admin", "reviewer_admin"]).default("all"),
});

function searchOrCondition(query: string) {
  const pattern = `%${query.slice(0, 200)}%`;
  return or(
    ilike(user.name, pattern),
    ilike(user.email, pattern),
    ilike(user.username, pattern),
    ilike(user.displayUsername, pattern),
  )!;
}

const setUserAdminRoleInputSchema = z.object({
  userId: z.string().uuid(),
  role: z.union([z.enum(adminRoleEnum.enumValues), z.null()]),
});

export const adminUsersRouter = {
  listUsers: skillVerdictAdminProcedure.input(listUsersInputSchema).handler(async ({ input }) => {
    const { page, pageSize, query, roleFilter } = input;
    const offset = (page - 1) * pageSize;

    const filters = [];
    if (query) filters.push(searchOrCondition(query));
    if (roleFilter === "user") filters.push(isNull(adminRoles.role));
    if (roleFilter === "skill_verdict_admin") filters.push(eq(adminRoles.role, "skill_verdict_admin"));
    if (roleFilter === "reviewer_admin") filters.push(eq(adminRoles.role, "reviewer_admin"));
    const where = filters.length > 0 ? and(...filters) : undefined;

    const [totalRow] = await db
      .select({ total: count() })
      .from(user)
      .leftJoin(adminRoles, eq(user.id, adminRoles.userId))
      .where(where);
    const total = totalRow?.total ?? 0;

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        displayUsername: user.displayUsername,
        createdAt: user.createdAt,
        adminRole: adminRoles.role,
      })
      .from(user)
      .leftJoin(adminRoles, eq(user.id, adminRoles.userId))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(pageSize)
      .offset(offset);

    return {
      users: rows,
      total,
      page,
      pageSize,
    };
  }),

  setUserAdminRole: skillVerdictAdminProcedure
    .input(setUserAdminRoleInputSchema)
    .handler(async ({ context, input }) => {
      const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.userId)).limit(1);
      if (!target) {
        throw new ORPCError("NOT_FOUND", { message: "User not found" });
      }

      if (input.userId === context.user.id && (input.role === null || input.role === "reviewer_admin")) {
        const [other] = await db
          .select({ userId: adminRoles.userId })
          .from(adminRoles)
          .where(and(eq(adminRoles.role, "skill_verdict_admin"), ne(adminRoles.userId, context.user.id)))
          .limit(1);
        if (!other) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Assign another Skill Verdict Admin before changing your own role.",
          });
        }
      }

      if (input.role === null) {
        await db.delete(adminRoles).where(eq(adminRoles.userId, input.userId));
        return { ok: true as const };
      }

      await db
        .insert(adminRoles)
        .values({ userId: input.userId, role: input.role })
        .onConflictDoUpdate({
          target: adminRoles.userId,
          set: { role: input.role },
        });

      return { ok: true as const };
    }),
};
