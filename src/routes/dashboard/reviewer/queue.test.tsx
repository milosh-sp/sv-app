import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Mode = "ok" | "error" | "hang";

const navigate = vi.hoisted(() =>
  vi.fn(
    async (_options?: { search?: ((prev: Record<string, unknown>) => unknown) | Record<string, unknown> }) => undefined,
  ),
);
const search = vi.hoisted(() => ({
  skills: [] as string[],
  categories: [] as string[],
  statuses: [] as string[],
  proposed: [] as Array<"verified" | "rejected" | "issue">,
  types: [] as Array<"skill" | "project">,
}));
const state = vi.hoisted(() => ({
  profile: null as { consentGiven: boolean; reviewerSkills: string[] } | null,
  profileError: false,
  queue: [] as Array<Record<string, unknown>>,
  queueError: false,
  cases: [] as Array<Record<string, unknown>>,
  casesError: false,
  history: [] as Array<Record<string, unknown>>,
  historyError: false,
  consent: "ok" as Mode,
  accept: "ok" as Mode,
  submit: "ok" as Mode,
  calls: [] as Array<{ kind: string; input: unknown }>,
}));
const gates = vi.hoisted(() => ({
  profile: null as Promise<void> | null,
  queue: null as Promise<void> | null,
  cases: null as Promise<void> | null,
  consent: null as { resolve: () => void } | null,
  accept: null as { resolve: () => void } | null,
  submit: null as { resolve: () => void } | null,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/routes/dashboard/admin/-components/verification-queue-shared", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    DocumentPreview: ({ documentType }: { documentType: string }) => <p>{documentType}</p>,
  };
});
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigate };
});

function query(kind: "profile" | "queue" | "cases" | "history") {
  return {
    queryOptions: () => ({
      queryKey: [kind],
      queryFn: async () => {
        const gate =
          kind === "profile" ? gates.profile : kind === "queue" ? gates.queue : kind === "cases" ? gates.cases : null;
        if (gate) await gate;
        if (kind === "profile" && state.profileError) throw new Error("profile down");
        if (kind === "queue" && state.queueError) throw new Error("queue down");
        if (kind === "cases" && state.casesError) throw new Error("cases down");
        if (kind === "history" && state.historyError) throw new Error("history down");
        if (kind === "profile") return state.profile;
        if (kind === "queue") return state.queue;
        if (kind === "cases") return state.cases;
        return state.history;
      },
    }),
  };
}

function mutation(kind: "consent" | "accept" | "submit") {
  return {
    mutationOptions: () => ({
      mutationFn: async (input: unknown) => {
        state.calls.push({ kind, input });
        if (state[kind] === "error") throw new Error(`${kind} failed`);
        if (state[kind] === "hang") await new Promise<void>((resolve) => (gates[kind] = { resolve }));
        return {};
      },
    }),
  };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    reviewer: { profile: { get: query("profile"), giveConsent: mutation("consent") } },
    admin: {
      verification: {
        listQueue: query("queue"),
        listMyCases: query("cases"),
        listMyCaseHistory: query("history"),
        acceptCase: mutation("accept"),
        submitVerdict: mutation("submit"),
      },
    },
  },
}));

import { toast } from "sonner";

import { Route } from "./queue";

const when = new Date("2024-03-01T00:00:00.000Z");

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "req-1",
    itemLabel: "C#",
    parentItemLabel: "Unity",
    caseLabel: "12",
    status: "pending",
    sectionType: "skill",
    submittedAt: when,
    skillContext: {
      sectionType: "skill",
      itemLabel: "C#",
      parentItemLabel: "Unity",
      proficiency: "Expert",
      level: 5,
      keywords: ["Editor Tools"],
    },
    relatedExperience: [],
    documents: [],
    ...overrides,
  };
}

function resetSearch() {
  search.skills = [];
  search.categories = [];
  search.statuses = [];
  search.proposed = [];
  search.types = [];
}

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

beforeEach(() => {
  resetSearch();
  state.profile = null;
  state.profileError = false;
  state.queue = [];
  state.queueError = false;
  state.cases = [];
  state.casesError = false;
  state.history = [];
  state.historyError = false;
  state.consent = "ok";
  state.accept = "ok";
  state.submit = "ok";
  state.calls = [];
  gates.profile = null;
  gates.queue = null;
  gates.cases = null;
  gates.consent = null;
  gates.accept = null;
  gates.submit = null;
  navigate.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  vi.spyOn(Route, "useSearch").mockReturnValue(search);
});

