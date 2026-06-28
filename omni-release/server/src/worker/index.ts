// Publishing worker entrypoint. Long-running process (Fly.io / Render / a box):
// every TICK it runs all due jobs. Requires env from .env (see .env.example).
//
// Run: node --import tsx src/worker/index.ts   (after `npm install`)

import WebSocket from "ws";
import { importKey } from "../core/crypto.js";
import { PROVIDERS, type PlatformId } from "../core/providers.js";
import { runDueJobs, type ClientCreds } from "./runner.js";
import { SupabaseStore } from "./supabaseStore.js";

// supabase-js eagerly constructs a realtime client that needs a global
// WebSocket. Node < 22 has none, so the worker would otherwise crash on startup
// ("Node.js 20 detected without native WebSocket support"). The worker doesn't
// use realtime, but we provide a WebSocket so it starts on any Node version.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const TICK_MS = 10_000;

function env(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
}

/** Resolve a platform's OAuth client creds from env (for token refresh). */
function clientCreds(platform: string): ClientCreds | null {
  const p = PROVIDERS[platform as PlatformId];
  if (!p) return null;
  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function main() {
  const store = new SupabaseStore(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const vaultKey = await importKey(env("TOKEN_ENC_KEY"));
  const workerId = `worker-${process.pid}`;
  console.log(`[worker] started ${workerId}, tick ${TICK_MS}ms`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const summary = await runDueJobs(
        { store, vaultKey, fetchImpl: fetch, workerId, getClientCreds: clientCreds },
        new Date().toISOString(),
      );
      if (summary.claimed > 0) console.log(`[worker] ${JSON.stringify(summary)}`);
    } catch (e) {
      console.error("[worker] tick error", e);
    }
    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

main().catch((e) => {
  console.error("[worker] fatal", e);
  process.exit(1);
});
