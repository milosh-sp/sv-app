import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

const record = {
  id: "resume-1",
  slug: "sample",
  name: "CV",
  hasPassword: false,
  isPublic: true,
  views: 4,
  downloads: 2,
  lastViewedAt: new Date("2024-01-02T00:00:00.000Z"),
  lastDownloadedAt: null,
};

const api = vi.hoisted(() => {
  function endpoint(): Record<string, unknown> {
    const node = (() => endpoint()) as unknown as Record<string, unknown>;
    node.mutationOptions = () => ({ mutationFn: async () => ({ url: "https://example.com/cv.pdf" }) });
    node.queryOptions = () => ({
      queryKey: ["coverage"],
      queryFn: async () => record,
      initialData: record,
    });
    node.call = vi.fn();
    return new Proxy(node, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
        const child = endpoint();
        target[prop] = child;
        return child;
      },
    });
  }

  return { orpc: endpoint(), client: endpoint() };
});

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray | { message?: string }, ...values: Array<string | number>) => {
    if (!Array.isArray(strings)) return "message" in strings ? (strings.message ?? "") : "";
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
  },
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Plural: ({ one, other, value }: { one?: React.ReactNode; other?: React.ReactNode; value: number }) =>
    value === 1 ? (one ?? null) : (other ?? null),
}));

vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    i18n: {
      locale: "en-US",
      t: (message: unknown) => (typeof message === "string" ? message : ""),
      _: (message: unknown) => (typeof message === "string" ? message : ""),
    },
  }),
}));

vi.mock("@/integrations/orpc/client", () => api);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useSuspenseQuery: () => ({ data: record }) };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
  useParams: () => ({ resumeId: "resume-1" }),
  useRouteContext: () => ({
    session: { user: { id: "user-1", name: "Ada", email: "ada@example.com", username: "ada" } },
  }),
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1", username: "ada", name: "Ada", email: "ada@example.com" } } }),
    changePassword: vi.fn(async () => ({ error: null })),
    twoFactor: {
      enable: vi.fn(async () => ({ data: { totpURI: "otpauth://totp/Skill", backupCodes: ["111111"] }, error: null })),
      verifyTotp: vi.fn(async () => ({ error: null })),
      disable: vi.fn(async () => ({ error: null })),
    },
    apiKey: { create: vi.fn(async () => ({ data: { key: "sv_test" }, error: null })) },
  },
}));

vi.mock("@/components/theme/provider", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/use-dashboard-mode", () => ({
  useDashboardMode: () => ({
    effectiveMode: "user",
    isPending: false,
    isReviewerPrivileged: false,
    setMode: vi.fn(),
  }),
}));

vi.mock("@/components/resume/hooks/use-webfonts", () => ({
  useWebfonts: () => undefined,
}));

vi.mock("@/components/locale/combobox", () => ({
  LocaleCombobox: () => <div>locale</div>,
  getLocaleOptions: () => [],
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import { CountUp } from "@/components/animation/count-up";
import { RichInput } from "@/components/input/rich-input";
import { useResumeStore } from "@/components/resume/store/resume";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DialogManager } from "@/dialogs/manager";
import { useDialogStore } from "@/dialogs/store";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { BuilderHeader } from "@/routes/builder/$resumeId/-components/header";
import { BuilderSidebarLeft } from "@/routes/builder/$resumeId/-sidebar/left";
import { BuilderSidebarRight } from "@/routes/builder/$resumeId/-sidebar/right";
import { DashboardSidebar } from "@/routes/dashboard/-components/sidebar";

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

  class FakeIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
});

const dialogs = [
  "auth.change-password",
  "auth.two-factor.enable",
  "auth.two-factor.disable",
  "api-key.create",
  "resume.create",
  "resume.import",
  "resume.template.gallery",
] as const;

function providers(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <PromptDialogProvider>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </PromptDialogProvider>
    </QueryClientProvider>
  );
}

async function render(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(providers(node));
  });
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