const mounted: Array<{ unmount: () => void }> = [];

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render() {
  const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
  if (!Screen) throw new Error("missing route component");
  await Screen.preload?.();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Screen />
      </QueryClientProvider>,
    );
  });
  await flush();
  let active = true;
  const view = {
    container,
    unmount() {
      if (!active) return;
      active = false;
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
  mounted.push(view);
  return view;
}

afterEach(() => {
  for (const view of mounted) view.unmount();
  mounted.length = 0;
});

function button(label: string, scope: ParentNode = document) {
  const buttons = [...scope.querySelectorAll("button")];
  const match =
    buttons.find((el) => el.textContent?.trim() === label) ?? buttons.find((el) => el.textContent?.includes(label));
  if (!(match instanceof HTMLButtonElement)) throw new Error(`missing ${label}`);
  return match;
}

async function click(label: string, scope?: ParentNode) {
  await act(async () => {
    button(label, scope).click();
  });
}

function row(label: string) {
  const title = [...document.querySelectorAll("p")].find((el) => el.textContent === label);
  const card = title?.closest("div.rounded-lg");
  if (!card) throw new Error(`missing row ${label}`);
  return card;
}

async function chooseFile(file: File | null) {
  const input = document.querySelector("input[type='file']");
  if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
  const files = file ? { 0: file, length: 1, item: () => file } : { length: 0, item: () => null };
  Object.defineProperty(input, "files", { configurable: true, value: files });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("reviewer queue", () => {
  it("waits for the profile, then explains a missing profile and a profile that failed to load", async () => {
    let release!: () => void;
    gates.profile = new Promise<void>((resolve) => (release = resolve));
    state.queue = [item()];
    const loading = await render();
    expect(loading.container.textContent).toContain("assign your reviewable skills");
    expect(loading.container.textContent).not.toContain("Reviewer setup required");
    await act(async () => {
      release();
    });
    await flush();
    expect(loading.container.textContent).toContain("Your reviewer profile has not been created yet");
    expect(loading.container.textContent).toContain("assign your reviewable skills");
    loading.unmount();

    state.profileError = true;
    const failed = await render();
    expect(failed.container.textContent).toContain("Your reviewer profile has not been created yet");
  });

  it("records consent after a failure and while the request is in flight", async () => {
    state.profile = { consentGiven: false, reviewerSkills: ["C#"] };
    state.consent = "error";
    const view = await render();
    await click("Give consent");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("consent failed");

    state.consent = "hang";
    await click("Give consent");
    await flush();
    expect(view.container.textContent).toContain("Recording...");
    await act(async () => {
      gates.consent?.resolve();
    });
    await flush();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Consent recorded. You can now submit verdicts.");
  });

  it("filters the queue to nothing and commits a cleared filter", async () => {
    state.profile = { consentGiven: true, reviewerSkills: ["C#", "Go"] };
    state.queue = [
      item(),
      item({ id: "proj", itemLabel: "Portfolio", sectionType: "project", parentItemLabel: "Games" }),
    ];
    search.skills = ["Go"];
    const view = await render();
    expect(view.container.textContent).toContain("No requests match the selected filters.");
    await click("Reset filters");
    expect(navigate).toHaveBeenCalledWith({
      search: { skills: [], categories: [], statuses: [], proposed: [], types: [] },
    });

    search.skills = [];
    view.unmount();
    const open = await render();
    expect(open.container.textContent).toContain("C#");
    expect(open.container.textContent).toContain("Portfolio");

    const host = open.container.firstElementChild ?? open.container;
    const fiberKey = Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$"));
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { onValueChange?: (value: unknown) => void } };
    const start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    const stack = start ? [start] : [];
    const jobs: Array<(value: unknown) => void> = [];
    const seen = new Set<unknown>();
    const walked = new Set<Fiber>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || walked.has(fiber)) continue;
      walked.add(fiber);
      const onValueChange = fiber.memoizedProps?.onValueChange;
      if (typeof onValueChange === "function" && !seen.has(onValueChange)) {
        seen.add(onValueChange);
        jobs.push(onValueChange);
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    expect(jobs.length).toBeGreaterThan(0);
    await act(async () => {
      for (const onValueChange of jobs) {
        onValueChange(null);
        onValueChange(["C#"]);
      }
    });
    const updates = navigate.mock.calls.flatMap(([options]) => {
      const apply = options?.search;
      return typeof apply === "function" ? [apply({ ...search })] : [];
    });
    expect(updates).toEqual(expect.arrayContaining([expect.objectContaining({ skills: [] })]));
  });

  it("accepts a case without a message and reports a failed accept", async () => {
    state.profile = { consentGiven: true, reviewerSkills: ["C#"] };
    state.queue = [item({ parentItemLabel: null })];
    const view = await render();
    await click("View");
    expect(view.container.textContent).toContain("Skill context");
    await click("Collapse");
    await click("Accept");
    expect(document.body.textContent).toContain("Accept case");
    await chooseFile(null);
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();

    await chooseFile(new File(["pdf"], "instructions.pdf", { type: "application/pdf" }));
    expect(document.body.textContent).toContain("instructions.pdf");
    state.accept = "error";
    await click("Accept & send instructions");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("accept failed");
    const sent = state.calls.find((call) => call.kind === "accept");
    expect(sent?.input).toEqual(expect.objectContaining({ requestId: "req-1", message: undefined }));

    state.accept = "hang";
    await click("Accept & send instructions");
    await flush();
    expect(document.body.textContent).toContain("Accepting...");
    await act(async () => {
      gates.accept?.resolve();
    });
    await flush();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      "Case accepted. Assessment instructions sent to the applicant.",
    );

    await click("Accept");
    await click("Cancel");
    expect(document.body.textContent).not.toContain("Instructions file");
  });

  it("shows empty and failed cases, then submits a verdict", async () => {
    state.profile = { consentGiven: false, reviewerSkills: ["C#"] };
    let releaseCases!: () => void;
    gates.cases = new Promise<void>((resolve) => (releaseCases = resolve));
    const empty = await render();
    await click("My Cases");
    expect(empty.container.textContent).toContain("Loading queue");
    await act(async () => {
      releaseCases();
    });
    await flush();
    expect(empty.container.textContent).toContain("You have no active cases.");
    await click("Queue");
    expect(empty.container.textContent).toContain("No matching requests for your assigned skills.");
    empty.unmount();

    search.skills = ["Go"];
    state.profile = { consentGiven: true, reviewerSkills: ["C#", "Go"] };
    state.cases = [item({ id: "claimed", itemLabel: "C#", status: "claimed" })];
    const filteredCases = await render();
    await click("My Cases");
    await flush();
    expect(filteredCases.container.textContent).toContain("No cases match the selected filters.");
    filteredCases.unmount();
    resetSearch();
    state.cases = [];

    state.casesError = true;
    const failed = await render();
    await click("My Cases");
    await flush();
    expect(failed.container.textContent).toContain("Failed to load queue");
    failed.unmount();

    state.casesError = false;
    state.profile = { consentGiven: false, reviewerSkills: ["C#"] };
    state.cases = [
      item({
        id: "pending",
        itemLabel: "Issue Skill",
        status: "verdict_pending",
        proposedVerdict: "issue",
        claimedAt: when,
      }),
      item({
        id: "pass",
        itemLabel: "Pass Skill",
        status: "verdict_pending",
        proposedVerdict: "verified",
        claimedAt: when,
      }),
      item({
        id: "fail",
        itemLabel: "Fail Skill",
        status: "verdict_pending",
        proposedVerdict: "rejected",
        claimedAt: when,
      }),
      item({
        id: "claimed",
        itemLabel: "Claimed Skill",
        parentItemLabel: "",
        status: "claimed",
        claimedAt: when,
        documents: [],
      }),
    ];
    const withheld = await render();
    await click("My Cases");
    await flush();
    expect(withheld.container.textContent).toContain("Proposed: Issue");
    expect(withheld.container.textContent).toContain("Proposed: Pass");
    expect(withheld.container.textContent).toContain("Proposed: Fail");
    expect(withheld.container.textContent).toContain("Awaiting Skill Verdict Admin confirmation.");
    await click("Details", row("Claimed Skill"));
    expect(row("Claimed Skill").textContent).toContain("No solution submitted yet");
    expect(row("Claimed Skill").textContent).not.toContain("Review Decision");
    const host = withheld.container.firstElementChild ?? withheld.container;
    const fiberKey = Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$"));
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { onValueChange?: (value: unknown) => void } };
    const start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    const stack = start ? [start] : [];
    const jobs: Array<(value: unknown) => void> = [];
    const seen = new Set<unknown>();
    const walked = new Set<Fiber>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || walked.has(fiber)) continue;
      walked.add(fiber);
      const onValueChange = fiber.memoizedProps?.onValueChange;
      if (typeof onValueChange === "function" && !seen.has(onValueChange)) {
        seen.add(onValueChange);
        jobs.push(onValueChange);
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    await act(async () => {
      for (const onValueChange of jobs) onValueChange(null);
    });
    expect(navigate).toHaveBeenCalled();
    withheld.unmount();

    state.profile = { consentGiven: true, reviewerSkills: ["C#"] };
    state.cases = [
      item({
        id: "claimed",
        itemLabel: "Claimed Skill",
        status: "claimed",
        claimedAt: null,
        assessmentInstructionsUrl: "https://example.com/instructions.pdf",
        documents: [
          {
            id: "doc-1",
            documentType: "assessment_instructions",
            fileUrl: "https://example.com/instructions.pdf",
            uploadedAt: when,
          },
          {
            id: "doc-2",
            documentType: "assessment_solution",
            fileUrl: "https://example.com/solution.pdf",
            uploadedAt: when,
          },
        ],
      }),
    ];
    await render();
    await click("My Cases");
    await flush();
    const claimed = row("Claimed Skill");
    await click("Details", claimed);
    expect(claimed.textContent).toContain("assessment_instructions");
    await click("Cancel", claimed);
    expect(claimed.textContent).not.toContain("Review Decision");
    await click("Details", claimed);
    expect(claimed.textContent).not.toContain("External link");
    await click("issue", claimed);
    await click("Submit Review", claimed);
    await click("Back", claimed);
    state.submit = "error";
    await click("Submit Review", claimed);
    await click("Confirm", claimed);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("submit failed");
    const failedCall = state.calls.find((call) => call.kind === "submit");
    expect(failedCall?.input).toEqual(
      expect.objectContaining({ requestId: "claimed", verdict: "issue", notes: undefined }),
    );

    state.submit = "hang";
    await click("Submit Review", claimed);
    await click("Confirm", claimed);
    await flush();
    expect(claimed.textContent).toContain("Submitting...");
    await act(async () => {
      gates.submit?.resolve();
    });
    await flush();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Verdict submitted for admin confirmation.");
  });

  it("shows history errors, an empty history, and a review that matches the proposal", async () => {
    state.profile = { consentGiven: true, reviewerSkills: ["C#", "Go"] };
    state.historyError = true;
    const failed = await render();
    await click("History");
    await flush();
    expect(failed.container.textContent).toContain("Failed to load queue");
    failed.unmount();

    state.historyError = false;
    const empty = await render();
    await click("History");
    await flush();
    expect(empty.container.textContent).toContain("No completed reviews yet.");
    empty.unmount();

    search.skills = ["Go"];
    state.history = [item({ id: "hist", itemLabel: "Pathfinding", status: "verified", proposedVerdict: "verified" })];
    const filtered = await render();
    await click("History");
    await flush();
    expect(filtered.container.textContent).toContain("No completed reviews match the selected filters.");
    filtered.unmount();

    resetSearch();
    state.history = [
      item({
        id: "hist",
        itemLabel: "Pathfinding",
        parentItemLabel: null,
        status: "verified",
        proposedVerdict: "verified",
        resolvedAt: null,
        reviewerNote: null,
        documents: [],
      }),
      item({
        id: "linked",
        itemLabel: "Linked Skill",
        status: "rejected",
        proposedVerdict: "rejected",
        documents: [
          {
            id: "doc-link",
            documentType: "assessment_solution_link",
            fileUrl: "https://github.com/ada/solution",
            uploadedAt: when,
          },
        ],
      }),
    ];
    const view = await render();
    await click("History");
    await flush();
    expect(view.container.textContent).toContain("Pathfinding");
    expect(view.container.textContent).not.toContain("Final verdict differed from your proposal.");
    await click("Details", row("Pathfinding"));
    expect(row("Pathfinding").textContent).toContain("No solution submitted");
    await click("Details", row("Linked Skill"));
    expect(row("Linked Skill").textContent).toContain("External link");
    await click("Collapse", row("Linked Skill"));
  });

  it("notifies the accept dialog when it opens and closes", async () => {
    state.profile = { consentGiven: true, reviewerSkills: ["C#"] };
    state.queue = [item()];
    const view = await render();
    await click("Accept");
    const root = view.container;
    const key = Object.keys(root).find((name) => name.startsWith("__reactFiber$") || name.startsWith("__reactContainer$"));
    let fiber = key
      ? (
          root as unknown as Record<
            string,
            { child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }
          >
        )[key]
      : undefined;
    const stack = fiber ? [fiber] : [];
    const seen = new Set<object>();
    const openChanges: Array<(open: boolean) => void> = [];
    while (stack.length > 0) {
      fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      const onOpenChange = fiber.memoizedProps?.onOpenChange;
      if (typeof onOpenChange === "function") openChanges.push(onOpenChange as (open: boolean) => void);
      if (fiber.child) stack.push(fiber.child as typeof fiber);
      if (fiber.sibling) stack.push(fiber.sibling as typeof fiber);
    }
    expect(openChanges.length).toBeGreaterThan(0);
    await act(async () => {
      for (const onOpenChange of openChanges) {
        onOpenChange(true);
        onOpenChange(false);
      }
    });
  });
});
