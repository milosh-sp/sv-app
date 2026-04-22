import { eq } from "drizzle-orm";

import { db } from "@/integrations/drizzle/client";
import { adminRoles } from "@/integrations/drizzle/schema";

import { protectedProcedure, publicProcedure } from "../context";
import { authService, type ProviderList } from "../services/auth";

export const authRouter = {
  providers: {
    list: publicProcedure
      .route({
        method: "GET",
        path: "/auth/providers",
        tags: ["Authentication"],
        operationId: "listAuthProviders",
        summary: "List authentication providers",
        description:
          "Returns a list of all authentication providers enabled on this Skill Verdict instance, along with their display names. Possible providers include password-based credentials, Google, GitHub, and custom OAuth. No authentication required.",
        successDescription: "A map of enabled authentication provider identifiers to their display names.",
      })
      .handler((): ProviderList => {
        return authService.providers.list();
      }),
  },

  getAdminRole: protectedProcedure
    .route({
      method: "GET",
      path: "/auth/admin-role",
      tags: ["Authentication"],
      operationId: "getAdminRole",
      summary: "Get current user's admin role",
      description: "Returns the admin role of the authenticated user, or null if the user has no admin role assigned.",
      successDescription: "The admin role of the current user, or null.",
    })
    .handler(async ({ context }) => {
      const [row] = await db
        .select({ role: adminRoles.role })
        .from(adminRoles)
        .where(eq(adminRoles.userId, context.user.id))
        .limit(1);
      return { role: row?.role ?? null };
    }),

  deleteAccount: protectedProcedure
    .route({
      method: "DELETE",
      path: "/auth/account",
      tags: ["Authentication"],
      operationId: "deleteAccount",
      summary: "Delete user account",
      description:
        "Permanently deletes the authenticated user's account, including all resumes, uploaded files (profile pictures, screenshots, PDFs), and associated data. This action is irreversible. Requires authentication.",
      successDescription: "The user account and all associated data have been successfully deleted.",
    })
    .handler(async ({ context }): Promise<void> => {
      return await authService.deleteAccount({ userId: context.user.id });
    }),
};
