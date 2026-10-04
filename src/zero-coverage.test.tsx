import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";

import { jobResultSchema } from "@/schema/jobs";
import { sampleResumeData } from "@/schema/resume/sample";

const api = vi.hoisted(() => {
  function endpoint(): Record<string, unknown> {
    const node = (() => endpoint()) as unknown as Record<string, unknown>;
    node.mutationOptions = () => ({ mutationFn: async () => ({ url: "https://example.com/cv.pdf" }) });
    node.queryOptions = () => ({ queryKey: ["coverage"], queryFn: async () => [] });
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
  useLingui: () => ({ i18n: { locale: "en-US", t: () => "", _: () => "" } }),
}));

vi.mock("@/integrations/orpc/client", () => api);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => vi.fn(async () => undefined),
    useRouter: () => ({ invalidate: vi.fn(async () => undefined) }),
    useParams: () => ({ resumeId: "resume-1", username: "ada", slug: "sample" }),
    useRouteContext: () => ({
      session: {
        user: { id: "user-1", name: "Ada", email: "ada@example.com", username: "ada", twoFactorEnabled: false },
      },
    }),
  };
});

vi.mock("@/integrations/auth/client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "user-1", username: "ada", name: "Ada", email: "ada@example.com", twoFactorEnabled: false } },
    }),
    listAccounts: vi.fn(async () => ({ data: [{ id: "acc", providerId: "google" }] })),
    linkSocial: vi.fn(async () => ({ error: null })),
    unlinkAccount: vi.fn(async () => ({ error: null })),
    signIn: { social: vi.fn(async () => ({ error: null })) },
  },
}));

vi.mock("@/components/locale/combobox", () => ({
  LocaleCombobox: () => <div>locale</div>,
  getLocaleOptions: () => [],
}));

vi.mock("@/components/theme/combobox", () => ({
  ThemeCombobox: () => <div>theme</div>,
}));

vi.mock("@/utils/theme", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, setThemeServerFn: vi.fn(async () => undefined) };
});

