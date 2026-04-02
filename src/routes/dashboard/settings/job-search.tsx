import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/settings/job-search")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/admin/job-search", replace: true });
  },
  component: () => null,
});
