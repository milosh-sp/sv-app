import type { auth } from "./config";

export type AuthSession = {
  session: typeof auth.$Infer.Session.session;
  user: typeof auth.$Infer.Session.user;
};

export type AuthProvider = "credential" | "google" | "github" | "custom";
