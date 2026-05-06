import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,

  client: {},

  server: {
    // Server
    TZ: z.string().default("Etc/UTC"),
    APP_URL: z.url({ protocol: /https?/ }),
    PRINTER_APP_URL: z.url({ protocol: /https?/ }).optional(),

    // Printer
    PRINTER_ENDPOINT: z.url({ protocol: /^(wss?|https?)$/ }),

    // Database
    DATABASE_URL: z.url({ protocol: /postgres(ql)?/ }),

    // Authentication
    AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_API_KEY: z.string().min(1).optional(),

    // Social Auth (Google)
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    // Social Auth (GitHub)
    GITHUB_CLIENT_ID: z.string().min(1).optional(),
    GITHUB_CLIENT_SECRET: z.string().min(1).optional(),

    // Custom OAuth Provider
    OAUTH_PROVIDER_NAME: z.string().min(1).optional(),
    OAUTH_CLIENT_ID: z.string().min(1).optional(),
    OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
    OAUTH_DISCOVERY_URL: z.url({ protocol: /https?/ }).optional(),
    OAUTH_AUTHORIZATION_URL: z.url({ protocol: /https?/ }).optional(),
    OAUTH_TOKEN_URL: z.url({ protocol: /https?/ }).optional(),
    OAUTH_USER_INFO_URL: z.url({ protocol: /https?/ }).optional(),
    OAUTH_SCOPES: z
      .string()
      .min(1)
      .transform((value) => value.split(" "))
      .default(["openid", "profile", "email"]),

    // Email
    // Set EMAIL_DRIVER to the name of the provider to use (e.g. "sender", "resend").
    // Omit or set to "console" to log emails to stdout without sending (dev default).
    EMAIL_DRIVER: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    // Sender.net driver (EMAIL_DRIVER=sender)
    SENDER_API_TOKEN: z.string().min(1).optional(),
    // Resend driver (EMAIL_DRIVER=resend)
    RESEND_API_KEY: z.string().min(1).optional(),

    // Storage (Optional)
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_REGION: z.string().default("us-east-1"),
    S3_ENDPOINT: z.url({ protocol: /https?/ }).optional(),
    S3_BUCKET: z.string().min(1).optional(),
    // Set to "true" for path-style URLs (endpoint/bucket), common with MinIO, SeaweedFS, etc.
    // Set to "false" for virtual-hosted-style URLs (bucket.endpoint), common with AWS S3, Cloudflare R2, etc.
    S3_FORCE_PATH_STYLE: z.stringbool().default(false),

    // Verification
    CAL_COM_LINK: z.url({ protocol: /https?/ }).optional(),
    SUPPORT_EMAIL: z.email().optional(),

    // Feature Flags
    FLAG_DEBUG_PRINTER: z.stringbool().default(false),
    FLAG_DISABLE_SIGNUPS: z.stringbool().default(false),
    FLAG_DISABLE_EMAIL_AUTH: z.stringbool().default(false),
    FLAG_DISABLE_IMAGE_PROCESSING: z.stringbool().default(false),
  },
});
