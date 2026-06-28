// OAuth 2.0 PKCE (RFC 7636) + CSRF state. Pure WebCrypto.
//
// The desktop app initiates auth; the server holds the client secret. PKCE
// protects the authorization-code flow so an intercepted code can't be redeemed
// without the verifier. `state` defends against CSRF on the callback.

import { bytesToBase64Url } from "./b64.js";

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** A high-entropy, URL-safe random token. */
export function randomToken(bytes = 32): string {
  return bytesToBase64Url(randomBytes(bytes));
}

export interface Pkce {
  codeVerifier: string;
  codeChallenge: string;
  method: "S256";
}

/** Create a PKCE verifier/challenge pair (S256). */
export async function createPkce(): Promise<Pkce> {
  const codeVerifier = randomToken(32); // 43+ chars, within RFC's 43..128
  const codeChallenge = await s256Challenge(codeVerifier);
  return { codeVerifier, codeChallenge, method: "S256" };
}

/** Compute base64url(SHA-256(verifier)) — the S256 challenge. */
export async function s256Challenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier) as unknown as BufferSource;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToBase64Url(new Uint8Array(digest));
}

/** A fresh CSRF state value to round-trip through the provider. */
export function createState(): string {
  return randomToken(24);
}

/** Constant-time-ish equality for opaque tokens (state, etc.). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
