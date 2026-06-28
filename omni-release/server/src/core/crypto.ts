// Token vault encryption: AES-256-GCM via WebCrypto.
//
// The 32-byte key is a SERVER-ONLY secret (env: TOKEN_ENC_KEY, base64). It is
// never stored in the database and never sent to a client. Ciphertext layout:
// base64( iv[12] || ciphertext+tag ). Decryption fails (throws) on any tampering
// because GCM authenticates the data.

import { base64ToBytes, bytesToBase64 } from "./b64.js";

const IV_BYTES = 12;

// WebCrypto wants BufferSource; recent TS typed-array generics need a nudge.
const buf = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

/** Generate a fresh base64 key for first-time setup (put in TOKEN_ENC_KEY). */
export async function generateKeyBase64(): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(raw);
}

/** Import a base64 32-byte key into a non-extractable AES-GCM CryptoKey. */
export async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  if (raw.length !== 32) {
    throw new Error(`TOKEN_ENC_KEY must be 32 bytes (got ${raw.length}); use generateKeyBase64().`);
  }
  return crypto.subtle.importKey("raw", buf(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(data)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return bytesToBase64(out);
}

export async function decryptString(key: CryptoKey, payload: string): Promise<string> {
  const payloadBytes = base64ToBytes(payload);
  const iv = payloadBytes.slice(0, IV_BYTES);
  const ct = payloadBytes.slice(IV_BYTES);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(ct));
  return new TextDecoder().decode(pt);
}

/** Encrypt a token bundle (access/refresh/expiry) for storage in tokens_enc. */
export interface TokenBundle {
  access_token: string;
  refresh_token?: string;
  expires_at?: string; // ISO
  scope?: string;
  token_type?: string;
}

export function encryptTokens(key: CryptoKey, tokens: TokenBundle): Promise<string> {
  return encryptString(key, JSON.stringify(tokens));
}

export async function decryptTokens(key: CryptoKey, payload: string): Promise<TokenBundle> {
  return JSON.parse(await decryptString(key, payload)) as TokenBundle;
}
