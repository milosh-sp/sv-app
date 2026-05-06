import { env } from "@/utils/env";

import type { EmailDriver } from "./drivers/types";

import { consoleDriver } from "./drivers/console";
import { resendDriver } from "./drivers/resend";
import { senderDriver } from "./drivers/sender";

// Registry: add a new entry here when adding a driver.
const drivers: Record<string, EmailDriver> = {
  sender: senderDriver,
  resend: resendDriver,
  console: consoleDriver,
};

const getDriver = (): EmailDriver => {
  const name = env.EMAIL_DRIVER;
  if (!name) return consoleDriver;
  const driver = drivers[name];
  if (!driver) throw new Error(`Unknown EMAIL_DRIVER "${name}". Available: ${Object.keys(drivers).join(", ")}`);
  return driver;
};

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  from?: string;
};

export const sendEmail = async (options: SendEmailOptions) => {
  const from = options.from ?? env.EMAIL_FROM ?? "Skill Verdict <noreply@localhost>";
  const driver = getDriver();

  try {
    await driver({ ...options, from });
  } catch (error) {
    console.error("There was an error sending mail.", error);
  }
};
