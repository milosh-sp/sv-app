import nodemailer, { type Transporter } from "nodemailer";

import { APP_NAME } from "@/constants/brand";
import { env } from "@/utils/env";

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text: string;
  from?: string;
};

const isSmtpEnabled = () => {
  return !!env.SMTP_HOST && !!env.SMTP_USER && !!env.SMTP_PASS && !!env.SMTP_FROM;
};

let cachedTransport: Transporter | undefined;

const getTransport = () => {
  if (!isSmtpEnabled()) return;
  if (cachedTransport) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASS!,
    },
  });

  return cachedTransport;
};

export const sendEmail = async (options: SendEmailOptions) => {
  const transport = getTransport();

  const from = options.from ?? env.SMTP_FROM ?? `${APP_NAME} <noreply@localhost>`;
  const payload: nodemailer.SendMailOptions = {
    to: options.to,
    from,
    subject: options.subject,
    text: options.text,
  };

  if (!transport) {
    console.info("SMTP not configured; skipping email send.", {
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
    });

    return;
  }

  try {
    await transport.sendMail({ ...options, from });
  } catch (error) {
    console.error("There was an error sending mail.", error);
  }
};
