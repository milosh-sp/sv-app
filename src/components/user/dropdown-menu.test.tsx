import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const session = vi.hoisted(() => ({ current: null as null | { user?: { id: string; name: string } } }));
const dashboard = vi.hoisted(() => ({
  effectiveMode: "user" as "user" | "reviewer",
  isPending: false,
  isReviewerPrivileged: false,
  setMode: vi.fn(async () => undefined),
}));
const theme = vi.hoisted(() => ({ value: "light" as "light" | "dark", setTheme: vi.fn() }));
const invalidate = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() =>
  vi.fn(
    async (options: {
      fetchOptions: {
        onSuccess: () => void;
        onError: (result: { error: { message: string } }) => void;
      };
    }) => {
      options.fetchOptions.onSuccess();
      options.fetchOptions.onError({ error: { message: "nope" } });
    },
  ),
);

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray) => strings.join(""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ i18n: { locale: "en-US", t: () => "English" } }),
}));
vi.mock("sonner", () => ({
  toast: { loading: vi.fn(() => "toast"), dismiss: vi.fn(), error: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));
vi.mock("@/components/theme/provider", () => ({
  useTheme: () => ({ theme: theme.value, setTheme: theme.setTheme }),
}));
vi.mock("@/hooks/use-dashboard-mode", () => ({
  useDashboardMode: () => dashboard,
}));
vi.mock("@/integrations/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: session.current }),
    signOut,
  },
}));
vi.mock("@/utils/locale", () => ({
  isLocale: (value: string) => ["en-US", "de-DE", "es-ES", "ru-RU"].includes(value),
  localeMap: {
    "en-US": "English",
    "de-DE": "German",
    "es-ES": "Spanish",
    "ru-RU": "Russian",
  },
  loadLocale: vi.fn(async () => undefined),
  setLocaleServerFn: vi.fn(async () => undefined),
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ render }: { render: React.ReactNode }) => <>{render}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
  }) => (
    <div
      onClick={(event) => {
        const target = (event.target as HTMLElement).closest("[data-value]");
        if (target) onValueChange?.(target.getAttribute("data-value") ?? "");
      }}
    >
      <button type="button" data-value="nope">
        invalid
      </button>
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <button type="button" data-value={value}>
      {children}
    </button>
  ),
}));

import { toast } from "sonner";

import { loadLocale } from "@/utils/locale";

import { UserDropdownMenu } from "./dropdown-menu";

async function click(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find((item) => item.textContent?.includes(label));
  await act(async () => {
    button?.click();
  });
}

describe("user menu", () => {
  it("switches mode, locale, and theme, then signs out", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    session.current = null;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = async () => {
      await act(async () => {
        root.render(<UserDropdownMenu>{() => <button type="button">account</button>}</UserDropdownMenu>);
      });
    };

    await render();
    expect(container.textContent).toBe("");

    session.current = {};
    await render();
    expect(container.textContent).toBe("");

    session.current = { user: { id: "1", name: "Ada" } };
    dashboard.isReviewerPrivileged = false;
    await render();
    expect(container.textContent).not.toContain("Switch to");

    dashboard.isReviewerPrivileged = true;
    dashboard.effectiveMode = "user";
    dashboard.isPending = false;
    await render();
    await click(container, "Switch to Reviewer Mode");
    expect(dashboard.setMode).toHaveBeenCalledWith("reviewer");

    dashboard.effectiveMode = "reviewer";
    await render();
    await click(container, "Switch to User Mode");
    expect(dashboard.setMode).toHaveBeenCalledWith("user");

    dashboard.isPending = true;
    dashboard.setMode.mockClear();
    await render();
    await click(container, "Switch to User Mode");
    expect(dashboard.setMode).not.toHaveBeenCalled();

    dashboard.isPending = false;
    dashboard.setMode.mockRejectedValueOnce(new Error("no"));
    await render();
    await click(container, "Switch to User Mode");
    expect(toast.error).toHaveBeenCalled();

    const dark = container.querySelector("[data-value='dark']");
    const german = container.querySelector("[data-value='de-DE']");
    await act(async () => {
      dark?.parentElement?.querySelector<HTMLButtonElement>("[data-value='nope']")?.click();
      dark?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      german?.parentElement?.querySelector<HTMLButtonElement>("[data-value='nope']")?.click();
      german?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(theme.setTheme).toHaveBeenCalledWith("dark");
    expect(loadLocale).toHaveBeenCalledWith("de-DE");
    expect(reload).toHaveBeenCalled();

    await click(container, "Logout");
    expect(signOut).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });
});
