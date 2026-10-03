// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const envState = vi.hoisted(() => ({
  EMAIL_DRIVER: undefined as string | undefined,
  EMAIL_FROM: undefined as string | undefined,
  SENDER_API_TOKEN: undefined as string | undefined,
  RESEND_API_KEY: undefined as string | undefined,
}));

vi.mock("@/utils/env", () => ({ env: envState }));

import { sendEmail } from "./service";

describe("sendEmail", () => {
  beforeEach(() => {
    envState.EMAIL_DRIVER = undefined;
    envState.EMAIL_FROM = undefined;
    envState.SENDER_API_TOKEN = undefined;
    envState.RESEND_API_KEY = undefined;
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, text: async () => "" })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("logs through the console driver when none is configured", async () => {
    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" });

    expect(console.info).toHaveBeenCalledWith(
      "Email driver not configured; skipping send.",
      expect.objectContaining({ to: "ada@example.com", from: "Skill Verdict <noreply@localhost>" }),
    );

    envState.EMAIL_FROM = "Skill Verdict <mail@example.com>";
    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello", from: "Ada <ada@example.com>" });

    expect(console.info).toHaveBeenLastCalledWith(
      "Email driver not configured; skipping send.",
      expect.objectContaining({ from: "Ada <ada@example.com>" }),
    );
  });

  it("rejects an unknown driver before sending", async () => {
    envState.EMAIL_DRIVER = "postmark";

    await expect(sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" })).rejects.toThrow(
      'Unknown EMAIL_DRIVER "postmark"',
    );
  });

  it("sends through Sender.net, including a failed response", async () => {
    envState.EMAIL_DRIVER = "sender";

    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" });
    expect(fetch).not.toHaveBeenCalled();

    envState.SENDER_API_TOKEN = "token";
    await sendEmail({
      to: ["Ada Lovelace <ada@example.com>", "charles@example.com"],
      subject: "Hi",
      text: "Hello",
      from: "Skill Verdict <mail@example.com>",
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(body.from).toEqual({ name: "Skill Verdict", email: "mail@example.com" });
    expect(body.to).toEqual({ name: "Ada Lovelace", email: "ada@example.com" });

    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 422, text: async () => "nope" } as Response);
    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" });
    expect(console.error).toHaveBeenCalled();
  });

  it("sends through Resend, including a failed response", async () => {
    envState.EMAIL_DRIVER = "resend";

    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" });
    expect(fetch).not.toHaveBeenCalled();

    envState.RESEND_API_KEY = "key";
    await sendEmail({ to: "ada@example.com", subject: "Hi", text: "Hello" });
    const body = JSON.parse(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).body));
    expect(body.to).toEqual(["ada@example.com"]);

    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, text: async () => "down" } as Response);
    await sendEmail({ to: ["ada@example.com", "charles@example.com"], subject: "Hi", text: "Hello" });
    expect(console.error).toHaveBeenCalled();
  });
});
