import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";

import { SidebarProvider } from "@/components/ui/sidebar";

import { getDashboardSidebarServerFn, setDashboardSidebarServerFn } from "./-components/functions";
import { DashboardSidebar } from "./-components/sidebar";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async ({ context, location }) => {
    if (!context.session) throw redirect({ to: "/auth/login", replace: true });
    if (!context.session.user.emailVerified) {
      throw redirect({
        to: "/auth/verify-email",
        search: { callbackURL: location.href },
        replace: true,
      });
    }

    return { session: context.session };
  },
  loader: async () => {
    const sidebarState = await getDashboardSidebarServerFn();
    return { sidebarState };
  },
});

function RouteComponent() {
  const router = useRouter();
  const { sidebarState } = Route.useLoaderData();

  const handleSidebarOpenChange = async (open: boolean) => {
    await setDashboardSidebarServerFn({ data: open });
    void router.invalidate();
  };

  return (
    <SidebarProvider
      open={sidebarState}
      onOpenChange={handleSidebarOpenChange}
      className="relative mx-auto min-h-svh max-w-[1500px] px-3 md:px-6"
    >
      <DashboardSidebar />

      <main className="@container flex-1 p-4 md:px-10 md:py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center *:w-full">
          <Outlet />
        </div>
      </main>
    </SidebarProvider>
  );
}
