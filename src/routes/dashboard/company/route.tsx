import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

export const Route = createFileRoute("/dashboard/company")({
  beforeLoad: async ({ context, location }) => {
    const { role } = await context.queryClient.ensureQueryData(
      getAdminRoleQueryOptionsForUser(context.session.user.id),
    );
    if (role !== "company") {
      throw redirect({ to: "/dashboard", replace: true });
    }
    if (location.pathname.replace(/\/$/, "") === "/dashboard/company") {
      throw redirect({ to: "/dashboard/company/match", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
