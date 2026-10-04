// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";

const envState = vi.hoisted(() => ({
  APP_URL: "http://localhost:3000",
  S3_ACCESS_KEY_ID: undefined as string | undefined,
  S3_SECRET_ACCESS_KEY: undefined as string | undefined,
  S3_BUCKET: undefined as string | undefined,
  S3_REGION: "us-east-1",
  S3_FORCE_PATH_STYLE: false,
  FLAG_DISABLE_IMAGE_PROCESSING: true,
}));

vi.mock("@/utils/env", () => ({ env: envState }));
vi.mock("sharp", () => ({
  default: () => ({
    resize: () => ({
      webp: () => ({ toBuffer: async () => Buffer.from("webp") }),
    }),
  }),
}));

import {
  getStorageService,
  inferContentType,
  isImageFile,
  processImageForUpload,
  toPublicFileUrl,
  toStorageKey,
  uploadFile,
} from "./storage";

describe("storage file references", () => {
  it("normalizes stored references to a storage key", () => {
    expect(toStorageKey("uploads/user/pictures/1.webp")).toBe("uploads/user/pictures/1.webp");
    expect(toStorageKey("https://cdn.example.com/uploads/user/pictures/1.webp")).toBe("uploads/user/pictures/1.webp");
    expect(toStorageKey("notes.txt")).toBe("notes.txt");
    expect(toStorageKey("http://%")).toBe("http://%");
  });

  it("builds a public URL and infers file types", () => {
    expect(toPublicFileUrl("uploads/user/pictures/1.webp")).toBe("http://localhost:3000/uploads/user/pictures/1.webp");
    expect(inferContentType("photo.PNG")).toBe("image/png");
    expect(inferContentType("resume.pdf")).toBe("application/pdf");
    expect(inferContentType("notes.txt")).toBe("application/octet-stream");
    expect(isImageFile("image/jpeg")).toBe(true);
    expect(isImageFile("application/pdf")).toBe(false);
  });
});

describe("local storage", () => {
  const previousCwd = process.cwd();
  let root = "";

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "sv-storage-"));
    process.chdir(root);
  });

  afterAll(() => {
    process.chdir(previousCwd);
  });

  it("writes, reads, lists, and deletes files without leaving the storage root", async () => {
    const storage = getStorageService();
    const data = new Uint8Array([1, 2, 3]);

    await storage.write({ key: "uploads/user/notes.txt", data, contentType: "text/plain" });
    await storage.write({ key: "../outside.txt", data, contentType: "text/plain" });

    const read = await storage.read("uploads/user/notes.txt");
    expect(Array.from(read?.data ?? [])).toEqual([1, 2, 3]);
    expect(read?.contentType).toBe("application/octet-stream");
    await expect(storage.read("uploads/missing.txt")).resolves.toBeNull();
    await storage.write({ key: "uploads/user/folder", data, contentType: "text/plain" });
    await expect(storage.read("uploads/user")).rejects.toThrow();
    await expect(storage.list("uploads/missing")).resolves.toEqual([]);
    await expect(storage.list("uploads/user/notes.txt")).rejects.toThrow();

    const listed = await storage.list("uploads");
    expect(listed.some((key) => key.endsWith("notes.txt"))).toBe(true);
    const outside = await storage.read("outside.txt");
    expect(Array.from(outside?.data ?? [])).toEqual([1, 2, 3]);

    await expect(storage.delete("uploads/user/notes.txt")).resolves.toBe(true);
    await expect(storage.delete("uploads")).resolves.toBe(true);
    await expect(storage.delete("uploads")).resolves.toBe(false);
    await expect(storage.read("..")).rejects.toThrow("Invalid storage key");
    await expect(storage.healthcheck()).resolves.toMatchObject({ type: "local", status: "healthy" });
    await rm(join(root, "data"), { recursive: true });
    await writeFile(join(root, "data"), "not-a-directory");
    await expect(storage.healthcheck()).resolves.toMatchObject({ type: "local", status: "unhealthy" });
    await rm(join(root, "data"));
  });

  it("builds upload keys and rejects incomplete document uploads", async () => {
    const bytes = new Uint8Array([9]);
    const picture = await uploadFile({ userId: "user", data: bytes, contentType: "image/webp", type: "picture" });
    const screenshot = await uploadFile({
      userId: "user",
      resumeId: "resume",
      data: bytes,
      contentType: "image/webp",
      type: "screenshot",
    });
    const pdf = await uploadFile({
      userId: "user",
      resumeId: "resume",
      data: bytes,
      contentType: "application/pdf",
      type: "pdf",
    });
    const document = await uploadFile({
      userId: "user",
      resumeId: "resume",
      itemId: "item",
      data: bytes,
      contentType: "application/pdf",
      type: "document",
    });

    expect(picture.key).toMatch(/^uploads\/user\/pictures\/\d+\.webp$/);
    expect(screenshot.key).toMatch(/^uploads\/user\/screenshots\/resume\/\d+\.webp$/);
    expect(pdf.key).toMatch(/^uploads\/user\/pdfs\/resume\/\d+\.pdf$/);
    expect(document.key).toMatch(/^uploads\/user\/documents\/resume\/item\/\d+$/);
    expect(picture.url).toBe(`http://localhost:3000/${picture.key}`);

    await expect(
      uploadFile({ userId: "user", data: bytes, contentType: "image/webp", type: "screenshot" }),
    ).rejects.toThrow("resumeId");
    await expect(
      uploadFile({ userId: "user", resumeId: "resume", data: bytes, contentType: "application/pdf", type: "pdf" }),
    ).resolves.toMatchObject({ key: expect.stringContaining("/pdfs/") });
    await expect(
      uploadFile({ userId: "user", data: bytes, contentType: "application/pdf", type: "pdf" }),
    ).rejects.toThrow("resumeId");
    await expect(
      uploadFile({ userId: "user", resumeId: "resume", data: bytes, contentType: "application/pdf", type: "document" }),
    ).rejects.toThrow("itemId");
    await expect(
      uploadFile({ userId: "user", data: bytes, contentType: "application/pdf", type: "document" }),
    ).rejects.toThrow("resumeId is required for document uploads");
  });

  it("keeps the original image when processing is disabled and converts it otherwise", async () => {
    const file = new File([new Uint8Array([7, 8])], "photo.png", { type: "image/png" });
    await expect(processImageForUpload(file)).resolves.toMatchObject({ contentType: "image/png" });

    envState.FLAG_DISABLE_IMAGE_PROCESSING = false;
    await expect(processImageForUpload(file)).resolves.toMatchObject({
      contentType: "image/webp",
      data: new Uint8Array(Buffer.from("webp")),
    });
  });
});
