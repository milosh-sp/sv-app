// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const envState = vi.hoisted(() => ({
  APP_URL: "http://localhost:3000",
  PRINTER_APP_URL: "http://printer.internal:3000",
  PRINTER_ENDPOINT: "ws://127.0.0.1:4000",
}));

const lookup = vi.hoisted(() => vi.fn(async () => ({ address: "10.0.0.8" })));
const connect = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({
  list: vi.fn(),
  delete: vi.fn(async () => true),
}));
const uploadFile = vi.hoisted(() => vi.fn(async () => ({ url: "http://localhost:3000/uploads/file", key: "k" })));

vi.mock("@/utils/env", () => ({ env: envState }));
vi.mock("node:dns/promises", () => ({ default: { lookup }, lookup }));
vi.mock("puppeteer-core", () => ({ default: { connect } }));
vi.mock("./storage", () => ({
  getStorageService: () => storage,
  uploadFile,
}));

import { defaultResumeData } from "@/schema/resume/data";

import { printerService } from "./printer";

const page = {
  emulateMediaType: vi.fn(),
  setViewport: vi.fn(),
  goto: vi.fn(),
  waitForFunction: vi.fn(async (fn: () => unknown) => fn()),
  evaluate: vi.fn(async (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args)),
  pdf: vi.fn(async () => new Uint8Array([1, 2, 3])),
  screenshot: vi.fn(async () => new Uint8Array([4])),
  close: vi.fn(async () => undefined),
};

const browser = {
  connected: true,
  newPage: vi.fn(async () => page),
  setCookie: vi.fn(),
  close: vi.fn(),
};

function resumeData(format: "a4" | "free-form", template: string) {
  const data = structuredClone(defaultResumeData);
  data.metadata.page.format = format;
  data.metadata.template = template as typeof data.metadata.template;
  data.metadata.design.colors.background = "rgba(255, 255, 255, 1)";
  return data;
}

function mountPages() {
  document.body.innerHTML = `
    <div class="resume-preview-container"></div>
    <div data-page-index="0"><div class="page"></div><div class="page-content"></div></div>
    <div data-page-index="1"><div class="page"></div><div class="page-content"></div></div>
  `;
}

describe("printerService", () => {
  beforeEach(() => {
    envState.PRINTER_ENDPOINT = "ws://127.0.0.1:4000";
    lookup.mockClear();
    connect.mockReset();
    connect.mockImplementation(async () => browser);
    browser.connected = true;
    page.goto.mockReset();
    page.goto.mockResolvedValue(undefined);
    page.pdf.mockClear();
    page.screenshot.mockClear();
    page.close.mockClear();
    uploadFile.mockClear();
    storage.list.mockReset();
    storage.delete.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ json: async () => ({ Browser: "Chrome" }) })),
    );
    mountPages();
  });

  it("checks printer health over websocket and http endpoints", async () => {
    await expect(printerService.healthcheck()).resolves.toEqual({ Browser: "Chrome" });

    envState.PRINTER_ENDPOINT = "http://printer.local:4000";
    await expect(printerService.healthcheck()).resolves.toEqual({ Browser: "Chrome" });
    expect(lookup).toHaveBeenCalledWith("printer.local");
  });

  it("reuses a fresh screenshot, keeps a stale unchanged one, and regenerates after an edit", async () => {
    const now = Date.now();
    const fresh = `uploads/user-1/screenshots/resume-1/${now - 1_000}.webp`;
    const junk = "uploads/user-1/screenshots/resume-1/notes.txt";
    const input = {
      id: "resume-1",
      userId: "user-1",
      data: resumeData("a4", "onyx"),
      updatedAt: new Date(now),
    };

    storage.list.mockResolvedValueOnce([junk, fresh]);
    await expect(printerService.getResumeScreenshot(input)).resolves.toBe(`http://localhost:3000/${fresh}`);
    expect(uploadFile).not.toHaveBeenCalled();

    const stale = now - 1000 * 60 * 60 * 7;
    const stalePath = `uploads/user-1/screenshots/resume-1/${stale}.webp`;
    storage.list.mockResolvedValueOnce([stalePath]);
    await expect(printerService.getResumeScreenshot({ ...input, updatedAt: new Date(stale - 1_000) })).resolves.toBe(
      `http://localhost:3000/${stalePath}`,
    );

    storage.list.mockResolvedValueOnce([stalePath, junk]);
    await expect(printerService.getResumeScreenshot({ ...input, updatedAt: new Date(now) })).resolves.toBe(
      "http://localhost:3000/uploads/file",
    );
    expect(storage.delete).toHaveBeenCalledWith(stalePath);
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ type: "screenshot", resumeId: "resume-1" }));

    uploadFile.mockClear();
    storage.list.mockResolvedValueOnce([junk]);
    await expect(printerService.getResumeScreenshot(input)).resolves.toBe("http://localhost:3000/uploads/file");

    uploadFile.mockClear();
    storage.list.mockResolvedValueOnce([]);
    await expect(printerService.getResumeScreenshot(input)).resolves.toBe("http://localhost:3000/uploads/file");

    page.screenshot.mockRejectedValueOnce(new Error("screenshot failed"));
    page.close.mockRejectedValueOnce(new Error("close failed"));
    storage.list.mockResolvedValueOnce([]);
    await expect(printerService.getResumeScreenshot(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });

  it("prints a margined page and a free-form page, and wraps navigation failures", async () => {
    browser.connected = false;
    const printed = await printerService.printResumeAsPDF(
      { id: "resume-1", userId: "user-1", data: resumeData("a4", "onyx") },
      "user-1",
    );
    expect(printed).toBe("http://localhost:3000/uploads/file");
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ type: "pdf", contentType: "application/pdf" }));
    expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ height: "1123px" }));
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ browserWSEndpoint: expect.stringContaining("ws://") }),
    );

    browser.connected = false;
    envState.PRINTER_ENDPOINT = "http://10.0.0.8:4000";
    await printerService.printResumeAsPDF({
      id: "resume-1",
      userId: "user-1",
      data: resumeData("free-form", "chikorita"),
    });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ browserURL: expect.stringContaining("http://") }));

    page.goto.mockRejectedValueOnce(new Error("navigation failed"));
    page.close.mockRejectedValueOnce(new Error("close failed"));
    await expect(
      printerService.printResumeAsPDF({ id: "resume-1", userId: "user-1", data: resumeData("a4", "onyx") }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(page.close).toHaveBeenCalled();

    const freeForm = resumeData("free-form", "onyx");
    freeForm.metadata.page.marginY = 12;
    await printerService.printResumeAsPDF({ id: "resume-1", userId: "user-1", data: freeForm });

    browser.connected = true;
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    process.emit("SIGINT");
    await Promise.resolve();
    process.emit("SIGTERM");
    await Promise.resolve();
    expect(browser.close).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });
});
