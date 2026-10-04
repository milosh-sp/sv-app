import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";
import { deriveSkillKeywordId } from "@/utils/verification/skills";

const resumeId = "resume-1";
const unityId = "019bef5a-93e4-7746-ad39-5a52dcf50ed4";
const unrealId = "019bef5a-93e4-7746-ad39-5e8bb7cacbc8";
const experienceId = "019bef5a-93e4-7746-ad39-44d8cec98ca4";
const csharpId = deriveSkillKeywordId(unityId, "C#");
const editorToolsId = deriveSkillKeywordId(unityId, "Editor Tools");
const blueprintsId = deriveSkillKeywordId(unrealId, "Blueprints");

const navigate = vi.hoisted(() => vi.fn());

const state = vi.hoisted(() => ({
  resumes: [] as Array<{ id: string; name: string; slug: string }>,
  resume: null as { id: string; data: typeof sampleResumeData } | null,
  statuses: [] as Array<Record<string, unknown>>,
  history: [] as Array<Record<string, unknown>>,
  profile: null as { consentGiven: boolean; reviewerSkills: string[] } | null,
  queue: [] as Array<Record<string, unknown>>,
  cases: [] as Array<Record<string, unknown>>,
  caseHistory: [] as Array<Record<string, unknown>>,
  users: {
    users: [] as Array<Record<string, unknown>>,
    total: 0,
    pageSize: 20,
  },
  overview: null as Record<string, unknown> | null,
  mutations: [] as Array<{ path: string; input: unknown }>,
}));

function endpoint(path: string[]): Record<string, unknown> {
  const key = path.join(".");
  const node: Record<string, unknown> = {};
  node.queryOptions = () => ({
    queryKey: [key],
    queryFn: async () => {
      if (key === "resume.list") return state.resumes;
      if (key === "resume.getById") return state.resume;
      if (key === "verification.getAllStatuses") return state.statuses;
      if (key === "verification.getHistory") return state.history;
      if (key === "reviewer.profile.get") return state.profile;
      if (key === "admin.verification.listQueue") return state.queue;
      if (key === "admin.verification.listMyCases") return state.cases;
      if (key === "admin.verification.listMyCaseHistory") return state.caseHistory;
      if (key === "admin.users.listUsers") return state.users;
      if (key === "admin.users.getUserOverview") return state.overview;
      return null;
    },
  });
  node.mutationOptions = () => ({
    mutationFn: async (input: unknown) => {
      state.mutations.push({ path: key, input });
      return {};
    },
  });
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
      const child = endpoint([...path, String(prop)]);
      target[prop] = child;
      return child;
    },
  });
}

const api = vi.hoisted(() => ({
  orpc: null as ReturnType<typeof endpoint>,
  client: null as ReturnType<typeof endpoint>,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
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
      _: (message: unknown) => message,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("@/integrations/orpc/client", () => {
  api.orpc = endpoint([]);
  api.client = endpoint([]);
  return api;
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
    useNavigate: () => navigate,
    useRouter: () => ({ invalidate: vi.fn() }),
    useRouteContext: () => ({
      session: { user: { id: "user-1", name: "Ada", email: "ada@example.com", username: "ada" } },
    }),
  };
});

import { toast } from "sonner";

import { SidebarProvider } from "@/components/ui/sidebar";
import { Route as UsersRoute } from "@/routes/dashboard/admin/users";
import { Route as ReviewerQueueRoute } from "@/routes/dashboard/reviewer/queue";
import { Route as VerificationRoute } from "@/routes/dashboard/verification/index";

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
  class FakeResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = () => undefined;
});

function status(
  itemId: string,
  itemLabel: string,
  sectionType: string,
  value: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: `${sectionType}-${itemId}`,
    sectionType,
    itemId,
    itemLabel,
    status: value,
    badgeVisible: value === "verified",
    submittedAt: new Date("2024-01-02T00:00:00.000Z"),
    resumeId,
    ...extra,
  };
}

function queueItem(label: string) {
  return {
    id: "req-1",
    itemLabel: label,
    parentItemLabel: "Unity Engine",
    caseLabel: "12",
    status: "pending",
    sectionType: "skill",
    submittedAt: new Date("2024-01-02T00:00:00.000Z"),
    skillContext: {
      sectionType: "skill",
      itemLabel: label,
      parentItemLabel: "Unity Engine",
      proficiency: "Expert",
      level: 5,
      keywords: ["Editor Tools"],
    },
    relatedExperience: [{ position: "Engineer", period: "2020", description: "<p>Built</p>", roles: [] }],
    documents: [],
  };
}

