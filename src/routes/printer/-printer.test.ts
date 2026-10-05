// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const debugPrinter = vi.hoisted(() => ({ on: false }));
const getByIdForPrinter = vi.hoisted(() => vi.fn());
const getPrinterStatus = vi.hoisted(() => vi.fn());

vi.mock("@/utils/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/env")>();
  return {
    env: new Proxy(actual.env, {
      get(target, prop, receiver) {
        if (prop === "FLAG_DEBUG_PRINTER") return debugPrinter.on;
        return Reflect.get(target, prop, receiver);
      },
    }),
  };
});

vi.mock("@/integrations/orpc/client", () => ({
  getORPCClient: () => ({
    resume: { getByIdForPrinter },
    verification: { getPrinterStatus },
  }),
}));

import { generatePrinterToken } from "@/utils/printer-token";

import { Route } from "./$id";

type BeforeLoad = (args: { params: { id: string }; search: { token: string } }) => Promise<unknown>;
type Loader = (args: { params: { id: string }; deps: { token: string } }) => Promise<unknown>;

function beforeLoad() {
  const load = Route.options.beforeLoad as BeforeLoad | undefined;
  if (!load) throw new Error("printer beforeLoad missing");
  return load;
}

describe("printer route", () => {
  beforeEach(() => {
    debugPrinter.on = false;
    getByIdForPrinter.mockReset();
    getPrinterStatus.mockReset();
  });

  it("skips token checks in debug and rejects a bad or mismatched token", async () => {
    debugPrinter.on = true;
    await expect(beforeLoad()({ params: { id: "resume-1" }, search: { token: "" } })).resolves.toBeUndefined();

    debugPrinter.on = false;
    await expect(beforeLoad()({ params: { id: "resume-1" }, search: { token: "bad" } })).rejects.toBeTruthy();

    const token = generatePrinterToken("resume-1") ?? "";
    await expect(beforeLoad()({ params: { id: "other" }, search: { token } })).rejects.toBeTruthy();
    await expect(beforeLoad()({ params: { id: "resume-1" }, search: { token } })).resolves.toBeUndefined();
  });

  it("loads the resume when verification status is missing", async () => {
    const deps = Route.options.loaderDeps as (args: { search: { token: string } }) => { token: string };
    expect(deps({ search: { token: "t" } })).toEqual({ token: "t" });

    getByIdForPrinter.mockResolvedValue({ id: "resume-1" });
    getPrinterStatus.mockResolvedValueOnce([{ id: "status-1" }]);
    const load = Route.options.loader as Loader;
    await expect(load({ params: { id: "resume-1" }, deps: { token: "t" } })).resolves.toMatchObject({
      resume: { id: "resume-1" },
      verificationStatuses: [{ id: "status-1" }],
    });

    getPrinterStatus.mockRejectedValueOnce(new Error("offline"));
    await expect(load({ params: { id: "resume-1" }, deps: { token: "t" } })).resolves.toMatchObject({
      verificationStatuses: [],
    });
  });
});
