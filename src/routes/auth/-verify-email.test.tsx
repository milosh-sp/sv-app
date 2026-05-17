import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const verifyEmailMessages = [
  "A new verification link has been sent to your email address.",
  "Check your inbox",
  "Continue",
  "Email verified",
  "Failed to resend verification email. Please try again.",
  "Request a new link",
  "Resend verification email",
  "Resending verification email...",
  "Sign in",
  "Sign in to your account to request a new verification email.",
  "Sign in to your account, then request a new verification email.",
  "Sign in to verify your email",
  "The verification link may be invalid, expired, or already used.",
  "Try requesting a new verification link.",
  "Verify your email",
  "We couldn't verify your email",
  "We sent a verification link to your email address.",
  "You can now use account recovery and other features that require a verified email address.",
  "You must verify your email address before you can access Skill Verdict.",
  "Your account is up to date.",
  "Your email address is confirmed. You can continue using Skill Verdict.",
];

const verifyEmailSourceRef = "#: src/routes/auth/verify-email.tsx";
const localesPath = resolve(process.cwd(), "locales");
const catalogPaths = readdirSync(localesPath)
  .filter((file) => file.endsWith(".po"))
  .map((file) => resolve(localesPath, file));

function parsePoString(value: string) {
  return JSON.parse(value) as string;
}

function parseCatalogEntries(catalog: string) {
  return new Map(
    catalog.split(/\n{2,}/).flatMap((entry) => {
      const msgid = entry
        .split("\n")
        .find((line) => line.startsWith("msgid "))
        ?.slice(6);

      return msgid ? [[parsePoString(msgid), entry]] : [];
    }),
  );
}

function getMsgstr(entry: string) {
  const msgstr = entry
    .split("\n")
    .find((line) => line.startsWith("msgstr "))
    ?.slice(7);

  return msgstr ? parsePoString(msgstr) : "";
}

describe("verify-email locale catalog", () => {
  it("keeps all page strings in every locale catalog", () => {
    for (const catalogPath of catalogPaths) {
      const catalog = readFileSync(catalogPath, "utf8");
      const entries = parseCatalogEntries(catalog);

      for (const message of verifyEmailMessages) {
        const entry = entries.get(message);
        const localeName = catalogPath.split("/").at(-1);

        expect(entry, `${localeName} should include "${message}"`).toBeDefined();
        expect(entry).toContain(verifyEmailSourceRef);
        expect(getMsgstr(entry ?? ""), `${localeName} should translate "${message}"`).not.toBe("");
      }
    }
  });
});
