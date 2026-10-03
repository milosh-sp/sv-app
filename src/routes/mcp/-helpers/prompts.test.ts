// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const list = vi.hoisted(() => vi.fn());
const getById = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/orpc/client", () => ({
  client: { resume: { list, getById } },
}));

import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";

type PromptHandler = (args: { id: string; job_description?: string }) => Promise<{
  messages: Array<{ content: { text?: string; resource?: { uri: string } } }>;
}>;

function capture() {
  const prompts = new Map<string, PromptHandler>();
  const resources: Array<{ name: string; template: { listCallback?: () => Promise<unknown> }; read: Function }> = [];
  const server = {
    registerPrompt: (name: string, _config: unknown, handler: PromptHandler) => {
      prompts.set(name, handler);
    },
    registerResource: (
      name: string,
      template: { listCallback?: () => Promise<unknown> },
      _config: unknown,
      read: Function,
    ) => {
      resources.push({ name, template, read });
    },
  };
  registerPrompts(server as never);
  registerResources(server as never);
  return { prompts, resources };
}

describe("MCP prompts and resources", () => {
  beforeEach(() => {
    list.mockReset();
    getById.mockReset();
  });

  it("builds prompt messages that point at the resume", async () => {
    const { prompts } = capture();
    const built = await prompts.get("build_resume")!({ id: "resume-1" });
    expect(built.messages[0]?.content.resource?.uri).toBe("resume://resume-1");
    expect(built.messages.at(-1)?.content.text).toContain("build my resume");

    const tailored = await prompts.get("tailor_resume")!({ id: "resume-1", job_description: "Compilers" });
    expect(tailored.messages.at(-1)?.content.text).toContain("Compilers");

    const review = await prompts.get("review_resume")!({ id: "resume-1" });
    expect(review.messages.at(-1)?.content.text).toContain("read-only");

    const improved = await prompts.get("improve_resume")!({ id: "resume-1" });
    expect(improved.messages[0]?.content.resource?.uri).toBe("resume://resume-1");
  });

  it("lists resume resources and rejects a bad read", async () => {
    const { resources } = capture();
    const resume = resources.find((resource) => resource.name === "resume");
    const schema = resources.find((resource) => resource.name === "resume-schema");
    const updatedAt = new Date("2020-01-02T00:00:00.000Z");

    list.mockResolvedValueOnce([
      { id: "resume-1", name: "CV", slug: "cv", tags: ["design"], isPublic: true, isLocked: true, updatedAt },
      { id: "resume-2", name: "Draft", slug: "draft", tags: [], isPublic: false, isLocked: false, updatedAt },
    ]);
    const listed = (await resume?.template.listCallback?.()) as {
      resources: Array<{ description: string; uri: string }>;
    };
    expect(listed.resources[0]).toMatchObject({
      uri: "resume://resume-1",
      description: "Public | Locked | Tags: design",
    });
    expect(listed.resources[1]?.description).toBe("Private");

    list.mockRejectedValueOnce(new Error("down"));
    await expect(resume?.template.listCallback?.()).rejects.toThrow("down");

    getById.mockResolvedValueOnce({ data: { basics: { name: "Ada" } } });
    const read = await resume?.read(new URL("resume://resume-1"));
    expect(read.contents[0].text).toContain("Ada");

    const empty = new URL("https://example.com");
    Object.defineProperty(empty, "href", { value: "resume://" });
    await expect(resume?.read(empty)).rejects.toThrow("Invalid resume URI");

    getById.mockRejectedValueOnce(new Error("missing"));
    await expect(resume?.read(new URL("resume://missing"))).rejects.toThrow("missing");

    const schemaRead = await schema?.read(new URL("resume://schema"));
    expect(schemaRead.contents[0].text).toContain("basics");
  });
});
