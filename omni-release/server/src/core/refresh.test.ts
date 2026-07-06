import { test } from "node:test";
import assert from "node:assert/strict";
import { needsRefresh, refreshTokens } from "./refresh.js";
import type { FetchImpl } from "./youtube.js";

const NOW = Date.parse("2026-06-26T12:00:00Z");

test("needsRefresh: true when expired/near, false when fresh or no expiry", () => {
  assert.equal(needsRefresh({ access_token: "a" }, NOW), false); // no expiry → no refresh
  assert.equal(needsRefresh({ access_token: "a", expires_at: "2026-06-26T13:00:00Z" }, NOW), false);
  assert.equal(needsRefresh({ access_token: "a", expires_at: "2026-06-26T12:00:30Z" }, NOW), true); // within skew
  assert.equal(needsRefresh({ access_token: "a", expires_at: "2026-06-26T11:00:00Z" }, NOW), true); // past
});

test("refreshTokens swaps the access token and keeps the refresh token if none returned", async () => {
  const mock: FetchImpl = async (url, init) => {
    assert.ok(url.includes("oauth2.googleapis.com/token"));
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "rt-old");
    return new Response(JSON.stringify({ access_token: "at-new", expires_in: 3600 }), { status: 200 });
  };
  const out = await refreshTokens(
    "youtube",
    { access_token: "at-old", refresh_token: "rt-old", expires_at: "2026-06-26T11:00:00Z" },
    { fetchImpl: mock, clientId: "c", clientSecret: "s", nowMs: NOW },
  );
  assert.equal(out.access_token, "at-new");
  assert.equal(out.refresh_token, "rt-old"); // preserved
  assert.equal(out.expires_at, "2026-06-26T13:00:00.000Z");
});

test("refreshTokens throws without a refresh token and on HTTP failure", async () => {
  const ok: FetchImpl = async () => new Response("{}", { status: 200 });
  await assert.rejects(() => refreshTokens("youtube", { access_token: "a" }, { fetchImpl: ok, clientId: "c", clientSecret: "s", nowMs: NOW }));
  const bad: FetchImpl = async () => new Response("nope", { status: 400 });
  await assert.rejects(() =>
    refreshTokens("youtube", { access_token: "a", refresh_token: "r" }, { fetchImpl: bad, clientId: "c", clientSecret: "s", nowMs: NOW }),
  );
});
