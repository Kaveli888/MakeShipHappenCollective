// Supabase client for the desktop app. The app stays fully usable offline
// (local-first); cloud features light up only when these env vars are set
// (app/.env → VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY). The ANON key is safe
// in the client — it's gated by RLS. Service-role keys NEVER live here.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anon);

/** Project URL + anon key, exposed so native (Rust) calls can reach the API
 * directly (e.g. Edge Functions that the webview can't call due to CORS). */
export const supabaseUrl = url as string | undefined;
export const supabaseAnonKey = anon as string | undefined;

let client: SupabaseClient | null = null;
if (cloudConfigured) {
  client = createClient(url!, anon!, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** The Supabase client, or null when cloud isn't configured. */
export function sb(): SupabaseClient | null {
  return client;
}
