// Access-token refresh. The worker refreshes just-in-time before publishing
// when a stored token is at/near expiry, using the provider's refresh grant.
// Client secrets stay server-side (passed in by the caller from env).

import { buildRefresh, expiresAtIso, type RawTokenResponse } from "./oauth.js";
import type { FetchImpl } from "./youtube.js";
import type { TokenBundle } from "./crypto.js";

const SKEW_MS = 60_000; // refresh if it expires within a minute

/** True when the bundle has an expiry that's already past (or within SKEW). */
export function needsRefresh(bundle: TokenBundle, nowMs: number): boolean {
  if (!bundle.expires_at) return false;
  const exp = Date.parse(bundle.expires_at);
  return Number.isFinite(exp) && exp - nowMs <= SKEW_MS;
}

export interface RefreshDeps {
  fetchImpl: FetchImpl;
  clientId: string;
  clientSecret: string;
  nowMs: number;
}

/**
 * Exchange a refresh token for a fresh access token. Returns a new bundle,
 * preserving the existing refresh token if the provider doesn't return one.
 * Throws on a non-OK response (caller may fall back to the existing token).
 */
export async function refreshTokens(
  platform: string,
  bundle: TokenBundle,
  deps: RefreshDeps,
): Promise<TokenBundle> {
  if (!bundle.refresh_token) throw new Error("no refresh_token available");
  const req = buildRefresh({
    platform,
    clientId: deps.clientId,
    clientSecret: deps.clientSecret,
    refreshToken: bundle.refresh_token,
  });
  const resp = await deps.fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body });
  if (!resp.ok) throw new Error(`refresh failed: ${resp.status}`);
  const raw = (await resp.json()) as RawTokenResponse;
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token ?? bundle.refresh_token,
    expires_at: expiresAtIso(raw, deps.nowMs),
    scope: raw.scope ?? bundle.scope,
    token_type: raw.token_type ?? bundle.token_type,
  };
}
