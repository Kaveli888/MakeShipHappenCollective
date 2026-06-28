// Cloud operations: auth, workspace bootstrap, platform connections (OAuth
// hand-off via the oauth-start Edge Function), and media upload to Storage.
// All DB access is RLS-protected; the worker (service role) does the publishing.

import { invoke } from "@tauri-apps/api/core";
import { sb, cloudConfigured, supabaseUrl, supabaseAnonKey } from "./supabase.js";
import type { CalendarEntry, PostPlatformTarget, ScheduledJob } from "../types.js";

export { cloudConfigured };

export interface CloudUser {
  id: string;
  email: string | null;
}

export interface Connection {
  id: string;
  platform: string;
  display_name: string | null;
  /** Platform-side handle/username/channel id (e.g. @jake, UC… ). */
  external_account_id: string | null;
  /** Connected account's profile picture URL (populated by the OAuth callback). */
  avatar_url: string | null;
  status: string;
  scopes: string[];
  token_expires_at: string | null;
}

export async function getUser(): Promise<CloudUser | null> {
  const client = sb();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export function onAuthChange(cb: (user: CloudUser | null) => void): () => void {
  const client = sb();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_e, session) => {
    cb(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<void> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  const { error } = await client.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await sb()?.auth.signOut();
}

/** Find the caller's workspace, creating one (+ owner membership) on first use. */
export async function ensureWorkspace(): Promise<string> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  const user = await getUser();
  if (!user) throw new Error("not signed in");

  // Pick the oldest existing workspace deterministically (avoid a non-deterministic
  // limit(1) landing on a different row across calls).
  const { data: existing, error: selErr } = await client
    .from("workspaces")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  if (selErr) throw selErr;

  let workspaceId: string;
  if (existing && existing.length) {
    workspaceId = existing[0].id as string;
  } else {
    // Generate the id client-side so we don't need an insert read-back. The
    // workspaces SELECT policy requires membership (is_ws_member), but the
    // workspace_members row doesn't exist yet — a chicken-and-egg that makes
    // `.insert().select()` fail with RLS 42501. Insert minimally instead.
    workspaceId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { error: wsErr } = await client
      .from("workspaces")
      .insert({ id: workspaceId, owner_user_id: user.id, name: user.email ?? "My Workspace" });
    if (wsErr) throw wsErr;
  }

  // Ensure owner membership exists (idempotent) — required for every
  // workspace-scoped RLS check. Self-heals workspaces left without a member.
  const { error: memErr } = await client
    .from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: user.id, role: "owner" }, { onConflict: "workspace_id,user_id" });
  if (memErr) throw memErr;
  return workspaceId;
}

export async function listConnections(workspaceId: string): Promise<Connection[]> {
  const client = sb();
  if (!client) return [];
  const { data, error } = await client
    .from("platform_accounts_safe")
    .select("id, platform, display_name, external_account_id, avatar_url, status, scopes, token_expires_at")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return (data ?? []) as Connection[];
}

export interface BackfillResult {
  updated: number;
  results: Array<{ platform: string; status: string; detail?: string }>;
}

/** One-time backfill: have the server fetch the real name + avatar for every
 * already-connected account (accounts connected before the callback captured
 * identity won't have a photo until this runs). Idempotent — safe to re-run. */
export async function backfillProfiles(): Promise<BackfillResult> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  const { data, error } = await client.functions.invoke<BackfillResult>("backfill-profiles", {
    body: {},
  });
  if (error) throw error;
  return data ?? { updated: 0, results: [] };
}

/** Start an OAuth connect: ask the Edge Function for the authorize URL, open it.
 * The request is routed through the Rust backend (invoke "oauth_start") rather
 * than supabase-js functions.invoke, because the webview's fetch to Edge
 * Functions is rejected by a CORS preflight the function doesn't answer
 * ("FunctionsFetchError: Failed to send a request"). Native HTTP isn't subject
 * to CORS, so this works against the function as deployed. */
export async function connectPlatform(platform: string, workspaceId: string): Promise<void> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("cloud not configured");
  const { data: sess } = await client.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("not signed in");

  const url = await invoke<string>("oauth_start", {
    functionsUrl: `${supabaseUrl.replace(/\/$/, "")}/functions/v1`,
    anonKey: supabaseAnonKey,
    accessToken,
    platform,
    workspaceId,
  });
  if (!url) throw new Error("no authorize_url returned");
  await invoke("open_url", { url }); // system browser; user finishes in-browser
}

interface UploadedMedia {
  storageKey: string;
  filename: string;
  mimeType: string;
  byteSize: number;
}

/** Upload a local media asset to Storage via the Rust resumable (TUS) command.
 * Streams from disk in 6 MB chunks — handles multi-hundred-MB videos without
 * loading the whole file into the webview (the old base64 path couldn't). */
