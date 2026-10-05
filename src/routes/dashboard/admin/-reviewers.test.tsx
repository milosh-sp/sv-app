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
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  };
});

const list = vi.hoisted(() => ({
  mode: "ok" as "ok" | "error" | "loading" | "empty",
  refetch: vi.fn(),
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    admin: {
      reviewerProfiles: {
        list: {
          queryOptions: () => ({
            queryKey: ["reviewers", list.mode],
            queryFn: async () => {
              if (list.mode === "error") throw new Error("down");
              return list.rows;
            },
          }),
        },
        getByAdminId: { queryOptions: () => ({ queryKey: ["profile"], queryFn: async () => null }) },
        create: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
        updateDirect: { mutationOptions: () => ({ mutationFn: async () => ({}) }) },
      },
    },
    reviewer: { profile: { get: { queryOptions: () => ({ queryKey: ["mine"] }) } } },
  },
}));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return actual;
});

import { Route } from "./reviewers";

async function render() {
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

describe("admin reviewers", () => {
  it("shows loading, an error, an empty list, and profile states", async () => {
    list.mode = "error";
    const failed = await render();
    await act(async () => {
      [...failed.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    expect(failed.container.textContent).toContain("Failed to load reviewers");
    failed.unmount();

    list.mode = "empty";
    list.rows = [];
    const empty = await render();
    expect(empty.container.textContent).toContain("No Reviewer Admins found");
    empty.unmount();

    list.mode = "ok";
    list.rows = [
      {
        userId: "user-1",
        name: "Ada",
        email: "ada@example.com",
        profile: null,
      },
      {
        userId: "user-2",
        name: "Grace",
        email: "grace@example.com",
        profile: { firstName: "Grace", lastName: "Hopper", title: "Staff", reviewerSkills: ["COBOL"] },
      },
      {
        userId: "user-3",
        name: "Lin",
        email: "lin@example.com",
        profile: { firstName: "Lin", lastName: "T", title: "Eng", reviewerSkills: ["Go", "Rust"] },
      },
      {
        userId: "user-4",
        name: "No Skills",
        email: "none@example.com",
        profile: { firstName: "No", lastName: "Skills", title: "Eng", reviewerSkills: [] },
      },
    ];
    const view = await render();
    expect(view.container.textContent).toContain("No public reviewer profile yet");
    expect(view.container.textContent).toContain("1 skill");
    expect(view.container.textContent).toContain("2 skills");
    expect(view.container.textContent).toContain("Grace Hopper");
    view.unmount();
  }, 20000);
});
