// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

const getSession = vi.hoisted(() => vi.fn());
const resumeService = vi.hoisted(() => ({
  getForPdfExport: vi.fn(),
  getByIdForPrinter: vi.fn(),
  statistics: { increment: vi.fn(async () => undefined) },
}));
const printerService = vi.hoisted(() => ({
  printResumeAsPDF: vi.fn(async () => "http://localhost/file.pdf"),
  getResumeScreenshot: vi.fn(async () => "http://localhost/shot.webp"),
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/resume", () => ({ resumeService }));
vi.mock("../services/printer", () => ({ printerService }));

import { printerRouter } from "./printer";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };
const exported = { id: "resume-1", data: defaultResumeData, userId: "owner", updatedAt: new Date() };

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }, input?: object) {
  return procedure.callable({ context: { locale: "en-US", reqHeaders: new Headers() } })(input);
}

describe("printerRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    resumeService.getForPdfExport.mockReset();
    resumeService.getByIdForPrinter.mockReset();
    resumeService.statistics.increment.mockClear();
    resumeService.getForPdfExport.mockResolvedValue(exported);
    resumeService.getByIdForPrinter.mockResolvedValue(exported);
  });

  it("counts an anonymous download and skips the count for a signed-in viewer", async () => {
    getSession.mockResolvedValue(null);
    await expect(call(printerRouter.printResumeAsPDF, { id: "resume-1" })).resolves.toEqual({
      url: "http://localhost/file.pdf",
    });
    expect(resumeService.statistics.increment).toHaveBeenCalledWith({ id: "resume-1", downloads: true });

    getSession.mockResolvedValue({ user });
    await call(printerRouter.printResumeAsPDF, { id: "resume-1" });
    expect(resumeService.statistics.increment).toHaveBeenCalledOnce();
  });

  it("returns a screenshot url and null when generation fails", async () => {
    getSession.mockResolvedValue({ user });
    await expect(call(printerRouter.getResumeScreenshot, { id: "resume-1" })).resolves.toEqual({
      url: "http://localhost/shot.webp",
    });
    expect(resumeService.getByIdForPrinter).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1" });

    resumeService.getByIdForPrinter.mockRejectedValueOnce(new Error("missing"));
    await expect(call(printerRouter.getResumeScreenshot, { id: "resume-1" })).resolves.toEqual({ url: null });
  });
});
