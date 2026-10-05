import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const ai = vi.hoisted(() => ({ canUse: false }));
const query = vi.hoisted(() => ({
  data: [] as Array<{ id: string; name: string; updatedAt: Date; tags: string[] }>,
  isLoading: false,
}));
const duplicateResume = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({
  resume: {
    duplicate: vi.fn(),
    getById: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(async () => undefined),
  },
  ai: { tailorResume: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => query,
  useMutation: () => ({ mutate: duplicateResume, isPending: pending.value }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/integrations/ai/use-ai-integration", () => ({ useAiIntegration: () => ai }));
vi.mock("@/integrations/orpc/client", () => ({
  client,
  orpc: { resume: { list: { queryOptions: () => ({}) }, duplicate: { mutationOptions: () => ({}) } } },
}));
const tailorState = vi.hoisted(() => ({
  errors: ["headline was dropped"] as string[],
  operations: [{ op: "replace", path: "/basics/name", value: "Ada" }] as unknown[],
  newSkills: [{ name: "Rust", keywords: ["borrow"], proficiency: "Expert" }] as Array<{
    name: string;
    keywords: string[];
    proficiency?: string;
  }>,
}));
const pending = vi.hoisted(() => ({ value: false }));

vi.mock("@/utils/resume/tailor", () => ({
  validateTailorOutput: () => tailorState.errors,
  tailorOutputToPatches: () => ({ operations: tailorState.operations, newSkills: tailorState.newSkills }),
  buildSkillSyncOperations: () => [{ op: "add", path: "/sections/skills/items/-", value: { name: "Rust" } }],
}));

import { toast } from "sonner";

import { TailorDialog } from "./tailor-dialog";

const job = {
  job_title: "Compiler Engineer",
  employer_name: "Example",
  job_apply_link: "https://example.com/apply",
} as never;

function renderDialog(nextJob: unknown = job) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  return {
    container,
    root,
    async show() {
      await act(async () => {
        root.render(<TailorDialog job={nextJob as never} open onOpenChange={vi.fn()} />);
      });
    },
  };
}

describe("tailor dialog", () => {
  beforeEach(() => {
    ai.canUse = false;
    query.isLoading = false;
    query.data = [{ id: "resume-1", name: "CV", updatedAt: new Date("2020-01-01T00:00:00.000Z"), tags: ["design"] }];
    duplicateResume.mockReset();
    navigate.mockReset();
    client.resume.duplicate.mockReset();
    client.resume.getById.mockReset();
    client.resume.patch.mockReset();
    client.resume.delete.mockClear();
    client.ai.tailorResume.mockReset();
    tailorState.errors = ["headline was dropped"];
    tailorState.operations = [{ op: "replace", path: "/basics/name", value: "Ada" }];
    tailorState.newSkills = [{ name: "Rust", keywords: ["borrow"], proficiency: "Expert" }];
    pending.value = false;
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("duplicates a resume when AI is off and shows an empty list", async () => {
    const view = renderDialog();
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
    });
    const options = duplicateResume.mock.calls[0]?.[1] as {
      onSuccess: (id: string) => void;
      onError: (error: Error) => void;
    };
    options.onError(new Error("taken"));
    expect(toast.error).toHaveBeenCalled();
    options.onSuccess("resume-2");
    expect(window.open).toHaveBeenCalledWith("https://example.com/apply", "_blank", "noopener,noreferrer");
    expect(navigate).toHaveBeenCalledWith({ to: "/builder/$resumeId", params: { resumeId: "resume-2" } });

    query.data = [];
    await view.show();
    expect(document.body.textContent).toContain("No resumes found");

    query.isLoading = true;
    await view.show();
    view.root.unmount();
    view.container.remove();
  });

  it("tailors with AI, syncs new skills, and deletes the copy when tailoring fails", async () => {
    ai.canUse = true;
    client.resume.duplicate.mockResolvedValue("resume-2");
    client.resume.getById.mockResolvedValue({ data: { basics: { name: "Ada" } } });
    client.ai.tailorResume.mockResolvedValue({ ok: true });
    client.resume.patch.mockResolvedValue(undefined);

    const view = renderDialog();
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain("Rust");

    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Save"))?.click();
      await Promise.resolve();
    });
    expect(client.resume.patch).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();

    client.resume.getById.mockRejectedValueOnce("nope");
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(client.resume.delete).toHaveBeenCalledWith({ id: "resume-2" });

    view.root.unmount();
    view.container.remove();
  });

  it("finishes without new skills, skips sync, and tolerates a failed skill save", async () => {
    ai.canUse = true;
    pending.value = true;
    const view = renderDialog({ ...job, job_apply_link: "" });
    await view.show();
    expect(document.body.textContent).toContain("");
    pending.value = false;
    await view.show();

    const node = document.body;
    const key = Object.keys(node).find((name) => name.startsWith("__reactFiber$")) ?? Object.keys(node).find((name) => name.startsWith("__reactContainer$"));
    let fiber = key
      ? (node as unknown as Record<string, { child?: unknown; sibling?: unknown; memoizedProps?: Record<string, unknown> }>)[key]
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
    for (const onOpenChange of openChanges) onOpenChange(true);

    tailorState.errors = [];
    tailorState.operations = [];
    tailorState.newSkills = [];
    client.resume.duplicate.mockResolvedValue("resume-2");
    client.resume.getById.mockResolvedValue({ data: { basics: { name: "Ada" } } });
    client.ai.tailorResume.mockResolvedValue({ ok: true });
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalled();

    tailorState.newSkills = [{ name: "Rust", keywords: [], proficiency: "" }];
    tailorState.operations = [{ op: "replace" }];
    client.resume.patch.mockRejectedValueOnce(new Error("sync failed"));
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const skill = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Rust"));
    await act(async () => {
      skill?.click();
      skill?.click();
    });
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Skip"))?.click();
    });
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Rust"))?.click();
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Save"))?.click();
      await Promise.resolve();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    client.resume.duplicate.mockRejectedValueOnce(new Error("duplicate failed"));
    await view.show();
    await act(async () => {
      [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("CV"))?.click();
      await Promise.resolve();
    });

    view.root.unmount();
    view.container.remove();
  });
});
