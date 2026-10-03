import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";

import { auth, authBaseUrl } from "@/integrations/auth/config";
import { db } from "@/integrations/drizzle/client";
import { oauthClient, verification } from "@/integrations/drizzle/schema";
import { generateId } from "@/utils/string";

function generateCode() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("base64url");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

type OAuthQuery = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  scope: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
};

function readOAuthQuery(params: URLSearchParams): OAuthQuery | Response {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");

  if (!clientId || !redirectUri) {
    return Response.json({ error: "missing client_id or redirect_uri" }, { status: 400 });
  }

  return {
    clientId,
    redirectUri,
    state: params.get("state"),
    scope: params.get("scope"),
    codeChallenge: params.get("code_challenge"),
    codeChallengeMethod: params.get("code_challenge_method"),
  };
}

function loginRedirect(origin: string, params: URLSearchParams) {
  const loginUrl = new URL("/auth/login", origin);
  const oauthParams = new URLSearchParams();
  for (const [key, value] of params) {
    if (!["exp", "sig"].includes(key)) oauthParams.set(key, value);
  }
  loginUrl.searchParams.set("callbackURL", `/auth/oauth?${oauthParams.toString()}`);

  return new Response(null, {
    status: 302,
    headers: { Location: loginUrl.toString() },
  });
}

async function loadClient(query: OAuthQuery) {
  const [client] = await db.select().from(oauthClient).where(eq(oauthClient.clientId, query.clientId)).limit(1);

  if (!client) return Response.json({ error: "invalid client" }, { status: 400 });
  if (!client.redirectUris.includes(query.redirectUri)) {
    return Response.json({ error: "invalid redirect_uri" }, { status: 400 });
  }

  return client;
}

async function issueAuthorizationCode(session: AuthSession, query: OAuthQuery) {
  const code = generateCode();
  const hashedCode = hashCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 600_000);

  await db.insert(verification).values({
    id: generateId(),
    identifier: hashedCode,
    value: JSON.stringify({
      type: "authorization_code",
      query: {
        response_type: "code",
        client_id: query.clientId,
        redirect_uri: query.redirectUri,
        scope: query.scope,
        state: query.state,
        code_challenge: query.codeChallenge,
        code_challenge_method: query.codeChallengeMethod,
      },
      userId: session.user.id,
      sessionId: session.session.id,
      authTime: new Date(session.session.createdAt).getTime(),
    }),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const callbackUrl = new URL(query.redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (query.state) callbackUrl.searchParams.set("state", query.state);
  callbackUrl.searchParams.set("iss", `${authBaseUrl}/api/auth`);

  return new Response(null, {
    status: 302,
    headers: { Location: callbackUrl.toString() },
  });
}

function consentPage(query: OAuthQuery, clientName: string) {
  const fields = [
    ["client_id", query.clientId],
    ["redirect_uri", query.redirectUri],
    ["state", query.state],
    ["scope", query.scope],
    ["code_challenge", query.codeChallenge],
    ["code_challenge_method", query.codeChallengeMethod],
  ]
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize ${escapeHtml(clientName)}</title>
</head>
<body>
  <main>
    <h1>Authorize ${escapeHtml(clientName)}</h1>
    <p>${escapeHtml(clientName)} wants access to your Skill Verdict account.</p>
    <p>Redirect: ${escapeHtml(query.redirectUri)}</p>
    <p>Scopes: ${escapeHtml(query.scope ?? "none")}</p>
    <form method="post" action="/auth/oauth">
      ${fields}
      <button type="submit">Allow</button>
    </form>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function authorize(session: AuthSession, params: URLSearchParams, issue: boolean) {
  const query = readOAuthQuery(params);
  if (query instanceof Response) return query;

  const client = await loadClient(query);
  if (client instanceof Response) return client;

  if (issue || client.skipConsent === true) return issueAuthorizationCode(session, query);

  return consentPage(query, client.name || client.clientId);
}

export const Route = createFileRoute("/auth/oauth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        const url = new URL(request.url);

        if (!session?.user) return loginRedirect(url.origin, url.searchParams);

        return authorize(session, url.searchParams, false);
      },
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers });
        const url = new URL(request.url);
        const body = await request.formData();
        const params = new URLSearchParams();
        for (const [key, value] of body) {
          if (typeof value === "string") params.set(key, value);
        }

        if (!session?.user) return loginRedirect(url.origin, params);

        return authorize(session, params, true);
      },
    },
  },
});
