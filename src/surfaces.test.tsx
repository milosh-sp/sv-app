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

  it("walks through enabling two-factor authentication", async () => {
    useDialogStore.setState({ open: true, activeDialog: { type: "auth.two-factor.enable", data: undefined } as never });
    const unmount = await render(<DialogManager />);

    const setValue = (value: string) => {
      const input = document.querySelector("input");
      if (!(input instanceof HTMLInputElement)) throw new Error("missing input");
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (!set) throw new Error("missing value setter");
      Reflect.apply(set, input, [value]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const submit = async () => {
      const form = document.querySelector("form");
      if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
      form.noValidate = true;
      await act(async () => {
        form.requestSubmit();
      });
    };

    setValue("secret1");
    await submit();
    setValue("123456");
    await submit();
    expect(document.body.textContent).toContain("111111");
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
  });
});
