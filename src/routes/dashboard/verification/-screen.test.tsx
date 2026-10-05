import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, Suspense, type ComponentType, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";
import { deriveSkillKeywordId } from "@/utils/verification/skills";

const unityId = "019bef5a-93e4-7746-ad39-5a52dcf50ed4";
const experienceId = "019bef5a-93e4-7746-ad39-44d8cec98ca4";
const keywordId = deriveSkillKeywordId(unityId, "C#");

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/routes/dashboard/-components/header", () => ({
  DashboardHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

const navigate = vi.hoisted(() => vi.fn(async () => undefined));
const api = vi.hoisted(() => ({
  resumes: [] as Array<{ id: string; name: string; slug: string }>,
  resume: null as { id: string; data: typeof sampleResumeData } | null,
  statuses: [] as Array<Record<string, unknown>>,
  history: [] as Array<Record<string, unknown>>,
  historyError: false,
  fail: "" as "" | "request" | "solution" | "upload" | "experience",
}));

function endpoint(path: string[]) {
  const key = path.join(".");
  const node: Record<string, unknown> = {
    key: () => [key],
    queryOptions: (options?: { input?: { itemId?: string } }) => ({
      queryKey: [key, options?.input, api.historyError, api.resumes, api.resume, api.statuses],
      queryFn: async () => {
        if (key === "resume.list") return api.resumes;
        if (key === "resume.getById") return api.resume;
        if (key === "verification.getAllStatuses") return api.statuses;
        if (key === "verification.getHistory") {
          if (api.historyError) throw new Error("history down");
          return api.history;
        }
        return null;
      },
    }),
    mutationOptions: () => ({
      mutationFn: async () => {
        if (api.fail && key.includes(api.fail === "request" ? "requestSkill" : api.fail)) throw new Error(`${api.fail} failed`);
        if (api.fail === "request" && key.endsWith("requestSkill")) throw new Error("request failed");
        if (api.fail === "solution" && key.endsWith("submitAssessmentSolution")) throw new Error("solution failed");
        if (api.fail === "upload" && key.endsWith("uploadDocument")) throw new Error("upload failed");
        if (api.fail === "experience" && key.endsWith("requestExperience")) throw new Error("experience failed");
        return {};
      },
    }),
  };
  return new Proxy(node, {
    get(target, prop, receiver) {
      if (typeof prop === "symbol" || prop in target) return Reflect.get(target, prop, receiver);
      const child = endpoint([...path, String(prop)]);
      target[prop] = child;
      return child;
    },
  });
}

vi.mock("@/integrations/orpc/client", () => ({ orpc: endpoint([]) }));
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useNavigate: () => navigate, Link: ({ children }: { children?: ReactNode }) => <a>{children}</a> };
});

import { toast } from "sonner";

import { Route } from "./index";

function status(itemId: string, value: string, extra: Record<string, unknown> = {}) {
  return {
    id: itemId,
    sectionType: "skill",
    itemId,
    itemLabel: itemId,
    status: value,
    badgeVisible: false,
    submittedAt: new Date("2024-01-02T00:00:00.000Z"),
    resumeId: "resume-1",
    ...extra,
  };
}

