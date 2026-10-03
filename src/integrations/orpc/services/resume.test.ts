// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

const { state, chain } = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    updateError: null as unknown,
    sets: [] as Array<Record<string, unknown>>,
    inserts: 0,
  };

  function chain(rows: unknown[], kind: "select" | "update" | "insert" | "delete") {
    const self = {
      from: () => self,
      innerJoin: () => self,
      where: () => self,
      set: (value: Record<string, unknown>) => {
        state.sets.push(value);
        return self;
      },
      values: () => {
        if (kind === "insert") state.inserts += 1;
        return self;
      },
      returning: () => self,
      onConflictDoUpdate: () => self,
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) {
        if (kind === "update" && state.updateError) {
          const error = state.updateError;
          state.updateError = null;
          return Promise.reject(error).then(onFulfilled, onRejected);
        }

        if (kind === "update") {
          const written = state.sets.at(-1);
          const data = written && "data" in written ? written.data : undefined;
          return Promise.resolve([{ id: "resume-1", data, isLocked: false, hasPassword: false }]).then(
            onFulfilled,
            onRejected,
          );
        }

        return Promise.resolve(rows).then(onFulfilled, onRejected);
      },
    };

    return self;
  }

  return { state, chain };
});

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => chain(state.selectQueue.shift() ?? [], "select"),
    update: () => chain([], "update"),
    insert: () => chain([], "insert"),
    delete: () => chain([], "delete"),
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => jar.get(name),
  setCookie: (name: string, value: string) => {
    jar.set(name, value);
  },
}));

vi.mock("@/utils/password", () => ({
  hashPassword: async (password: string) => `hashed:${password}`,
  verifyPassword: async (password: string, passwordHash: string) => passwordHash === `hashed:${password}`,
}));

vi.mock("./storage", () => ({
  getStorageService: () => ({ delete: vi.fn() }),
}));

import { grantResumeAccess } from "../helpers/resume-access";
import { resumeService } from "./resume";

const publicResume = {
  id: "resume-1",
  name: "CV",
  slug: "cv",
  tags: [] as string[],
  data: defaultResumeData,
  isPublic: true,
  isLocked: false,
  passwordHash: null as string | null,
  hasPassword: false,
};

describe("resumeService", () => {
  beforeEach(() => {
    state.selectQueue = [];
    state.updateError = null;
    state.sets = [];
    state.inserts = 0;
    jar.clear();
  });

  it("hides a private resume from an anonymous viewer", async () => {
    await expect(resumeService.getBySlug({ username: "ada", slug: "cv" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("asks for the password when the grant cookie is missing", async () => {
    state.selectQueue.push([{ ...publicResume, passwordHash: "hashed:secret", hasPassword: true }]);

    await expect(resumeService.getBySlug({ username: "ada", slug: "cv" })).rejects.toMatchObject({
      code: "NEED_PASSWORD",
      data: { username: "ada", slug: "cv" },
    });
    expect(state.inserts).toBe(0);
  });

  it("returns the resume and counts a view when the password grant matches", async () => {
    grantResumeAccess("resume-1", "hashed:secret");
    state.selectQueue.push([{ ...publicResume, passwordHash: "hashed:secret", hasPassword: true }]);

    const result = await resumeService.getBySlug({ username: "ada", slug: "cv" });

    expect(result).toMatchObject({ id: "resume-1", hasPassword: true, data: defaultResumeData });
    expect(state.inserts).toBe(1);
  });

  it("lets the owner export and hides a password-protected resume without a grant", async () => {
    state.selectQueue.push([
      { id: "resume-1", data: defaultResumeData, userId: "owner", isPublic: false, password: null },
    ]);

    await expect(resumeService.getForPdfExport({ id: "resume-1", viewerId: "owner" })).resolves.toMatchObject({
      id: "resume-1",
      userId: "owner",
    });

    state.selectQueue.push([
      { id: "resume-1", data: defaultResumeData, userId: "owner", isPublic: true, password: "hashed:secret" },
    ]);

    await expect(resumeService.getForPdfExport({ id: "resume-1", viewerId: "other" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects updates, patches, and deletes on a locked resume", async () => {
    state.selectQueue.push([{ isLocked: true }]);
    await expect(resumeService.update({ id: "resume-1", userId: "user-1", name: "Next" })).rejects.toMatchObject({
      code: "RESUME_LOCKED",
    });

    state.selectQueue.push([{ data: defaultResumeData, isLocked: true }]);
    await expect(
      resumeService.patch({
        id: "resume-1",
        userId: "user-1",
        operations: [{ op: "replace", path: "/summary/content", value: "<p>Next</p>" }],
      }),
    ).rejects.toMatchObject({ code: "RESUME_LOCKED" });

    state.selectQueue.push([{ isLocked: true }]);
    await expect(resumeService.delete({ id: "resume-1", userId: "user-1" })).rejects.toMatchObject({
      code: "RESUME_LOCKED",
    });
  });

  it("returns the failing operation index for a bad patch", async () => {
    state.selectQueue.push([{ data: defaultResumeData, isLocked: false }]);

    await expect(
      resumeService.patch({
        id: "resume-1",
        userId: "user-1",
        operations: [{ op: "replace", path: "/does/not/exist", value: "x" }],
      }),
    ).rejects.toMatchObject({
      code: "INVALID_PATCH_OPERATIONS",
      data: { code: "OPERATION_PATH_UNRESOLVABLE", index: 0 },
    });
  });

  it("persists a successful patch", async () => {
    state.selectQueue.push([{ data: structuredClone(defaultResumeData), isLocked: false }]);

    const result = await resumeService.patch({
      id: "resume-1",
      userId: "user-1",
      operations: [{ op: "replace", path: "/summary/content", value: "<p>Next</p>" }],
    });

    expect(result?.data.summary.content).toBe("<p>Next</p>");
  });

  it("rejects a duplicate slug", async () => {
    state.selectQueue.push([{ isLocked: false }]);
    state.updateError = { cause: { constraint: "resume_slug_user_id_unique" } };

    await expect(resumeService.update({ id: "resume-1", userId: "user-1", slug: "taken" })).rejects.toMatchObject({
      code: "RESUME_SLUG_ALREADY_EXISTS",
    });
  });

  it("grants access for the right password and rejects the wrong one", async () => {
    state.selectQueue.push([{ id: "resume-1", password: "hashed:secret" }]);
    await expect(
      resumeService.verifyPassword({ slug: "cv", username: "ada", password: "nope" }),
    ).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
    expect(jar.size).toBe(0);

    state.selectQueue.push([{ id: "resume-1", password: "hashed:secret" }]);
    await expect(resumeService.verifyPassword({ slug: "cv", username: "ada", password: "secret" })).resolves.toBe(
      true,
    );
    expect(jar.has("resume_access_resume-1")).toBe(true);
  });
});
