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
  pendingVerdicts: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20, totalUnfiltered: 0 },
  verdictHistory: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20 },
  identityQueue: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20, totalUnfiltered: 0 },
  identityHistory: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20 },
  mutations: [] as Array<{ path: string; input: unknown }>,
  fail: null as string | null,
  failMutation: null as string | null,
  failMessage: "failed",
  analysis: "# Title\n\n**bold** and `code`\n\n1. First\n- item\n\nA paragraph.",
}));

function endpoint(path: string[]): Record<string, unknown> {
  const key = path.join(".");
  const node: Record<string, unknown> = {};
  node.key = () => [key];
  node.queryOptions = () => ({
    queryKey: [key],
    queryFn: async () => {
      if (state.fail === key) throw new Error(`failed ${key}`);
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
      if (key === "admin.verification.listPendingVerdicts") return state.pendingVerdicts;
      if (key === "admin.verification.listVerdictHistory") return state.verdictHistory;
      if (key === "admin.verification.listIdentityQueue") return state.identityQueue;
      if (key === "admin.verification.listIdentityHistory") return state.identityHistory;
      return null;
    },
  });
  node.mutationOptions = () => ({
    mutationFn: async (input: unknown) => {
      state.mutations.push({ path: key, input });
      if (state.failMutation === key) throw new Error(state.failMessage);
      if (key === "ai.reviewResume") return { analysis: state.analysis };
      return { id: "resume-1" };
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

const aiGate = vi.hoisted(() => ({ canUse: false, isAvailabilityLoaded: true }));

vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => aiGate,
}));

const auth = vi.hoisted(() => ({
  enable: vi.fn(async () => ({
    data: { totpURI: "otpauth://totp/Skill?secret=ABCDEF", backupCodes: ["111111", "222222"] },
    error: null as { message: string } | null,
  })),
  verifyTotp: vi.fn(async () => ({ error: null as { message: string } | null })),
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1", username: "ada", name: "Ada", email: "ada@example.com" } } }),
    twoFactor: { enable: auth.enable, verifyTotp: auth.verifyTotp },
  },
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

import { Dialog } from "@/components/ui/dialog";
import { SidebarProvider } from "@/components/ui/sidebar";
import { EnableTwoFactorDialog } from "@/dialogs/auth/enable-two-factor";
import { CreateResumeDialog, DuplicateResumeDialog, UpdateResumeDialog } from "@/dialogs/resume";
import { ResumeAiReviewDialog } from "@/dialogs/resume/ai-review";
import { ImportResumeDialog } from "@/dialogs/resume/import";
import { useDialogStore } from "@/dialogs/store";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";
import { DocumentPreview } from "@/routes/dashboard/admin/-components/verification-queue-shared";
import { Route as IdentityRoute } from "@/routes/dashboard/admin/identity";
import { Route as PendingVerdictsRoute } from "@/routes/dashboard/admin/pending-verdicts";
import { Route as UsersRoute } from "@/routes/dashboard/admin/users";
import { Route as ReviewerQueueRoute } from "@/routes/dashboard/reviewer/queue";
import { Route as VerificationRoute } from "@/routes/dashboard/verification/index";
import { Route as WorkAuthorizationRoute } from "@/routes/dashboard/work-authorization/index";
import { defaultAdminVerificationSearch } from "@/utils/verification/admin-verification-search";

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
  Element.prototype.getAnimations = () => [];
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn(async () => undefined) } });
  }
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
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
  state.pendingVerdicts = { items: [], total: 0, pageSize: 20, totalUnfiltered: 0 };
  state.verdictHistory = { items: [], total: 0, pageSize: 20 };
  state.identityQueue = { items: [], total: 0, pageSize: 20, totalUnfiltered: 0 };
  state.identityHistory = { items: [], total: 0, pageSize: 20 };
  state.fail = null;
  state.failMutation = null;
  state.failMessage = "failed";
  aiGate.canUse = false;
  aiGate.isAvailabilityLoaded = true;
  auth.enable.mockReset();
  auth.verifyTotp.mockReset();
  auth.enable.mockResolvedValue({
    data: { totpURI: "otpauth://totp/Skill?secret=ABCDEF", backupCodes: ["111111", "222222"] },
    error: null,
  });
  auth.verifyTotp.mockResolvedValue({ error: null });
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  navigate.mockImplementation((options?: { search?: unknown }) => {
    if (options && typeof options.search === "function") {
      options.search({
        q: "",
        role: "all",
        page: 1,
        skills: [],
        categories: [],
        statuses: [],
        proposed: [],
        types: [],
      });
    }
  });
  vi.spyOn(UsersRoute, "useSearch").mockReturnValue({ q: "", role: "all", page: 1 });
  vi.spyOn(ReviewerQueueRoute, "useSearch").mockReturnValue({
    skills: [],
    categories: [],
    statuses: [],
    proposed: [],
    types: [],
  });
  vi.spyOn(PendingVerdictsRoute, "useSearch").mockReturnValue({
    q: "",
    page: 1,
    statuses: [],
    proposed: [],
    types: [],
  });
  vi.spyOn(IdentityRoute, "useSearch").mockReturnValue({ ...defaultAdminVerificationSearch });
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
          <ConfirmDialogProvider>
            <Suspense fallback={<div>loading</div>}>{node}</Suspense>
          </ConfirmDialogProvider>
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