async function resumableUpload(workspaceId: string, mediaId: string): Promise<UploadedMedia> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("cloud not configured");
  const { data: sess } = await client.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("not signed in");
  return invoke<UploadedMedia>("media_upload_resumable", {
    supabaseUrl,
    anonKey: supabaseAnonKey,
    accessToken,
    workspaceId,
    mediaId,
  });
}

/** Upload a local media asset's bytes to Storage (resumable). Returns the key. */
export async function uploadMediaToStorage(workspaceId: string, mediaId: string): Promise<string> {
  return (await resumableUpload(workspaceId, mediaId)).storageKey;
}

export interface CloudScheduleInput {
  workspaceId: string;
  /** Local media id (uploaded to Storage). Omit for text-only posts. */
  mediaId?: string;
  platform: string;
  title: string;
  caption: string;
  hashtags: string[];
  privacy: string;
  scheduledForIso: string;
  timezone: string;
}

/**
 * Mirror a scheduled post into the cloud DB so the worker publishes it live:
 * upload media → create media_assets, posts, post_platform_targets, scheduled_jobs.
 * Returns the cloud scheduled_job id. The worker (service role) does the rest.
 */
export async function scheduleToCloud(input: CloudScheduleInput): Promise<string> {
  const client = sb();
  if (!client) throw new Error("cloud not configured");

  // Text-only posts (X / Facebook / LinkedIn) carry no media; skip the upload
  // and create a post with no media_asset_id.
  let mediaAssetId: string | null = null;
  if (input.mediaId) {
    const up = await resumableUpload(input.workspaceId, input.mediaId);
    mediaAssetId = await insertReturningId(client, "media_assets", {
      workspace_id: input.workspaceId,
      storage_key: up.storageKey,
      filename: up.filename,
      mime_type: up.mimeType,
      byte_size: up.byteSize,
      status: "ready",
    });
  }

  const post = await insertReturningId(client, "posts", {
    workspace_id: input.workspaceId,
    media_asset_id: mediaAssetId,
    master_caption: input.caption,
  });

  const target = await insertReturningId(client, "post_platform_targets", {
    post_id: post,
    platform: input.platform,
    caption_override: input.caption,
    title_override: input.title,
    hashtags: input.hashtags,
    privacy: input.privacy,
    status: "scheduled",
  });

  const job = await insertReturningId(client, "scheduled_jobs", {
    workspace_id: input.workspaceId,
    post_platform_target_id: target,
    scheduled_for: input.scheduledForIso,
    timezone: input.timezone,
    idempotency_key: `${target}:${input.scheduledForIso}`,
    status: "pending",
    run_after: input.scheduledForIso,
  });
  return job;
}

/**
 * Read scheduled + shipped jobs from the cloud DB for a month window, shaped as
 * CalendarEntry[] so the Calendar can merge them with local jobs. This is what
 * surfaces "Schedule live (cloud)" posts — and their published_at / external_url
 * once the worker ships them — on the calendar. Returns [] if cloud is off.
 */
export async function listCloudCalendar(
  workspaceId: string,
  fromIso: string,
  toIso: string,
): Promise<CalendarEntry[]> {
  const client = sb();
  if (!client) return [];
  const { data, error } = await client
    .from("scheduled_jobs")
    .select(
      `id, workspace_id, post_platform_target_id, scheduled_for, timezone,
       idempotency_key, status, run_after, attempts, max_attempts, locked_by, locked_at, created_at,
       target:post_platform_targets!inner (
         id, post_id, platform, caption_override, title_override, hashtags,
         thumbnail_media_id, privacy, options, status, external_post_id,
         external_url, published_at, failure_reason,
         post:posts!inner ( media:media_assets ( title, filename ) )
       )`,
    )
    .eq("workspace_id", workspaceId)
    .neq("status", "canceled")
    .gte("scheduled_for", fromIso)
    .lt("scheduled_for", toIso)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row): CalendarEntry => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    const { target: rawTarget, ...job } = r;
    const { post, ...target } = rawTarget ?? {};
    const media = post?.media;
    const media_title = media?.title ?? media?.filename ?? null;
    return {
      job: job as ScheduledJob,
      target: target as PostPlatformTarget,
      post_id: target.post_id,
      media_title,
    };
  });
}

/** Delete scheduled jobs (calendar entries) from the cloud DB by id. Leaves the
 * published post/target history and the live video untouched — just clears the
 * calendar. RLS (job_rw) permits this for workspace members. */
export async function deleteCloudJobs(jobIds: string[]): Promise<void> {
  const client = sb();
  if (!client || !jobIds.length) return;
  const { error } = await client.from("scheduled_jobs").delete().in("id", jobIds);
  if (error) throw error;
}

async function insertReturningId(
  client: NonNullable<ReturnType<typeof sb>>,
  table: string,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await client.from(table).insert(row).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}
