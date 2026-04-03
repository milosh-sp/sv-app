import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockLimit = vi.fn((): any => []);
const mockWhere = vi.fn((): any => ({ limit: mockLimit }));
const mockFrom = vi.fn((): any => ({ where: mockWhere }));
const mockSelect = vi.fn((): any => ({ from: mockFrom }));

const mockOnConflictDoUpdate = vi.fn();
const mockValues = vi.fn((): any => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = vi.fn((): any => ({ values: mockValues }));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}));

vi.mock("@/integrations/drizzle/schema", () => ({
  globalJobSearchSettings: {
    id: "id",
    apiKey: "api_key",
    connectionTestOk: "connection_test_ok",
    updatedByUserId: "updated_by_user_id",
    updatedAt: "updated_at",
  },
}));

const {
  getGlobalJobSearchSettingsRow,
  getPublicGlobalJobSearchSettings,
  getGlobalJobSearchApiKeyForService,
} = await import("./global-job-search-settings");

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "default",
    apiKey: "rapid-api-key",
    connectionTestOk: true,
    updatedByUserId: "user-1",
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockReturnValue([]);
});

// --- getGlobalJobSearchSettingsRow ---

describe("getGlobalJobSearchSettingsRow", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    expect(await getGlobalJobSearchSettingsRow()).toBeNull();
  });

  it("returns the row when one exists", async () => {
    const row = makeRow();
    mockLimit.mockReturnValue([row]);
    expect(await getGlobalJobSearchSettingsRow()).toEqual(row);
  });
});

// --- getPublicGlobalJobSearchSettings ---

describe("getPublicGlobalJobSearchSettings", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    expect(await getPublicGlobalJobSearchSettings()).toBeNull();
  });

  it("returns correct shape when API key is set and connection OK", async () => {
    mockLimit.mockReturnValue([makeRow()]);
    const result = await getPublicGlobalJobSearchSettings();
    expect(result).toEqual({ apiKeySet: true, connectionTestOk: true });
  });

  it("returns apiKeySet false when API key is empty", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "" })]);
    const result = await getPublicGlobalJobSearchSettings();
    expect(result).toEqual({ apiKeySet: false, connectionTestOk: true });
  });

  it("returns connectionTestOk false when stored value is false", async () => {
    mockLimit.mockReturnValue([makeRow({ connectionTestOk: false })]);
    const result = await getPublicGlobalJobSearchSettings();
    expect(result).toEqual({ apiKeySet: true, connectionTestOk: false });
  });

  it("returns both false when key is empty and connection failed", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "", connectionTestOk: false })]);
    const result = await getPublicGlobalJobSearchSettings();
    expect(result).toEqual({ apiKeySet: false, connectionTestOk: false });
  });
});

// --- getGlobalJobSearchApiKeyForService ---

describe("getGlobalJobSearchApiKeyForService", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    expect(await getGlobalJobSearchApiKeyForService()).toBeNull();
  });

  it("returns null when API key is empty (rowIsUsable = false)", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "" })]);
    expect(await getGlobalJobSearchApiKeyForService()).toBeNull();
  });

  it("returns null when connectionTestOk is false (rowIsUsable = false)", async () => {
    mockLimit.mockReturnValue([makeRow({ connectionTestOk: false })]);
    expect(await getGlobalJobSearchApiKeyForService()).toBeNull();
  });

  it("returns the API key when row is usable", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "rapid-key-123" })]);
    expect(await getGlobalJobSearchApiKeyForService()).toBe("rapid-key-123");
  });
});
