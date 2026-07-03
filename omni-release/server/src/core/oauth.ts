// OAuth request builders. These construct URLs/requests; the caller (Edge
// Function / server) performs the network calls so secrets stay server-side.

import { getProvider, type OAuthProvider } from "./providers.js";

export interface AuthorizeInput {
  platform: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string; // required if provider.usesPkce
  scopesOverride?: string[];
}

/** Build the provider authorize URL the desktop app opens in the browser. */
export function buildAuthorizeUrl(input: AuthorizeInput): string {
  const p = getProvider(input.platform);
  const scopes = input.scopesOverride ?? p.scopes;
  const url = new URL(p.authorizeUrl);
  const q = url.searchParams;
  q.set("response_type", "code");
  q.set(p.clientIdParam ?? "client_id", input.clientId);
  q.set("redirect_uri", input.redirectUri);
  q.set("scope", scopes.join(p.scopeSeparator ?? " "));
  q.set("state", input.state);
  if (p.usesPkce) {
    if (!input.codeChallenge) throw new Error(`${p.id} requires PKCE codeChallenge`);
    q.set("code_challenge", input.codeChallenge);
    q.set("code_challenge_method", "S256");
  }
  for (const [k, v] of Object.entries(p.authorizeParams ?? {})) q.set(k, v);
  return url.toString();
}

export interface TokenExchangeInput {
  platform: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string; // required if provider.usesPkce
}

export interface HttpRequestSpec {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string; // x-www-form-urlencoded
}

/** Build the code→token exchange request (server sends it). */
export function buildTokenExchange(input: TokenExchangeInput): HttpRequestSpec {
  const p = getProvider(input.platform);
  const useBasic = p.tokenAuth === "basic";
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  form.set(p.clientIdParam ?? "client_id", input.clientId);
  // Confidential clients (e.g. X) authenticate with the Authorization: Basic
  // header; sending client_secret in the body returns 401 unauthorized_client.
  if (!useBasic) form.set("client_secret", input.clientSecret);
  if (p.usesPkce) {
    if (!input.codeVerifier) throw new Error(`${p.id} requires PKCE codeVerifier`);
    form.set("code_verifier", input.codeVerifier);
  }
  return formPost(p.tokenUrl, form, useBasic ? basicAuthHeader(input.clientId, input.clientSecret) : undefined);
}

export interface RefreshInput {
  platform: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** Build the refresh-token request. */
export function buildRefresh(input: RefreshInput): HttpRequestSpec {
  const p = getProvider(input.platform);
  const useBasic = p.tokenAuth === "basic";
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
  });
  form.set(p.clientIdParam ?? "client_id", input.clientId);
  if (!useBasic) form.set("client_secret", input.clientSecret);
  return formPost(p.tokenUrl, form, useBasic ? basicAuthHeader(input.clientId, input.clientSecret) : undefined);
}

/** HTTP Basic credential for confidential clients (Authorization: Basic …). */
function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

function formPost(url: string, form: URLSearchParams, authHeader?: string): HttpRequestSpec {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  if (authHeader) headers.authorization = authHeader;
  return { url, method: "POST", headers, body: form.toString() };
}

/** Normalize a provider token response into our TokenBundle-ish shape. */
export interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds
  scope?: string;
  token_type?: string;
}

export function expiresAtIso(resp: RawTokenResponse, nowMs: number): string | undefined {
  if (resp.expires_in == null) return undefined;
  return new Date(nowMs + resp.expires_in * 1000).toISOString();
}

/* ---------- account identity (name + avatar shown in previews) ---------- */

export interface ProfileRequestSpec {
  url: string;
  headers: Record<string, string>;
}

/** Build the request that fetches the connected account's public profile.
 * Returns null when the provider has no identity endpoint configured (or a
 * required Client-Id is missing). The caller performs the fetch server-side. */
export function buildProfileRequest(
  platform: string,
  accessToken: string,
  clientId?: string,
): ProfileRequestSpec | null {
  const p = getProvider(platform);
  if (!p.profile) return null;
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/json",
  };
  if (p.profile.needsClientId) {
    if (!clientId) return null;
    headers["client-id"] = clientId;
  }
  return { url: p.profile.url, headers };
}

export interface ProfileInfo {
  external_account_id?: string;
  display_name?: string;
  avatar_url?: string;
}

/** Normalize each provider's profile response into a common identity shape.
 * Defensive: any missing field is simply omitted (never throws on shape). */
// deno-lint-ignore no-explicit-any
export function parseProfile(platform: string, json: any): ProfileInfo {
  switch (platform) {
    case "youtube": {
      const it = json?.items?.[0];
      const th = it?.snippet?.thumbnails;
      return {
        external_account_id: it?.id,
        display_name: it?.snippet?.title,
        avatar_url: th?.high?.url ?? th?.medium?.url ?? th?.default?.url,
      };
    }
    case "facebook":
    case "instagram":
      return {
        external_account_id: json?.id,
        display_name: json?.name,
        avatar_url: json?.picture?.data?.url,
      };
    case "linkedin":
      // OIDC userinfo: { sub, name, picture, email }
      return {
        external_account_id: json?.sub,
        display_name: json?.name,
        avatar_url: json?.picture,
      };
    case "tiktok": {
      const u = json?.data?.user;
      return {
        external_account_id: u?.open_id,
        display_name: u?.display_name,
        avatar_url: u?.avatar_url,
      };
    }
    case "x": {
      const d = json?.data;
      return {
        external_account_id: d?.username ?? d?.id,
        display_name: d?.name,
        avatar_url: d?.profile_image_url,
      };
    }
    case "twitch": {
      const u = json?.data?.[0];
      return {
        external_account_id: u?.login ?? u?.id,
        display_name: u?.display_name,
        avatar_url: u?.profile_image_url,
      };
    }
    default:
      return {};
  }
}

export type { OAuthProvider };
