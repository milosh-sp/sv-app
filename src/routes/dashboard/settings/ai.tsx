import { createFileRoute, redirect } from "@tanstack/react-router";

/** Hidden route: `/dashboard/settings/ai` redirects so old links do not 404; no user-facing AI settings. */
export const Route = createFileRoute("/dashboard/settings/ai")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/settings/profile", replace: true });
  },
});
