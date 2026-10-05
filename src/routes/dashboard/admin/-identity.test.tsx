import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";
import { defaultAdminVerificationSearch } from "@/utils/verification/admin-verification-search";

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
const search = vi.hoisted(() => ({ q: "", statuses: [] as Array<"verified" | "rejected" | "issue">, page: 1 }));
const state = vi.hoisted(() => ({
  fail: "" as "" | "queue" | "history",
  review: "ok" as "ok" | "error",
  unfiltered: 0,
  queue: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20, totalUnfiltered: 0 },
  history: { items: [] as Array<Record<string, unknown>>, total: 0, pageSize: 20 },
}));

function list(kind: "queue" | "history") {
  return {
    queryOptions: ({ input }: { input: { pageSize?: number } }) => ({
      queryKey: [kind, input, state.fail],
      queryFn: async () => {
        if (input.pageSize === 1) {
          return { items: [], total: state.unfiltered, pageSize: 1, totalUnfiltered: state.unfiltered };
        }
        if (state.fail === kind) throw new Error(`${kind} down`);
        return kind === "queue" ? state.queue : state.history;
      },
    }),
    key: () => [kind],
  };
}

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      verification: {
        listIdentityQueue: list("queue"),
        listIdentityHistory: list("history"),
        reviewIdentity: {
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

import { Route } from "./identity";

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

async function click(label: string, scope: ParentNode = document) {
  await act(async () => {
    [...scope.querySelectorAll("button")].find((button) => button.textContent?.includes(label))?.click();
  });
}

describe("identity queue", () => {
  it("reviews requests and covers empty, filtered, and error states", async () => {
    search.q = "";
    search.page = 1;
    search.statuses = [];
    state.fail = "queue";
    const errored = await render();
    expect(errored.container.textContent).toContain("Failed to load");
    errored.unmount();

    state.fail = "";
    state.unfiltered = 2;
    const empty = await render();
    expect(empty.container.textContent).toContain("No identity verification requests pending");
    expect(empty.container.textContent).toContain("2");
    await click("History");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(empty.container.textContent).toContain("No completed identity reviews yet");
    empty.unmount();

    state.fail = "history";
    search.statuses = ["rejected"];
    const historyError = await render();
    await click("History");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(historyError.container.textContent).toContain("Failed to load");
    historyError.unmount();

    state.fail = "";
    search.q = "ada";
    search.page = 2;
    search.statuses = [];
    const filtered = await render();
    expect(filtered.container.textContent).toContain("No identity verification requests match");
    const input = document.getElementById("admin-verification-search");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing search");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "grace");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Next");
    await click("Previous");
    await click("Identity Queue");
    await click("Reset filters");
    expect(navigate).toHaveBeenCalled();
    filtered.unmount();

    const submittedAt = new Date("2024-03-01T00:00:00.000Z");
    state.queue = {
      items: [
        {
          id: "id-1",
          itemLabel: "Passport",
          status: "pending",
          method: "identity_call",
          submittedAt,
          calendarLinkSentAt: submittedAt,
          user,
          resume: {
            id: "resume-1",
            name: "CV",
            slug: "cv",
            tags: [],
            data: sampleResumeData,
            isLocked: false,
          },
          documents: [
            { id: "doc-1", fileUrl: "https://example.com/p", documentType: "assessment_solution_link", uploadedAt: submittedAt },
          ],
        },
        {
          id: "id-2",
          itemLabel: "Unknown",
          status: "pending",
          method: null,
          submittedAt,
          calendarLinkSentAt: null,
          user: null,
          resume: null,
          documents: [],
        },
      ],
      total: 21,
      pageSize: 20,
      totalUnfiltered: 21,
    };
    search.q = "";
    search.page = 1;
    const view = await render();
    expect(view.container.textContent).toContain("Showing 2 of 21");
    expect(view.container.textContent).toContain("Unknown applicant");
    const card = () => {
      const title = [...view.container.querySelectorAll("p")].find((el) => el.textContent === "Passport");
      const row = title?.closest("div.rounded-lg");
      if (!row) throw new Error("missing passport row");
      return row;
    };
    await click("Review", card());
    expect(view.container.textContent).toContain("ada@example.com");
    expect(view.container.textContent).toContain("resume-preview");
    await click("rejected", card());
    await click("Submit Review", card());
    state.review = "error";
    await click("Confirm", card());
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("review failed");
    state.review = "ok";
    await click("Submit Review", card());
    await click("Confirm", card());
    expect(vi.mocked(toast.success).mock.calls).toContainEqual(["Identity request rejected."]);
    await click("issue", card());
    await click("Submit Review", card());
    await click("Confirm", card());
    expect(vi.mocked(toast.success).mock.calls).toContainEqual(["Identity request flagged as issue."]);
    await click("verified", card());
    await click("Submit Review", card());
    await click("Back", card());
    await click("Submit Review", card());
    await click("Confirm", card());
    expect(vi.mocked(toast.success).mock.calls).toContainEqual(["Identity verified successfully."]);
    await click("Collapse", card());
    view.unmount();
    expect(defaultAdminVerificationSearch.q).toBe("");
  }, 20000);
});
