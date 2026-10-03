globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
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
  useMutation: () => ({ mutate: duplicateResume, isPending: false }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/integrations/ai/use-ai-integration", () => ({ useAiIntegration: () => ai }));
vi.mock("@/integrations/orpc/client", () => ({ client, orpc: { resume: { list: { queryOptions: () => ({}) }, duplicate: { mutationOptions: () => ({}) } } } }));
vi.mock("@/utils/resume/tailor", () => ({
  validateTailorOutput: () => ["headline was dropped"],
  tailorOutputToPatches: () => ({
    operations: [{ op: "replace", path: "/basics/name", value: "Ada" }],
    newSkills: [{ name: "Rust", keywords: ["borrow"], proficiency: "Expert" }],
  }),
  buildSkillSyncOperations: () => [{ op: "add", path: "/sections/skills/items/-", value: { name: "Rust" } }],
}));

import { toast } from "sonner";

import { TailorDialog } from "./tailor-dialog";

const job = {
  job_title: "Compiler Engineer",
  employer_name: "Example",
  job_apply_link: "https://example.com/apply",
} as never;

function renderDialog() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  return {
    container,
    root,
    async show() {
      await act(async () => {
        root.render(<TailorDialog job={job} open onOpenChange={vi.fn()} />);
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
});
