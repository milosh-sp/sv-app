import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute("/dashboard/admin")({
  beforeLoad: async ({ context }) => {
    const { role } = await context.queryClient.ensureQueryData(orpc.auth.getAdminRole.queryOptions());
    if (role !== "skill_verdict_admin") {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