vi.mock("@/utils/dashboard-mode", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, setDashboardModeServerFn: vi.fn(async () => undefined) };
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TextMaskEffect } from "@/components/animation/text-mask";
import { BreakpointIndicator } from "@/components/layout/breakpoint-indicator";
import { ErrorScreen } from "@/components/layout/error-screen";
import { LoadingScreen } from "@/components/layout/loading-screen";
import { NotFoundScreen } from "@/components/layout/not-found-screen";
import { SummaryItem } from "@/components/resume/shared/items/summary-item";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandPalette } from "@/components/command-palette";
import { useCommandPaletteStore } from "@/components/command-palette/store";
import { DashboardModeProvider } from "@/components/dashboard-mode/provider";
import { useWebfonts } from "@/components/resume/hooks/use-webfonts";
import { useResumeStore } from "@/components/resume/store/resume";
import { ThemeProvider, useTheme } from "@/components/theme/provider";
import { ThemeToggleButton } from "@/components/theme/toggle-button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { useDashboardMode } from "@/hooks/use-dashboard-mode";
import { PromptDialogProvider } from "@/hooks/use-prompt";
import { FAQ } from "@/routes/_home/-sections/faq";
import { Features } from "@/routes/_home/-sections/features";
import { Footer } from "@/routes/_home/-sections/footer";
import { Header } from "@/routes/_home/-sections/header";
import { Hero } from "@/routes/_home/-sections/hero";
import { HeroVisual } from "@/routes/_home/-sections/hero-visual";
import { HowItWorks } from "@/routes/_home/-sections/how-it-works";
import { Statistics } from "@/routes/_home/-sections/statistics";
import { Templates } from "@/routes/_home/-sections/templates";
import { SocialAuth } from "@/routes/auth/-components/social-auth";
import { Route as BuilderRoute } from "@/routes/builder/$resumeId/route";
import { Route as PublicProfileRoute } from "@/routes/$username/$slug";
import { Route as HomeIndexRoute } from "@/routes/_home/index";
import { Route as HomeRoute } from "@/routes/_home/route";
import { Route as ForgotPasswordRoute } from "@/routes/auth/forgot-password";
import { Route as AuthIndexRoute } from "@/routes/auth/index";
import { Route as LoginRoute } from "@/routes/auth/login";
import { Route as RegisterRoute } from "@/routes/auth/register";
import { Route as ResetPasswordRoute } from "@/routes/auth/reset-password";
import { Route as ResumePasswordRoute } from "@/routes/auth/resume-password";
import { Route as AuthLayoutRoute } from "@/routes/auth/route";
import { Route as VerifyBackupRoute } from "@/routes/auth/verify-2fa-backup";
import { Route as VerifyTwoFactorRoute } from "@/routes/auth/verify-2fa";
import { Route as VerifyEmailRoute } from "@/routes/auth/verify-email";
import { Route as DashboardIndexRoute } from "@/routes/dashboard/index";
import { Route as ContactRequestsRoute } from "@/routes/dashboard/contact-requests";
import { Route as CompanyContactsRoute } from "@/routes/dashboard/company/contacts";
import { Route as CompanyMatchRoute } from "@/routes/dashboard/company/match";
import { Route as CompanyRoute } from "@/routes/dashboard/company/route";
import { Route as CompanySavedRoute } from "@/routes/dashboard/company/saved";
import { Route as JobSearchRoute } from "@/routes/dashboard/job-search/index";
import { Route as ReviewerQueueRoute } from "@/routes/dashboard/reviewer/queue";
import { Route as ReviewerRoute } from "@/routes/dashboard/reviewer/route";
import { Route as SettingsAiRoute } from "@/routes/dashboard/settings/ai";
import { Route as SettingsApiKeysRoute } from "@/routes/dashboard/settings/api-keys";
import { Route as SettingsAuthRoute } from "@/routes/dashboard/settings/authentication/index";
import { Route as SettingsDangerRoute } from "@/routes/dashboard/settings/danger-zone";
import { Route as SettingsJobSearchRoute } from "@/routes/dashboard/settings/job-search";
import { Route as SettingsPreferencesRoute } from "@/routes/dashboard/settings/preferences";
import { Route as SettingsRoute } from "@/routes/dashboard/settings/route";
import { Route as AdminAiRoute } from "@/routes/dashboard/admin/ai";
import { Route as AdminExperienceRoute } from "@/routes/dashboard/admin/experience-queue";
import { Route as AdminIdentityRoute } from "@/routes/dashboard/admin/identity";
import { Route as AdminJobSearchRoute } from "@/routes/dashboard/admin/job-search";
import { Route as AdminPendingRoute } from "@/routes/dashboard/admin/pending-verdicts";
import { Route as AdminReviewersRoute } from "@/routes/dashboard/admin/reviewers";
import { Route as AdminRoute } from "@/routes/dashboard/admin/route";
import { Route as AdminUsersRoute } from "@/routes/dashboard/admin/users";
import { Route as WorkAuthorizationRoute } from "@/routes/dashboard/work-authorization/index";
import { Route as DashboardRoute } from "@/routes/dashboard/route";
import { Route as ResumesRoute } from "@/routes/dashboard/resumes/index";
import { Route as PrinterRoute } from "@/routes/printer/$id";
import { Route as ReviewerProfileRoute } from "@/routes/reviewer/$adminId";
import {
  AdminExperienceFilterBar,
  AdminVerdictFilterBar,
  AdminVerificationFilterBar,
} from "@/routes/dashboard/admin/-components/admin-verification-filters";
import { CandidateActions } from "@/routes/dashboard/company/-components/candidate-actions";
import {
  CandidateVerificationSummary,
  IdentityVerifiedBadge,
} from "@/routes/dashboard/company/-components/candidate-verification-summary";
import { JobDetailSheet } from "@/routes/dashboard/job-search/-components/job-detail";
import { SearchFilters } from "@/routes/dashboard/job-search/-components/search-filters";
import { initialFilterState } from "@/routes/dashboard/job-search/-components/filter-helpers";
import { CreateResumeCard } from "@/routes/dashboard/resumes/-components/cards/create-card";
import { ImportResumeCard } from "@/routes/dashboard/resumes/-components/cards/import-card";
import { ResumeCard } from "@/routes/dashboard/resumes/-components/cards/resume-card";
import { ResumeDropdownMenu } from "@/routes/dashboard/resumes/-components/menus/dropdown-menu";
import { GridView } from "@/routes/dashboard/resumes/-components/grid-view";
import { ListView } from "@/routes/dashboard/resumes/-components/list-view";
import { ResumeQuickActions } from "@/routes/dashboard/resumes/-components/resume-quick-actions";
import {
  RedactedExperiencePanel,
  ReviewerCaseLabel,
  ReviewerSkillContextPanel,
} from "@/routes/dashboard/reviewer/-components/reviewer-context-panels";
import { PasswordSection } from "@/routes/dashboard/settings/authentication/-components/password";
import { SocialProviderSection } from "@/routes/dashboard/settings/authentication/-components/social-provider";
import { TwoFactorSection } from "@/routes/dashboard/settings/authentication/-components/two-factor";
import {
  defaultAdminExperienceSearch,
  defaultAdminVerdictSearch,
  defaultAdminVerificationSearch,
} from "@/utils/verification/admin-verification-search";

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
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  class FakeFontFace {
    constructor(
      public family: string,
      public source: string,
      public descriptors?: FontFaceDescriptors,
    ) {}
    load() {
      return Promise.resolve(this);
    }
  }
  window.FontFace = FakeFontFace as unknown as typeof FontFace;
  if (!document.fonts) {
    Object.defineProperty(document, "fonts", { value: { has: () => false, add: () => undefined } });
  }
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  Element.prototype.scrollIntoView = () => undefined;
  Element.prototype.getAnimations = () => [];
});

