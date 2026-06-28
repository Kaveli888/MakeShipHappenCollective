// Edge Function: oauth-start
// Reference implementation (Deno / Supabase Edge runtime). Deploy after
// `npm run fn:sync` populates ../_shared/core. Verifying requires Supabase.
//
// Flow: authenticated user asks to connect a platform → we mint PKCE + state,
// stash them server-side (oauth_flows table, short TTL), and return the provider
// authorize URL for the desktop app to open. Client secrets never leave here.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { createPkce, createState } from "../_shared/core/pkce.ts";
import { buildAuthorizeUrl } from "../_shared/core/oauth.ts";
import { getProvider } from "../_shared/core/providers.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

// CORS: the desktop app calls this via supabase-js functions.invoke, which sends
// Authorization + apikey + content-type and therefore triggers a preflight. The
// platform's auto-added CORS omits content-type, so we set our own (and answer
// OPTIONS) — otherwise the webview's preflight is rejected with
// "FunctionsFetchError: Failed to send a request to the Edge Function".
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { platform, workspace_id } = await req.json();
    const provider = getProvider(platform);

    // Identify the caller from their Supabase JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supa = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

    const clientId = env(provider.clientIdEnv);
    if (!clientId) return json({ error: `${provider.id} not configured` }, 400);

    const pkce = provider.usesPkce ? await createPkce() : null;
    const state = createState();

    // Persist the flow (service role) so the callback can validate + exchange.
    const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
    await admin.from("oauth_flows").insert({
      state,
      user_id: userData.user.id,
      workspace_id,
      platform,
      code_verifier: pkce?.codeVerifier ?? null,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    const url = buildAuthorizeUrl({
      platform,
      clientId,
      redirectUri: env("OAUTH_REDIRECT_URI"),
      state,
      codeChallenge: pkce?.codeChallenge,
    });
    return json({ authorize_url: url });
  } catch (e) {
    return json({ error: String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}
