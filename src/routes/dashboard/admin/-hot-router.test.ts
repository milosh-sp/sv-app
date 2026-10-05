import { describe, expect, it, vi } from "vite-plus/test";

vi.hoisted(() => {
  const ids = [
    "/dashboard/admin/ai",
    "/dashboard/admin/experience-queue",
    "/dashboard/admin/identity",
    "/dashboard/admin/job-search",
    "/dashboard/admin/pending-verdicts",
    "/dashboard/admin/reviewers",
    "/dashboard/admin",
    "/dashboard/admin/users",
    "/dashboard/admin/resume/$resumeId",
    "/dashboard/verification/",
    "/dashboard/work-authorization/",
  ];
  const routesById: Record<string, { options: Record<string, unknown>; update: () => void }> = {};
  for (const id of ids) {
    routesById[id] = {
      options: {
        id,
        path: id,
        ...(id === "/dashboard/admin" ? { component() {}, shellComponent() {} } : {}),
      },
      update() {},
    };
  }
  Object.assign(window, {
    __TSR_ROUTER__: {
      routesById,
      _replaceRouteChunk() {},
      setRoutes() {},
      buildRouteTree() {
        return {};
      },
      resolvePathCache: { clear() {} },
      _refreshRoute() {},
    },
  });
});

import { Route as AiRoute } from "./ai";
import { Route as ExperienceRoute } from "./experience-queue";
import { Route as IdentityRoute } from "./identity";
import { Route as JobSearchRoute } from "./job-search";
import { Route as PendingRoute } from "./pending-verdicts";
import { Route as ResumeRoute } from "./resume/$resumeId";
import { Route as ReviewersRoute } from "./reviewers";
import { Route as AdminRoute } from "./route";
import { Route as UsersRoute } from "./users";
import { Route as VerificationRoute } from "../verification/index";
import { Route as WorkRoute } from "../work-authorization/index";

describe("admin route hot update", () => {
  it("rejects a non-admin and keeps an admin on the route", async () => {
    expect([
      AiRoute,
      ExperienceRoute,
      IdentityRoute,
      JobSearchRoute,
      PendingRoute,
      ResumeRoute,
      ReviewersRoute,
      UsersRoute,
      VerificationRoute,
      WorkRoute,
    ].every(Boolean)).toBe(true);
    const beforeLoad = AdminRoute.options.beforeLoad;
    if (!beforeLoad) throw new Error("missing admin guard");
    const session = { user: { id: "user-1" } };
    await beforeLoad({
      context: { session, queryClient: { ensureQueryData: async () => ({ role: "skill_verdict_admin" }) } },
    } as never);
    await expect(
      beforeLoad({
        context: { session, queryClient: { ensureQueryData: async () => ({ role: "user" }) } },
      } as never),
    ).rejects.toBeTruthy();
  });
});
