import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";
import { getDashboardMode, getEffectiveDashboardMode } from "@/utils/dashboard-mode";

export const Route = createFileRoute("/dashboard/reviewer")({
  beforeLoad: async ({ context }) => {
    const [{ role }, cookieMode] = await Promise.all([
      context.queryClient.ensureQueryData(getAdminRoleQueryOptionsForUser(context.session.user.id)),
      getDashboardMode(),
    ]);

    if (role !== "reviewer_admin" || getEffectiveDashboardMode(role, cookieMode) === "user") {
      throw redirect({ to: "/dashboard/resumes", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
