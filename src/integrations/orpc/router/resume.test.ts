// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const getSession = vi.hoisted(() => vi.fn());
const roleRows = vi.hoisted(() => ({ value: [] as unknown[] }));
const resumeService = vi.hoisted(() => ({
  tags: { list: vi.fn(async () => ["design"]) },
  statistics: {
    getById: vi.fn(async () => ({
      isPublic: true,
      views: 1,
      downloads: 0,
      lastViewedAt: null,
      lastDownloadedAt: null,
    })),
    increment: vi.fn(async () => undefined),
  },
  list: vi.fn(async () => []),
  searchForEmployers: vi.fn(async () => []),
  getById: vi.fn(async () => ({ id: "resume-1", name: "CV", slug: "cv", tags: [], data: {}, userId: "user-1" })),
  getBySlug: vi.fn(async () => ({ id: "resume-1" })),
  create: vi.fn(async () => "resume-1"),
  update: vi.fn(),
  patch: vi.fn(),
  setLocked: vi.fn(async () => undefined),
  delete: vi.fn(async () => undefined),
  verifyPassword: vi.fn(async () => true),
}));

vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => roleRows.value,
        }),
      }),
    }),
  },
}));
vi.mock("../services/resume", () => ({ resumeService }));

import { callProcedure } from "../call-procedure";
import { resumeRouter } from "./resume";

const user = { id: "user-1", email: "ada@example.com", name: "Ada", emailVerified: true };

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

function callInternal<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers(), internalCall: true }, input);
}

describe("resumeRouter", () => {
  beforeEach(() => {
    getSession.mockReset();
    getSession.mockResolvedValue({ user });
    roleRows.value = [];
    resumeService.list.mockClear();
    resumeService.create.mockClear();
    resumeService.statistics.increment.mockClear();
  });

  it("rejects an anonymous list and forwards the owner id", async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(call(resumeRouter.list)).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    await expect(call(resumeRouter.list, { tags: ["design"] })).resolves.toEqual([]);
    expect(resumeService.list).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", tags: ["design"] }));
  });

  it("passes sample data only when requested and keeps statistics internal", async () => {
    await call(resumeRouter.create, { name: "CV", slug: "cv", tags: [], withSampleData: false });
    expect(resumeService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: "user-1", data: undefined }),
    );

    await call(resumeRouter.create, { name: "CV", slug: "cv", tags: [], withSampleData: true });
    expect(resumeService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ userId: "user-1", data: expect.any(Object) }),
    );

    await expect(call(resumeRouter.statistics.increment, { id: "resume-1", views: true })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      callInternal(resumeRouter.statistics.increment, { id: "resume-1", views: true }),
    ).resolves.toBeUndefined();
    expect(resumeService.statistics.increment).toHaveBeenCalledWith({ id: "resume-1", views: true, downloads: false });
  });

  it("lets a company search and a public slug include the viewer", async () => {
    await expect(call(resumeRouter.searchForEmployers, {})).rejects.toMatchObject({ code: "FORBIDDEN" });

    roleRows.value = [{ role: "company" }];
    await expect(call(resumeRouter.searchForEmployers, {})).resolves.toEqual([]);
    expect(resumeService.searchForEmployers).toHaveBeenCalledWith(expect.objectContaining({ workAuthRegions: [] }));
  });
});
