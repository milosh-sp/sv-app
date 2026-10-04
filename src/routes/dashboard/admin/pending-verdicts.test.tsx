import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultAdminVerdictSearch } from "@/utils/verification/admin-verification-search";

type Mode = "ok" | "error" | "hang";
type Gate = { resolve: () => void };

const navigate = vi.hoisted(() =>
  vi.fn(
    async (_options?: { search?: ((prev: Record<string, unknown>) => unknown) | Record<string, unknown> }) => undefined,
  ),
);
const search = vi.hoisted(() => ({
  q: "",
  page: 1,
  statuses: [] as Array<"verified" | "rejected" | "issue">,
  proposed: [] as Array<"verified" | "rejected" | "issue">,
  types: [] as Array<"skill" | "project">,
}));
const state = vi.hoisted(() => ({
  unfiltered: 0,
  badgeUnfiltered: undefined as number | null | undefined,
  pendingError: false,
  historyError: false,
  confirm: "ok" as Mode,
  override: "ok" as Mode,
  pending: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20, totalUnfiltered: 0 },
  history: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20 },
  calls: [] as Array<{ kind: string; input: unknown }>,
}));
const gates = vi.hoisted(() => ({
  pending: null as Promise<void> | null,
  history: null as Promise<void> | null,
  confirm: null as Gate | null,
  override: null as Gate | null,
}));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
  Plural: ({ one, other, value }: { one?: ReactNode; other?: ReactNode; value: number }) =>
    value === 1 ? (one ?? null) : (other ?? null),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("usehooks-ts", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useDebounceCallback: (fn: (...args: never[]) => void) => fn };
});
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/routes/dashboard/admin/-components/verification-queue-shared", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    QueueResumePreview: ({ resume }: { resume: { name: string } }) => <p>{resume.name}</p>,
    DocumentPreview: ({ documentType }: { documentType: string }) => <p>{documentType}</p>,
  };
});
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigate };
});

function mutation(kind: "confirm" | "override") {
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

function list(kind: "pending" | "history") {
  return {
    queryOptions: ({ input }: { input: { pageSize?: number } }) => ({
      queryKey: [kind, input],
      queryFn: async () => {
        if (kind === "pending" && input.pageSize === 1) {
          const totalUnfiltered = state.badgeUnfiltered === undefined ? state.unfiltered : state.badgeUnfiltered;
          return { items: [], total: state.unfiltered, pageSize: 1, totalUnfiltered };
        }
        if (gates[kind]) await gates[kind];
        if (kind === "pending" && state.pendingError) throw new Error("queue down");
        if (kind === "history" && state.historyError) throw new Error("history down");
        return kind === "pending" ? state.pending : state.history;
      },
    }),
    key: () => [kind],
  };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      verification: {
        listPendingVerdicts: list("pending"),
        listVerdictHistory: list("history"),
        confirmVerdict: mutation("confirm"),
        overrideVerdict: mutation("override"),
        overrideConcludedVerdict: mutation("override"),
      },
    },
  },
}));

import { toast } from "sonner";

import { Route } from "./pending-verdicts";

const user = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  emailVerified: true,
  username: "ada",
  displayUsername: "Ada",
  image: null,
  twoFactorEnabled: false,
  lastActiveAt: null,
  createdAt: new Date("2020-01-02T00:00:00.000Z"),
  updatedAt: new Date("2020-01-03T00:00:00.000Z"),
};

const submittedAt = new Date("2024-03-01T00:00:00.000Z");

function verdict(overrides: Record<string, unknown>) {
  return {
    id: "verdict-1",
    itemLabel: "C#",
    status: "verdict_pending",
    proposedVerdict: "verified",
    sectionType: "skill",
    submittedAt,
    reviewerName: null,
    reviewerTitle: null,
    reviewerSkills: [],
    reviewerPublicProfileUrl: null,
    verdictNotes: null,
    verdictSubmittedAt: null,
    user: null,
    documents: [],
    resume: null,
    assessmentInstructionsUrl: null,
    ...overrides,
  };
}

function resetSearch() {
  search.q = "";
  search.page = 1;
  search.statuses = [];
  search.proposed = [];
  search.types = [];
}

