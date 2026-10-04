// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

const state = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
  insertQueue: [] as unknown[][],
  selects: 0,
  sets: [] as unknown[],
}));

const getGlobalAiCredentialsForService = vi.hoisted(() => vi.fn());
const matchCandidates = vi.hoisted(() => vi.fn());
const sendAccepted = vi.hoisted(() => vi.fn());
const sendDeclined = vi.hoisted(() => vi.fn());
const sendRequested = vi.hoisted(() => vi.fn());

function chain(rows: unknown[]) {
  const self = {
    from: () => self,
    innerJoin: () => self,
    where: () => self,
    orderBy: () => self,
    limit: () => self,
    set: (value: unknown) => {
      state.sets.push(value);
      return self;
    },
    values: () => self,
    returning: () => self,
    onConflictDoNothing: () => self,
    // oxlint-disable-next-line unicorn/no-thenable -- drizzle query mocks are thenable on purpose
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (error: unknown) => unknown) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
  return self;
}

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => {
      state.selects += 1;
      return chain(state.selectQueue.shift() ?? []);
    },
    update: () => chain(state.updateQueue.shift() ?? []),
    insert: () => chain(state.insertQueue.shift() ?? []),
    delete: () => chain([]),
  },
}));

vi.mock("./global-ai-settings", () => ({
  getGlobalAiCredentialsForService,
}));

vi.mock("./ai", () => ({
  aiService: { matchCandidates },
}));

vi.mock("@/integrations/email/company-contact", () => ({
  sendCompanyContactAcceptedEmail: sendAccepted,
  sendCompanyContactDeclinedEmail: sendDeclined,
  sendCompanyContactRequestedEmail: sendRequested,
}));

import { companyService } from "./company";

const creds = { provider: "openai", model: "test", apiKey: "key", baseURL: "http://localhost" };

function poolRow(input: { resumeId: string; candidateUserId: string; email: string; name: string }) {
  const data = structuredClone(defaultResumeData);
  data.basics.name = input.name;
  return {
    resumeId: input.resumeId,
    candidateUserId: input.candidateUserId,
    username: input.name.toLowerCase(),
    email: input.email,
    slug: "cv",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    basics: data.basics,
    data,
  };
}

const filters = { workAuthRegions: [] as ("eu" | "usa" | "uk")[], jobDescription: "Engineer" };

