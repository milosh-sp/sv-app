// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  duplicate: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  setLocked: vi.fn(),
  statistics: vi.fn(),
  printResumeAsPDF: vi.fn(),
  getResumeScreenshot: vi.fn(),
}));

vi.mock("@/integrations/orpc/client", () => ({
  client: {
    resume: {
      list: api.list,
      getById: api.getById,
      create: api.create,
      duplicate: api.duplicate,
      patch: api.patch,
      delete: api.delete,
      setLocked: api.setLocked,
      statistics: { getById: api.statistics },
    },
    printer: {
      printResumeAsPDF: api.printResumeAsPDF,
      getResumeScreenshot: api.getResumeScreenshot,
    },
  },
}));

import { errorHint, registerTools } from "./tools";

type ToolHandler = (params: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: Array<{ text: string }>;
}>;

function register() {
  const tools = new Map<string, ToolHandler>();
  registerTools({
    registerTool: (name: string, _config: unknown, handler: ToolHandler) => {
      tools.set(name, handler);
    },
  } as never);
  return tools;
}

describe("MCP tool errors", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
  });

  it("returns an error result with a hint when listing resumes fails", async () => {
    const tools = register();
    api.list.mockRejectedValueOnce(new Error("404 not found"));

    const result = await tools.get("list_resumes")!({ tags: [], sort: "name" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Error listing resumes: 404 not found");
    expect(result.content[0]?.text).toContain("list_resumes");

    api.list.mockRejectedValueOnce("nope");
    const plain = await tools.get("list_resumes")!({ tags: [], sort: "name" });
    expect(plain.content[0]?.text).toBe("Error listing resumes: nope");
  });

  it("returns resume json and an empty-list message", async () => {
    const tools = register();
    api.list.mockResolvedValueOnce([{ id: "resume-1", name: "CV" }]);
    const listed = await tools.get("list_resumes")!({ tags: ["design"], sort: "name" });
    expect(listed.isError).toBeUndefined();
    expect(listed.content[0]?.text).toContain("resume-1");
    expect(api.list).toHaveBeenCalledWith({ tags: ["design"], sort: "name" });

    api.list.mockResolvedValueOnce([]);
    const empty = await tools.get("list_resumes")!({ tags: [], sort: "name" });
    expect(empty.content[0]?.text).toContain("No resumes found");
  });

  it("maps known failures to hints", () => {
    expect(errorHint(new Error("slug already exists"))).toContain("different one");
    expect(errorHint(new Error("resume is locked"))).toContain("unlock_resume");
    expect(errorHint(new Error("404 not found"))).toContain("list_resumes");
    expect(errorHint(new Error("400 bad request"))).toContain("get_resume");
    expect(errorHint(new Error("403 forbidden"))).toContain("Permission denied");
    expect(errorHint(new Error("nope"))).toBe("");
  });

  it("creates, reads, duplicates, patches, locks, and deletes a resume", async () => {
    const tools = register();
    api.getById.mockResolvedValue({ name: "CV", data: { basics: { name: "Ada" } } });
    api.create.mockResolvedValue("resume-2");
    api.duplicate.mockResolvedValue("resume-3");
    api.patch.mockResolvedValue({ name: "CV" });
    api.printResumeAsPDF.mockResolvedValue({ url: "https://example.com/cv.pdf" });
    api.getResumeScreenshot.mockResolvedValueOnce({ url: "https://example.com/cv.webp" });
    api.statistics.mockResolvedValue({ views: 2, downloads: 1 });

    const got = await tools.get("get_resume")!({ id: "resume-1" });
    expect(got.content[0]?.text).toContain("Ada");

    const created = await tools.get("create_resume")!({
      name: "CV",
      slug: "cv",
      tags: [],
      withSampleData: false,
    });
    expect(created.content[0]?.text).toContain("resume-2");
    expect(created.content[0]?.text).not.toContain("sample data");

    const sampled = await tools.get("create_resume")!({
      name: "CV",
      slug: "cv-sample",
      tags: ["design"],
      withSampleData: true,
    });
    expect(sampled.content[0]?.text).toContain("Pre-filled with sample data");

    const copy = await tools.get("duplicate_resume")!({ id: "resume-1", name: "Copy", slug: "copy", tags: [] });
    expect(copy.content[0]?.text).toContain("resume-3");

    const patched = await tools.get("patch_resume")!({
      id: "resume-1",
      operations: [{ op: "replace", path: "/basics/name" }],
    });
    expect(patched.content[0]?.text).toContain("replace /basics/name");

    await tools.get("delete_resume")!({ id: "resume-1" });
    expect(api.delete).toHaveBeenCalledWith({ id: "resume-1" });

    const locked = await tools.get("lock_resume")!({ id: "resume-1" });
    expect(api.setLocked).toHaveBeenCalledWith({ id: "resume-1", isLocked: true });
    expect(locked.content[0]?.text).toContain("locked");

    const unlocked = await tools.get("unlock_resume")!({ id: "resume-1" });
    expect(api.setLocked).toHaveBeenLastCalledWith({ id: "resume-1", isLocked: false });
    expect(unlocked.content[0]?.text).toContain("unlocked");

    const pdf = await tools.get("export_resume_pdf")!({ id: "resume-1" });
    expect(pdf.content[0]?.text).toContain("https://example.com/cv.pdf");

    const shot = await tools.get("get_resume_screenshot")!({ id: "resume-1" });
    expect(shot.content[0]?.text).toContain("https://example.com/cv.webp");

    api.getResumeScreenshot.mockResolvedValueOnce({ url: null });
    const missing = await tools.get("get_resume_screenshot")!({ id: "resume-1" });
    expect(missing.content[0]?.text).toContain("could not be generated");

    const stats = await tools.get("get_resume_statistics")!({ id: "resume-1" });
    expect(stats.content[0]?.text).toContain("views");
  });

  it("returns a hinted error for each mutating tool", async () => {
    const tools = register();
    const cases: Array<[string, keyof typeof api, Record<string, unknown>, string]> = [
      ["get_resume", "getById", { id: "resume-1" }, "404 not found"],
      ["create_resume", "create", { name: "CV", slug: "cv", tags: [], withSampleData: false }, "slug already exists"],
      ["duplicate_resume", "duplicate", { id: "resume-1", name: "Copy", slug: "copy", tags: [] }, "resume is locked"],
      ["patch_resume", "patch", { id: "resume-1", operations: [{ op: "replace", path: "/basics/name" }] }, "400 bad"],
      ["delete_resume", "delete", { id: "resume-1" }, "403 forbidden"],
      ["lock_resume", "setLocked", { id: "resume-1" }, "nope"],
      ["unlock_resume", "setLocked", { id: "resume-1" }, "nope"],
      ["export_resume_pdf", "printResumeAsPDF", { id: "resume-1" }, "404 not found"],
      ["get_resume_screenshot", "getResumeScreenshot", { id: "resume-1" }, "400 bad"],
      ["get_resume_statistics", "statistics", { id: "resume-1" }, "403 forbidden"],
    ];

    for (const [tool, method, params, message] of cases) {
      api[method].mockRejectedValueOnce(new Error(message));
      const result = await tools.get(tool)!(params);
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain(message);
    }
  });
});
