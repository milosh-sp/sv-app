// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => ({ delete: vi.fn() }));
const uploadFile = vi.hoisted(() => vi.fn(async () => ({ url: "http://localhost/a.webp", key: "uploads/user-1/pictures/a.webp" })));
const processImageForUpload = vi.hoisted(() =>
  vi.fn(async () => ({ data: new Uint8Array([1]), contentType: "image/webp" })),
);

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("../services/storage", () => ({
  getStorageService: () => storage,
  isImageFile: (type: string) => type.startsWith("image/"),
  processImageForUpload,
  uploadFile,
}));

import { storageRouter } from "./storage";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };

function call<T>(procedure: { callable: (options: object) => (input?: object) => Promise<T> }, input?: object) {
  return procedure.callable({ context: { locale: "en-US", reqHeaders: new Headers() } })(input);
}

describe("storageRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    storage.delete.mockReset();
    uploadFile.mockClear();
  });

  it("rejects an anonymous upload and stores the caller's picture", async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(call(storageRouter.uploadFile, new File(["x"], "a.png", { type: "image/png" }))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    await expect(call(storageRouter.uploadFile, new File(["x"], "a.png", { type: "image/png" }))).resolves.toMatchObject({
      contentType: "image/webp",
      path: "uploads/user-1/pictures/a.webp",
    });
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", type: "picture" }));

    await call(storageRouter.uploadFile, new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(processImageForUpload).toHaveBeenCalledOnce();
  });

  it("deletes only files under the caller's prefix", async () => {
    storage.delete.mockResolvedValueOnce(true);
    await expect(call(storageRouter.deleteFile, { filename: "uploads/user-1/pictures/a.webp" })).resolves.toBeUndefined();

    await expect(call(storageRouter.deleteFile, { filename: "uploads/other/pictures/a.webp" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(call(storageRouter.deleteFile, { filename: "uploads/user-1/../secrets" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    storage.delete.mockResolvedValueOnce(false);
    await expect(call(storageRouter.deleteFile, { filename: "missing.png" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
