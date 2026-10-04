// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { env } from "@/utils/env";

const queue = vi.hoisted(() => ({ rows: [] as unknown[][] }));
const getSession = vi.hoisted(() => vi.fn());
const verifyPrinterToken = vi.hoisted(() => vi.fn());
const verificationService = vi.hoisted(() => ({
  requestSkill: vi.fn(async () => ({ id: "req" })),
  requestProject: vi.fn(async () => ({ id: "req" })),
  uploadDocument: vi.fn(async () => ({ id: "doc" })),
  submitAssessmentSolution: vi.fn(async () => ({ id: "req" })),
  requestExperience: vi.fn(async () => ({ id: "req" })),
  requestIdentity: vi.fn(async () => ({ id: "req" })),
  getStatus: vi.fn(async () => []),
  getPublicStatus: vi.fn(async () => []),
  getPrinterStatus: vi.fn(async () => []),
  getHistory: vi.fn(async () => []),
  getPublicTimeline: vi.fn(async () => ({ enabled: false, entries: [] })),
  toggleBadge: vi.fn(async () => ({ ok: true })),
  toggleTimeline: vi.fn(async () => ({ ok: true })),
  listTimelineSettingsForUser: vi.fn(async () => []),
  getAllStatuses: vi.fn(async () => []),
  getIdentityStatus: vi.fn(async () => null),
  cancelIdentity: vi.fn(async () => ({ ok: true })),
  getBadgeDetail: vi.fn(async () => null),
}));

function chain(rows: unknown[]) {
  const self = {
    from: () => self,
    where: () => self,
    limit: () => self,
    // oxlint-disable-next-line unicorn/no-thenable -- drizzle query mocks are thenable on purpose
    then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
  return self;
}

vi.mock("@/integrations/drizzle/client", () => ({
  db: { select: () => chain(queue.rows.shift() ?? []) },
}));
vi.mock("@/integrations/auth/config", () => ({
  auth: { api: { getSession, verifyApiKey: vi.fn() } },
  verifyOAuthToken: vi.fn(),
}));
vi.mock("@/utils/printer-token", () => ({ verifyPrinterToken }));
vi.mock("../services/verification", () => ({ verificationService }));

import { callProcedure } from "../call-procedure";
import { verificationRouter } from "./verification";

const userId = "00000000-0000-4000-8000-000000000001";
const resumeId = "00000000-0000-4000-8000-000000000020";
const itemId = "00000000-0000-4000-8000-000000000021";

function call<P extends object>(procedure: P, input?: object) {
  return callProcedure(procedure, { locale: "en-US", reqHeaders: new Headers() }, input);
}

describe("verificationRouter", () => {
  beforeEach(() => {
    queue.rows = [];
    getSession.mockReset();
    getSession.mockResolvedValue({ user: { id: userId, emailVerified: true, email: "ada@example.com", name: "Ada" } });
    verifyPrinterToken.mockReset();
    verificationService.requestSkill.mockClear();
    verificationService.getPrinterStatus.mockClear();
  });

  it("rejects an anonymous request and reports the admin flag", async () => {
    getSession.mockResolvedValueOnce(null);
    await expect(
      call(verificationRouter.requestSkill, { resumeId, itemId, itemLabel: "TypeScript" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    queue.rows.push([{ role: "company" }]);
    await expect(call(verificationRouter.getMyAdminFlags)).resolves.toEqual({ skillVerdictAdmin: false });

    queue.rows.push([{ role: "skill_verdict_admin" }]);
    await expect(call(verificationRouter.getMyAdminFlags)).resolves.toEqual({ skillVerdictAdmin: true });
  });

  it("forwards the owner id and rejects a printer token for another resume", async () => {
    await call(verificationRouter.requestSkill, { resumeId, itemId, itemLabel: "TypeScript" });
    expect(verificationService.requestSkill).toHaveBeenCalledWith(
      expect.objectContaining({ userId, resumeId, itemLabel: "TypeScript" }),
    );

    await call(verificationRouter.requestIdentity);
    expect(verificationService.requestIdentity).toHaveBeenCalledWith(userId);

    await expect(call(verificationRouter.getPublicStatus, { resumeId })).resolves.toEqual([]);

    verifyPrinterToken.mockReturnValueOnce(null);
    await expect(call(verificationRouter.getPrinterStatus, { resumeId, token: "bad" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    verifyPrinterToken.mockReturnValueOnce({ resumeId: "other", verificationAudience: "public" });
    await expect(call(verificationRouter.getPrinterStatus, { resumeId, token: "other" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    verifyPrinterToken.mockReturnValueOnce({ resumeId, verificationAudience: "owner" });
    await call(verificationRouter.getPrinterStatus, { resumeId, token: "owner" });
    expect(verificationService.getPrinterStatus).toHaveBeenCalledWith(resumeId, { includePendingLike: true });

    verifyPrinterToken.mockReturnValueOnce({ resumeId, verificationAudience: "public" });
    await call(verificationRouter.getPrinterStatus, { resumeId, token: "public" });
    expect(verificationService.getPrinterStatus).toHaveBeenLastCalledWith(resumeId, { includePendingLike: false });
  });

  it("returns the calendar link only when one is configured", async () => {
    const calendarEnv = env as { CAL_COM_LINK?: string };
    const previous = calendarEnv.CAL_COM_LINK;
    calendarEnv.CAL_COM_LINK = "https://cal.example/ada";
    await expect(call(verificationRouter.getCalLink)).resolves.toBe("https://cal.example/ada");
    calendarEnv.CAL_COM_LINK = undefined;
    await expect(call(verificationRouter.getCalLink)).resolves.toBeNull();
    calendarEnv.CAL_COM_LINK = previous;

    await call(verificationRouter.listTimelineSettings);
    expect(verificationService.listTimelineSettingsForUser).toHaveBeenCalledWith(userId);

    await expect(call(verificationRouter.getPublicTimeline, { resumeId })).resolves.toEqual({
      enabled: false,
      entries: [],
    });
  });
});
