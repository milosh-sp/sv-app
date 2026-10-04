globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Default process.env for `vp test` when no `.env` is present (e.g. GitHub Actions).
 * Does not override variables already set by the host or `.env` loading.
 */
if (typeof process !== "undefined") {
  process.env.TZ ??= "Etc/UTC";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.PRINTER_ENDPOINT ??= "ws://localhost:4000?token=vitest";
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/postgres";
  process.env.AUTH_SECRET ??= "vitest-placeholder-auth-secret-not-for-production";
}