function userOverview() {
  const when = new Date("2024-03-01T00:00:00.000Z");
  return {
    user: {
      emailVerified: true,
      twoFactorEnabled: false,
      lastActiveAt: when,
      updatedAt: when,
      adminRoleAssignedAt: null,
    },
    sessions: {
      total: 2,
      active: 1,
      recent: [{ id: "sess-1", createdAt: when, ipAddress: "127.0.0.1", userAgent: "Test browser" }],
    },
    authProviders: { totalLinkedAccounts: 1, providerIds: ["google"] },
    resumes: {
      total: 1,
      publicCount: 1,
      lockedCount: 0,
      lastUpdatedAt: when,
      totalViews: 4,
      totalDownloads: 1,
      hiddenCount: 1,
      items: [{ id: resumeId, name: "CV", isPublic: true, isLocked: false, updatedAt: when }],
    },
    workAuthorization: {
      eu: { status: "citizen", sponsorshipRequired: "no" },
      usa: { status: "needs_sponsorship", sponsorshipRequired: "yes" },
      uk: { status: "visa", sponsorshipRequired: "unknown" },
    },
    verification: {
      total: 2,
      pending: 1,
      claimed: 0,
      verdictPending: 0,
      verified: 1,
      rejected: 0,
      issue: 0,
      uploadedDocuments: {
        hiddenCount: 1,
        items: [
          {
            verificationRequestId: "req-1",
            fileUrl: "https://example.com/payslip.pdf",
            itemLabel: "Cascade Studios",
            documentType: "payslip",
            status: "pending",
            uploadedAt: when,
          },
        ],
      },
      approvedIdentity: {
        itemLabel: "Ada Lovelace",
        resolvedAt: when,
        method: "identity_call",
        reviewerNote: "Matched the passport",
        documents: [{ fileUrl: "https://example.com/id.pdf", documentType: "passport", uploadedAt: when }],
      },
      approvedExperience: {
        hiddenCount: 1,
        items: [
          {
            id: "exp-1",
            itemLabel: "Cascade Studios",
            resolvedAt: when,
            method: "document_upload",
            reviewerNote: "Payslip matched",
            documents: [{ fileUrl: "https://example.com/payslip.pdf", documentType: "payslip", uploadedAt: when }],
          },
        ],
      },
    },
    apiKeys: { total: 1, enabled: 1, totalRequestCount: 3, lastRequestAt: when },
  };
}

beforeEach(() => {
  document.body.replaceChildren();
  navigate.mockReset();
  state.mutations = [];
  state.resumes = [];
  state.resume = null;
  state.statuses = [];
  state.history = [];
  state.profile = null;
  state.queue = [];
  state.cases = [];
  state.caseHistory = [];
  state.users = { users: [], total: 0, pageSize: 20 };
  state.overview = null;
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.spyOn(UsersRoute, "useSearch").mockReturnValue({ q: "", role: "all", page: 1 });
  vi.spyOn(ReviewerQueueRoute, "useSearch").mockReturnValue({
    skills: [],
    categories: [],
    statuses: [],
    proposed: [],
    types: [],
  });
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <SidebarProvider>
          <Suspense fallback={<div>loading</div>}>{node}</Suspense>
        </SidebarProvider>
      </QueryClientProvider>,
    );
  });
  for (let attempt = 0; attempt < 20 && document.body.textContent === "loading"; attempt++) await flush();
  await flush();
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

function buttonNamed(text: string) {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
  if (!(button instanceof HTMLButtonElement)) throw new Error(`missing button ${text}`);
  return button;
}

async function click(text: string) {
  await act(async () => {
    buttonNamed(text).click();
  });
  await flush();
}

