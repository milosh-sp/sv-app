import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

const session = vi.hoisted(() => ({
  current: { user: { id: "user-1", name: "Ada", email: "ada@example.com" } } as {
    user?: { id?: string; name?: string; email?: string };
  } | null,
}));
const role = vi.hoisted(() => ({ value: null as string | null, status: "unverified" }));
const mode = vi.hoisted(() => ({ value: "user" as "user" | "reviewer" }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { t: (message: { id?: string } | string) => (typeof message === "string" ? message : (message?.id ?? "")) } }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useRouteContext: () => ({ session: session.current }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { role: role.value, status: role.status } }),
}));
vi.mock("@/hooks/use-dashboard-mode", () => ({
  useDashboardMode: () => ({ effectiveMode: mode.value }),
}));
vi.mock("@/components/user/dropdown-menu", () => ({
  UserDropdownMenu: ({
    children,
  }: {
    children: (args: { session: { user: { name: string; email: string; image: null } } }) => React.ReactNode;
  }) => children({ session: { user: { name: "Ada Lovelace", email: "ada@example.com", image: null } } }),
}));

import { SidebarProvider } from "@/components/ui/sidebar";

import { DashboardSidebar } from "./sidebar";
import {
  deriveIdentitySidebarVerificationState,
  SidebarIdentityVerificationStatus,
} from "./sidebar-identity-verification-status";

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

describe("dashboard sidebar", () => {
  it("derives identity status and shows each role", async () => {
    expect(deriveIdentitySidebarVerificationState(null)).toBe("unverified");
    expect(deriveIdentitySidebarVerificationState({ status: "verified" })).toBe("verified");
    expect(deriveIdentitySidebarVerificationState({ status: "pending" })).toBe("pending");
    expect(deriveIdentitySidebarVerificationState({ status: "claimed" })).toBe("pending");
    expect(deriveIdentitySidebarVerificationState({ status: "verdict_pending" })).toBe("pending");
    expect(deriveIdentitySidebarVerificationState({ status: "rejected" })).toBe("unverified");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    async function show(next: { sessionId?: string | null; role: string | null; status: string; dashboard: "user" | "reviewer" }) {
      session.current = next.sessionId === null ? null : { user: next.sessionId === "" ? { name: "Ada" } : { id: next.sessionId ?? "user-1", name: "Ada", email: "ada@example.com" } };
      role.value = next.role;
      role.status = next.status;
      mode.value = next.dashboard;
      await act(async () => {
        root.render(
          <SidebarProvider>
            <DashboardSidebar />
            <SidebarIdentityVerificationStatus state={next.status === "verified" ? "verified" : next.status === "pending" ? "pending" : "unverified"} />
          </SidebarProvider>,
        );
      });
    }

    await show({ sessionId: null, role: null, status: "unverified", dashboard: "user" });
    await show({ sessionId: "", role: null, status: "verified", dashboard: "user" });
    await show({ role: "skill_verdict_admin", status: "verified", dashboard: "user" });
    expect(container.textContent).toContain("Skill Verdict Admin");
    await show({ role: "company", status: "pending", dashboard: "user" });
    expect(container.textContent).toContain("Company");
    await show({ role: "reviewer_admin", status: "claimed", dashboard: "reviewer" });
    expect(container.textContent).toContain("Reviewer Admin");
    await show({ role: "reviewer_admin", status: "unverified", dashboard: "user" });
    await show({ role: null, status: "verified", dashboard: "user" });
    expect(container.textContent).toContain("ada@example.com");

    root.unmount();
    container.remove();
  });
});
