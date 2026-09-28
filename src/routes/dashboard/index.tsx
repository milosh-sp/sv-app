import { createFileRoute, redirect } from "@tanstack/react-router";

import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async ({ context }) => {
    const adminRole = context.session
      ? await context.queryClient.ensureQueryData(getAdminRoleQueryOptionsForUser(context.session.user.id))
      : null;

    if (adminRole?.role === "skill_verdict_admin") {
      throw redirect({ to: "/dashboard/admin/experience-queue", replace: true });
    }

    if (adminRole?.role === "company") {
      throw redirect({ to: "/dashboard/company/match", replace: true });
    }

    throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
  },
});
