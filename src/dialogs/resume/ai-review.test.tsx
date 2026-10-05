import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const review = vi.hoisted(() => vi.fn());
const ai = vi.hoisted(() => ({ canUse: true, isAvailabilityLoaded: true }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => ai,
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: { ai: { reviewResume: { mutationOptions: () => ({ mutationFn: review }) } } },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";

import { ResumeAiReviewDialog } from "./ai-review";

async function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Dialog open>
          <ResumeAiReviewDialog data={{ id: "resume-1", name: "CV" }} />
        </Dialog>
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

describe("resume AI review dialog", () => {
  it("waits for availability, shows headings, and reports a failed review", async () => {
    ai.isAvailabilityLoaded = false;
    ai.canUse = false;
    const unmountWaiting = await renderDialog();
    expect(document.querySelector("[role='status']")).toBeTruthy();
    const regenerate = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Regenerate"),
    );
    if (!(regenerate instanceof HTMLButtonElement)) throw new Error("missing regenerate");
    const fiberKey = Object.keys(regenerate).find((name) => name.startsWith("__reactFiber$"));
    let fiber = fiberKey
      ? (regenerate as unknown as Record<string, { return: unknown; memoizedProps?: { onClick?: () => void } } | null>)[
          fiberKey
        ]
      : null;
    let ran = false;
    while (fiber) {
      const onClick = fiber.memoizedProps?.onClick;
      if (typeof onClick === "function" && onClick.toString().includes("reviewResume")) {
        onClick();
        ran = true;
        break;
      }
      fiber = fiber.return as typeof fiber;
    }
    expect(ran).toBe(true);
    expect(review).not.toHaveBeenCalled();
    unmountWaiting();

    ai.isAvailabilityLoaded = true;
    ai.canUse = true;
    let resolveReview: (value: { analysis: string }) => void = () => undefined;
    review.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReview = resolve;
      }),
    );
    const unmountPending = await renderDialog();
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.querySelectorAll("[role='status']").length).toBeGreaterThan(0);
    await act(async () => {
      resolveReview({ analysis: "## Strengths\n### Detail\nKeep the summary." });
    });
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Strengths");
    });
    expect(document.body.textContent).toContain("Detail");
    unmountPending();

    review.mockRejectedValueOnce(new Error("offline"));
    const unmountError = await renderDialog();
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to generate AI review",
        expect.objectContaining({ description: "offline" }),
      );
    });
    unmountError();
  });
});
