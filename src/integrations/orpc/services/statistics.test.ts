// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fsMock = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const from = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  default: fsMock,
  ...fsMock,
}));

vi.mock("@/integrations/drizzle/client", () => ({
  db: {
    select: () => ({ from }),
  },
}));

import { statisticsService } from "./statistics";

const LAST_KNOWN_USERS = 978_528;
const freshMtime = Date.now();
const staleMtime = Date.now() - 7 * 60 * 60 * 1000;

describe("statisticsService", () => {
  beforeEach(() => {
    fsMock.stat.mockReset();
    fsMock.readFile.mockReset();
    fsMock.mkdir.mockReset();
    fsMock.writeFile.mockReset();
    from.mockReset();
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
  });

  it("returns a fresh cache file without querying the database", async () => {
    fsMock.stat.mockResolvedValue({ mtimeMs: freshMtime });
    fsMock.readFile.mockResolvedValue("42");

    await expect(statisticsService.user.getCount()).resolves.toBe(42);
    expect(from).not.toHaveBeenCalled();
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });

  it("uses the database count and writes the cache when the file is missing or stale", async () => {
    fsMock.stat.mockRejectedValue(new Error("missing"));
    from.mockResolvedValue([{ count: 10 }]);

    await expect(statisticsService.user.getCount()).resolves.toBe(10);
    expect(fsMock.writeFile).toHaveBeenCalledWith(expect.stringContaining("users.txt"), "10", "utf-8");

    fsMock.writeFile.mockClear();
    fsMock.stat.mockResolvedValue({ mtimeMs: staleMtime });
    fsMock.readFile.mockResolvedValue("42");
    from.mockResolvedValue([{ count: 11 }]);

    await expect(statisticsService.resume.getCount()).resolves.toBe(11);
    expect(fsMock.writeFile).toHaveBeenCalledWith(expect.stringContaining("resumes.txt"), "11", "utf-8");
  });

  it("returns the last known count when the database fails", async () => {
    fsMock.stat.mockRejectedValue(new Error("missing"));
    from.mockRejectedValue(new Error("db down"));

    await expect(statisticsService.user.getCount()).resolves.toBe(LAST_KNOWN_USERS);
    expect(fsMock.writeFile).not.toHaveBeenCalled();
  });
});