describe("large surfaces", () => {
  it("opens the uncovered dialogs", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    for (const type of dialogs) {
      useDialogStore.setState({ open: true, activeDialog: { type, data: undefined } as never });
      const unmount = await render(<DialogManager />);
      const text = document.body.textContent ?? "";
      expect(text.length > 5 ? type : text).toBe(type);
      unmount();
    }

    useDialogStore.setState({
      open: true,
      activeDialog: {
        type: "resume.update",
        data: { id: "resume-1", name: "CV", slug: "sample", tags: ["go"] },
      } as never,
    });
    const unmountUpdate = await render(<DialogManager />);
    expect(document.body.textContent).toContain("Update Resume");
    unmountUpdate();

    useDialogStore.setState({
      open: true,
      activeDialog: { type: "resume.ai.review", data: { id: "resume-1", name: "CV" } } as never,
    });
    const unmountReview = await render(<DialogManager />);
    expect(document.body.textContent?.length ?? 0).toBeGreaterThan(5);
    unmountReview();
  });

  it("imports a JSON resume file or explains why it cannot", async () => {
    const label = "JSON Resume";
    const file = new File(["{}"], "resume.json", { type: "application/json" });
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.loading).mockClear();
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.import", data: undefined } as never });
    const unmount = await render(<DialogManager />);
    const typeLabel = [...document.querySelectorAll("label")].find((item) => item.textContent?.trim() === "Type");
    const typeButton = typeLabel?.parentElement?.querySelector("button");
    if (!(typeButton instanceof HTMLButtonElement)) throw new Error("missing import type");
    act(() => {
      typeButton.click();
    });
    const option = [...document.querySelectorAll("[role='option']")].find((item) => item.textContent?.includes(label));
    if (!(option instanceof HTMLElement)) throw new Error(`missing ${label} option`);
    act(() => {
      option.click();
    });

    const dialog = [...document.querySelectorAll("[data-slot='dialog-content']")].at(-1);
    const input = dialog?.querySelector("input[type='file']");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
    Object.defineProperty(input, "files", { value: { 0: file, length: 1, item: () => file } });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const form = dialog?.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error(`missing form for ${label}`);
    form.noValidate = true;
    await act(async () => {
      form.requestSubmit();
    });
    expect(vi.mocked(toast.error).mock.calls.length + vi.mocked(toast.loading).mock.calls.length).toBeGreaterThan(0);
    unmount();
  });

  it("creates a resume from the dialog", async () => {
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.create", data: undefined } as never });
    const unmount = await render(<DialogManager />);
    const nameLabel = [...document.querySelectorAll("label")].find((label) => label.textContent?.trim() === "Name");
    const name = nameLabel ? document.getElementById(nameLabel.htmlFor) : null;
    if (!(name instanceof HTMLInputElement)) throw new Error("missing resume name");
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!set) throw new Error("missing value setter");
    await act(async () => {
      Reflect.apply(set, name, ["Ada Lovelace"]);
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
    form.noValidate = true;
    await act(async () => {
      form.requestSubmit();
    });
    expect(useDialogStore.getState().open).toBe(false);
    unmount();
  });

  it("renders both builder sidebars, the header, and the dashboard sidebar", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const unmount = await render(
      <>
        <BuilderHeader />
        <BuilderSidebarLeft />
        <BuilderSidebarRight />
        <SidebarProvider>
          <DashboardSidebar />
        </SidebarProvider>
      </>,
    );

    expect(document.body.textContent).toContain(data.basics.name);
    expect(document.body.textContent).toContain(data.customSections[0]?.title);
    unmount();
  });

  it("renders the app sidebar, a rich text field, and a count", async () => {
    const unmount = await render(
      <>
        <SidebarProvider>
          <Sidebar>
            <SidebarTrigger />
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>Resumes</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
        </SidebarProvider>
        <RichInput value="<p>Hello</p>" onChange={() => undefined} />
        <CountUp to={12} />
      </>,
    );

    expect(document.body.textContent).toContain("Resumes");
    expect(document.body.textContent).toContain("Hello");
    unmount();
  }, 60_000);
});
