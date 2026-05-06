import type { EmailDriver } from "./types";

export const consoleDriver: EmailDriver = async (options) => {
  console.info("Email driver not configured; skipping send.", {
    to: options.to,
    from: options.from,
    subject: options.subject,
    text: options.text,
  });
};
