import { describe, expect, it, vi } from "vite-plus/test";

const getBrowserSession = vi.hoisted(() => vi.fn());
const getServerSession = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({ authClient: { getSession: getBrowserSession } }));
vi.mock("./config", () => ({ auth: { api: { getSession: getServerSession } } }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeaders: () => new Headers() }));

import { getSession } from "./functions";

describe("getSession", () => {
  it("returns the browser session and null when the client errors", async () => {
    getBrowserSession.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null });
    await expect(getSession()).resolves.toEqual({ user: { id: "user-1" } });

    getBrowserSession.mockResolvedValueOnce({ data: null, error: { message: "expired" } });
    await expect(getSession()).resolves.toBeNull();
  });
});
