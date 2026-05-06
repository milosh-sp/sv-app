import { env } from "@/utils/env";

import type { EmailDriver } from "./types";

const API_URL = "https://api.sender.net/v2/message/send";

// Parses "Name <email@example.com>" or "email@example.com" into { name, email }.
const parseAddress = (address: string): { name: string; email: string } => {
  const match = address.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: "", email: address.trim() };
};

export const senderDriver: EmailDriver = async (options) => {
  const token = env.SENDER_API_TOKEN;
  if (!token) throw new Error("SENDER_API_TOKEN is not set.");

  const from = parseAddress(options.from);
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  await Promise.all(
    recipients.map(async (recipient) => {
      const to = parseAddress(recipient);
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          subject: options.subject,
          text: options.text,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Sender.net error ${response.status}: ${body}`);
      }
    }),
  );
};
