// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vite-plus/test";

import { env } from "./env";
import { generatePrinterToken, verifyPrinterToken } from "./printer-token";

describe("printer-token", () => {
  it("round-trips owner audience", () => {
    const resumeId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const token = generatePrinterToken(resumeId, "owner");
    expect(token).toBeDefined();
    const parsed = verifyPrinterToken(token as string);
    expect(parsed).toBeDefined();
    expect(parsed).toEqual({ resumeId, verificationAudience: "owner" });
  });

  it("round-trips public audience", () => {
    const resumeId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const token = generatePrinterToken(resumeId, "public");
    expect(token).toBeDefined();
    const parsed = verifyPrinterToken(token as string);
    expect(parsed).toBeDefined();
    expect(parsed).toEqual({ resumeId, verificationAudience: "public" });
  });

  it("defaults generate to public", () => {
    const resumeId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const token = generatePrinterToken(resumeId);
    expect(token).toBeDefined();
    const parsed = verifyPrinterToken(token as string);
    expect(parsed).toBeDefined();
    expect(parsed?.verificationAudience).toBe("public");
  });

  it("legacy two-part payload verifies as public", () => {
    const resumeId = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
    const timestamp = Date.now();
    const payload = `${resumeId}:${timestamp}`;
    const payloadBase64 = Buffer.from(payload).toString("base64url");
    const signature = createHash("sha256").update(`${payloadBase64}.${env.AUTH_SECRET}`).digest("hex");
    const token = `${payloadBase64}.${signature}`;

    const parsed = verifyPrinterToken(token);
    expect(parsed).toBeDefined();
    expect(parsed?.resumeId).toBe(resumeId);
    expect(parsed?.verificationAudience).toBe("public");
  });
});
