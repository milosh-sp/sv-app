import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

export const Route = createFileRoute("/dashboard/reviewer")({
  beforeLoad: async ({ context }) => {
    const { role } = await context.queryClient.ensureQueryData(
      getAdminRoleQueryOptionsForUser(context.session.user.id),
    );
    if (role !== "reviewer_admin") {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
