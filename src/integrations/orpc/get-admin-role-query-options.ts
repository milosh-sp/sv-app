import { orpc } from "@/integrations/orpc/client";

/**
 * oRPC's default `getAdminRole` query key is identical for every user, so React Query
 * can return the previous account's role after logout/login until GC. Always include
 * the current session user id in the key for correct route guards and UI.
 */
export function getAdminRoleQueryOptionsForUser(userId: string) {
  const base = orpc.auth.getAdminRole.queryOptions();
  return {
    ...base,
    queryKey: [...base.queryKey, userId],
  };
}
