import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("usehooks-ts", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useDebounceCallback: (fn: (...args: never[]) => void) => fn };
});
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/components/resume/preview", () => ({ ResumePreview: () => <p>resume-preview</p> }));
vi.mock("@/components/resume/store/resume", () => ({
  useResumeStore: (selector: (state: { isReady: boolean; initialize: (value: unknown) => void }) => unknown) =>
    selector({ isReady: true, initialize: () => undefined }),
}));

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const search = vi.hoisted(() => ({
  q: "",
  method: "all" as "all" | "document_upload" | "freelancer_link" | "identity_call",
  statuses: [] as Array<"verified" | "rejected" | "issue">,
  page: 1,
}));
const state = vi.hoisted(() => ({
  fail: "" as "" | "queue" | "history",
  review: "ok" as "ok" | "error",
  unfiltered: 3,
  queue: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20, totalUnfiltered: 0 },
  history: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20 },
}));

function list(kind: "queue" | "history") {
  const name = kind === "queue" ? "listExperienceQueue" : "listExperienceHistory";
  return {
    name,
    queryOptions: ({ input }: { input: { pageSize?: number } }) => ({
      queryKey: [name, input, state.fail],
      queryFn: async () => {
        if (input.pageSize === 1) {
          return { items: [], total: state.unfiltered, pageSize: 1, totalUnfiltered: state.unfiltered };
        }
        if (state.fail === kind) throw new Error(`${kind} down`);
        return kind === "queue" ? state.queue : state.history;
      },
    }),
    key: () => [name],
  };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      verification: {
        listExperienceQueue: list("queue"),
        listExperienceHistory: list("history"),
        reviewExperience: {
          mutationOptions: () => ({
            mutationFn: async () => {
              if (state.review === "error") throw new Error("review failed");
              return {};
            },
          }),
        },
      },
    },
  },
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigate };
});

import { toast } from "sonner";

import { Route } from "./experience-queue";

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

async function render() {
  vi.spyOn(Route, "useSearch").mockReturnValue(search);
  const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
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
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function click(label: string) {
  await act(async () => {
    [...document.querySelectorAll("button")].find((button) => button.textContent?.includes(label))?.click();
  });
}

describe("experience queue", () => {
  it("reviews a request and walks filters, pages, and errors", async () => {
    state.fail = "queue";
    const errored = await render();
    expect(errored.container.textContent).toContain("Failed to load");
    errored.unmount();

    state.fail = "";
    search.q = "ada";
    const empty = await render();
    expect(empty.container.textContent).toContain("No experience verification requests match");
    await click("History");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(empty.container.textContent).toContain("No completed reviews match");
    const input = document.getElementById("admin-verification-search");
    if (input instanceof HTMLInputElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "grace");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    type Fiber = { child?: Fiber; sibling?: Fiber; return?: Fiber; memoizedProps?: { onValueChange?: (value: unknown) => void } };
    const host = empty.container.firstElementChild;
    const fiberKey = host ? Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$")) : undefined;
    let start = fiberKey && host ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    while (start?.return) start = start.return;
    const stack = start ? [start] : [];
    const seen = new Set<unknown>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      fiber.memoizedProps?.onValueChange?.("document_upload");
      fiber.memoizedProps?.onValueChange?.(null);
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    await click("Reset filters");
    await click("Next");
    await click("Previous");
    empty.unmount();

    search.q = "";
    search.page = 1;
    const submittedAt = new Date("2024-03-01T00:00:00.000Z");
    state.queue = {
      items: [
        {
          id: "exp-1",
          itemLabel: "Cascade",
          status: "pending",
          method: "document_upload",
          submittedAt,
          user,
          resume: { id: "resume-1", name: "CV", slug: "cv", tags: [], data: sampleResumeData, isLocked: false },
          documents: [
            { id: "doc-1", fileUrl: "https://example.com/p", documentType: "assessment_solution_link", uploadedAt: submittedAt },
          ],
        },
        { id: "exp-2", itemLabel: "Bare", status: "pending", method: null, submittedAt, user: null, resume: null, documents: [] },
      ],
      total: 25,
      pageSize: 20,
      totalUnfiltered: 25,
    };
    const view = await render();
    expect(view.container.textContent).toContain("Showing 2 of 25");
    expect(view.container.textContent).toContain("Unknown applicant");
    await click("Review");
    const notes = document.querySelector("textarea");
    if (notes instanceof HTMLTextAreaElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(notes, "  note  ");
        notes.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await click("rejected");
    await click("Submit Review");
    state.review = "error";
    await click("Confirm");
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("review failed");
    state.review = "ok";
    await click("issue");
    await click("Submit Review");
    await click("Confirm");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Experience request flagged as issue.");
    await click("verified");
    await click("Submit Review");
    await click("Confirm");
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Experience verified successfully.");
    await click("Collapse");
    view.unmount();

    state.queue = { items: [], total: 0, pageSize: 20, totalUnfiltered: 0 };
    const plain = await render();
    expect(plain.container.textContent).toContain("No experience verification requests pending");
    plain.unmount();
  }, 20000);
});