async function render() {
  const Screen = Route.options.component as ComponentType & { preload?: () => Promise<void> };
  await Screen.preload?.();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Suspense fallback={<p>suspended</p>}>
          <Screen />
        </Suspense>
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

function choose(input: HTMLInputElement, file: File | null) {
  Object.defineProperty(input, "files", { configurable: true, value: file ? [file] : [] });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("verification screen", () => {
  it("requests skills and experience and shows every status", async () => {
    api.resumes = [];
    const empty = await render();
    expect(empty.container.textContent).toContain("Create a resume first");
    await act(async () => {
      [...empty.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Create a new resume"))?.click();
    });
    expect(navigate).toHaveBeenCalled();
    empty.unmount();

    const blank = structuredClone(sampleResumeData);
    blank.sections.skills.items = [];
    blank.sections.experience.items = [];
    api.resumes = [
      { id: "resume-1", name: "CV", slug: "cv" },
      { id: "resume-2", name: "Blank", slug: "blank" },
    ];
    api.resume = { id: "resume-1", data: sampleResumeData };
    api.statuses = [
      status(unityId, "verified"),
      status(keywordId, "claimed", {
        assessmentInstructionsUrl: "https://example.com/task",
      }),
      status(experienceId, "rejected"),
    ];
    const view = await render();
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    expect(view.container.textContent).toContain("Legacy category request");
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Blank")?.click();
    });
    api.resume = { id: "resume-2", data: blank };
    await act(async () => {
      [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Blank")?.click();
    });
    view.unmount();

    api.resume = { id: "resume-1", data: sampleResumeData };
    api.statuses = [
      status(keywordId, "claimed", { assessmentInstructionsUrl: "https://example.com/task" }),
      status(experienceId, "issue"),
    ];
    const skills = await render();
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    const fileInput = skills.container.querySelector("input[type='file']");
    if (!(fileInput instanceof HTMLInputElement)) throw new Error("missing solution input");
    await act(async () => {
      choose(fileInput, null);
      choose(fileInput, new File(["x"], "notes.txt", { type: "text/plain" }));
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    const huge = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(huge, "size", { value: 26 * 1024 * 1024 });
    await act(async () => {
      choose(fileInput, huge);
      choose(fileInput, new File(["x"], "ok.pdf", { type: "application/pdf" }));
    });
    const url = skills.container.querySelector("input[type='url']");
    if (url instanceof HTMLInputElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(url, "https://github.com/you/repo");
        url.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    api.fail = "solution";
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit solution"))?.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("solution failed");
    api.fail = "";
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit solution"))?.click();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalled();

    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Request"))?.click();
    });
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent === "Cancel")?.click();
    });
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Request"))?.click();
    });
    api.fail = "request";
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent === "Confirm")?.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("request failed");
    api.fail = "";
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Request"))?.click();
    });
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent === "Confirm")?.click();
    });

    skills.unmount();
  }, 60000);

  it("shows history, submitted solutions, and experience uploads", async () => {
    api.resumes = [{ id: "resume-1", name: "CV", slug: "cv" }];
    api.resume = { id: "resume-1", data: sampleResumeData };
    api.statuses = [
      status(keywordId, "claimed", { assessmentInstructionsUrl: "https://example.com/task" }),
      status(experienceId, "issue"),
    ];
    const skills = await render();
    await act(async () => {
      [...skills.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    const historyButton = [...skills.container.querySelectorAll("button")].find((button) => button.className.includes("size-6"));
    await act(async () => {
      historyButton?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(skills.container.textContent).toContain("No history available");
    api.history = [
      { id: "h1", status: "verified", verifiedBy: "Ada", reviewerProfileUrl: "/reviewer/ada", submittedAt: new Date("2024-02-01T00:00:00.000Z") },
      { id: "h2", status: "rejected", verifiedBy: null, reviewerProfileUrl: null, submittedAt: new Date("2024-02-02T00:00:00.000Z") },
    ];
    await act(async () => {
      historyButton?.click();
      historyButton?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    skills.unmount();

    api.historyError = true;
    api.statuses = [status(keywordId, "verified")];
    const historyError = await render();
    await act(async () => {
      [...historyError.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    const toggle = [...historyError.container.querySelectorAll("button")].find((button) => button.className.includes("size-6"));
    await act(async () => {
      toggle?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(historyError.container.textContent).toContain("Unable to load verification history");
    historyError.unmount();

    api.historyError = false;
    api.history = [];
    api.statuses = [
      status(keywordId, "claimed", {
        assessmentInstructionsUrl: "https://example.com/task",
        assessmentSolutionSubmittedAt: new Date("2024-03-01T00:00:00.000Z"),
        assessmentSolutionFileUrl: "https://example.com/file",
        assessmentSolutionLinkUrl: "https://example.com/link",
      }),
    ];
    const submitted = await render();
    await act(async () => {
      [...submitted.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    expect(submitted.container.textContent).toContain("Solution submitted");
    expect(submitted.container.textContent).toContain("View submitted file");
    expect(submitted.container.textContent).toContain("Open submitted link");
    submitted.unmount();

    api.statuses = [status(keywordId, "verdict_pending", { assessmentSolutionLinkUrl: "https://example.com/link" })];
    const pending = await render();
    await act(async () => {
      [...pending.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    expect(pending.container.textContent).toContain("Awaiting final approval");
    expect(pending.container.textContent).toContain("Open submitted link");
    pending.unmount();

    api.statuses = [status(keywordId, "verdict_pending")];
    const pendingBare = await render();
    await act(async () => {
      [...pendingBare.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    expect(pendingBare.container.textContent).toContain("Awaiting final approval");
    pendingBare.unmount();

    api.statuses = [status(keywordId, "mystery")];
    const mystery = await render();
    await act(async () => {
      [...mystery.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Unity Engine"))?.click();
    });
    expect(mystery.container.textContent).toContain("mystery");
    mystery.unmount();

    api.statuses = [status(experienceId, "rejected")];
    const experience = await render();
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Upload Document"))?.click();
    });
    const upload = experience.container.querySelector("input[type='file']");
    if (!(upload instanceof HTMLInputElement)) throw new Error("missing upload");
    await act(async () => {
      choose(upload, null);
      choose(upload, new File(["x"], "notes.txt", { type: "text/plain" }));
    });
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    await act(async () => {
      choose(upload, big);
      choose(upload, new File(["x"], "payslip.pdf", { type: "application/pdf" }));
    });
    api.fail = "experience";
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit Request"))?.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("experience failed");
    api.fail = "";
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Freelancer"))?.click();
    });
    const link = [...experience.container.querySelectorAll("input[type='url']")].at(-1);
    if (link instanceof HTMLInputElement) {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(link, "https://upwork.com/a");
        link.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent === "Continue")?.click();
    });
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit Request"))?.click();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalled();
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Retry"))?.click();
    });
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Upload Document"))?.click();
    });
    const uploadAgain = experience.container.querySelector("input[type='file']");
    if (uploadAgain instanceof HTMLInputElement) {
      await act(async () => {
        choose(uploadAgain, new File(["x"], "contract.pdf", { type: "application/pdf" }));
      });
    }
    api.fail = "upload";
    await act(async () => {
      [...experience.container.querySelectorAll("button")].find((button) => button.textContent?.includes("Submit Request"))?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("upload failed");
    experience.unmount();
  }, 60000);
});
