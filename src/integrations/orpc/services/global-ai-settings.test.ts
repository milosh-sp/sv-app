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
  globalAiSettings: {
    id: "id",
    provider: "provider",
    model: "model",
    apiKey: "api_key",
    baseURL: "base_url",
    connectionTestOk: "connection_test_ok",
    updatedByUserId: "updated_by_user_id",
    updatedAt: "updated_at",
  },
}));

const { isGlobalAiAvailable, getGlobalAiSettingsRow, getPublicGlobalAiSettings, getGlobalAiCredentialsForService } =
  await import("./global-ai-settings");

// A fully usable row returned from the database
function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "default",
    provider: "openai",
    model: "gpt-4o",
    apiKey: "sk-test",
    baseURL: "",
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

// --- isGlobalAiAvailable ---

describe("isGlobalAiAvailable", () => {
  it("returns false when row is null", () => {
    expect(isGlobalAiAvailable(null)).toBe(false);
  });

  it("returns false when connectionTestOk is false", () => {
    expect(isGlobalAiAvailable(makeRow({ connectionTestOk: false }) as any)).toBe(false);
  });

  it("returns false when model is empty", () => {
    expect(isGlobalAiAvailable(makeRow({ model: "" }) as any)).toBe(false);
  });

  it("returns false when apiKey is empty", () => {
    expect(isGlobalAiAvailable(makeRow({ apiKey: "" }) as any)).toBe(false);
  });

  it("returns true when all conditions are met", () => {
    expect(isGlobalAiAvailable(makeRow() as any)).toBe(true);
  });
});

// --- getGlobalAiSettingsRow ---

describe("getGlobalAiSettingsRow", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    const result = await getGlobalAiSettingsRow();
    expect(result).toBeNull();
  });

  it("returns the row when one exists", async () => {
    const row = makeRow();
    mockLimit.mockReturnValue([row]);
    const result = await getGlobalAiSettingsRow();
    expect(result).toEqual(row);
  });
});

// --- getPublicGlobalAiSettings ---

describe("getPublicGlobalAiSettings", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    expect(await getPublicGlobalAiSettings()).toBeNull();
  });

  it("returns public shape with apiKeySet true when key is set", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "sk-secret" })]);
    const result = await getPublicGlobalAiSettings();
    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-4o",
      baseURL: "",
      apiKeySet: true,
      connectionTestOk: true,
    });
  });

  it("returns apiKeySet false when key is empty string", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "" })]);
    const result = await getPublicGlobalAiSettings();
    expect(result?.apiKeySet).toBe(false);
  });

  it("falls back to 'openai' provider when stored provider value is invalid", async () => {
    mockLimit.mockReturnValue([makeRow({ provider: "not-a-real-provider" })]);
    const result = await getPublicGlobalAiSettings();
    expect(result?.provider).toBe("openai");
  });

  it("passes through a valid non-openai provider unchanged", async () => {
    mockLimit.mockReturnValue([makeRow({ provider: "anthropic" })]);
    const result = await getPublicGlobalAiSettings();
    expect(result?.provider).toBe("anthropic");
  });
});

// --- getGlobalAiCredentialsForService ---

describe("getGlobalAiCredentialsForService", () => {
  it("returns null when no row exists", async () => {
    mockLimit.mockReturnValue([]);
    expect(await getGlobalAiCredentialsForService()).toBeNull();
  });

  it("returns null when row is not usable (apiKey empty)", async () => {
    mockLimit.mockReturnValue([makeRow({ apiKey: "", connectionTestOk: true })]);
    expect(await getGlobalAiCredentialsForService()).toBeNull();
  });

  it("returns null when row is not usable (connectionTestOk false)", async () => {
    mockLimit.mockReturnValue([makeRow({ connectionTestOk: false })]);
    expect(await getGlobalAiCredentialsForService()).toBeNull();
  });

  it("returns parsed credentials when row is usable", async () => {
    mockLimit.mockReturnValue([makeRow({ provider: "anthropic", model: "claude-3-5-sonnet", apiKey: "sk-ant" })]);
    const result = await getGlobalAiCredentialsForService();
    expect(result).toMatchObject({
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      apiKey: "sk-ant",
    });
  });

  it("returns null when row fields fail schema parse (invalid provider on usable row)", async () => {
    // aiCredentialsSchema.provider is aiProviderSchema (enum) — unknown value fails parse
    mockLimit.mockReturnValue([makeRow({ provider: "unknown-provider", apiKey: "sk-test", connectionTestOk: true })]);
    // rowIsUsable only checks connectionTestOk / model / apiKey length, so the row passes usability.
    // aiCredentialsSchema.safeParse will fail on the bad provider → null returned.
    const result = await getGlobalAiCredentialsForService();
    expect(result).toBeNull();
  });
});
