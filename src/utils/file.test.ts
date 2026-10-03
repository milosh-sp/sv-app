import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { downloadFromUrl, downloadWithAnchor, generateFilename } from "./file";

describe("generateFilename", () => {
  it("should slugify the prefix and append the extension", () => {
    expect(generateFilename("My Resume", "docx")).toBe("my-resume.docx");
  });

  it("should return slugified name without extension when none provided", () => {
    expect(generateFilename("My Resume")).toBe("my-resume");
  });

  it("should handle special characters in the prefix", () => {
    expect(generateFilename("John Doe - CS Base - Program Coordinator", "pdf")).toBe(
      "john-doe-cs-base-program-coordinator.pdf",
    );
  });

  it("should handle empty prefix", () => {
    expect(generateFilename("", "pdf")).toBe(".pdf");
  });
});

describe("download helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("clicks an anchor and revokes the object url", () => {
    vi.useFakeTimers();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:resume");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadWithAnchor(new Blob(["pdf"]), "cv.pdf");

    expect(click).toHaveBeenCalledOnce();
    expect(document.body.querySelector("a")).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(revoke).toHaveBeenCalledWith("blob:resume");
  });

  it("downloads a url through an anchor", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:resume");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ blob: async () => new Blob(["pdf"]) })),
    );

    await downloadFromUrl("http://localhost/cv.pdf", "cv.pdf");

    expect(fetch).toHaveBeenCalledWith("http://localhost/cv.pdf");
  });
});
