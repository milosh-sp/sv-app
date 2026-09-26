// @ts-check

const nextPackages = ["@monaco-editor/react"];

const rcPackages = ["drizzle-orm", "drizzle-kit"];

/** @type {import('npm-check-updates').RunOptions} */
module.exports = {
  upgrade: true,
  install: "always",
  packageManager: "pnpm",
  // ponytail: better-auth 1.7 needs an Account.issuer data backfill, moves generic OAuth callbacks to /api/auth/callback/:id
  // (re-register redirect URIs) and changes oauth-provider schema/validAudiences. Held on 1.6 until that migration is done.
  reject: ["better-auth", "@better-auth/api-key", "@better-auth/drizzle-adapter", "@better-auth/oauth-provider"],
  target: (packageName) => {
    if (nextPackages.includes(packageName)) return "@next";
    if (rcPackages.includes(packageName)) return "@rc";
    return "latest";
  },
};
