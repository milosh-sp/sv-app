import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const openDialog = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ current: null as null | { user: { id: string } } }));
const query = vi.hoisted(() => ({
  data: undefined as Array<{ id: string; name: string }> | undefined,
  isLoading: false,
}));

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
  useQuery: () => ({ data: query.data, isLoading: query.isLoading }),
}));
vi.mock("@/dialogs/store", () => ({
  useDialogStore: () => ({ openDialog }),
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: { resume: { list: { queryOptions: () => ({}) } } },
}));
vi.mock("@/components/ui/command", () => ({
  CommandItem: ({ onSelect, children }: { onSelect?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  CommandGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  CommandShortcut: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("cmdk", () => ({
  CommandLoading: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { useCommandPaletteStore } from "../store";
import { ResumesCommandGroup } from "./resumes";

describe("resume commands", () => {
  it("hides without a session and opens a resume when one is loaded", async () => {
    session.current = null;
    useCommandPaletteStore.setState({ open: true, search: "", pages: [] });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(<ResumesCommandGroup />);
      });
    };

    await render();
    expect(container.textContent).toBe("");

    session.current = { user: { id: "1" } };
    await render();
    await act(async () => {
      [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Resumes"))?.click();
    });
    expect(useCommandPaletteStore.getState().peekPage()).toBe("resumes");

    query.isLoading = true;
    await render();
    expect(container.textContent).toContain("Loading resumes...");

    query.isLoading = false;
    query.data = [{ id: "resume-1", name: "Ada" }];
    await render();
    await act(async () => {
      [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Create"))?.click();
    });
    expect(openDialog).toHaveBeenCalledWith("resume.create", undefined);
    expect(navigate).toHaveBeenCalledWith({ to: "/dashboard/resumes" });

    useCommandPaletteStore.setState({ open: true, search: "", pages: ["resumes"] });
    await render();
    await act(async () => {
      [...container.querySelectorAll("button")].find((item) => item.textContent?.includes("Ada"))?.click();
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/builder/resume-1" });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
