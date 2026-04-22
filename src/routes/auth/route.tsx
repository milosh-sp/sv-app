import { createFileRoute, Outlet } from "@tanstack/react-router";

import { BrandIcon } from "@/components/ui/brand-icon";

export const Route = createFileRoute("/auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="dark min-h-svh w-dvw bg-background text-foreground">
      <div className="xs:px-0 mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4 py-8">
        <BrandIcon className="mb-8 size-16 self-center" />
        <Outlet />
      </div>
    </div>
  );
}