beforeEach(() => {
  resetSearch();
  state.unfiltered = 0;
  state.badgeUnfiltered = undefined;
  state.pendingError = false;
  state.historyError = false;
  state.confirm = "ok";
  state.override = "ok";
  state.pending = { items: [], total: 0, pageSize: 20, totalUnfiltered: 0 };
  state.history = { items: [], total: 0, pageSize: 20 };
  state.calls = [];
  gates.pending = null;
  gates.history = null;
  gates.confirm = null;
  gates.override = null;
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

function setText(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("pending verdicts", () => {
  it("fills in verdict search defaults and rejects a page below 1", () => {
    const validate = Route.options.validateSearch as {
      parse: (input: Record<string, unknown>) => { page: number; q: string };
    };
    expect(validate.parse({})).toMatchObject({ q: "", page: 1, statuses: [], proposed: [], types: [] });
    expect(
      validate.parse({ page: "4", q: "ada", statuses: ["issue"], proposed: ["rejected"], types: ["project"] }),
    ).toMatchObject({
      page: 4,
      q: "ada",
      statuses: ["issue"],
      proposed: ["rejected"],
      types: ["project"],
    });
    expect(() => validate.parse({ page: 0 })).toThrow();
  });

  it("shows an empty queue, the badge, and both history empties", async () => {
    state.unfiltered = 2;
    const view = await render();
    expect(document.body.textContent).toContain("No verdicts awaiting confirmation.");
    expect(document.body.textContent).toContain("2");

    await click("History");
    await flush();
    expect(document.body.textContent).toContain("No concluded verdicts yet.");
    view.unmount();

    search.statuses = ["rejected"];
    await render();
    await click("History");
    await flush();
    expect(document.body.textContent).toContain("No concluded verdicts match the selected filters.");
  });

  it("shows a filtered empty queue while the list is still loading", async () => {
    search.proposed = ["issue"];
    state.badgeUnfiltered = null;
    let release!: () => void;
    gates.pending = new Promise<void>((resolve) => (release = resolve));
    const view = await render();
    expect(view.container.textContent).toContain("Loading pending verdicts...");
    await act(async () => {
      release();
    });
    await flush();
    expect(view.container.textContent).toContain("No verdicts match the selected filters.");
  });

  it("pages the queue and commits search, filters, and reset", async () => {
    search.page = 2;
    search.q = "ada";
    state.pending = {
      items: [verdict({ id: "only", itemLabel: "Only" })],
      total: 41,
      pageSize: 20,
      totalUnfiltered: 41,
    };
    state.unfiltered = 41;
    const view = await render();
    expect(view.container.textContent).toContain("Showing 1 of 41 pending verdicts");
    expect(document.body.textContent).toContain("Page 2 of 3");

    await click("Next");
    await click("Previous");
    await click("Pending Verdicts");
    const updates = navigate.mock.calls.flatMap(([options]) => {
      const apply = options?.search;
      return typeof apply === "function" ? [apply({ ...search })] : [];
    });
    expect(updates).toEqual([
      expect.objectContaining({ page: 3 }),
      expect.objectContaining({ page: 1 }),
      expect.objectContaining({ page: 1 }),
    ]);

    const input = document.getElementById("admin-verification-search");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing search");
    await act(async () => {
      setText(input, "grace");
    });
    const searchUpdate = navigate.mock.calls.at(-1)?.[0]?.search;
    if (typeof searchUpdate !== "function") throw new Error("missing search update");
    expect(searchUpdate({ ...search })).toEqual(expect.objectContaining({ q: "grace", page: 1 }));

    const jobs: Array<(value: unknown) => void> = [];
    const host = view.container.firstElementChild ?? view.container;
    const fiberKey = Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$"));
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedProps?: { onValueChange?: (value: unknown) => void } };
    const start = fiberKey ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    const stack = start ? [start] : [];
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
      for (const onValueChange of jobs) onValueChange(["project"]);
    });
    const filterUpdates = navigate.mock.calls.flatMap(([options]) => {
      const apply = options?.search;
      return typeof apply === "function" ? [apply({ ...search })] : [];
    });
    expect(filterUpdates).toEqual(
      expect.arrayContaining([expect.objectContaining({ proposed: ["project"], page: 1 })]),
    );

    await click("Reset filters");
    expect(navigate).toHaveBeenCalledWith({ search: defaultAdminVerdictSearch });
  });

  it("confirms, overrides, and renders each verdict shape", async () => {
    const docs = [
      {
        id: "i",
        fileUrl: "https://example.com/i.pdf",
        documentType: "assessment_instructions",
        uploadedAt: submittedAt,
      },
      { id: "s", fileUrl: "https://example.com/s.pdf", documentType: "assessment_solution", uploadedAt: submittedAt },
      { id: "l", fileUrl: "https://example.com/l", documentType: "assessment_solution_link", uploadedAt: submittedAt },
      { id: "o", fileUrl: "https://example.com/o", documentType: "other", uploadedAt: submittedAt },
    ];
    state.pending = {
      items: [
        verdict({
          id: "pass",
          itemLabel: "Pass Skill",
          parentItemLabel: "Unity",
          user,
          reviewerName: "Ada",
          reviewerTitle: "Staff",
          reviewerSkills: ["C#"],
          reviewerPublicProfileUrl: "/reviewer/ada",
          verdictNotes: "Strong sample",
          verdictSubmittedAt: submittedAt,
          resume: { name: "Game CV" },
          assessmentInstructionsUrl: "https://example.com/i.pdf",
          documents: docs,
        }),
        verdict({
          id: "fail",
          itemLabel: "Fail Skill",
          proposedVerdict: "rejected",
          user,
          reviewerName: "Ada",
        }),
        verdict({
          id: "issue",
          itemLabel: "Issue Skill",
          parentItemLabel: "",
          proposedVerdict: "issue",
          user,
          assessmentInstructionsUrl: "https://example.com/i.pdf",
        }),
        verdict({
          id: "bare",
          itemLabel: "Bare Skill",
          proposedVerdict: null,
          reviewerSkills: undefined,
          documents: [docs[2]],
        }),
      ],
      total: 4,
      pageSize: 20,
      totalUnfiltered: 4,
    };
    state.history = {
      items: [verdict({ id: "hist", itemLabel: "Blueprints", status: "rejected" })],
      total: 1,
      pageSize: 20,
    };
    const view = await render();
    expect(view.container.textContent).toContain("01/03/2024");
    expect(document.body.textContent).toContain("Proposed: Pass");
    expect(document.body.textContent).toContain("Proposed: Fail");
    expect(document.body.textContent).toContain("Proposed: Issue");
    expect(document.body.textContent).toContain("Missing proposed verdict");
    expect(document.body.textContent).toContain("Unknown applicant");

    const pass = row("Pass Skill");
    await click("Review", pass);
    expect(pass.textContent).toContain("Unity");
    expect(pass.textContent).toContain("ada@example.com");
    expect(pass.textContent).toContain("Reviewer: Ada · Staff");
    expect(pass.textContent).toContain("Game CV");
    expect(pass.textContent).toContain("assessment_instructions");
    expect(pass.textContent).toContain("assessment_solution");
    expect(pass.textContent).toContain("assessment_solution_link");
    expect(pass.textContent).toContain("Strong sample");
    await click("Collapse", pass);

    await click("Review", pass);
    await click("Override", pass);
    await click("rejected", pass);
    await click("issue", pass);
    await click("verified", pass);
    const reason = pass.querySelector("textarea");
    if (!(reason instanceof HTMLTextAreaElement)) throw new Error("missing reason");
    await act(async () => {
      setText(reason, "The sample was the wrong file");
    });
    await click("Submit Override", pass);
    await act(async () => {
      setText(reason, "   ");
    });
    await click("Confirm", pass);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("A reason is required to override.");
    await act(async () => {
      setText(reason, "The sample was the wrong file");
    });
    await click("Back", pass);
    state.override = "error";
    await click("Submit Override", pass);
    await click("Confirm", pass);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("override failed");
    state.override = "hang";
    await click("Submit Override", pass);
    await click("Confirm", pass);
    await flush();
    expect(pass.textContent).toContain("Overriding...");
    await act(async () => {
      gates.override?.resolve();
    });
    await flush();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Verdict overridden successfully.");
    expect(state.calls.some((call) => call.kind === "override")).toBe(true);

    const fail = row("Fail Skill");
    await click("Review", fail);
    expect(fail.textContent).toContain("No solution submitted");
    expect(fail.textContent).toContain("Reviewer: Ada");
    expect(fail.textContent).not.toContain("· Staff");
    state.confirm = "error";
    await click("Confirm Fail", fail);
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("confirm failed");
    state.confirm = "ok";
    await click("Confirm Fail", fail);
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Verdict confirmed. Request rejected.");

    const issue = row("Issue Skill");
    await click("Review", issue);
    state.confirm = "hang";
    await click("Confirm Issue", issue);
    await flush();
    expect(issue.textContent).toContain("Confirming...");
    await act(async () => {
      gates.confirm?.resolve();
    });
    await flush();
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Verdict confirmed. Request flagged as issue.");

    const bare = row("Bare Skill");
    await click("Review", bare);
    expect(button("Confirm", bare).disabled).toBe(true);
    expect(bare.textContent).toContain("assessment_solution_link");
    state.confirm = "ok";
    await click("Review", row("Pass Skill"));
    await click("Confirm Pass", row("Pass Skill"));
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Verdict confirmed. Skill verified.");

    await click("History");
    await flush();
    expect(view.container.textContent).toContain("Blueprints");
  });
});
