// Mirrors the Rust models in src-tauri/src/models.rs (and the future REST API).

export type PlatformId =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "twitch"
  | "rumble";

export interface PlatformCapability {
  platform: PlatformId;
  label: string;
  can_upload_video: boolean;
  can_direct_publish: boolean;
  can_schedule_native: boolean;
  requires_business_account: boolean;
  requires_app_review: boolean;
  requires_paid_tier: boolean;
  supports_link: boolean;
  supports_hashtags: boolean;
  supports_thumbnail: boolean;
  supports_analytics: boolean;
  oauth_scopes: string[];
  implementation_status: string;
  notes: string;
}

export interface MediaAsset {
  id: string;
  workspace_id: string;
  storage_key: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: string | null;
  thumbnail_key: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  campaign_id: string | null;
  notes: string | null;
  status: string;
  checksum: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  media_asset_id: string | null;
  master_caption: string | null;
  link: string | null;
  cta: string | null;
  campaign_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PostPlatformTarget {
  id: string;
  post_id: string;
  platform: PlatformId;
  caption_override: string | null;
  title_override: string | null;
  hashtags: string[];
  thumbnail_media_id: string | null;
  privacy: string | null;
  options: unknown;
  status: string;
  external_post_id: string | null;
  external_url: string | null;
  published_at: string | null;
  failure_reason: string | null;
}

export interface PostBundle {
  post: Post;
  /** Primary/cover asset (first in the carousel) — kept for legacy consumers. */
  media: MediaAsset | null;
  /** Full ordered media set attached to the post (carousel that ships together). */
  media_items: MediaAsset[];
  targets: PostPlatformTarget[];
}

export interface ScheduledJob {
  id: string;
  workspace_id: string;
  post_platform_target_id: string;
  scheduled_for: string;
  timezone: string;
  idempotency_key: string;
  status: string;
  run_after: string;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
}

export interface CalendarEntry {
  job: ScheduledJob;
  target: PostPlatformTarget;
  post_id: string;
  media_title: string | null;
}

export interface PublishAttempt {
  id: string;
  scheduled_job_id: string | null;
  post_platform_target_id: string;
  attempt_no: number;
  mode: string;
  started_at: string;
  finished_at: string | null;
  outcome: string | null;
  external_post_id: string | null;
  external_url: string | null;
  response_summary: unknown;
  error_code: string | null;
  error_message: string | null;
}

export interface AuditLog {
  id: string;
  workspace_id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: unknown;
  created_at: string;
}

export interface PublishOutcome {
  outcome: string;
  external_post_id: string | null;
  external_url: string | null;
  error_code: string | null;
  error_message: string | null;
  is_mock: boolean;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  color: string | null;
  created_at: string;
}