async function typeInto(input: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!set) throw new Error("missing value setter");
  await act(async () => {
    Reflect.apply(set, input, [value]);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

type Screen = React.ComponentType & { preload?: () => Promise<unknown> };

async function renderRoute(route: { options: { component?: Screen } }) {
  const Screen = route.options.component;
  if (!Screen) throw new Error("route has no component");
  await Screen.preload?.();
  return render(<Screen />);
}

describe("large dashboard screens", () => {
  it("asks for a resume before verification can start", async () => {
    const unmount = await renderRoute(VerificationRoute);
    expect(document.body.textContent).toContain("Create a resume first");
    await click("Create a new resume");
    expect(navigate).toHaveBeenCalled();
    unmount();
  });

  it("requests a skill and shows a pending experience", async () => {
    state.resumes = [{ id: resumeId, name: "CV", slug: "sample" }];
    state.resume = { id: resumeId, data: structuredClone(sampleResumeData) };
    state.history = [
      {
        id: "hist-1",
        status: "verified",
        verifiedBy: "Ada",
        reviewerProfileUrl: "/reviewer/ada",
        submittedAt: new Date("2024-02-01T00:00:00.000Z"),
      },
    ];
    state.statuses = [
      status(csharpId, "C#", "skill", "verified"),
      status(editorToolsId, "Editor Tools", "skill", "claimed", {
        assessmentInstructionsUrl: "https://example.com/instructions.pdf",
      }),
      status(blueprintsId, "Blueprints", "skill", "verdict_pending", {
        assessmentSolutionSubmittedAt: new Date("2024-02-02T00:00:00.000Z"),
        assessmentSolutionFileUrl: "https://example.com/solution.zip",
        assessmentSolutionLinkUrl: "https://github.com/ada/solution",
      }),
      status(experienceId, "Cascade Studios — Senior Game Developer", "experience", "pending"),
    ];

    const unmount = await renderRoute(VerificationRoute);

    expect(document.body.textContent).toContain("Unity Engine");
    expect(document.body.textContent).toContain("Cascade Studios — Senior Game Developer");
    expect(document.body.textContent).toContain("pending");

    const triggerNamed = (name: string) => {
      const trigger = [...document.querySelectorAll("[data-slot='accordion-trigger']")].find((item) =>
        item.textContent?.includes(name),
      );
      if (!(trigger instanceof HTMLElement)) throw new Error(`missing ${name} accordion`);
      return trigger;
    };
    await act(async () => {
      triggerNamed("Unity Engine").click();
    });
    expect(document.body.textContent).toContain("Assessment in progress");
    await act(async () => {
      triggerNamed("Unreal Engine").click();
    });
    expect(document.body.textContent).toContain("Awaiting final approval");

    await click("Request");
    await click("Confirm");
    expect(state.mutations.some((call) => call.path === "verification.requestSkill")).toBe(true);

    const experience = [...document.querySelectorAll("span")].find(
      (item) => item.textContent === "Cascade Studios — Senior Game Developer",
    );
    const historyButton = experience?.closest("div")?.parentElement?.querySelector("button.size-6");
    if (!(historyButton instanceof HTMLButtonElement)) throw new Error("missing experience history");
    await act(async () => {
      historyButton.click();
    });
    await flush();
    expect(document.body.textContent).toContain("Verified by Ada");
    unmount();
  });

  it("submits an experience document after choosing a file", async () => {
    state.resumes = [{ id: resumeId, name: "CV", slug: "sample" }];
    state.resume = { id: resumeId, data: structuredClone(sampleResumeData) };
    state.statuses = [status(csharpId, "C#", "skill", "rejected")];

    const unmount = await renderRoute(VerificationRoute);

    await click("Verify");
    await click("Upload Document");
    const input = document.querySelector("input[type='file']");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
    const bad = new File(["nope"], "notes.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: bad, length: 1, item: () => bad } });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    const file = new File(["pdf"], "payslip.pdf", { type: "application/pdf" });
    Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file } });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.body.textContent).toContain("payslip.pdf");
    await click("Submit Request");
    expect(state.mutations.map((call) => call.path)).toEqual([
      "verification.requestExperience",
      "verification.uploadDocument",
    ]);
    unmount();
  });

  it("shows the queue and records reviewer consent", async () => {
    state.profile = { consentGiven: false, reviewerSkills: ["C#"] };
    state.queue = [queueItem("C#")];
    state.cases = [
      {
        ...queueItem("Blueprints"),
        id: "case-1",
        status: "claimed",
        claimedAt: new Date("2024-02-01T00:00:00.000Z"),
        documents: [],
      },
    ];
    state.caseHistory = [
      {
        ...queueItem("Pathfinding"),
        id: "hist-case",
        status: "verified",
        proposedVerdict: "verified",
        resolvedAt: new Date("2024-02-03T00:00:00.000Z"),
      },
    ];

    const unmount = await renderRoute(ReviewerQueueRoute);

    expect(document.body.textContent).toContain("C#");
    expect(document.body.textContent).toContain("Reviewer setup required");
    await click("Give consent");
    expect(state.mutations.some((call) => call.path === "reviewer.profile.giveConsent")).toBe(true);

    await click("View");
    expect(document.body.textContent).toContain("Skill context");
    await click("My Cases");
    expect(document.body.textContent).toContain("Blueprints");
    await click("History");
    expect(document.body.textContent).toContain("Pathfinding");
    unmount();
  });

  it("lists a user and shows the overview after expanding the row", async () => {
    state.users = {
      users: [
        {
          id: "user-1",
          name: "Grace Hopper",
          email: "grace@example.com",
          username: "grace",
          displayUsername: "grace",
          createdAt: new Date("2020-01-02T00:00:00.000Z"),
          adminRole: null,
        },
      ],
      total: 1,
      pageSize: 20,
    };
    state.overview = userOverview();

    const unmount = await renderRoute(UsersRoute);

    expect(document.body.textContent).toContain("grace@example.com");
    expect(document.body.textContent).toContain("(you)");
    await click("View details");
    expect(document.body.textContent).toContain("Account health");
    expect(document.body.textContent).toContain("Email verified");
    expect(document.body.textContent).toContain("requires employer sponsorship");
    expect(document.body.textContent).toContain("CV");
    unmount();
  });
});
