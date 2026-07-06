// Security-core tests. Run with: npm test  (uses node:test via tsx).
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyBase64, importKey, encryptTokens, decryptTokens } from "./crypto.js";
import { createPkce, s256Challenge, createState, safeEqual } from "./pkce.js";
import { buildAuthorizeUrl, buildTokenExchange, expiresAtIso } from "./oauth.js";

test("token encryption round-trips and rejects tampering", async () => {
  const key = await importKey(await generateKeyBase64());
  const tokens = { access_token: "at-123", refresh_token: "rt-456", expires_at: "2026-01-01T00:00:00Z" };
  const enc = await encryptTokens(key, tokens);
  assert.notEqual(enc, JSON.stringify(tokens), "ciphertext must not be plaintext");
  const dec = await decryptTokens(key, enc);
  assert.deepEqual(dec, tokens);

  // Tamper one base64 char → GCM auth must fail.
  const flipped = enc.slice(0, -2) + (enc.at(-2) === "A" ? "B" : "A") + enc.slice(-1);
  await assert.rejects(() => decryptTokens(key, flipped));
});

test("a wrong key cannot decrypt", async () => {
  const k1 = await importKey(await generateKeyBase64());
  const k2 = await importKey(await generateKeyBase64());
  const enc = await encryptTokens(k1, { access_token: "secret" });
  await assert.rejects(() => decryptTokens(k2, enc));
});

test("importKey rejects wrong-size keys", async () => {
  await assert.rejects(() => importKey(btoa("too-short")));
});

test("PKCE challenge is base64url(sha256(verifier))", async () => {
  const p = await createPkce();
  assert.equal(p.method, "S256");
  assert.match(p.codeVerifier, /^[A-Za-z0-9_-]+$/, "verifier is url-safe");
  assert.match(p.codeChallenge, /^[A-Za-z0-9_-]+$/, "challenge is url-safe");
  assert.equal(await s256Challenge(p.codeVerifier), p.codeChallenge);
});

test("state is unique and safeEqual works", () => {
  const a = createState();
  const b = createState();
  assert.notEqual(a, b);
  assert.ok(safeEqual(a, a));
  assert.ok(!safeEqual(a, b));
});

test("authorize URL contains required PKCE + scope params (YouTube)", async () => {
  const { codeChallenge } = await createPkce();
  const url = new URL(
    buildAuthorizeUrl({
      platform: "youtube",
      clientId: "cid.apps.googleusercontent.com",
      redirectUri: "https://api.example.com/oauth/callback",
      state: "st",
      codeChallenge,
    }),
  );
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("client_id"), "cid.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), codeChallenge);
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.ok(url.searchParams.get("scope")!.includes("youtube.upload"));
});

test("PKCE provider requires a challenge", () => {
  assert.throws(() =>
    buildAuthorizeUrl({
      platform: "youtube",
      clientId: "c",
      redirectUri: "https://x/cb",
      state: "s",
    }),
  );
});

test("token exchange is a form POST with PKCE verifier", () => {
  const req = buildTokenExchange({
    platform: "youtube",
    clientId: "c",
    clientSecret: "secret",
    code: "auth-code",
    redirectUri: "https://x/cb",
    codeVerifier: "ver",
  });
  assert.equal(req.method, "POST");
  assert.equal(req.headers["content-type"], "application/x-www-form-urlencoded");
  const body = new URLSearchParams(req.body);
  assert.equal(body.get("grant_type"), "authorization_code");
  assert.equal(body.get("code_verifier"), "ver");
  assert.equal(body.get("client_secret"), "secret");
});

test("confidential clients (X) use Authorization: Basic, not client_secret in body", () => {
  const req = buildTokenExchange({
    platform: "x",
    clientId: "cid",
    clientSecret: "csecret",
    code: "auth-code",
    redirectUri: "https://x/cb",
    codeVerifier: "ver",
  });
  const body = new URLSearchParams(req.body);
  assert.equal(body.get("client_secret"), null); // secret must NOT be in the body
  assert.equal(body.get("code_verifier"), "ver");
  assert.equal(req.headers["authorization"], `Basic ${btoa("cid:csecret")}`);
});

test("expiresAtIso computes from expires_in", () => {
  const iso = expiresAtIso({ access_token: "a", expires_in: 3600 }, Date.parse("2026-06-26T00:00:00Z"));
  assert.equal(iso, "2026-06-26T01:00:00.000Z");
});
