import { invoke } from "@tauri-apps/api/core";
import type {
  AgentQueueItem,
  AuditLog,
  Campaign,
  CalendarEntry,
  MediaAsset,
  PlatformCapability,
  Post,
  PostBundle,
  PublishAttempt,
  PublishOutcome,
} from "./types.js";

/* ---------- legacy content engine bridge (returns JSON strings) ---------- */

export interface Lane {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  cadence?: string;
  proofImage: boolean;
  enabled: boolean;
}
export interface EngineInfo {
  root: string;
  node: string | null;
  built: boolean;
}
async function parsed<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const out = await invoke<string>(cmd, args);
  return JSON.parse(out) as T;
}

/* ---------- publishing platform API ---------- */

export const api = {
  // content engine (existing)
  engineInfo: () => invoke<EngineInfo>("engine_info"),
  listLanes: () => parsed<Lane[]>("list_lanes"),

  // capability matrix
  capabilities: () => invoke<PlatformCapability[]>("platform_capabilities"),

  // media library
  pickMediaFiles: () => invoke<string[]>("pick_media_files"),
  mediaImport: (path: string) => invoke<MediaAsset>("media_import", { path }),
  mediaList: (includeArchived = false) =>
    invoke<MediaAsset[]>("media_list", { includeArchived }),
  mediaThumb: (id: string) => invoke<string | null>("media_thumb", { id }),
  mediaUpdate: (
    id: string,
    title: string | null,
    description: string | null,
    tags: string[],
    notes: string | null,
    campaignId: string | null,
  ) =>
    invoke<void>("media_update", {
      id,
      title,
      description,
      tags,
      notes,
      campaignId,
    }),
  mediaSetStatus: (id: string, status: string) =>
    invoke<void>("media_set_status", { id, status }),

  // campaigns
  campaignsList: () => invoke<Campaign[]>("campaigns_list"),
  campaignCreate: (name: string, color: string | null) =>
    invoke<string>("campaign_create", { name, color }),

  // posts + composer
  postCreate: (mediaAssetId: string | null) =>
    invoke<string>("post_create", { mediaAssetId }),
  postsList: () => invoke<Post[]>("posts_list"),
  postGet: (id: string) => invoke<PostBundle | null>("post_get", { id }),
  postUpdate: (
    id: string,
    mediaAssetId: string | null,
    masterCaption: string | null,
    link: string | null,
    cta: string | null,
    campaignId: string | null,
  ) =>
    invoke<void>("post_update", {
      id,
      mediaAssetId,
      masterCaption,
      link,
      cta,
      campaignId,
    }),
  postSetMedia: (postId: string, mediaIds: string[]) =>
    invoke<void>("post_set_media", { postId, mediaIds }),
  targetUpsert: (args: {
    postId: string;
    platform: string;
    captionOverride: string | null;
    titleOverride: string | null;
    hashtags: string[];
    thumbnailMediaId: string | null;
    privacy: string | null;
    options: unknown;
  }) => invoke<string>("target_upsert", args),
  targetDelete: (postId: string, platform: string) =>
    invoke<void>("target_delete", { postId, platform }),

  // scheduling / calendar
  scheduleCreate: (
    targetId: string,
    scheduledFor: string,
    timezone: string,
    maxAttempts: number | null = null,
  ) =>
    invoke<string>("schedule_create", {
      targetId,
      scheduledFor,
      timezone,
      maxAttempts,
    }),
  scheduleCancel: (jobId: string) => invoke<void>("schedule_cancel", { jobId }),
  scheduleReschedule: (jobId: string, scheduledFor: string, timezone: string) =>
    invoke<void>("schedule_reschedule", { jobId, scheduledFor, timezone }),
  calendarList: (from: string, to: string) =>
    invoke<CalendarEntry[]>("calendar_list", { from, to }),
  jobRetry: (jobId: string) => invoke<void>("job_retry", { jobId }),
  jobDelete: (jobId: string) => invoke<void>("job_delete", { jobId }),

  // publishing
  publishNow: (targetId: string, mode: string) =>
    invoke<PublishOutcome>("publish_now", { targetId, mode }),

  // activity
  attemptsList: (limit = 50) => invoke<PublishAttempt[]>("attempts_list", { limit }),
  auditList: (limit = 100) => invoke<AuditLog[]>("audit_list", { limit }),
  agentQueue: () => invoke<AgentQueueItem[]>("agent_queue"),
  ingestAgentResults: () => invoke<number>("ingest_agent_results"),

  // small persisted app state
  stateGet: (key: string) => invoke<string | null>("state_get", { key }),
  stateSet: (key: string, value: string) => invoke<void>("state_set", { key, value }),

  // open an external (https) link in the system browser
  openUrl: (url: string) => invoke<void>("open_url", { url }),
  openChromeUrl: (url: string) => invoke<void>("open_chrome_url", { url }),
  openPath: (path: string) => invoke<void>("open_path", { path }),
};
