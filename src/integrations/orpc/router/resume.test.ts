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
  getByIdForPrinter: vi.fn(async () => ({ id: "resume-1" })),
  setLocked: vi.fn(async () => undefined),
  setPassword: vi.fn(async () => undefined),
  removePassword: vi.fn(async () => undefined),
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

import { defaultResumeData } from "@/schema/resume/data";

import { callProcedure } from "../call-procedure";
import { resumeRouter } from "./resume";

const savedResume = {
  id: "resume-1",
  name: "CV",
  slug: "cv",
  tags: [] as string[],
  isPublic: false,
  isLocked: false,
  hasPassword: false,
  data: defaultResumeData,
};

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

    getSession.mockResolvedValueOnce(null);
    resumeService.getBySlug.mockResolvedValueOnce(savedResume);
    await expect(call(resumeRouter.getBySlug, { username: "ada", slug: "cv" })).resolves.toMatchObject({
      id: "resume-1",
    });
    expect(resumeService.getBySlug).toHaveBeenCalledWith({ username: "ada", slug: "cv", currentUserId: undefined });

    resumeService.getBySlug.mockResolvedValueOnce(savedResume);
    await expect(call(resumeRouter.getBySlug, { username: "ada", slug: "cv" })).resolves.toMatchObject({
      id: "resume-1",
    });
    expect(resumeService.getBySlug).toHaveBeenLastCalledWith(
      expect.objectContaining({ username: "ada", slug: "cv", currentUserId: "user-1" }),
    );
  });

  it("forwards owner mutations and keeps password checks public", async () => {
    resumeService.update.mockResolvedValue(savedResume);
    resumeService.patch.mockResolvedValue(savedResume);
    resumeService.getById.mockResolvedValue({ ...savedResume, userId: "user-1" } as never);

    await expect(call(resumeRouter.import, { data: defaultResumeData })).resolves.toBe("resume-1");
    expect(resumeService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", tags: [], locale: "en-US", data: defaultResumeData }),
    );

    await expect(call(resumeRouter.update, { id: "resume-1", name: "Renamed", isPublic: true })).resolves.toMatchObject(
      {
        id: "resume-1",
        name: "CV",
      },
    );
    expect(resumeService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "resume-1", userId: "user-1", name: "Renamed", isPublic: true }),
    );

    const operations = [{ op: "replace" as const, path: "/summary/content", value: "<p>Hi</p>" }];
    await expect(call(resumeRouter.patch, { id: "resume-1", operations })).resolves.toMatchObject({
      hasPassword: false,
    });
    expect(resumeService.patch).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1", operations });

    await expect(call(resumeRouter.setLocked, { id: "resume-1", isLocked: true })).resolves.toBeUndefined();
    expect(resumeService.setLocked).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1", isLocked: true });

    await expect(call(resumeRouter.setPassword, { id: "resume-1", password: "secret1" })).resolves.toBeUndefined();
    expect(resumeService.setPassword).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1", password: "secret1" });

    await expect(call(resumeRouter.removePassword, { id: "resume-1" })).resolves.toBeUndefined();
    expect(resumeService.removePassword).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1" });

    await expect(
      call(resumeRouter.duplicate, { id: "resume-1", name: "Copy", slug: "copy", tags: ["design"] }),
    ).resolves.toBe("resume-1");
    expect(resumeService.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: "user-1",
        name: "Copy",
        slug: "copy",
        tags: ["design"],
        data: savedResume.data,
      }),
    );

    await expect(call(resumeRouter.delete, { id: "resume-1" })).resolves.toBeUndefined();
    expect(resumeService.delete).toHaveBeenCalledWith({ id: "resume-1", userId: "user-1" });

    await expect(call(resumeRouter.getById, { id: "resume-1" })).resolves.toMatchObject({ id: "resume-1" });
    await expect(call(resumeRouter.tags.list)).resolves.toEqual(["design"]);
    await expect(call(resumeRouter.statistics.getById, { id: "resume-1" })).resolves.toMatchObject({ views: 1 });

    getSession.mockResolvedValueOnce(null);
    await expect(call(resumeRouter.update, { id: "resume-1", name: "Nope" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    getSession.mockResolvedValueOnce(null);
    await expect(call(resumeRouter.verifyPassword, { username: "ada", slug: "cv", password: "secret1" })).resolves.toBe(
      true,
    );
    expect(resumeService.verifyPassword).toHaveBeenCalledWith({ username: "ada", slug: "cv", password: "secret1" });

    await expect(call(resumeRouter.getByIdForPrinter, { id: "resume-1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(callInternal(resumeRouter.getByIdForPrinter, { id: "resume-1" })).resolves.toEqual({ id: "resume-1" });
  });
});