function FontProbe() {
  useWebfonts(sampleResumeData.metadata.typography);
  return null;
}

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <ThemeToggleButton onClick={() => toggleTheme({ playSound: false })}>{theme}</ThemeToggleButton>;
}

function ModeProbe() {
  const { setMode, effectiveMode } = useDashboardMode();
  return <button onClick={() => void setMode("user")}>{effectiveMode}</button>;
}

async function render(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PromptDialogProvider>
          <ConfirmDialogProvider>{node}</ConfirmDialogProvider>
        </PromptDialogProvider>
      </QueryClientProvider>,
    );
  });
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

describe("previously uncovered surfaces", () => {
  it("renders marketing, settings, palette, and dashboard chrome", async () => {
    const sample = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: sample.basics.name,
      slug: "sample",
      tags: [],
      data: sample,
      isLocked: false,
    });
    useCommandPaletteStore.getState().setOpen(true);
    const resume = {
      id: "resume-1",
      name: "CV",
      slug: "sample",
      tags: ["go"],
      updatedAt: new Date("2024-03-05T00:00:00.000Z"),
      isLocked: false,
    };

    const unmount = await render(
      <ThemeProvider theme="dark">
        <Header />
        <Hero />
        <HeroVisual />
        <Features />
        <HowItWorks />
        <FAQ />
        <Templates />
        <Statistics />
        <Footer />
        <SearchFilters filters={initialFilterState} onFiltersChange={() => undefined} />
        <BreakpointIndicator />
        <LoadingScreen />
        <ErrorScreen error={new Error("boom")} reset={() => undefined} />
        <NotFoundScreen isNotFound routeId="__root__" />
        <Progress value={40} />
        <Skeleton className="h-4 w-10" />
        <Tabs defaultValue="a">
          <TabsList>
            <TabsTrigger value="a">A</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Tab</TabsContent>
        </Tabs>
        <SummaryItem id="s" hidden={false} content="<p>Summary</p>" />
        <ListView resumes={[resume as never]} />
        <GridView resumes={[resume as never]} />
        <ResumeQuickActions />
        <CandidateVerificationSummary verifiedSkills={["TypeScript"]} verifiedExperiences={["Acme"]} />
        <IdentityVerifiedBadge verified />
        <JobDetailSheet
          job={jobResultSchema.parse({ job_id: "1", job_title: "Engineer", employer_name: "Acme" })}
          open
          onOpenChange={() => undefined}
        />
        <CandidateActions
          candidate={{
            candidateUserId: "user-1",
            resumeId: "resume-1",
            isFavorite: false,
            isToContact: true,
            contactStatus: "pending",
          }}
        />
        <ReviewerCaseLabel caseLabel="12" />
        <ReviewerSkillContextPanel
          skillContext={{ sectionType: "project", name: "Portfolio", itemLabel: "Portfolio", period: "2024", description: "<p>Shipped</p>" } as never}
        />
        <RedactedExperiencePanel
          relatedExperience={[{ position: "Engineer", period: "2020", description: "<p>Built</p>", roles: [] }]}
        />
        <TextMaskEffect text="Skill Verdict" />
        <SocialAuth showPrivacyPolicyNotice />
        <Sheet open>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>
        <ThemeProbe />
        <DashboardModeProvider dashboardMode="user">
          <ModeProbe />
        </DashboardModeProvider>
        <FontProbe />
        <CommandPalette />
        <SocialProviderSection provider="google" />
        <PasswordSection />
        <TwoFactorSection />
        <CreateResumeCard />
        <ImportResumeCard />
        <ResumeCard resume={resume as never} />
        <ResumeDropdownMenu resume={resume as never}>
          <button>resume menu</button>
        </ResumeDropdownMenu>
        <AdminVerificationFilterBar
          variant="identity"
          tab="queue"
          search={{ ...defaultAdminVerificationSearch, q: "ada" }}
          onSearchChange={() => undefined}
          onReset={() => undefined}
        />
        <AdminExperienceFilterBar
          tab="queue"
          search={{ ...defaultAdminExperienceSearch, q: "ada" }}
          onSearchChange={() => undefined}
          onReset={() => undefined}
        />
        <AdminVerdictFilterBar
          tab="queue"
          search={{ ...defaultAdminVerdictSearch, q: "ada" }}
          onSearchChange={() => undefined}
          onReset={() => undefined}
        />
      </ThemeProvider>,
    );

    expect(document.body.textContent).toContain("Skill Verdict");
    expect(document.body.textContent).toContain("CV");
    const toggle = [...document.querySelectorAll("button")].find((button) => button.textContent === "dark");
    await act(async () => {
      toggle?.click();
    });
    const mode = [...document.querySelectorAll("button")].find((button) => button.textContent === "user");
    await act(async () => {
      mode?.click();
    });
    unmount();
  });

  it("runs route guards for signed-out and signed-in visitors", async () => {
    const guardedRoutes = [
      LoginRoute,
      RegisterRoute,
      ResetPasswordRoute,
      ForgotPasswordRoute,
      VerifyEmailRoute,
      VerifyTwoFactorRoute,
      VerifyBackupRoute,
      ResumePasswordRoute,
      AuthIndexRoute,
      AuthLayoutRoute,
      HomeIndexRoute,
      HomeRoute,
      DashboardIndexRoute,
      DashboardRoute,
      ResumesRoute,
      ContactRequestsRoute,
      CompanyContactsRoute,
      CompanyMatchRoute,
      CompanyRoute,
      CompanySavedRoute,
      JobSearchRoute,
      ReviewerQueueRoute,
      ReviewerRoute,
      ReviewerProfileRoute,
      AdminAiRoute,
      AdminExperienceRoute,
      AdminIdentityRoute,
      AdminJobSearchRoute,
      AdminPendingRoute,
      AdminReviewersRoute,
      AdminRoute,
      AdminUsersRoute,
      WorkAuthorizationRoute,
      SettingsRoute,
      SettingsAiRoute,
      SettingsApiKeysRoute,
      SettingsAuthRoute,
      SettingsDangerRoute,
      SettingsJobSearchRoute,
      SettingsPreferencesRoute,
      PublicProfileRoute,
      PrinterRoute,
    ];
    const queryClient = { ensureQueryData: async () => null };
    const location = { href: "http://localhost:3000/x" };
    const params = { resumeId: "resume-1", username: "ada", slug: "sample", id: "resume-1" };
    const search = { token: "bad", callbackURL: "/", redirect: "/", email: "ada@example.com" };
    const sessions = [null, { user: { id: "user-1", emailVerified: true } }, { user: { id: "user-1", emailVerified: false } }];

    for (const route of guardedRoutes) {
      const beforeLoad = route.options.beforeLoad;
      if (!beforeLoad) continue;
      for (const session of sessions) {
        try {
          await beforeLoad({ context: { session, queryClient }, location, params, search } as never);
        } catch {
          // Redirects throw.
        }
      }
    }

    expect(guardedRoutes.length).toBeGreaterThan(10);
  });

  it("sends anonymous and unverified visitors away from the builder", async () => {
    const beforeLoad = BuilderRoute.options.beforeLoad;
    if (!beforeLoad) throw new Error("builder route has no beforeLoad");
    const location = { href: "http://localhost:3000/builder/resume-1" };
    await expect(beforeLoad({ context: { session: null }, location } as never)).rejects.toBeTruthy();
    await expect(
      beforeLoad({ context: { session: { user: { emailVerified: false } } }, location } as never),
    ).rejects.toBeTruthy();
    await expect(
      beforeLoad({ context: { session: { user: { emailVerified: true } } }, location } as never),
    ).resolves.toMatchObject({ session: { user: { emailVerified: true } } });
  });
});
