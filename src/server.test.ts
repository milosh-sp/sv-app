// @vitest-environment node
import { describe, expect, it, vi } from "vite-plus/test";

const fetch = vi.hoisted(() => vi.fn(async () => new Response("ok")));
const createServerEntry = vi.hoisted(() => vi.fn((entry: { fetch: (request: Request) => Promise<Response> }) => entry));

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch },
  createServerEntry,
}));

vi.mock("srvx", () => ({
  FastResponse: class FastResponse extends Response {},
}));

import server from "./server";

describe("server entry", () => {
  it("forwards fetch to the start handler", async () => {
    const response = await server.fetch(new Request("http://localhost:3000/"));
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalled();
    expect(createServerEntry).toHaveBeenCalled();
  });
});
