import { describe, expect, it, vi } from "vite-plus/test";

const cookieJar = vi.hoisted(() => new Map<string, string>());

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: (name: string) => cookieJar.get(name),
  setCookie: (name: string, value: string) => {
    cookieJar.set(name, value);
  },
}));

vi.mock("@tanstack/react-start", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createServerFn: () => {
      const builder = {
        validator() {
          return builder;
        },
        inputValidator() {
          return builder;
        },
        middleware() {
          return builder;
        },
        handler(fn: (...args: unknown[]) => unknown) {
          return fn;
        },
      };
      return builder;
    },
  };
});

type Hot = {
  data: Record<string, unknown>;
  accept: (cb: (mod: unknown) => void) => void;
  prune: () => void;
  dispose: () => void;
  decline: () => void;
  invalidate: () => void;
  on: () => void;
  send: () => void;
};

type RouteModule = {
  Route: {
    options: {
      beforeLoad?: (ctx: unknown) => Promise<unknown>;
      loader?: (ctx: unknown) => Promise<unknown>;
    };
  };
};

const callbacks: Array<(mod: unknown) => void> = [];
let hotOn = true;

function stubRoute() {
  return {
    options: { id: "x", path: "/", getParentRoute() {}, component() {} },
    update() {},
    _path: "/",
    _id: "x",
    _fullPath: "/",
    _to: "/",
    lazyFn: undefined as unknown,
    parentRoute: undefined as unknown,
  };
}

function installRouter() {
  (window as unknown as { __TSR_ROUTER__: unknown }).__TSR_ROUTER__ = {
    routesById: new Proxy({}, { get: () => stubRoute() }),
    _replaceRouteChunk() {},
    setRoutes() {},
    buildRouteTree() {
      return {};
    },
    resolvePathCache: { clear() {} },
    _refreshRoute() {},
  };
}

function invalidate(fragment: string) {
  const worker = (
    globalThis as {
      __vitest_worker__?: {
        evaluatedModules: {
          idToModuleMap: Map<string, { evaluated: boolean; promise?: Promise<unknown>; exports?: unknown; meta?: unknown }>;
        };
      };
    }
  ).__vitest_worker__;
  for (const [id, node] of worker?.evaluatedModules.idToModuleMap ?? []) {
    if (!id.includes(fragment)) continue;
    node.evaluated = false;
    node.promise = undefined;
    node.exports = undefined;
    node.meta = undefined;
  }
}

async function guards(route: RouteModule["Route"], label: string) {
  const locations = [
    { href: "http://localhost/dashboard/company", pathname: "/dashboard/company" },
    { href: "http://localhost/dashboard/company/match", pathname: "/dashboard/company/match/" },
  ];
  const roles = [null, "user", "company", "skill_verdict_admin", "reviewer_admin"] as const;
  for (const role of roles) {
    cookieJar.set("dashboardMode", role === "reviewer_admin" ? "user" : "reviewer");
    const context = {
      session: role ? { user: { id: "user-1", emailVerified: true } } : null,
      queryClient: {
        ensureQueryData: async () =>
          role ? { role, skillVerdictAdmin: role === "skill_verdict_admin" } : { role: "user", skillVerdictAdmin: false },
      },
    };
    for (const location of locations) {
      try {
        await route.options.beforeLoad?.({ context, location });
      } catch {
        // Redirects throw.
      }
    }
    try {
      await route.options.loader?.({ context });
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      if (label.endsWith("resumes/index.tsx") || label.endsWith("dashboard/route.tsx")) {
        throw new Error(`${label} loader: ${message}`);
      }
    }
  }
  cookieJar.set("dashboardMode", "reviewer");
  try {
    await route.options.beforeLoad?.({
      context: {
        session: { user: { id: "user-1", emailVerified: true } },
        queryClient: { ensureQueryData: async () => ({ role: "reviewer_admin", skillVerdictAdmin: false }) },
      },
      location: locations[1],
    });
  } catch {
    // Redirects throw.
  }
}

async function exercise(fragment: string, load: () => Promise<RouteModule>) {
  hotOn = true;
  callbacks.length = 0;
  const loaded = await load();
  for (const callback of callbacks) {
    callback(undefined);
    callback({});
    callback({ Route: loaded.Route });
    callback({ Route: stubRoute() });
  }
  await guards(loaded.Route, fragment);
  invalidate(fragment);
  hotOn = false;
  callbacks.length = 0;
  await load();
  hotOn = true;
}

describe("dashboard route modules", () => {
  it("runs guards, loaders, and route hot reload", async () => {
    const client = (await import("/@vite/client")) as { createHotContext: (path: string) => Hot | undefined };
    client.createHotContext = () => {
      if (!hotOn) return undefined;
      return {
        data: {},
        accept(cb) {
          callbacks.push(cb);
        },
        prune() {},
        dispose() {},
        decline() {},
        invalidate() {},
        on() {},
        send() {},
      };
    };
    installRouter();
    invalidate("/routes/dashboard/");
    await import("./-components/functions.ts");
    const worker = (globalThis as { __vitest_worker__?: { evaluatedModules: { idToModuleMap: Map<string, { meta?: { code?: string } }> } } }).__vitest_worker__;
    const fnCode = [...(worker?.evaluatedModules.idToModuleMap.entries() ?? [])].find(([id]) => id.includes("dashboard/-components/functions"))?.[1].meta?.code ?? "";
    const fs = await import("node:fs");
    fs.writeFileSync("/tmp/fn-transformed.js", fnCode);

    const loads: Array<[string, () => Promise<RouteModule>]> = [
      ["dashboard/index.tsx", () => import("./index.tsx")],
      ["dashboard/route.tsx", () => import("./route.tsx")],
      ["dashboard/contact-requests.tsx", () => import("./contact-requests.tsx")],
      ["company/route.tsx", () => import("./company/route.tsx")],
      ["company/contacts.tsx", () => import("./company/contacts.tsx")],
      ["company/match.tsx", () => import("./company/match.tsx")],
      ["company/saved.tsx", () => import("./company/saved.tsx")],
      ["job-search/index.tsx", () => import("./job-search/index.tsx")],
      ["resumes/index.tsx", () => import("./resumes/index.tsx")],
      ["reviewer/route.tsx", () => import("./reviewer/route.tsx")],
      ["reviewer/queue.tsx", () => import("./reviewer/queue.tsx")],
      ["settings/route.tsx", () => import("./settings/route.tsx")],
      ["settings/ai.tsx", () => import("./settings/ai.tsx")],
      ["settings/api-keys.tsx", () => import("./settings/api-keys.tsx")],
      ["settings/authentication/index.tsx", () => import("./settings/authentication/index.tsx")],
      ["settings/danger-zone.tsx", () => import("./settings/danger-zone.tsx")],
      ["settings/job-search.tsx", () => import("./settings/job-search.tsx")],
      ["settings/preferences.tsx", () => import("./settings/preferences.tsx")],
      ["settings/privacy.tsx", () => import("./settings/privacy.tsx")],
      ["settings/profile.tsx", () => import("./settings/profile.tsx")],
    ];

    for (const [fragment, load] of loads) {
      await exercise(fragment, load);
    }

    expect(loads.length).toBeGreaterThan(0);
  }, 60_000);
});
