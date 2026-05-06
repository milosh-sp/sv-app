import { env } from "@/utils/env";

import type { EmailDriver } from "./types";

const API_URL = "https://api.resend.com/emails";

export const resendDriver: EmailDriver = async (options) => {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set.");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: options.from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      text: options.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error ${response.status}: ${body}`);
  }
};
