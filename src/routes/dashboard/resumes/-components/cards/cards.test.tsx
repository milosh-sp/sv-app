import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const shot = vi.hoisted(() => ({
  url: undefined as string | undefined,
  loading: false,
}));
const ai = vi.hoisted(() => ({ canUse: true }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { refetchInterval?: (query: { state: { data?: { url?: string } } }) => unknown }) => {
    options.refetchInterval?.({ state: { data: { url: "https://cdn.example/preview.png" } } });
    options.refetchInterval?.({ state: { data: undefined } });
    return { data: shot.url ? { url: shot.url } : undefined, isLoading: shot.loading };
  },
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: { printer: { getResumeScreenshot: { queryOptions: () => ({ queryKey: ["shot"] }) } } },
}));
vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => ({ canUse: ai.canUse }),
}));
vi.mock("../menus/context-menu", () => ({
  ResumeContextMenu: ({ children }: { children: React.ReactNode }) => children,
}));

import { useDialogStore } from "@/dialogs/store";

import { CreateResumeCard } from "./create-card";
import { ImportResumeCard } from "./import-card";
import { ResumeCard } from "./resume-card";

const resume = {
  id: "resume-1",
  name: "Ada",
  slug: "ada",
  tags: ["design"],
  updatedAt: new Date("2024-01-01T00:00:00.000Z"),
  isLocked: false,
} as never;

describe("resume cards", () => {
  it("opens create and import dialogs and renders screenshot states", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <>
          <CreateResumeCard />
          <ImportResumeCard />
        </>,
      );
    });
    const cards = [...container.querySelectorAll("h3")];
    await act(async () => {
      cards.find((node) => node.textContent?.includes("Create"))?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.create");
    await act(async () => {
      cards.find((node) => node.textContent?.includes("Import"))?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.import");

    shot.loading = true;
    await act(async () => {
      root.render(<ResumeCard resume={resume} />);
    });
    shot.loading = false;
    shot.url = "https://cdn.example/uploads/shot.png?v=1";
    await act(async () => {
      root.render(<ResumeCard resume={{ ...resume, isLocked: true }} />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/uploads/shot.png?v=1");

    shot.url = "https://cdn.example/other.png";
    await act(async () => {
      root.render(<ResumeCard resume={resume} />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/other.png");

    shot.url = "not a url";
    await act(async () => {
      root.render(<ResumeCard resume={resume} />);
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe("not a url");

    shot.url = undefined;
    await act(async () => {
      root.render(<ResumeCard resume={resume} />);
    });

    ai.canUse = true;
    shot.url = "https://cdn.example/uploads/shot.png";
    await act(async () => {
      root.render(<ResumeCard resume={resume} />);
    });
    const review = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("AI review"));
    await act(async () => {
      review?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.ai.review");

    root.unmount();
    container.remove();
  });
});
