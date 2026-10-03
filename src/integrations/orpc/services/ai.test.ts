// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const generateText = vi.hoisted(() => vi.fn());
const streamText = vi.hoisted(() => vi.fn());
const convertToModelMessages = vi.hoisted(() => vi.fn(async (messages: unknown) => messages));

function provider(name: string) {
  return () => ({
    chat: (model: string) => ({ provider: name, model }),
    languageModel: (model: string) => ({ provider: name, model }),
  });
}

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText,
    streamText,
    convertToModelMessages,
    createGateway: provider("vercel-ai-gateway"),
  };
});
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: provider("openai") }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: provider("gemini") }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: provider("anthropic") }));
vi.mock("ai-sdk-ollama", () => ({ createOllama: provider("ollama") }));
vi.mock("@orpc/server", () => ({ streamToEventIterator: (value: unknown) => value }));

import { defaultResumeData } from "@/schema/resume/data";

import { aiService } from "./ai";

const credentials = {
  provider: "openai" as const,
  model: "gpt-test",
  apiKey: "key",
  baseURL: "",
};

const file = { name: "resume.pdf", data: "ZmlsZQ==" };

describe("aiService", () => {
  beforeEach(() => {
    generateText.mockReset();
    streamText.mockReset();
    convertToModelMessages.mockClear();
  });

  it("selects a provider and reports whether the connection check passed", async () => {
    for (const providerName of ["openai", "ollama", "anthropic", "vercel-ai-gateway", "gemini"] as const) {
      generateText.mockResolvedValueOnce({ output: "1" });
      await expect(
        aiService.testConnection({ ...credentials, provider: providerName, baseURL: "http://localhost:11434" }),
      ).resolves.toBe(true);
    }

    generateText.mockResolvedValueOnce({ output: "no" });
    await expect(aiService.testConnection(credentials)).resolves.toBe(false);

    const models = generateText.mock.calls.map((call) => call[0].model.provider);
    expect(models).toEqual(["openai", "ollama", "anthropic", "vercel-ai-gateway", "gemini", "openai"]);
  });

  it("parses fenced, repaired, and invalid resume JSON from pdf and docx", async () => {
    const resume = {
      basics: { name: "Ada Lovelace" },
      sections: {
        experience: {
          items: [
            { company: "" },
            { company: "Analytical Engines" },
            "skip",
            { company: "Archive", id: "", hidden: "no" },
          ],
        },
        skills: { items: [] },
      },
    };
    generateText.mockResolvedValueOnce({ text: `Sure:\n${JSON.stringify(resume)}` });

    const parsed = await aiService.parsePdf({ ...credentials, file });
    expect(parsed.basics.name).toBe("Ada Lovelace");
    expect(parsed.sections.experience.items.map((item) => item.company)).toEqual(["Analytical Engines", "Archive"]);
    expect(parsed.sections.experience.items[1]?.hidden).toBe(false);

    generateText.mockResolvedValueOnce({ text: '{ "basics": { "name": "Grace", }, }' });
    await expect(
      aiService.parseDocx({
        ...credentials,
        file,
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).resolves.toMatchObject({ basics: { name: "Grace" } });

    generateText.mockResolvedValueOnce({ text: '{ "basics": { "name": 4 } }' });
    await expect(aiService.parsePdf({ ...credentials, file })).rejects.toThrow(Error);

    generateText.mockResolvedValueOnce({ text: '[note] { "basics": { "name": 4 } }' });
    await expect(aiService.parsePdf({ ...credentials, file })).rejects.toThrow(Error);

    generateText.mockRejectedValueOnce(new Error("provider down"));
    await expect(aiService.parsePdf({ ...credentials, file })).rejects.toThrow("provider down");

    generateText.mockRejectedValueOnce("nope");
    await expect(aiService.parseDocx({ ...credentials, file, mediaType: "application/msword" })).rejects.toThrow(
      "An unknown error occurred",
    );
  });

  it("reviews, tailors, matches, and streams a chat patch", async () => {
    generateText.mockResolvedValueOnce({ text: "Add metrics." });
    await expect(aiService.reviewResume({ ...credentials, resumeData: defaultResumeData })).resolves.toBe(
      "Add metrics.",
    );

    const tailored = { summary: { content: "<p>Fit</p>" }, experiences: [], references: [], skills: [] };
    generateText.mockResolvedValueOnce({ output: tailored });
    const job = {
      job_title: "Engineer",
      employer_name: "Engines",
      job_description: "",
      job_highlights: { Required: ["Maths"] },
      job_required_skills: ["Analysis"],
    };
    await expect(
      aiService.tailorResume({ ...credentials, resumeData: defaultResumeData, job: job as never }),
    ).resolves.toEqual(tailored);

    generateText.mockResolvedValueOnce({ output: null });
    await expect(
      aiService.tailorResume({
        ...credentials,
        resumeData: defaultResumeData,
        job: { ...job, job_highlights: null, job_required_skills: null, job_description: "Build engines" } as never,
      }),
    ).rejects.toThrow("no structured tailoring output");

    const match = {
      matches: [{ resumeId: "00000000-0000-4000-8000-000000000001", matchScore: 90, matchReason: "Skills overlap" }],
    };
    generateText.mockResolvedValueOnce({ output: match });
    await expect(
      aiService.matchCandidates({
        ...credentials,
        jobDescription: "Maths",
        candidates: [
          {
            resumeId: "00000000-0000-4000-8000-000000000001",
            displayName: "Ada",
            headline: "Mathematician",
            verifiedSkills: ["Analysis"],
            experienceTitles: ["Programmer @ Engines"],
          },
        ],
      }),
    ).resolves.toEqual(match);

    generateText.mockResolvedValueOnce({ output: null });
    await expect(
      aiService.matchCandidates({ ...credentials, jobDescription: "Maths", candidates: [] }),
    ).rejects.toThrow("no structured candidate match output");

    let execute: ((input: { operations: never[] }) => Promise<unknown>) | undefined;
    streamText.mockImplementation((options: { tools: { patch_resume: { execute: typeof execute } } }) => {
      execute = options.tools.patch_resume.execute;
      return { toUIMessageStream: () => "stream" };
    });

    await expect(aiService.chat({ ...credentials, messages: [], resumeData: defaultResumeData })).resolves.toBe(
      "stream",
    );
    await expect(execute?.({ operations: [] })).resolves.toMatchObject({ success: true });
  });
});
