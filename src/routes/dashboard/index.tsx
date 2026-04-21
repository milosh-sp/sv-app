import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async ({ context }) => {
    const adminRole = context.session
      ? await context.queryClient.ensureQueryData(context.orpc.auth.getAdminRole.queryOptions())
      : null;

    if (adminRole?.role === "skill_verdict_admin") {
      throw redirect({ to: "/dashboard/admin/experience-queue", replace: true });
    }

    throw redirect({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] }, replace: true });
  },
});
