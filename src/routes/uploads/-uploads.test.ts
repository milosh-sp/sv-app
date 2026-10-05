// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn(async () => null as { user?: { id: string } } | null));
const limit = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
const read = vi.hoisted(() => vi.fn(async () => null as unknown));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession } },
}));
vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  },
}));
vi.mock("@/integrations/orpc/services/storage", () => ({
  getStorageService: () => ({ read }),
  inferContentType: (filename: string) => (filename.endsWith(".png") ? "image/png" : "application/octet-stream"),
}));

import { Route } from "./$userId.$";

type Handler = (args: { request: Request }) => Promise<Response>;

function getHandler() {
  const handlers = Route.options.server?.handlers as unknown as { GET?: Handler } | undefined;
  const handler = handlers?.GET;
  if (!handler) throw new Error("upload handler missing");
  return handler;
}

const file = {
  data: new Uint8Array([1, 2, 3, 4]),
  size: 4,
  contentType: "image/png",
};

describe("upload file handler", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    limit.mockReset();
    limit.mockResolvedValue([]);
    read.mockReset();
    read.mockResolvedValue(file);
  });

  it("rejects a missing path, traversal, and a private document", async () => {
    const handler = getHandler();
    expect((await handler({ request: new Request("http://localhost:3000/uploads/user-1") })).status).toBe(400);
    expect(
      (await handler({ request: new Request("http://localhost:3000/uploads/user-1/documents/id.pdf") })).status,
    ).toBe(403);

    getSession.mockResolvedValue({ user: { id: "user-1" } });
    const owned = await handler({ request: new Request("http://localhost:3000/uploads/user-1/documents/id.png") });
    expect(owned.status).toBe(200);
    expect(owned.headers.get("content-type")).toBe("image/png");
  });

  it("returns 404, 304, and a forced pdf download", async () => {
    const handler = getHandler();
    read.mockResolvedValueOnce(null);
    expect(
      (await handler({ request: new Request("http://localhost:3000/uploads/user-1/pictures/missing.png") })).status,
    ).toBe(404);

    read.mockResolvedValueOnce({ ...file, etag: "abc" });
    const fresh = await handler({ request: new Request("http://localhost:3000/uploads/user-1/pictures/photo.png") });
    expect(fresh.headers.get("etag")).toBe('"abc"');
    read.mockResolvedValueOnce({ ...file, etag: "abc" });
    const cached = await handler({
      request: new Request("http://localhost:3000/uploads/user-1/pictures/photo.png", {
        headers: { "if-none-match": '"abc"' },
      }),
    });
    expect(cached.status).toBe(304);

    limit.mockResolvedValue([{ id: "resume-1", userId: "user-1", isPublic: true, password: null }]);
    read.mockResolvedValueOnce({ ...file, contentType: "application/pdf", etag: 'W/"1"' });
    const pdf = await handler({
      request: new Request("http://localhost:3000/uploads/user-1/pdfs/resume-1/cv.pdf"),
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-disposition")).toContain("attachment");
    expect(pdf.headers.get("etag")).toBe('W/"1"');
  });

  it("rejects traversal, a sliced buffer, and a pdf the viewer cannot open", async () => {
    const handler = getHandler();
    expect((await handler({ request: new Request("http://localhost:3000/uploads/user-1//secret.png") })).status).toBe(
      403,
    );
    expect((await handler({ request: new Request("http://localhost:3000/uploads/user-1/") })).status).toBe(400);
    expect(
      (await handler({ request: new Request("http://localhost:3000/uploads/user-1/pdfs/missing/cv.pdf") })).status,
    ).toBe(403);

    const view = new Uint8Array(new ArrayBuffer(8), 2, 3);
    read.mockResolvedValueOnce({ data: view, size: 3 });
    const inferred = await handler({ request: new Request("http://localhost:3000/uploads/user-1/pictures/photo.png") });
    expect(inferred.headers.get("content-type")).toBe("image/png");

    getSession.mockResolvedValue({ user: { id: "other" } });
    limit.mockResolvedValueOnce([]);
    expect(
      (await handler({ request: new Request("http://localhost:3000/uploads/user-1/documents/id.png") })).status,
    ).toBe(403);
    limit.mockResolvedValueOnce([{ role: "reviewer_admin" }]);
    read.mockResolvedValueOnce(file);
    expect(
      (await handler({ request: new Request("http://localhost:3000/uploads/user-1/documents/id.png") })).status,
    ).toBe(200);
  });
});
