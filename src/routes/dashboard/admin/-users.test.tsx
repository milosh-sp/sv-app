import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

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
vi.mock("./-components/reviewer-profile-panel", () => ({
  ReviewerProfileDialogTrigger: () => <button type="button">Reviewer profile</button>,
}));

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const search = vi.hoisted(() => ({
  q: "",
  role: "all" as "all" | "user" | "skill_verdict_admin" | "reviewer_admin" | "company",
  page: 1,
}));
const session = vi.hoisted(() => ({ id: "user-1" as string | undefined }));
const state = vi.hoisted(() => ({
  listError: false,
  overview: "full" as "full" | "sparse" | "error" | "empty" | "loading",
  roleError: false,
  roleHang: false,
  release: null as null | (() => void),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useNavigate: () => navigate,
    useRouteContext: () => ({ session: session.id ? { user: { id: session.id } } : undefined }),
    Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  };
});

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      users: {
        listUsers: {
          queryOptions: () => ({
            queryKey: ["users", state.listError, search],
            queryFn: async () => {
              if (state.listError) throw new Error("list down");
              return state.overview === "empty" && false
                ? null
                : {
                    users: state.listError
                      ? []
                      : (globalThis as unknown as { __users?: unknown[] }).__users ?? [],
                    total: 40,
                    pageSize: 20,
                  };
            },
          }),
        },
        getUserOverview: {
          queryOptions: () => ({
            queryKey: ["overview", state.overview],
            queryFn: async () => {
              if (state.overview === "error") throw new Error("overview down");
              if (state.overview === "empty") return undefined;
              return (globalThis as unknown as { __overview?: unknown }).__overview;
            },
          }),
        },
        setUserAdminRole: {
          mutationOptions: () => ({
            mutationFn: async () => {
              if (state.roleHang) await new Promise<void>((resolve) => (state.release = resolve));
              if (state.roleError) throw new Error("role failed");
              return {};
            },
          }),
        },
      },
    },
    auth: { getAdminRole: { queryOptions: () => ({ queryKey: ["role"] }) } },
  },
}));

import { toast } from "sonner";

import { Route } from "./users";

const when = new Date("2024-03-01T00:00:00.000Z");

