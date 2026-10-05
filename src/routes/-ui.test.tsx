import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const providers = vi.hoisted(() => ({ current: {} as Record<string, string> }));
const social = vi.hoisted(() => vi.fn());
const oauth2 = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: Array.isArray(strings) ? strings.join("") : "" }),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
    useRouter: () => ({ invalidate }),
  };
});

vi.mock("@/integrations/auth/client", () => ({
  authClient: { signIn: { social, oauth2 } },
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    auth: {
      providers: {
        list: {
          queryOptions: () => ({
            queryKey: ["providers"],
            queryFn: async () => providers.current,
            initialData: providers.current,
            staleTime: Number.POSITIVE_INFINITY,
          }),
        },
      },
    },
  },
}));

vi.mock("@/components/locale/combobox", () => ({
  LocaleCombobox: () => <div>locale</div>,
}));

import { ThemeProvider } from "@/components/theme/provider";
import { Footer } from "@/routes/_home/-sections/footer";
import { Header } from "@/routes/_home/-sections/header";
import { PrivacyPolicyNotice } from "@/routes/auth/-components/privacy-policy-notice";
import { SocialAuth } from "@/routes/auth/-components/social-auth";

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function installBrowserStubs() {
  class FakeIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
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
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frame = cb;
    return 1;
  });
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
  return {
    flushFrame() {
      const callback = frame;
      frame = undefined;
      callback?.(0);
    },
  };
}

async function render(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  });
  cleanups.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
}

async function click(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("marketing header and footer", () => {
  it("hides the header while scrolling down and shows the footer underline", async () => {
    const frames = installBrowserStubs();
    const container = await render(
      <ThemeProvider theme="dark">
        <Header />
        <Footer />
      </ThemeProvider>,
    );

    const scroll = () => window.dispatchEvent(new Event("scroll"));
    window.scrollY = 10;
    scroll();
    frames.flushFrame();
    window.scrollY = 80;
    scroll();
    scroll();
    frames.flushFrame();
    window.scrollY = 40;
    scroll();
    frames.flushFrame();

    const link = container.querySelector("li");
    expect(link).toBeTruthy();
    await act(async () => {
      link?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    await act(async () => {
      link?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
  });
});

describe("social auth", () => {
  it("signs in with each provider and reports a failure", async () => {
    providers.current = { custom: "SSO" };
    social.mockResolvedValue({ error: null });
    oauth2.mockResolvedValueOnce({ error: { message: "denied" } }).mockResolvedValueOnce({ error: null });
    const customOnly = await render(<SocialAuth />);
    const customButton = [...customOnly.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("SSO"),
    );
    expect(customButton).toBeTruthy();
    await click(customButton as HTMLButtonElement);
    await click(customButton as HTMLButtonElement);

    providers.current = { google: "Google", github: "GitHub" };
    social.mockResolvedValueOnce({ error: { message: "nope" } }).mockResolvedValue({ error: null });
    const socials = await render(<SocialAuth showPrivacyPolicyNotice />);
    await act(async () => {
      await Promise.resolve();
    });
    const google = [...socials.querySelectorAll("button")].find((button) => button.textContent?.includes("Google"));
    const github = [...socials.querySelectorAll("button")].find((button) => button.textContent?.includes("GitHub"));
    expect(google).toBeTruthy();
    expect(github).toBeTruthy();
    await click(google as HTMLButtonElement);
    await click(github as HTMLButtonElement);
    expect(invalidate).toHaveBeenCalled();
  });
});

describe("privacy policy notice", () => {
  it("renders the form and continue copy", async () => {
    const container = await render(
      <>
        <PrivacyPolicyNotice className="extra" />
        <PrivacyPolicyNotice variant="continue" />
      </>,
    );
    expect(container.textContent).toContain("Privacy Policy");
    expect(container.textContent).toContain("By submitting this form");
    expect(container.textContent).toContain("By continuing");
  });
});
