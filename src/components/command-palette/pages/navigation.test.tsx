import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
const flags = vi.hoisted(() => ({ data: undefined as { skillVerdictAdmin?: boolean } | undefined }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useRouteContext: () => ({ session: session.current }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: flags.data }),
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: { verification: { getMyAdminFlags: { queryOptions: () => ({}) } } },
}));
vi.mock("@/components/ui/command", () => ({
  CommandItem: ({
    onSelect,
    children,
    disabled,
  }: {
    onSelect?: () => void;
    children?: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { useCommandPaletteStore } from "../store";
import { NavigationCommandGroup } from "./navigation";

async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  if (!(button instanceof HTMLButtonElement)) throw new Error(`missing ${label}`);
  await act(async () => {
    button.click();
  });
}

describe("navigation commands", () => {
  it("navigates home, settings, and admin routes", async () => {
    useCommandPaletteStore.setState({ open: true, search: "", pages: [] });
    session.current = { user: { id: "1" } };
    flags.data = { skillVerdictAdmin: false };
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(<NavigationCommandGroup />);
      });
    };

    await render();
    expect(container.textContent).not.toContain("Global AI");
    await click(container, "Home");
    await click(container, "Resumes");
    await click(container, "Settings");
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard/resumes" });

    flags.data = { skillVerdictAdmin: true };
    useCommandPaletteStore.setState({ open: true, search: "", pages: [] });
    await render();
    await click(container, "Global AI");
    await click(container, "API Keys");
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard/admin/ai" });

    for (const label of ["Profile", "Preferences", "Authentication", "Danger Zone"]) {
      useCommandPaletteStore.setState({ open: true, search: "", pages: ["settings"] });
      await render();
      await click(container, label);
    }
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard/settings/danger-zone" });

    flags.data = undefined;
    await render();
    expect(container.textContent).not.toContain("Global AI");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
