import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import Cookies from "js-cookie";
import z from "zod";

const dashboardModeSchema = z.union([z.literal("reviewer"), z.literal("user")]);

export type DashboardMode = z.infer<typeof dashboardModeSchema>;

export type AdminRole = "skill_verdict_admin" | "reviewer_admin" | "company" | null;

export const dashboardModeStorageKey = "dashboardMode";
const defaultDashboardMode: DashboardMode = "reviewer";

export function isDashboardMode(value: string): value is DashboardMode {
  return dashboardModeSchema.safeParse(value).success;
}

export function getEffectiveDashboardMode(adminRole: AdminRole, cookieMode: DashboardMode): DashboardMode {
  if (adminRole !== "reviewer_admin") return "user";
  return cookieMode;
}

export function parseDashboardModeFromCookieHeader(headers: Headers): DashboardMode {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return defaultDashboardMode;

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name !== dashboardModeStorageKey) continue;

    const value = decodeURIComponent(valueParts.join("="));
    if (isDashboardMode(value)) return value;
  }

  return defaultDashboardMode;
}

export function readDashboardModeFromClientCookie(): DashboardMode {
  const mode = Cookies.get(dashboardModeStorageKey);
  if (!mode || !isDashboardMode(mode)) return defaultDashboardMode;
  return mode;
}

export function writeDashboardModeToClientCookie(mode: DashboardMode) {
  Cookies.set(dashboardModeStorageKey, mode, { path: "/", sameSite: "lax" });
}

export const getDashboardMode = createIsomorphicFn()
  .client(() => readDashboardModeFromClientCookie())
  .server(async () => {
    const cookieMode = getCookie(dashboardModeStorageKey);
    if (!cookieMode || !isDashboardMode(cookieMode)) return defaultDashboardMode;
    return cookieMode;
  });

export const setDashboardModeServerFn = createServerFn({ method: "POST" })
  .inputValidator(dashboardModeSchema)
  .handler(async ({ data }) => {
    setCookie(dashboardModeStorageKey, data);
  });
