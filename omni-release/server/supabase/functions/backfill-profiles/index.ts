// Edge Function: backfill-profiles
// Reference implementation (Deno / Supabase Edge runtime). Deploy after
// `npm run fn:sync` populates ../_shared/core.
//
// One-time (idempotent) backfill: for every CONNECTED platform_account in the
// caller's workspaces, decrypt the stored token, fetch the account's public
// profile, and persist display_name / avatar_url / external_account_id. This
// lets accounts that were connected BEFORE the callback learned to capture
// identity get their name + photo without the user reconnecting.
//
// Best-effort per account: a single fetch/decrypt failure is recorded and the
// loop continues. Tokens never leave the server; the response carries only a
// per-platform status summary.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { importKey, decryptTokens } from "../_shared/core/crypto.ts";
import { buildProfileRequest, parseProfile } from "../_shared/core/oauth.ts";
import { getProvider } from "../_shared/core/providers.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

interface Row {
  id: string;
  workspace_id: string;
  platform: string;
  tokens_enc: string | null;
  avatar_url: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Identify the caller from their Supabase JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    // The caller's workspaces (membership-scoped).
    const { data: memberships, error: memErr } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userData.user.id);
    if (memErr) return json({ error: memErr.message }, 500);
    const wsIds = (memberships ?? []).map((m) => m.workspace_id as string);
    if (!wsIds.length) return json({ updated: 0, results: [] });

    // Connected accounts in those workspaces (base table → has tokens_enc).
    const { data: rows, error: rowErr } = await admin
      .from("platform_accounts")
      .select("id, workspace_id, platform, tokens_enc, avatar_url")
      .in("workspace_id", wsIds)
      .eq("status", "connected");
    if (rowErr) return json({ error: rowErr.message }, 500);

    const key = await importKey(env("TOKEN_ENC_KEY"));
    const results: Array<{ platform: string; status: string; detail?: string }> = [];
    let updated = 0;

    for (const row of (rows ?? []) as Row[]) {
      const { platform } = row;
      try {
        if (!row.tokens_enc) {
          results.push({ platform, status: "skipped", detail: "no token" });
          continue;
        }
        const provider = getProvider(platform);
        if (!provider.profile) {
          results.push({ platform, status: "skipped", detail: "no profile endpoint" });
          continue;
        }
        const bundle = await decryptTokens(key, row.tokens_enc);
        const clientId = env(provider.clientIdEnv) || env("GOOGLE_CLIENT_ID");
        const preq = buildProfileRequest(platform, bundle.access_token, clientId);
        if (!preq) {
          results.push({ platform, status: "skipped", detail: "missing client id" });
          continue;
        }
        const pres = await fetch(preq.url, { headers: preq.headers });
        if (!pres.ok) {
          results.push({ platform, status: "error", detail: `profile ${pres.status}` });
          continue;
        }
        const profile = parseProfile(platform, await pres.json());
        if (!profile.display_name && !profile.avatar_url && !profile.external_account_id) {
          results.push({ platform, status: "empty" });
          continue;
        }
        const patch: Record<string, string> = {};
        if (profile.display_name) patch.display_name = profile.display_name;
        if (profile.avatar_url) patch.avatar_url = profile.avatar_url;
        if (profile.external_account_id) patch.external_account_id = profile.external_account_id;
        const { error: upErr } = await admin
          .from("platform_accounts")
          .update(patch)
          .eq("id", row.id);
        if (upErr) {
          results.push({ platform, status: "error", detail: upErr.message });
          continue;
        }
        updated++;
        results.push({ platform, status: "updated" });
      } catch (e) {
        results.push({ platform, status: "error", detail: String(e) });
      }
    }

    return json({ updated, results });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
