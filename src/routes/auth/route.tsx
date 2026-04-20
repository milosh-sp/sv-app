import { Trans } from "@lingui/react/macro";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { BrandIcon } from "@/components/ui/brand-icon";
import { APP_NAME } from "@/constants/brand";

export const Route = createFileRoute("/auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="relative mx-auto flex h-svh w-dvw max-w-sm flex-col justify-center gap-y-6 px-4 xs:px-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,rgba(120,120,120,0.2)_1px,transparent_0)] bg-size-[28px_28px]"
      />

      <div className="mb-4 flex flex-col items-center gap-3">
        <span className="flex size-16 items-center justify-center border-2 border-foreground bg-brand-lime">
          <BrandIcon forceTheme="light" className="size-10" />
        </span>

        <span className="font-mono text-[0.72rem] tracking-[0.25em] text-muted-foreground uppercase">
          — {APP_NAME}
        </span>

        <span className="font-mono text-[0.68rem] tracking-[0.18em] uppercase">
          <Trans>Don't chase. Attract.</Trans>
        </span>
      </div>

      <Outlet />
    </div>
  );
}
