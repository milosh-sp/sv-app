// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";

import { inferContentType, isImageFile, toPublicFileUrl, toStorageKey } from "./storage";

describe("storage file references", () => {
  it("normalizes stored references to a storage key", () => {
    expect(toStorageKey("uploads/user/pictures/1.webp")).toBe("uploads/user/pictures/1.webp");
    expect(toStorageKey("https://cdn.example.com/uploads/user/pictures/1.webp")).toBe(
      "uploads/user/pictures/1.webp",
    );
    expect(toStorageKey("notes.txt")).toBe("notes.txt");
  });

  it("builds a public URL and infers file types", () => {
    expect(toPublicFileUrl("uploads/user/pictures/1.webp")).toBe(
      "http://localhost:3000/uploads/user/pictures/1.webp",
    );
    expect(inferContentType("photo.PNG")).toBe("image/png");
    expect(inferContentType("resume.pdf")).toBe("application/pdf");
    expect(inferContentType("notes.txt")).toBe("application/octet-stream");
    expect(isImageFile("image/jpeg")).toBe(true);
    expect(isImageFile("application/pdf")).toBe(false);
  });
});
