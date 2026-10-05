import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const session = vi.hoisted(() => ({ current: null as null | { user?: { id?: string } } }));
const query = vi.hoisted(() => ({ data: undefined as { role: string | null } | undefined }));
const nav = vi.hoisted(() => ({
  navigate: vi.fn(async () => undefined),
  invalidate: vi.fn(async () => undefined),
}));
const fail = vi.hoisted(() => ({ value: false }));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: nav.invalidate }),
  useNavigate: () => nav.navigate,
  useRouteContext: () => ({ session: session.current }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: query.data }),
  useMutation: (options: {
    mutationFn: (mode: "user" | "reviewer") => Promise<void>;
    onSuccess: (data: unknown, mode: "user" | "reviewer") => Promise<void>;
    onError: () => void;
  }) => ({
    isPending: false,
    mutateAsync: async (mode: "user" | "reviewer") => {
      try {
        await options.mutationFn(mode);
        await options.onSuccess(undefined, mode);
      } catch {
        options.onError();
      }
    },
  }),
}));
vi.mock("@/integrations/orpc/get-admin-role-query-options", () => ({
  getAdminRoleQueryOptionsForUser: (userId: string) => ({ queryKey: ["admin-role", userId] }),
}));
vi.mock("@/utils/dashboard-mode", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/dashboard-mode")>();
  return {
    ...actual,
    setDashboardModeServerFn: vi.fn(async () => {
      if (fail.value) throw new Error("fail");
    }),
    writeDashboardModeToClientCookie: vi.fn(),
  };
});

import { writeDashboardModeToClientCookie } from "@/utils/dashboard-mode";

import { DashboardModeProvider, useDashboardMode } from "./provider";

function Panel() {
  const mode = useDashboardMode();
  return (
    <>
      <button type="button" onClick={() => void mode.setMode("reviewer")}>
        reviewer
      </button>
      <button type="button" onClick={() => void mode.setMode("user")}>
        user
      </button>
      <span>{mode.cookieMode}</span>
    </>
  );
}

describe("dashboard mode", () => {
  it("syncs the cookie, switches modes, and recovers from a failed write", async () => {
    session.current = null;
    query.data = undefined;
    fail.value = false;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <DashboardModeProvider dashboardMode="user">
          <Panel />
        </DashboardModeProvider>,
      );
    });
    session.current = { user: { id: "user-1" } };
    query.data = { role: "reviewer_admin" };
    await act(async () => {
      root.render(
        <DashboardModeProvider dashboardMode="reviewer">
          <Panel />
        </DashboardModeProvider>,
      );
    });
    expect(container.textContent).toContain("reviewer");

    const click = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((item) => item.textContent === label);
      await act(async () => {
        button?.click();
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    await click("reviewer");
    expect(nav.navigate).toHaveBeenCalledWith({ to: "/dashboard/reviewer/queue", replace: true });
    await click("user");
    expect(nav.navigate).toHaveBeenCalledWith({ to: "/dashboard/resumes", replace: true });

    fail.value = true;
    await click("user");
    expect(writeDashboardModeToClientCookie).toHaveBeenCalledWith("reviewer");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("throws outside the provider", async () => {
    function Bare() {
      useDashboardMode();
      return null;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    await expect(
      act(async () => {
        root.render(<Bare />);
      }),
    ).rejects.toThrow("useDashboardMode must be used within a DashboardModeProvider");
    root.unmount();
  });
});
