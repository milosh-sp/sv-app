// @ts-expect-error The Vitest runner provides this module.
import * as client from "/@vite/client";

export const hotCallbacks: Array<(mod: unknown) => void> = [];

export const fakeRoute = {
  options: { id: "RID", path: "/", component() {}, getParentRoute() {} },
  update() {},
  lazyFn: undefined,
};

const browser = window as unknown as {
  __TSR_ROUTER__?: {
    routesById: Record<string, unknown>;
    _replaceRouteChunk: () => void;
    setRoutes: () => void;
    buildRouteTree: () => object;
    resolvePathCache: { clear: () => void };
    _refreshRoute: () => void;
  };
  __getReactRefreshIgnoredExports?: (ctx: { id: string }) => string[];
};

let ignoredReads = 0;
browser.__getReactRefreshIgnoredExports = () => {
  ignoredReads += 1;
  if (ignoredReads === 1) return undefined;
  return ["pre"];
};
browser.__TSR_ROUTER__ = {
  routesById: new Proxy(
    {},
    {
      get: (_target, prop) => (typeof prop === "string" ? fakeRoute : undefined),
    },
  ),
  _replaceRouteChunk() {},
  setRoutes() {},
  buildRouteTree: () => ({}),
  resolvePathCache: { clear() {} },
  _refreshRoute() {},
};

client.createHotContext = () => ({
  data: { "tsr-route-id": "RID" },
  accept(callback: (mod: unknown) => void) {
    hotCallbacks.push(callback);
  },
  prune() {},
  dispose() {},
  decline() {},
  invalidate() {},
  on() {},
  send() {},
});
