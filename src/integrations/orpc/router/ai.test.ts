// @vitest-environment node
import { AISDKError } from "ai";
import { OllamaError } from "ai-sdk-ollama";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";

import { defaultResumeData } from "@/schema/resume/data";

const getSession = vi.hoisted(() => vi.fn());
const getGlobalAiCredentialsForService = vi.hoisted(() => vi.fn());
const aiService = vi.hoisted(() => ({
  parsePdf: vi.fn(),
  parseDocx: vi.fn(),
  chat: vi.fn(),
  tailorResume: vi.fn(),
  reviewResume: vi.fn(),
  matchCandidates: vi.fn(),
}));
const resumeService = vi.hoisted(() => ({
  getById: vi.fn(),
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/global-ai-settings", () => ({ getGlobalAiCredentialsForService }));
vi.mock("../services/ai", async () => {
  const actual = await vi.importActual<typeof AiService>("../services/ai");
  return { ...actual, aiService };
});
vi.mock("../services/resume", () => ({ resumeService }));

import type * as AiService from "../services/ai";

import { callProcedure } from "../call-procedure";
import { aiRouter } from "./ai";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };
const file = { name: "resume.pdf", data: "Zg==" };
const credentials = { provider: "openai", model: "gpt-test", apiKey: "key", baseURL: "" };

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

describe("aiRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    getGlobalAiCredentialsForService.mockReset();
    aiService.parsePdf.mockReset();
    aiService.parseDocx.mockReset();
    aiService.reviewResume.mockReset();
    resumeService.getById.mockReset();
  });

  it("rejects an anonymous parse and a missing global AI configuration", async () => {
    getSession.mockResolvedValue(null);
    await expect(call(aiRouter.parsePdf, { file })).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    getSession.mockResolvedValue({ user });
    getGlobalAiCredentialsForService.mockResolvedValue(null);
    await expect(call(aiRouter.getAvailability)).resolves.toEqual({ configured: false, provider: null, model: null });
    await expect(call(aiRouter.parsePdf, { file })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    await expect(call(aiRouter.parseDocx, { file, mediaType: "application/msword" })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("maps provider and schema failures and reviews the caller's resume", async () => {
    getGlobalAiCredentialsForService.mockResolvedValue(credentials);
    await expect(call(aiRouter.getAvailability)).resolves.toEqual({
      configured: true,
      provider: "openai",
      model: "gpt-test",
    });

    aiService.parsePdf.mockRejectedValueOnce(new AISDKError({ name: "AI_APICallError", message: "down" }));
    await expect(call(aiRouter.parsePdf, { file })).rejects.toMatchObject({ code: "BAD_GATEWAY", message: "down" });

    aiService.parseDocx.mockRejectedValueOnce(new ZodError([]));
    await expect(call(aiRouter.parseDocx, { file, mediaType: "application/msword" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });

    aiService.parsePdf.mockRejectedValueOnce(new Error("unexpected"));
    await expect(call(aiRouter.parsePdf, { file })).rejects.toThrow("unexpected");

    resumeService.getById.mockResolvedValue({ data: defaultResumeData });
    aiService.reviewResume.mockResolvedValue("Add metrics.");
    await expect(call(aiRouter.reviewResume, { resumeId: "resume-1" })).resolves.toEqual({ analysis: "Add metrics." });
    expect(resumeService.getById).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1" });

    aiService.reviewResume.mockRejectedValueOnce(new OllamaError({ message: "offline" }));
    await expect(call(aiRouter.reviewResume, { resumeId: "resume-1" })).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});
