// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const execute = vi.hoisted(() => vi.fn());
const printerHealth = vi.hoisted(() => vi.fn());
const storageHealth = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/drizzle/client", () => ({
  db: { execute },
}));
vi.mock("@/integrations/orpc/services/printer", () => ({
  printerService: { healthcheck: printerHealth },
}));
vi.mock("@/integrations/orpc/services/storage", () => ({
  getStorageService: () => ({ healthcheck: storageHealth }),
}));

import { Route } from "./health";

type Handler = () => Promise<Response>;

function getHandler() {
  const handlers = Route.options.server?.handlers as unknown as { GET?: Handler } | undefined;
  const handler = handlers?.GET;
  if (!handler) throw new Error("health handler missing");
  return handler;
}

describe("health handler", () => {
  beforeEach(() => {
    execute.mockReset();
    execute.mockResolvedValue(undefined);
    printerHealth.mockReset();
    printerHealth.mockResolvedValue({ status: "healthy" });
    storageHealth.mockReset();
    storageHealth.mockResolvedValue({ status: "healthy" });
  });

  it("reports healthy when every check succeeds", async () => {
    const response = await getHandler()();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; database: { status: string } };
    expect(body.status).toBe("healthy");
    expect(body.database.status).toBe("healthy");
  });

  it("reports unhealthy when a dependency fails or times out", async () => {
    execute.mockRejectedValueOnce("db down");
    printerHealth.mockRejectedValueOnce(new Error("printer down"));
    storageHealth.mockResolvedValueOnce({ status: "unhealthy", error: "disk" });

    const response = await getHandler()();
    expect(response.status).toBe(503);
    const body = (await response.json()) as {
      status: string;
      database: { error: string };
      printer: { error: string };
      storage: { error: string };
    };
    expect(body.status).toBe("unhealthy");
    expect(body.database.error).toBe("Unknown error");
    expect(body.printer.error).toBe("printer down");
    expect(body.storage.error).toBe("disk");
  });
});