describe("companyService.matchCandidates", () => {
  beforeEach(() => {
    state.selectQueue = [];
    state.updateQueue = [];
    state.insertQueue = [];
    state.selects = 0;
    state.sets = [];
    getGlobalAiCredentialsForService.mockReset();
    matchCandidates.mockReset();
    sendAccepted.mockReset();
    sendDeclined.mockReset();
  });

  it("fails before loading the pool when AI is not configured", async () => {
    getGlobalAiCredentialsForService.mockResolvedValue(null);

    await expect(companyService.matchCandidates("company-1", filters)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(state.selects).toBe(0);
    expect(matchCandidates).not.toHaveBeenCalled();
  });

  it("returns no matches and skips the model when the vetted pool is empty", async () => {
    getGlobalAiCredentialsForService.mockResolvedValue(creds);
    state.selectQueue.push([]);

    await expect(companyService.matchCandidates("company-1", filters)).resolves.toEqual([]);
    expect(matchCandidates).not.toHaveBeenCalled();
  });

  it("drops unknown resume ids and shares email only after accept", async () => {
    getGlobalAiCredentialsForService.mockResolvedValue(creds);
    state.selectQueue.push([
      poolRow({ resumeId: "resume-1", candidateUserId: "cand-1", email: "ada@example.com", name: "Ada" }),
      poolRow({ resumeId: "resume-2", candidateUserId: "cand-2", email: "bea@example.com", name: "Bea" }),
      poolRow({ resumeId: "resume-3", candidateUserId: "cand-3", email: "cy@example.com", name: "Cy" }),
    ]);
    // The pool query embeds two EXISTS selects before the follow-up loads run.
    state.selectQueue.push([]);
    state.selectQueue.push([]);
    state.selectQueue.push([]);
    state.selectQueue.push([]);
    state.selectQueue.push([]);
    state.selectQueue.push([
      { candidateUserId: "cand-1", listType: "favorite" },
      { candidateUserId: "cand-2", listType: "to_contact" },
    ]);
    state.selectQueue.push([
      { id: "contact-1", candidateUserId: "cand-1", status: "pending" },
      { id: "contact-2", candidateUserId: "cand-2", status: "accepted" },
      { id: "contact-3", candidateUserId: "cand-3", status: "declined" },
    ]);
    matchCandidates.mockResolvedValue({
      matches: [
        { resumeId: "missing", matchScore: 99, matchReason: "not in pool" },
        { resumeId: "resume-1", matchScore: 70, matchReason: "pending" },
        { resumeId: "resume-2", matchScore: 90, matchReason: "accepted" },
        { resumeId: "resume-3", matchScore: 40, matchReason: "declined" },
      ],
    });

    const result = await companyService.matchCandidates("company-1", filters);

    expect(result.map((row) => row.resumeId)).toEqual(["resume-2", "resume-1", "resume-3"]);
    expect(result.find((row) => row.resumeId === "resume-1")).toMatchObject({
      candidateEmail: null,
      isFavorite: true,
      isToContact: false,
      contactStatus: "pending",
    });
    expect(result.find((row) => row.resumeId === "resume-2")).toMatchObject({
      candidateEmail: "bea@example.com",
      isFavorite: false,
      isToContact: true,
      contactStatus: "accepted",
    });
    expect(result.find((row) => row.resumeId === "resume-3")?.candidateEmail).toBeNull();
  });

  it("labels a candidate with no name and skips blank experience titles", async () => {
    getGlobalAiCredentialsForService.mockResolvedValue(creds);
    const row = poolRow({ resumeId: "resume-1", candidateUserId: "cand-1", email: "ada@example.com", name: "" });
    row.data.sections.experience.items = [
      {
        ...row.data.sections.experience.items[0]!,
        hidden: false,
        position: "",
        company: "",
      },
    ];
    state.selectQueue.push([row], [], [], [], [], [], []);
    matchCandidates.mockResolvedValue({
      matches: [{ resumeId: "resume-1", matchScore: 10, matchReason: "fit" }],
    });

    const result = await companyService.matchCandidates("company-1", filters);
    expect(result[0]).toMatchObject({ displayName: "Candidate", experienceTitles: [] });

    const blank = poolRow({ resumeId: "resume-2", candidateUserId: "cand-2", email: "bea@example.com", name: "Bea" });
    blank.data.sections.experience.items = undefined as never;
    state.selectQueue.push([blank], [], [], [], [], [], []);
    matchCandidates.mockResolvedValue({
      matches: [{ resumeId: "resume-2", matchScore: 1, matchReason: "fit" }],
    });
    const withoutItems = await companyService.matchCandidates("company-1", filters);
    expect(withoutItems[0]?.experienceTitles).toEqual([]);
  });
});

describe("companyService.respondToContactRequest", () => {
  const input = {
    candidateUserId: "cand-1",
    candidateName: "Ada",
    candidateEmail: "ada@example.com",
    id: "req-1",
  };

  beforeEach(() => {
    state.selectQueue = [];
    state.updateQueue = [];
    state.insertQueue = [];
    state.selects = 0;
    state.sets = [];
    sendAccepted.mockReset();
    sendDeclined.mockReset();
  });

  it("rejects a request that does not belong to the candidate", async () => {
    state.selectQueue.push([]);

    await expect(companyService.respondToContactRequest({ ...input, decision: "accepted" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.sets).toEqual([]);
  });

  it("rejects a second response", async () => {
    state.selectQueue.push([{ id: "req-1", status: "declined", companyUserId: "company-1" }]);

    await expect(companyService.respondToContactRequest({ ...input, decision: "accepted" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This contact request was already answered.",
    });
    expect(state.sets).toEqual([]);
  });

  it("persists accept and decline", async () => {
    state.selectQueue.push([{ id: "req-1", status: "pending", companyUserId: "company-1" }]);
    state.selectQueue.push([{ name: "Acme", email: "acme@example.com" }]);
    state.updateQueue.push([{ id: "req-1" }]);

    await expect(companyService.respondToContactRequest({ ...input, decision: "accepted" })).resolves.toEqual({
      id: "req-1",
      status: "accepted",
    });
    expect(state.sets[0]).toMatchObject({ status: "accepted" });
    expect(sendAccepted).toHaveBeenCalledTimes(2);
    expect(sendDeclined).not.toHaveBeenCalled();

    state.selectQueue.push([{ id: "req-2", status: "pending", companyUserId: "company-1" }]);
    state.selectQueue.push([{ name: "Acme", email: "acme@example.com" }]);
    state.updateQueue.push([{ id: "req-2" }]);
    sendAccepted.mockClear();

    await expect(
      companyService.respondToContactRequest({ ...input, id: "req-2", decision: "declined" }),
    ).resolves.toEqual({ id: "req-2", status: "declined" });
    expect(state.sets[1]).toMatchObject({ status: "declined" });
    expect(sendDeclined).toHaveBeenCalledTimes(1);
    expect(sendAccepted).not.toHaveBeenCalled();
  });

  it("rejects a pending request whose company or update disappeared", async () => {
    state.selectQueue.push([{ id: "req-1", status: "pending", companyUserId: "company-1" }]);
    state.selectQueue.push([]);

    await expect(companyService.respondToContactRequest({ ...input, decision: "accepted" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Company account not found.",
    });

    state.selectQueue.push([{ id: "req-1", status: "pending", companyUserId: "company-1" }]);
    state.selectQueue.push([{ name: "Acme", email: "acme@example.com" }]);
    state.updateQueue.push([]);

    await expect(companyService.respondToContactRequest({ ...input, decision: "declined" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This contact request was already answered.",
    });
    expect(sendDeclined).not.toHaveBeenCalled();
  });
});

describe("companyService saved candidates and contact requests", () => {
  beforeEach(() => {
    state.selectQueue = [];
    state.updateQueue = [];
    state.insertQueue = [];
    state.selects = 0;
    state.sets = [];
    sendRequested.mockReset();
  });

  it("lists saved candidates and toggles a saved row", async () => {
    state.selectQueue.push([]);
    await expect(companyService.listSaved("company-1")).resolves.toEqual([]);

    const data = structuredClone(defaultResumeData);
    data.basics.name = "";
    const experienceItem = {
      id: "exp-1",
      hidden: false,
      company: "Engines",
      position: "Programmer",
      location: "",
      period: "",
      website: { url: "", label: "" },
      description: "",
      roles: [],
    };
    data.sections.experience.items = [
      experienceItem,
      { ...experienceItem, id: "exp-2", hidden: true, company: "Hidden", position: "Ghost" },
    ];
    state.selectQueue.push([
      {
        candidateUserId: "cand-1",
        resumeId: "resume-1",
        listType: "favorite",
        savedAt: new Date("2026-01-02T00:00:00.000Z"),
        candidateName: "Ada",
        candidateEmail: "ada@example.com",
        username: "ada",
      },
      {
        candidateUserId: "cand-1",
        resumeId: null,
        listType: "to_contact",
        savedAt: new Date("2026-01-01T00:00:00.000Z"),
        candidateName: "Ada",
        candidateEmail: "ada@example.com",
        username: "ada",
      },
    ]);
    state.selectQueue.push(
      [
        { userId: "cand-1", itemLabel: "Maths" },
        { userId: "cand-1", itemLabel: "Maths" },
      ],
      [{ userId: "cand-1", itemLabel: "Programmer" }],
      [{ userId: "cand-1" }],
      [
        { id: "contact-1", candidateUserId: "cand-1", status: "accepted" },
        { id: "contact-old", candidateUserId: "cand-1", status: "pending" },
      ],
      [
        { candidateUserId: "cand-1", listType: "favorite" },
        { candidateUserId: "cand-1", listType: "to_contact" },
      ],
      [{ id: "resume-1", slug: "cv", basics: data.basics, data }],
    );

    const saved = await companyService.listSaved("company-1", "favorite");
    expect(saved[0]).toMatchObject({
      displayName: "Ada",
      headline: "",
      identityVerified: true,
      verifiedSkills: ["Maths"],
      experienceTitles: ["Programmer @ Engines"],
      candidateEmail: "ada@example.com",
      isFavorite: true,
      isToContact: true,
      contactStatus: "accepted",
    });
    expect(saved[1]).toMatchObject({ resumeId: null, experienceTitles: [], slug: null });

    await expect(
      companyService.setSaved({
        companyUserId: "company-1",
        candidateUserId: "cand-1",
        resumeId: "resume-1",
        listType: "favorite",
        saved: true,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      companyService.setSaved({
        companyUserId: "company-1",
        candidateUserId: "cand-1",
        listType: "to_contact",
        saved: false,
      }),
    ).resolves.toEqual({ ok: true });

    state.selectQueue.push([
      {
        candidateUserId: "cand-2",
        resumeId: null,
        listType: "favorite",
        savedAt: new Date("2026-01-03T00:00:00.000Z"),
        candidateName: "Bea",
        candidateEmail: "bea@example.com",
        username: "bea",
      },
    ]);
    state.selectQueue.push([], [], [], [], []);
    const unbound = await companyService.listSaved("company-1");
    expect(unbound[0]).toMatchObject({
      resumeId: null,
      verifiedSkills: [],
      verifiedExperiences: [],
      contactStatus: null,
      contactRequestId: null,
    });

    await expect(
      companyService.setSaved({
        companyUserId: "company-1",
        candidateUserId: "cand-2",
        listType: "favorite",
        saved: true,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("creates and lists contact requests", async () => {
    await expect(
      companyService.createContactRequest({
        companyUserId: "company-1",
        companyName: "Acme",
        candidateUserId: "company-1",
      }),
    ).rejects.toMatchObject({ message: "Cannot contact yourself." });

    state.selectQueue.push([]);
    await expect(
      companyService.createContactRequest({
        companyUserId: "company-1",
        companyName: "Acme",
        candidateUserId: "cand-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    state.selectQueue.push([{ id: "cand-1", email: "ada@example.com" }]);
    await expect(
      companyService.createContactRequest({
        companyUserId: "company-1",
        companyName: "Acme",
        candidateUserId: "cand-1",
        resumeId: "resume-1",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    state.selectQueue.push([{ id: "cand-1", email: "ada@example.com" }]);
    state.insertQueue.push([{ id: "contact-1" }]);
    await expect(
      companyService.createContactRequest({
        companyUserId: "company-1",
        companyName: "Acme",
        candidateUserId: "cand-1",
      }),
    ).resolves.toEqual({ id: "contact-1", status: "pending" });
    expect(sendRequested).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@example.com", companyName: "Acme" }));

    const createdAt = new Date("2026-02-01T00:00:00.000Z");
    state.selectQueue.push([
      {
        id: "contact-1",
        candidateUserId: "cand-1",
        resumeId: "resume-1",
        status: "accepted",
        createdAt,
        respondedAt: createdAt,
        candidateName: "Ada",
        candidateEmail: "ada@example.com",
      },
      {
        id: "contact-2",
        candidateUserId: "cand-2",
        resumeId: null,
        status: "pending",
        createdAt,
        respondedAt: null,
        candidateName: "Bea",
        candidateEmail: "bea@example.com",
      },
    ]);
    const listed = await companyService.listContactRequests("company-1", { status: "accepted", query: "Ada" });
    expect(listed.map((row) => row.candidateEmail)).toEqual(["ada@example.com", null]);

    state.selectQueue.push([
      {
        id: "contact-1",
        companyUserId: "company-1",
        resumeId: "resume-1",
        status: "pending",
        createdAt,
        respondedAt: null,
        companyName: "Acme",
        companyEmail: "acme@example.com",
      },
    ]);
    const mine = await companyService.listMyContactRequests("cand-1", { status: "pending" });
    expect(mine[0]).toMatchObject({ companyName: "Acme", companyEmail: null, status: "pending" });

    state.selectQueue.push([]);
    await expect(companyService.listContactRequests("company-1", {})).resolves.toEqual([]);
    state.selectQueue.push([]);
    await expect(companyService.listMyContactRequests("cand-1", {})).resolves.toEqual([]);
  });
});
