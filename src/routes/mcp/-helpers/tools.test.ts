// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const list = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/orpc/client", () => ({
  client: { resume: { list } },
}));

import { registerTools } from "./tools";

type ToolHandler = (params: { tags: string[]; sort: "name" }) => Promise<{
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
    list.mockReset();
  });

  it("returns an error result with a hint when listing resumes fails", async () => {
    const tools = register();
    list.mockRejectedValueOnce(new Error("404 not found"));

    const result = await tools.get("list_resumes")!({ tags: [], sort: "name" });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Error listing resumes: 404 not found");
    expect(result.content[0]?.text).toContain("list_resumes");

    list.mockRejectedValueOnce("nope");
    const plain = await tools.get("list_resumes")!({ tags: [], sort: "name" });
    expect(plain.content[0]?.text).toBe("Error listing resumes: nope");
  });

  it("returns resume json and an empty-list message", async () => {
    const tools = register();
    list.mockResolvedValueOnce([{ id: "resume-1", name: "CV" }]);
    const listed = await tools.get("list_resumes")!({ tags: ["design"], sort: "name" });
    expect(listed.isError).toBeUndefined();
    expect(listed.content[0]?.text).toContain("resume-1");
    expect(list).toHaveBeenCalledWith({ tags: ["design"], sort: "name" });

    list.mockResolvedValueOnce([]);
    const empty = await tools.get("list_resumes")!({ tags: [], sort: "name" });
    expect(empty.content[0]?.text).toContain("No resumes found");
  });
});