function overview(full: boolean) {
  return {
    user: {
      emailVerified: full,
      twoFactorEnabled: !full,
      lastActiveAt: full ? when : "not-a-date",
      updatedAt: full ? when : "2024-03-01T00:00:00.000Z",
      adminRoleAssignedAt: full ? null : "2024-04-01T00:00:00.000Z",
    },
    sessions: {
      total: 1,
      active: full ? 1 : 0,
      recent: full
        ? [{ id: "s", createdAt: when, ipAddress: "127.0.0.1", userAgent: "Browser" }]
        : [{ id: "t", createdAt: "nope", ipAddress: null, userAgent: null }],
    },
    authProviders: { totalLinkedAccounts: full ? 1 : 0, providerIds: full ? ["google"] : [] },
    resumes: {
      total: full ? 1 : 0,
      publicCount: 0,
      lockedCount: full ? 0 : 1,
      lastUpdatedAt: full ? when : null,
      totalViews: 0,
      totalDownloads: 0,
      hiddenCount: full ? 1 : 0,
      items: full
        ? [{ id: "resume-1", name: "CV", isPublic: true, isLocked: false, updatedAt: when }]
        : [{ id: "resume-2", name: "Hidden", isPublic: false, isLocked: true, updatedAt: "2024-01-01T00:00:00.000Z" }],
    },
    workAuthorization: full
      ? {
          eu: { status: "citizen", sponsorshipRequired: "no" },
          usa: { status: null, sponsorshipRequired: null },
          uk: { status: "needs_sponsorship", sponsorshipRequired: "yes" },
        }
      : null,
    verification: {
      total: 1,
      pending: 0,
      claimed: 0,
      verdictPending: 0,
      verified: 1,
      rejected: 0,
      issue: 0,
      uploadedDocuments: {
        hiddenCount: full ? 1 : 0,
        items: full
          ? [
              {
                verificationRequestId: "req",
                fileUrl: "https://example.com/a",
                itemLabel: "Cascade",
                documentType: "payslip",
                status: "pending",
                uploadedAt: when,
              },
            ]
          : [],
      },
      approvedIdentity: full
        ? {
            itemLabel: "Ada",
            resolvedAt: when,
            method: "identity_call",
            reviewerNote: "x".repeat(90),
            documents: [{ fileUrl: "https://example.com/id", documentType: "passport", uploadedAt: when }],
          }
        : {
            itemLabel: "Ada",
            resolvedAt: null,
            method: null,
            reviewerNote: null,
            documents: [],
          },
      approvedExperience: {
        hiddenCount: full ? 1 : 0,
        items: full
          ? [
              {
                id: "exp",
                itemLabel: "Cascade",
                resolvedAt: when,
                method: "document_upload",
                reviewerNote: "Payslip matched the long company ledger entry",
                documents: [{ fileUrl: "https://example.com/p", documentType: "payslip", uploadedAt: when }],
              },
            ]
          : [],
      },
    },
    apiKeys: { total: 0, enabled: 0, totalRequestCount: 0, lastRequestAt: full ? when : null },
  };
}

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
    async rerender() {
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
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("admin users", () => {
  it("edits roles and renders both overview shapes", async () => {
    state.listError = true;
    const failed = await render();
    expect(failed.container.textContent).toBe("");
    failed.unmount();

    state.listError = false;
    (globalThis as unknown as { __users: unknown[] }).__users = [];
    const empty = await render();
    expect(empty.container.textContent).toContain("No users match");
    empty.unmount();

    (globalThis as unknown as { __users: unknown[]; __overview: unknown }).__users = [
      {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com",
        username: "ada",
        displayUsername: "ada",
        createdAt: "2020-01-02T00:00:00.000Z",
        adminRole: "reviewer_admin",
      },
      {
        id: "user-2",
        name: "Grace",
        email: "grace@example.com",
        username: "grace",
        displayUsername: "grace",
        createdAt: new Date("2020-01-02T00:00:00.000Z"),
        adminRole: null,
      },
    ];
    (globalThis as unknown as { __overview: unknown }).__overview = overview(true);
    state.overview = "full";
    search.page = 2;
    search.q = "ada";
    session.id = "user-1";
    const view = await render();
    expect(view.container.textContent).toContain("(you)");
    expect(view.container.textContent).toContain("Reviewer profile");
    const input = document.getElementById("admin-users-search");
    if (input instanceof HTMLInputElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "grace");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    type Fiber = { child?: Fiber; sibling?: Fiber; return?: Fiber; memoizedProps?: { onValueChange?: (value: unknown) => void } };
    const host = view.container.firstElementChild;
    const fiberKey = host ? Object.getOwnPropertyNames(host).find((name) => name.startsWith("__reactFiber$")) : undefined;
    let start = fiberKey && host ? (host as unknown as Record<string, Fiber>)[fiberKey] : undefined;
    while (start?.return) start = start.return;
    const stack = start ? [start] : [];
    const handlers: Array<(value: unknown) => void> = [];
    const seen = new Set<unknown>();
    while (stack.length > 0) {
      const fiber = stack.pop();
      if (!fiber || seen.has(fiber)) continue;
      seen.add(fiber);
      const onValueChange = fiber.memoizedProps?.onValueChange;
      if (typeof onValueChange === "function" && !handlers.includes(onValueChange)) handlers.push(onValueChange);
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    await act(async () => {
      for (const onValueChange of handlers) {
        onValueChange("company");
        onValueChange(null);
        onValueChange("not-a-role");
      }
    });
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Save")?.click();
    });
    state.roleError = true;
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Save")?.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("role failed");
    state.roleError = false;
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("View details"))?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(view.container.textContent).toContain("Account health");
    expect(view.container.textContent).toContain("requires employer sponsorship");
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Hide details"))?.click();
    });
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Next")?.click();
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Previous")?.click();
    });

    search.q = "changed";
    (globalThis as unknown as { __overview: unknown }).__overview = overview(false);
    state.overview = "sparse";
    session.id = undefined;
    await view.rerender();
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("View details"))?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(view.container.textContent).toContain("No");
    expect(view.container.textContent).toContain("Unknown device");
    expect(view.container.textContent).toContain("No approved identity documents");

    state.overview = "error";
    await view.rerender();
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("View details"))?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    expect(view.container.textContent).toContain("Failed to load user details");

    state.overview = "empty";
    await view.rerender();
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("View details"))?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    state.roleHang = true;
    search.page = 2;
    await act(async () => {
      for (const onValueChange of handlers) onValueChange("skill_verdict_admin");
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Save")?.click();
    });
    await act(async () => {
      state.release?.();
    });
    view.unmount();
  }, 20000);
});
