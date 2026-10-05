import { ORPCError } from "@orpc/client";
import { SearchParamError } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";

import { Route as SlugRoute } from "./$username/$slug";
import { Route as ForgotPasswordRoute } from "./auth/forgot-password";
import { Route as RegisterRoute } from "./auth/register";
import { Route as ResetPasswordRoute } from "./auth/reset-password";
import { Route as ResumePasswordRoute } from "./auth/resume-password";
import { Route as VerifyEmailRoute } from "./auth/verify-email";
import { Route as PrinterRoute } from "./printer/$id";
import { Route as ReviewerRoute } from "./reviewer/$adminId";

describe("public route options", () => {
  it("loads a public resume and redirects when a password is required", async () => {
    const ensureQueryData = vi
      .fn()
      .mockResolvedValueOnce({ id: "resume-1", name: "Ada" })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ enabled: false, entries: [] });
    const loader = SlugRoute.options.loader as (args: unknown) => Promise<{ resume: { name: string } }>;
    const loaded = await loader({
      context: { queryClient: { ensureQueryData } },
      params: { username: "ada", slug: "cv" },
    });
    expect(loaded.resume.name).toBe("Ada");

    const head = SlugRoute.options.head as (args: { loaderData?: { resume: { name: string } } }) => {
      meta: Array<{ title: string }>;
    };
    expect(head({ loaderData: loaded }).meta[0]?.title).toContain("Ada");
    expect(head({}).meta[0]?.title).toBe("Skill Verdict");

    const onError = SlugRoute.options.onError as (error: unknown) => void;
    expect(() => onError(new Error("missing"))).toThrow();
    expect(() => onError(new ORPCError("BAD_REQUEST"))).toThrow();
    expect(() => onError(new ORPCError("NEED_PASSWORD", { data: {} }))).toThrow();
    expect(() => onError(new ORPCError("NEED_PASSWORD", { data: { username: "ada" } }))).toThrow();
    expect(() => onError(new ORPCError("NEED_PASSWORD", { data: { username: "ada", slug: "cv" } }))).toThrow();
  });

  it("loads a reviewer profile and titles the page", async () => {
    const ensureQueryData = vi
      .fn()
      .mockResolvedValueOnce({ firstName: "Ada", lastName: "Lovelace" })
      .mockRejectedValueOnce(new Error("missing"));
    const loader = ReviewerRoute.options.loader as (args: unknown) => Promise<{ profile: { firstName: string } }>;
    const args = { context: { queryClient: { ensureQueryData } }, params: { adminId: "admin-1" } };
    const loaded = await loader(args);
    expect(loaded.profile.firstName).toBe("Ada");
    await expect(loader(args)).rejects.toBeTruthy();

    const head = ReviewerRoute.options.head as (args: { loaderData?: typeof loaded }) => {
      meta: Array<{ title: string }>;
    };
    expect(head({ loaderData: loaded }).meta[0]?.title).toContain("Ada");
    expect(head({}).meta[0]?.title).toBe("Reviewer - Skill Verdict");
  });

  it("redirects when email auth or signups are disabled", async () => {
    const forgot = ForgotPasswordRoute.options.beforeLoad as (args: unknown) => Promise<unknown>;
    await expect(forgot({ context: { flags: { disableEmailAuth: true } } })).rejects.toBeTruthy();
    await expect(forgot({ context: { flags: { disableEmailAuth: false } } })).resolves.toBeUndefined();

    const register = RegisterRoute.options.beforeLoad as (args: unknown) => Promise<{ session: null }>;
    await expect(register({ context: { session: null, flags: { disableSignups: true } } })).rejects.toBeTruthy();
    await expect(register({ context: { session: null, flags: { disableSignups: false } } })).resolves.toEqual({
      session: null,
    });

    const reset = ResetPasswordRoute.options.beforeLoad as (args: unknown) => Promise<unknown>;
    await expect(reset({ context: { flags: { disableEmailAuth: true } } })).rejects.toBeTruthy();
    const resetOnError = ResetPasswordRoute.options.onError as (error: unknown) => void;
    expect(() => resetOnError(new Error("other"))).not.toThrow();
    expect(() => resetOnError(new SearchParamError())).toThrow();

    const resumeOnError = ResumePasswordRoute.options.onError as (error: unknown) => void;
    expect(() => resumeOnError(new Error("other"))).not.toThrow();
    expect(() => resumeOnError(new SearchParamError())).toThrow();

    const head = VerifyEmailRoute.options.head as () => { meta: Array<{ title: string }> };
    expect(head().meta[0]?.title).toContain("Verify Email");
  });

  it("rejects a printer token that does not verify in the browser", async () => {
    const beforeLoad = PrinterRoute.options.beforeLoad as (args: unknown) => Promise<unknown>;
    await expect(beforeLoad({ params: { id: "resume-1" }, search: { token: "bad" } })).rejects.toBeTruthy();
  });
});
