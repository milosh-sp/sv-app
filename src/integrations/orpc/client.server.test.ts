// @vitest-environment node
import { describe, expect, it, vi } from "vite-plus/test";

const captured = vi.hoisted(() => ({
  server: null as { interceptors: Array<(error: unknown) => void>; context: () => Promise<unknown> } | null,
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
    constructor() {}
  },
}));

vi.mock("@orpc/client/plugins", () => ({
  BatchLinkPlugin: class {
    constructor() {}
  },
}));

vi.mock("@orpc/tanstack-query", () => ({
  createTanstackQueryUtils: (value: unknown) => value,
}));

import { ORPCError } from "@orpc/server";

import "./client";

describe("oRPC server client", () => {
  it("logs server failures at 500 and above", async () => {
    await expect(captured.server?.context()).resolves.toEqual({
      locale: "en-US",
      reqHeaders: expect.any(Headers),
      internalCall: true,
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = captured.server?.interceptors[0];
    onError?.(new ORPCError("bad", { status: 400 }));
    expect(errorSpy).not.toHaveBeenCalled();
    onError?.(new ORPCError("down", { status: 500 }));
    onError?.(new Error("boom"));
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});
