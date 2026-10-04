import { describe, expect, it, vi } from "vite-plus/test";

const captured = vi.hoisted(() => ({
  server: null as { interceptors: Array<(error: unknown) => void>; context: () => Promise<unknown> } | null,
  link: null as {
    fetch: (request: Request, init?: RequestInit) => Promise<Response>;
    interceptors: Array<(error: unknown) => void>;
  } | null,
  batch: null as { mode: string; groups: Array<{ condition: () => boolean }> } | null,
}));
const getLocale = vi.hoisted(() => vi.fn(async () => "en-US"));
const getRequestHeaders = vi.hoisted(() => vi.fn(() => new Headers({ cookie: "a=b" })));

vi.mock("@tanstack/react-start/server", () => ({ getRequestHeaders }));
vi.mock("@/utils/locale", () => ({ getLocale }));
vi.mock("@/integrations/orpc/router", () => ({ default: {} }));

vi.mock("@orpc/server", () => ({
  createRouterClient: (_router: unknown, options: NonNullable<(typeof captured)["server"]>) => {
    captured.server = options;
    return { server: true };
  },
  ORPCError: class ORPCError extends Error {
    status: number;
    constructor(message?: string, options?: { status?: number }) {
      super(message);
      this.name = "ORPCError";
      this.status = options?.status ?? 400;
    }
  },
}));

vi.mock("@orpc/client", () => ({
  createORPCClient: () => ({ client: true }),
  onError: (handler: (error: unknown) => void) => handler,
}));

vi.mock("@orpc/client/fetch", () => ({
  RPCLink: class {
    constructor(options: NonNullable<(typeof captured)["link"]>) {
      captured.link = options;
    }
  },
}));

vi.mock("@orpc/client/plugins", () => ({
  BatchLinkPlugin: class {
    constructor(options: NonNullable<(typeof captured)["batch"]>) {
      captured.batch = options;
    }
  },
}));

vi.mock("@orpc/tanstack-query", () => ({
  createTanstackQueryUtils: (value: unknown) => value,
}));

import "./client";

describe("oRPC browser client", () => {
  it("sends credentialed requests and skips aborted calls", async () => {
    expect(captured.batch?.mode).toBe("streaming");
    expect(captured.batch?.groups[0]?.condition()).toBe(true);

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const request = new Request("https://app.test/api/rpc");
    await captured.link?.fetch(request, { method: "POST" });
    expect(fetchSpy).toHaveBeenCalledWith(request, expect.objectContaining({ credentials: "include", method: "POST" }));
    fetchSpy.mockRestore();

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onError = captured.link?.interceptors[0];
    onError?.(new DOMException("aborted", "AbortError"));
    expect(warn).not.toHaveBeenCalled();
    onError?.(new DOMException("offline", "NetworkError"));
    onError?.(new Error("boom"));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