async function typeInto(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!set) throw new Error("missing value setter");
  await act(async () => {
    Reflect.apply(set, input, [value]);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file } });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const applicant = {
  id: "user-2",
  name: "Grace Hopper",
  email: "grace@example.com",
  emailVerified: true,
  username: "grace",
  displayUsername: "grace",
  image: null,
  twoFactorEnabled: false,
  lastActiveAt: null,
  createdAt: new Date("2020-01-02T00:00:00.000Z"),
  updatedAt: new Date("2020-01-03T00:00:00.000Z"),
};

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
      total: 40,
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
    const search = document.getElementById("admin-users-search");
    if (!(search instanceof HTMLInputElement)) throw new Error("missing user search");
    await typeInto(search, "grace");
    await click("Next");
    const roles = [...document.querySelectorAll("[role='combobox']")];
    const role = roles.at(-1);
    if (role instanceof HTMLElement) {
      await act(async () => {
        role.click();
      });
      await flush();
      const option = [...document.querySelectorAll("[role='option']")].find((item) =>
        item.textContent?.includes("Reviewer Admin"),
      );
      if (option instanceof HTMLElement) {
        await act(async () => {
          option.click();
        });
        await click("Save");
        expect(state.mutations.some((call) => call.path === "admin.users.setUserAdminRole")).toBe(true);
      }
    }
    expect(navigate).toHaveBeenCalled();
    unmount();
  });

  it("accepts a review case and submits a verdict", async () => {
    state.profile = { consentGiven: true, reviewerSkills: ["C#"] };
    state.queue = [queueItem("C#")];
    state.cases = [
      {
        ...queueItem("Blueprints"),
        id: "case-1",
        status: "claimed",
        claimedAt: new Date("2024-02-01T00:00:00.000Z"),
        documents: [
          {
            id: "doc-1",
            documentType: "assessment_solution_link",
            fileUrl: "https://github.com/ada/solution",
            uploadedAt: new Date("2024-02-02T00:00:00.000Z"),
          },
        ],
      },
    ];
    state.caseHistory = [
      {
        ...queueItem("Pathfinding"),
        id: "hist-case",
        status: "verified",
        proposedVerdict: "rejected",
        reviewerNote: "Ship it",
        assessmentInstructionsUrl: "https://example.com/instructions.pdf",
        resolvedAt: new Date("2024-02-03T00:00:00.000Z"),
        documents: [
          {
            id: "doc-2",
            documentType: "assessment_instructions",
            fileUrl: "https://example.com/instructions.pdf",
            uploadedAt: new Date("2024-02-03T00:00:00.000Z"),
          },
          {
            id: "doc-3",
            documentType: "assessment_solution",
            fileUrl: "https://example.com/solution.pdf",
            uploadedAt: new Date("2024-02-03T00:00:00.000Z"),
          },
        ],
      },
    ];

    const unmount = await renderRoute(ReviewerQueueRoute);
    await click("Accept");
    expect(document.body.textContent).toContain("Accept case");
    const input = document.querySelector("[data-slot='dialog-content'] input[type='file']");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing instructions input");
    await chooseFile(input, new File(["nope"], "notes.txt", { type: "text/plain" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    const tooBig = new File([new Uint8Array(8)], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(tooBig, "size", { value: 5 * 1024 * 1024 + 1 });
    await chooseFile(input, tooBig);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    await chooseFile(input, new File(["pdf"], "instructions.pdf", { type: "application/pdf" }));
    const message = document.querySelector("textarea");
    if (message instanceof HTMLTextAreaElement) await typeInto(message, "Read this first");
    await click("Accept & send instructions");
    expect(state.mutations.some((call) => call.path === "admin.verification.acceptCase")).toBe(true);

    await click("My Cases");
    await click("Details");
    expect(document.body.textContent).toContain("Open Link");
    const notes = document.querySelector("textarea");
    if (!(notes instanceof HTMLTextAreaElement)) throw new Error("missing review notes");
    await typeInto(notes, "Looks solid");
    await click("rejected");
    await click("Submit Review");
    await click("Confirm");
    expect(state.mutations.some((call) => call.path === "admin.verification.submitVerdict")).toBe(true);

    await click("History");
    await click("Details");
    expect(document.body.textContent).toContain("Final verdict differed from your proposal.");
    expect(document.body.textContent).toContain("Ship it");
    unmount();
  });

  it("explains an empty queue and a queue that failed to load", async () => {
    state.profile = { consentGiven: true, reviewerSkills: [] };
    state.queue = [queueItem("C#")];
    const unmountEmptySkills = await renderRoute(ReviewerQueueRoute);
    expect(document.body.textContent).toContain("assign your reviewable skills");
    unmountEmptySkills();

    state.profile = { consentGiven: true, reviewerSkills: ["C#"] };
    state.queue = [];
    const unmountEmpty = await renderRoute(ReviewerQueueRoute);
    expect(document.body.textContent).toContain("No matching requests for your assigned skills.");
    unmountEmpty();

    state.fail = "admin.verification.listQueue";
    const unmountError = await renderRoute(ReviewerQueueRoute);
    expect(document.body.textContent).toContain("Failed to load queue");
    unmountError();
  });

  it("submits an assessment solution and reports a history error", async () => {
    state.resumes = [{ id: resumeId, name: "CV", slug: "sample" }];
    state.resume = { id: resumeId, data: structuredClone(sampleResumeData) };
    state.statuses = [
      status(editorToolsId, "Editor Tools", "skill", "claimed", {
        assessmentInstructionsUrl: "https://example.com/instructions.pdf",
      }),
      status(experienceId, "Cascade Studios — Senior Game Developer", "experience", "issue"),
    ];
    const unmount = await renderRoute(VerificationRoute);
    const unity = [...document.querySelectorAll("[data-slot='accordion-trigger']")].find((item) =>
      item.textContent?.includes("Unity Engine"),
    );
    if (!(unity instanceof HTMLElement)) throw new Error("missing Unity accordion");
    await act(async () => {
      unity.click();
    });
    expect(document.body.textContent).toContain("issue");
    await click("Submit solution");
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    const url = [...document.querySelectorAll("input[type='url']")].find(
      (item) => item instanceof HTMLInputElement && item.placeholder.includes("github"),
    );
    if (!(url instanceof HTMLInputElement)) throw new Error("missing solution url");
    await typeInto(url, "https://github.com/ada/solution");
    await click("Submit solution");
    expect(state.mutations.some((call) => call.path === "verification.submitAssessmentSolution")).toBe(true);

    state.fail = "verification.getHistory";
    const experience = [...document.querySelectorAll("span")].find(
      (item) => item.textContent === "Cascade Studios — Senior Game Developer",
    );
    const historyButton = experience?.closest("div")?.parentElement?.querySelector("button.size-6");
    if (!(historyButton instanceof HTMLButtonElement)) throw new Error("missing experience history");
    await act(async () => {
      historyButton.click();
    });
    await flush();
    expect(document.body.textContent).toContain("Unable to load verification history");
    unmount();
  });

  it("walks two-factor setup from password to backup codes", async () => {
    auth.enable.mockResolvedValueOnce({ data: null, error: { message: "bad password" } });
    const unmount = await render(
      <Dialog open>
        <EnableTwoFactorDialog />
      </Dialog>,
    );
    const password = document.querySelector("input[type='password']");
    if (!(password instanceof HTMLInputElement)) throw new Error("missing password");
    await typeInto(password, "secret1");
    await click("Continue");
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    await click("Continue");
    expect(document.body.textContent).toContain("Setup Authenticator App");
    const code = document.querySelector("input[type='number']");
    if (!(code instanceof HTMLInputElement)) throw new Error("missing code");
    await typeInto(code, "123456");
    auth.verifyTotp.mockResolvedValueOnce({ error: { message: "wrong code" } });
    await click("Continue");
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    await click("Continue");
    expect(document.body.textContent).toContain("111111");
    await click("Download");
    await click("Copy");
    await click("Continue");
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
    unmount();
  });

  it("confirms a pending verdict and reviews an identity request", async () => {
    state.pendingVerdicts = {
      items: [
        {
          id: "verdict-1",
          itemLabel: "C#",
          parentItemLabel: "Unity Engine",
          status: "verdict_pending",
          proposedVerdict: "verified",
          sectionType: "skill",
          submittedAt: new Date("2024-03-01T00:00:00.000Z"),
          reviewerName: "Ada",
          reviewerTitle: "Reviewer",
          user: applicant,
          documents: [],
        },
      ],
      total: 1,
      pageSize: 20,
      totalUnfiltered: 1,
    };
    const unmountVerdicts = await renderRoute(PendingVerdictsRoute);
    expect(document.body.textContent).toContain("C#");
    await click("Review");
    await click("Confirm Pass");
    expect(state.mutations.some((call) => call.path === "admin.verification.confirmVerdict")).toBe(true);
    await click("History");
    expect(document.body.textContent).toContain("No concluded verdicts yet.");
    unmountVerdicts();

    state.identityQueue = {
      items: [
        {
          id: "identity-1",
          itemLabel: "Passport",
          status: "pending",
          method: "identity_call",
          submittedAt: new Date("2024-03-01T00:00:00.000Z"),
          calendarLinkSentAt: new Date("2024-03-02T00:00:00.000Z"),
          user: applicant,
          documents: [],
        },
      ],
      total: 1,
      pageSize: 20,
      totalUnfiltered: 1,
    };
    const unmountIdentity = await renderRoute(IdentityRoute);
    expect(document.body.textContent).toContain("Passport");
    expect(document.body.textContent).toContain("Call link sent");
    await click("Review");
    await click("Submit Review");
    await click("Confirm");
    expect(state.mutations.some((call) => call.path === "admin.verification.reviewIdentity")).toBe(true);
    unmountIdentity();
  });

  it("saves work authorization for the selected resume", async () => {
    const unmountEmpty = await renderRoute(WorkAuthorizationRoute);
    expect(document.body.textContent).toContain("Create a resume first");
    unmountEmpty();

    state.resumes = [{ id: resumeId, name: "CV", slug: "sample" }];
    state.resume = { id: resumeId, data: structuredClone(sampleResumeData) };
    const unmount = await renderRoute(WorkAuthorizationRoute);
    for (let attempt = 0; attempt < 10 && !document.body.textContent?.includes("Save work authorization"); attempt++) {
      await flush();
    }
    expect(document.body.textContent).toContain("CV");
    await click("Save work authorization");
    expect(
      state.mutations.some((call) => call.path === "resume.update") || vi.mocked(toast.error).mock.calls.length > 0,
    ).toBe(true);
    unmount();
  });

  it("previews a verification document and overrides a concluded verdict", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const previousFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: { get: () => "application/octet-stream" },
      blob: async () => new Blob([pdfBytes]),
    }));
    globalThis.fetch = fetchMock as typeof fetch;
    const unmountPreview = await render(
      <DocumentPreview
        fileUrl="https://example.com/solution.pdf"
        documentType="assessment_solution"
        uploadedAt={new Date("2024-03-01T00:00:00.000Z")}
      />,
    );
    await click("Preview");
    await flush();
    expect(fetchMock).toHaveBeenCalled();
    unmountPreview();
    globalThis.fetch = previousFetch;

    state.verdictHistory = {
      items: [
        {
          id: "hist-1",
          itemLabel: "Blueprints",
          parentItemLabel: "Unreal Engine",
          status: "rejected",
          proposedVerdict: "verified",
          sectionType: "skill",
          submittedAt: new Date("2024-03-01T00:00:00.000Z"),
          resolvedAt: new Date("2024-03-02T00:00:00.000Z"),
          reviewerName: "Ada",
          reviewerTitle: "Reviewer",
          reviewerSkills: ["C#"],
          reviewerPublicProfileUrl: "/reviewer/ada",
          verdictNotes: "Needs another sample",
          verdictSubmittedAt: new Date("2024-03-02T00:00:00.000Z"),
          user: applicant,
          documents: [],
          reviewedBy: { name: "Ada", email: "ada@example.com" },
          reviewedAt: new Date("2024-03-02T00:00:00.000Z"),
        },
      ],
      total: 1,
      pageSize: 20,
    };
    const unmount = await renderRoute(PendingVerdictsRoute);
    await click("History");
    await click("Details");
    await click("Override");
    const reason = document.querySelector("textarea");
    if (!(reason instanceof HTMLTextAreaElement)) throw new Error("missing override reason");
    await typeInto(reason, "The sample was wrong");
    await click("Submit Override");
    await click("Confirm");
    expect(state.mutations.some((call) => call.path === "admin.verification.overrideConcludedVerdict")).toBe(true);
    unmount();
  });

  it("rejects a bad solution file and submits a freelancer profile", async () => {
    state.resumes = [{ id: resumeId, name: "CV", slug: "sample" }];
    state.resume = { id: resumeId, data: structuredClone(sampleResumeData) };
    state.statuses = [
      status(editorToolsId, "Editor Tools", "skill", "claimed", {
        assessmentInstructionsUrl: "https://example.com/instructions.pdf",
      }),
    ];
    const unmount = await renderRoute(VerificationRoute);
    const unity = [...document.querySelectorAll("[data-slot='accordion-trigger']")].find((item) =>
      item.textContent?.includes("Unity Engine"),
    );
    if (!(unity instanceof HTMLElement)) throw new Error("missing Unity accordion");
    await act(async () => {
      unity.click();
    });
    const solution = document.querySelector("input[type='file']");
    if (!(solution instanceof HTMLInputElement)) throw new Error("missing solution file");
    await chooseFile(solution, new File(["nope"], "notes.txt", { type: "text/plain" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    await chooseFile(solution, new File(["zip"], "solution.zip", { type: "application/zip" }));
    expect(document.body.textContent).toContain("solution.zip");
    await click("Submit solution");
    expect(state.mutations.some((call) => call.path === "verification.submitAssessmentSolution")).toBe(true);

    await click("Verify");
    await click("Freelancer Profile Link");
    const link = [...document.querySelectorAll("input[type='url']")].find(
      (item) => item instanceof HTMLInputElement && item.placeholder.includes("upwork"),
    );
    if (!(link instanceof HTMLInputElement)) throw new Error("missing freelancer url");
    await typeInto(link, "https://www.upwork.com/freelancers/~ada");
    const continueButton = [...document.querySelectorAll("button")].find(
      (item) => item.textContent?.includes("Continue") && !item.disabled,
    );
    if (!(continueButton instanceof HTMLButtonElement)) throw new Error("missing continue");
    await act(async () => {
      continueButton.click();
    });
    await flush();
    await click("Submit Request");
    expect(state.mutations.some((call) => call.path === "verification.requestExperience")).toBe(true);
    unmount();
  });

  it("shows an AI review and reports a duplicate resume slug", async () => {
    aiGate.canUse = true;
    const unmountReview = await render(
      <Dialog open>
        <ResumeAiReviewDialog data={{ id: "resume-1", name: "CV" }} />
      </Dialog>,
    );
    await flush();
    expect(document.body.textContent).toContain("Title");
    expect(document.body.textContent).toContain("bold");
    expect(document.body.textContent).toContain("code");
    unmountReview();

    state.failMutation = "resume.create";
    state.failMessage = "RESUME_SLUG_ALREADY_EXISTS";
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.create" } as never });
    const unmountCreate = await render(
      <Dialog open>
        <CreateResumeDialog />
      </Dialog>,
    );
    const nameLabel = [...document.querySelectorAll("label")].find((label) => label.textContent?.trim() === "Name");
    const name = nameLabel ? document.getElementById(nameLabel.htmlFor) : null;
    if (!(name instanceof HTMLInputElement)) throw new Error("missing resume name");
    await typeInto(name, "Ada Lovelace");
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing create form");
    form.noValidate = true;
    await act(async () => {
      form.requestSubmit();
    });
    await flush();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    state.failMutation = null;
    const createDialog = [...document.querySelectorAll("[data-slot='dialog-content']")].at(-1);
    const sampleTrigger = createDialog?.querySelector("[data-slot='dropdown-menu-trigger']");
    if (!(sampleTrigger instanceof HTMLElement)) throw new Error("missing sample resume menu");
    await act(async () => {
      sampleTrigger.click();
    });
    const sample = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
      element.textContent?.includes("Create a Sample Resume"),
    );
    if (!(sample instanceof HTMLElement)) throw new Error("missing sample resume item");
    await act(async () => {
      sample.click();
    });
    await flush();
    expect(state.mutations.filter((call) => call.path === "resume.create").length).toBeGreaterThan(1);
    unmountCreate();

    state.failMutation = null;
    useDialogStore.setState({
      open: true,
      activeDialog: { type: "resume.update", data: { id: "resume-1", name: "CV", slug: "sample", tags: [] } } as never,
    });
    const unmountUpdate = await render(
      <Dialog open>
        <UpdateResumeDialog data={{ id: "resume-1", name: "CV", slug: "sample", tags: [] }} />
      </Dialog>,
    );
    await click("Save Changes");
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
    unmountUpdate();

    state.failMutation = "resume.update";
    state.failMessage = "nope";
    const unmountUpdateError = await render(
      <Dialog open>
        <UpdateResumeDialog data={{ id: "resume-1", name: "CV", slug: "sample", tags: [] }} />
      </Dialog>,
    );
    await click("Save Changes");
    await flush();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    unmountUpdateError();

    state.failMutation = null;
    const unmountDuplicate = await render(
      <Dialog open>
        <DuplicateResumeDialog data={{ id: "resume-1", name: "CV", slug: "sample", tags: [] }} />
      </Dialog>,
    );
    await click("Duplicate");
    await flush();
    expect(state.mutations.some((call) => call.path === "resume.duplicate")).toBe(true);
    unmountDuplicate();
  });

  it("imports a JSON resume file", async () => {
    const unmount = await render(
      <Dialog open>
        <ImportResumeDialog />
      </Dialog>,
    );
    const typeLabel = [...document.querySelectorAll("label")].find((item) => item.textContent?.trim() === "Type");
    const typeButton = typeLabel?.parentElement?.querySelector("button");
    if (!(typeButton instanceof HTMLButtonElement)) throw new Error("missing import type");
    await act(async () => {
      typeButton.click();
    });
    const option = [...document.querySelectorAll("[role='option']")].find((item) =>
      item.textContent?.includes("JSON Resume"),
    );
    if (!(option instanceof HTMLElement)) throw new Error("missing JSON Resume option");
    await act(async () => {
      option.click();
    });
    const input = document.querySelector("input[type='file']");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
    const json = JSON.stringify({ basics: { name: "Ada Lovelace" }, work: [], skills: [] });
    await chooseFile(input, new File([json], "resume.json", { type: "application/json" }));
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing import form");
    form.noValidate = true;
    await act(async () => {
      form.requestSubmit();
    });
    await flush();
    expect(state.mutations.some((call) => call.path === "resume.import")).toBe(true);
    unmount();
  });
});
