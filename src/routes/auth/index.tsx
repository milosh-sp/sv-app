import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/")({
  beforeLoad: async ({ context }) => {
    if (context.session) {
      throw redirect({
        to: context.session.user.emailVerified ? "/dashboard" : "/auth/verify-email",
        replace: true,
      });
    }

    throw redirect({ to: "/auth/login", replace: true });
  },
});
