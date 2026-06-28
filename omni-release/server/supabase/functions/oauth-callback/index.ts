// Edge Function: oauth-callback
// Reference implementation (Deno / Supabase Edge runtime).
//
// Provider redirects here with ?code&state. We validate state (CSRF), exchange
// the code for tokens server-side (client secret stays here), encrypt the tokens
// with TOKEN_ENC_KEY, and upsert platform_accounts. The browser tab is then
// closed; the desktop app polls platform_accounts_safe for the new connection.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { importKey, encryptTokens } from "../_shared/core/crypto.ts";
import {
  buildTokenExchange,
  buildProfileRequest,
  parseProfile,
  expiresAtIso,
  type ProfileInfo,
  type RawTokenResponse,
} from "../_shared/core/oauth.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return html("Missing code/state", 400);

  const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  // Look up + consume the flow (one-time use, not expired).
  const { data: flow } = await admin
    .from("oauth_flows")
    .select("*")
    .eq("state", state)
    .maybeSingle();
  if (!flow) return html("Invalid or expired state", 400);
  if (new Date(flow.expires_at).getTime() < Date.now()) return html("Flow expired", 400);
  await admin.from("oauth_flows").delete().eq("state", state);

  try {
    const platform = flow.platform as string;
    const clientId = env(`${platform.toUpperCase()}_CLIENT_ID`) || env("GOOGLE_CLIENT_ID");
    const req2 = buildTokenExchange({
      platform,
      clientId,
      clientSecret: env(`${platform.toUpperCase()}_CLIENT_SECRET`) || env("GOOGLE_CLIENT_SECRET"),
      code,
      redirectUri: env("OAUTH_REDIRECT_URI"),
      codeVerifier: flow.code_verifier ?? undefined,
    });

    const resp = await fetch(req2.url, { method: req2.method, headers: req2.headers, body: req2.body });
    if (!resp.ok) return html(`Token exchange failed: ${resp.status}`, 502);
    const raw = (await resp.json()) as RawTokenResponse;

    // Capture the account's public identity (name + avatar) for the previews.
    // Best-effort: a profile-fetch failure must never block the connection.
    let profile: ProfileInfo = {};
    try {
      const preq = buildProfileRequest(platform, raw.access_token, clientId);
      if (preq) {
        const pres = await fetch(preq.url, { headers: preq.headers });
        if (pres.ok) profile = parseProfile(platform, await pres.json());
      }
    } catch (_) {
      /* identity is optional; the preview falls back to the brand placeholder */
    }

    const key = await importKey(env("TOKEN_ENC_KEY"));
    const tokens_enc = await encryptTokens(key, {
      access_token: raw.access_token,
      refresh_token: raw.refresh_token,
      expires_at: expiresAtIso(raw, Date.now()),
      scope: raw.scope,
      token_type: raw.token_type,
    });

    await admin.from("platform_accounts").upsert(
      {
        workspace_id: flow.workspace_id,
        platform,
        external_account_id: profile.external_account_id ?? null,
        display_name: profile.display_name ?? null,
        avatar_url: profile.avatar_url ?? null,
        scopes: (raw.scope ?? "").split(" ").filter(Boolean),
        tokens_enc,
        token_expires_at: expiresAtIso(raw, Date.now()),
        status: "connected",
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,platform,external_account_id" },
    );

    await admin.from("audit_logs").insert({
      workspace_id: flow.workspace_id,
      actor_user_id: flow.user_id,
      actor: "user",
      action: "account.connect",
      target_type: "platform_account",
      metadata: { platform },
    });

    return html(`Connected ${platform}. You can close this window.`);
  } catch (e) {
    return html(`Error: ${String(e)}`, 500);
  }
});

function html(msg: string, status = 200) {
  return new Response(`<!doctype html><meta charset=utf-8><body style="font:16px system-ui;padding:40px">${msg}</body>`, {
    status,
    headers: { "content-type": "text/html" },
  });
}
