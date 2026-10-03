// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData, defaultWorkAuthorizationData } from "@/schema/resume/data";

const { state, chain } = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    updateError: null as unknown,
    insertError: null as unknown,
    deleteError: null as unknown,
    updateRows: null as unknown[] | null,
    sets: [] as Array<Record<string, unknown>>,
    inserts: 0,
  };

  function chain(rows: unknown[], kind: "select" | "update" | "insert" | "delete") {
    const self = {
      from: () => self,
      innerJoin: () => self,
      rightJoin: () => self,
      where: () => self,
      orderBy: () => self,
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

        if (kind === "insert" && state.insertError) {
          const error = state.insertError;
          state.insertError = null;
          return Promise.reject(error).then(onFulfilled, onRejected);
        }

        if (kind === "delete" && state.deleteError) {
          const error = state.deleteError;
          state.deleteError = null;
          return Promise.reject(error).then(onFulfilled, onRejected);
        }

        if (kind === "update" && state.updateRows) {
          const rows = state.updateRows;
          state.updateRows = null;
          return Promise.resolve(rows).then(onFulfilled, onRejected);
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
    state.insertError = null;
    state.deleteError = null;
    state.updateRows = null;
    state.sets = [];
    state.inserts = 0;
    jar.clear();
  });

  it("hides a private resume from an anonymous viewer", async () => {
    await expect(resumeService.getBySlug({ username: "ada", slug: "cv" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("counts a view for a public resume with no password", async () => {
    state.selectQueue.push([publicResume]);

    await expect(resumeService.getBySlug({ username: "ada", slug: "cv" })).resolves.toMatchObject({
      id: "resume-1",
      hasPassword: false,
    });
    expect(state.inserts).toBe(1);
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

  it("rethrows an update failure that is not a duplicate slug", async () => {
    state.selectQueue.push([{ isLocked: false }]);
    state.updateError = new Error("db down");

    await expect(resumeService.update({ id: "resume-1", userId: "user-1", name: "Next" })).rejects.toThrow("db down");
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
    await expect(resumeService.verifyPassword({ slug: "cv", username: "ada", password: "nope" })).rejects.toMatchObject(
      { code: "INVALID_PASSWORD" },
    );
    expect(jar.size).toBe(0);

    state.selectQueue.push([{ id: "resume-1", password: "hashed:secret" }]);
    await expect(resumeService.verifyPassword({ slug: "cv", username: "ada", password: "secret" })).resolves.toBe(true);
    expect(jar.has("resume_access_resume-1")).toBe(true);
  });

  it("lists tags and resumes, and reads owner records for the printer", async () => {
    state.selectQueue.push([{ tags: ["design", "math"] }, { tags: ["design"] }]);
    await expect(resumeService.tags.list({ userId: "user-1" })).resolves.toEqual(["design", "math"]);

    state.selectQueue.push([]);
    await expect(resumeService.statistics.getById({ id: "resume-1", userId: "user-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    state.selectQueue.push([
      { isPublic: true, views: null, downloads: null, lastViewedAt: null, lastDownloadedAt: null },
    ]);
    await expect(resumeService.statistics.getById({ id: "resume-1", userId: "user-1" })).resolves.toMatchObject({
      views: 0,
      downloads: 0,
    });
    await resumeService.statistics.increment({ id: "resume-1", views: true, downloads: true });
    expect(state.inserts).toBe(1);

    const filters = { workAuthRegions: ["eu"] as ("eu" | "usa" | "uk")[] };
    for (const sort of ["lastUpdatedAt", "createdAt", "name"] as const) {
      state.selectQueue.push([{ id: "resume-1", name: "CV" }]);
      await expect(
        resumeService.list({ userId: "user-1", tags: sort === "name" ? ["design"] : [], sort, ...filters }),
      ).resolves.toEqual([{ id: "resume-1", name: "CV" }]);
    }

    state.selectQueue.push([
      { id: "resume-1", workAuthConsentToShare: true, workAuthorization: null },
      { id: "resume-2", workAuthConsentToShare: false, workAuthorization: { eu: { status: "citizen" } } },
    ]);
    const employers = await resumeService.searchForEmployers({ workAuthRegions: [] });
    expect(employers[0]?.workAuthorization).toEqual(defaultWorkAuthorizationData);
    expect(employers[1]?.workAuthorization).toEqual(defaultWorkAuthorizationData);

    state.selectQueue.push([]);
    await expect(resumeService.getById({ id: "resume-1", userId: "user-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    state.selectQueue.push([{ id: "resume-1", name: "CV" }]);
    await expect(resumeService.getById({ id: "resume-1", userId: "user-1" })).resolves.toMatchObject({ name: "CV" });

    state.selectQueue.push([]);
    await expect(resumeService.getByIdForPrinter({ id: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const withPicture = structuredClone(defaultResumeData);
    withPicture.picture.url = "";
    state.selectQueue.push([{ id: "resume-1", data: withPicture, userId: "user-1" }]);
    await expect(resumeService.getByIdForPrinter({ id: "resume-1" })).resolves.toMatchObject({ id: "resume-1" });

    withPicture.picture.url = "http://localhost:3000/picture.jpg";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ arrayBuffer: async () => new Uint8Array([1, 2]).buffer })),
    );
    state.selectQueue.push([{ id: "resume-1", data: structuredClone(withPicture), userId: "owner" }]);
    const printed = await resumeService.getByIdForPrinter({ id: "resume-1", userId: "owner" });
    expect(printed.data.picture.url).toMatch(/^data:image\/jpeg;base64,/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    const failedPicture = structuredClone(withPicture);
    state.selectQueue.push([{ id: "resume-1", data: failedPicture, userId: "owner" }]);
    const kept = await resumeService.getByIdForPrinter({ id: "resume-1", userId: "owner" });
    expect(kept.data.picture.url).toBe("http://localhost:3000/picture.jpg");
    vi.unstubAllGlobals();
  });

  it("creates, locks, clears a password, and deletes an unlocked resume", async () => {
    const id = await resumeService.create({
      userId: "user-1",
      name: "CV",
      slug: "cv",
      tags: [],
      locale: "de-DE",
    });
    expect(id).toEqual(expect.any(String));
    expect(state.inserts).toBe(1);

    state.insertError = { cause: { constraint: "resume_slug_user_id_unique" } };
    await expect(
      resumeService.create({ userId: "user-1", name: "CV", slug: "cv", tags: [], locale: "en-US" }),
    ).rejects.toMatchObject({ code: "RESUME_SLUG_ALREADY_EXISTS" });

    state.insertError = new Error("db down");
    await expect(
      resumeService.create({ userId: "user-1", name: "CV", slug: "other", tags: [], locale: "en-US" }),
    ).rejects.toThrow("db down");

    await resumeService.setLocked({ id: "resume-1", userId: "user-1", isLocked: true });
    await resumeService.setPassword({ id: "resume-1", userId: "user-1", password: "secret" });
    await resumeService.removePassword({ id: "resume-1", userId: "user-1" });
    expect(state.sets.map((set) => ("password" in set ? set.password : set.isLocked))).toEqual([
      true,
      "hashed:secret",
      null,
    ]);

    state.selectQueue.push([]);
    await expect(resumeService.delete({ id: "missing", userId: "user-1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    state.selectQueue.push([{ isLocked: false }]);
    await expect(resumeService.delete({ id: "resume-1", userId: "user-1" })).resolves.toBeUndefined();

    state.selectQueue.push([{ isLocked: false }]);
    state.deleteError = new Error("storage down");
    await expect(resumeService.delete({ id: "resume-1", userId: "user-1" })).rejects.toThrow("storage down");
  });

  it("rejects a missing resume on export, update, patch, and password check", async () => {
    await expect(resumeService.getForPdfExport({ id: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    state.selectQueue.push([{ isLocked: false }]);
    state.updateRows = [];
    await expect(resumeService.update({ id: "resume-1", userId: "user-1", name: "Next" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    state.selectQueue.push([{ isLocked: false }]);
    const updated = await resumeService.update({
      id: "resume-1",
      userId: "user-1",
      name: "Next",
      data: defaultResumeData,
    });
    expect(updated).toMatchObject({ id: "resume-1" });
    expect(state.sets.at(-1)).toMatchObject({
      name: "Next",
      workAuthEuStatus: defaultWorkAuthorizationData.eu.status,
    });

    await expect(
      resumeService.patch({
        id: "missing",
        userId: "user-1",
        operations: [{ op: "replace", path: "/summary/content", value: "<p>x</p>" }],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    state.selectQueue.push([{ data: structuredClone(defaultResumeData), isLocked: false }]);
    await expect(
      resumeService.patch({
        id: "resume-1",
        userId: "user-1",
        operations: [{ op: "replace", path: "/summary/content", value: 1 }],
      }),
    ).rejects.toThrow("invalid resume data");

    await expect(
      resumeService.verifyPassword({ slug: "cv", username: "ada", password: "secret" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
