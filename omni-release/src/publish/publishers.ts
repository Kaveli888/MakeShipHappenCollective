/**
 * Publisher adapters.
 *
 * Two routes behind one interface (core `Publisher`), so API publishing can
 * replace browser publishing later without touching the orchestrator:
 *
 *   A. API mode — official platform APIs (X, Meta/Facebook Pages, LinkedIn).
 *      Gated on credentials supplied via env. No credentials → cannot publish
 *      live; the orchestrator then falls back to a ready-to-post package.
 *   B. Browser-assisted mode — drive a logged-in Chrome/browser session. Gated
 *      on a configured session. Not wired in the MVP → cannot publish live.
 *
 * SAFE BY DEFAULT: nothing here posts to a live platform unless the relevant
 * credentials/session are explicitly configured. When an adapter cannot publish
 * live it returns a `failed` PublishResult with a clear reason instead of
 * throwing, so the caller can fall back without losing the post.
 */

import type {
  Platform,
  PublishMode,
  PublishResult,
  Publisher,
  QueueItem,
} from "../core/index.js";
import { nowIso } from "../core/index.js";
import type { PublishRoute } from "./types.js";

/** Required env vars per platform for live API publishing. */
const API_CREDENTIAL_KEYS: Record<Platform, string[]> = {
  x: ["OMNI_X_API_KEY", "OMNI_X_API_SECRET", "OMNI_X_ACCESS_TOKEN", "OMNI_X_ACCESS_SECRET"],
  linkedin: ["OMNI_LINKEDIN_ACCESS_TOKEN", "OMNI_LINKEDIN_AUTHOR_URN"],
  facebook: ["OMNI_FACEBOOK_PAGE_ID", "OMNI_FACEBOOK_PAGE_TOKEN"],
  browser: [],
};

/** Env var that marks a logged-in browser session as available for a platform. */
const BROWSER_SESSION_KEY = "OMNI_BROWSER_SESSION";

function hasAllEnv(keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => Boolean(process.env[k]?.trim()));
}

function result(
  item: QueueItem,
  mode: PublishMode,
  patch: Partial<PublishResult>,
): PublishResult {
  return {
    queueItemId: item.id,
    platform: item.platform,
    mode,
    status: patch.status ?? "failed",
    publishedAt: nowIso(),
    ...patch,
  };
}

/** API publisher. Live publishing requires platform credentials in the env. */
export function makeApiPublisher(platform: Platform): Publisher {
  const keys = API_CREDENTIAL_KEYS[platform] ?? [];
  return {
    platform,
    canPublishLive: () => hasAllEnv(keys),
    async publish(item: QueueItem, mode: PublishMode): Promise<PublishResult> {
      if (mode === "queue") {
        return result(item, mode, { status: "ready", markdownPath: item.markdownPath });
      }
      if (!hasAllEnv(keys)) {
        return result(item, mode, {
          status: "failed",
          error: `${platform} API credentials not configured (set ${keys.join(", ") || "the platform credentials"}).`,
        });
      }
      // Credentials exist but the live API call is not implemented in the MVP.
      // Returning `failed` (never throwing) keeps the post safe via fallback.
      return result(item, mode, {
        status: "failed",
        error: `${platform} API live publishing is not implemented yet; saved to ready-to-post instead.`,
      });
    },
  };
}

/** Browser-assisted publisher. Live publishing requires a configured session. */
export function makeBrowserPublisher(platform: Platform): Publisher {
  return {
    platform,
    canPublishLive: () => Boolean(process.env[BROWSER_SESSION_KEY]?.trim()),
    async publish(item: QueueItem, mode: PublishMode): Promise<PublishResult> {
      if (mode === "queue") {
        return result(item, mode, { status: "ready", markdownPath: item.markdownPath });
      }
      return result(item, mode, {
        status: "failed",
        error: `Browser-assisted publishing for ${platform} is not configured (set ${BROWSER_SESSION_KEY} and wire a session adapter); saved to ready-to-post instead.`,
      });
    },
  };
}

/**
 * Resolve which route handles a platform. Overridable per platform via
 * `OMNI_ROUTE_<PLATFORM>` (= "api" | "browser"). Defaults: API for the official
 * platforms, browser for the manual `browser` lane.
 */
export function resolveRoute(platform: Platform): PublishRoute {
  const override = process.env[`OMNI_ROUTE_${platform.toUpperCase()}`];
  if (override === "api" || override === "browser") return override;
  return platform === "browser" ? "browser" : "api";
}

/** Build the publisher for a platform given its resolved route. */
export function getPublisher(platform: Platform, route: PublishRoute = resolveRoute(platform)): Publisher {
  return route === "browser" ? makeBrowserPublisher(platform) : makeApiPublisher(platform);
}
