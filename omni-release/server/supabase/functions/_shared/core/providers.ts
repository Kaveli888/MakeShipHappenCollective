// OAuth provider registry. Endpoints/scopes per platform.
//
// ⚠️ VERIFY before each platform's sprint — these change. Confidence + caveats
// are in docs/audit-2026-06-26/01-PLATFORM-CAPABILITY-MATRIX.md. Only YouTube is
// wired for Phase 2; the rest carry their known endpoints + a `verified: false`
// flag so we don't ship against a stale URL by accident.

export type PlatformId =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "x"
  | "linkedin"
  | "twitch";

export interface OAuthProvider {
  id: PlatformId;
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  /** Default scopes requested at connect time. */
  scopes: string[];
  /** Extra query params for the authorize request (e.g. Google offline access). */
  authorizeParams?: Record<string, string>;
  /** Whether token exchange uses PKCE. */
  usesPkce: boolean;
  /** How client credentials are presented at the token endpoint. X (a
   * confidential client) mandates HTTP Basic auth — sending client_secret in the
   * body returns 401 there. Most providers accept body credentials. Default "body". */
  tokenAuth?: "basic" | "body";
  /** Param name for the client identifier at the authorize/token/refresh
   * endpoints. TikTok is non-standard and uses `client_key` instead of the
   * OAuth-standard `client_id`. Default "client_id". */
  clientIdParam?: string;
  /** Separator for the authorize `scope` param. TikTok joins scopes with a comma;
   * the OAuth default is a space. Default " ". */
  scopeSeparator?: string;
  /** True once endpoints/scopes have been re-verified for an integration. */
  verified: boolean;
  /** env var names for this provider's client credentials (server-only). */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Identity endpoint used after token exchange to capture the connected
   * account's name + avatar (parsed per-platform in oauth.ts `parseProfile`). */
  profile?: {
    url: string;
    /** Twitch requires the app Client-Id alongside the bearer token. */
    needsClientId?: boolean;
  };
}

export const PROVIDERS: Record<PlatformId, OAuthProvider> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ],
    authorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
    usesPkce: true,
    verified: true,
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    profile: { url: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true" },
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "business_management"],
    usesPkce: false,
    verified: false,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    profile: { url: "https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)" },
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list", "business_management"],
    usesPkce: false,
    verified: false,
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    profile: { url: "https://graph.facebook.com/v21.0/me?fields=id,name,picture.type(large)" },
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    // user.info.basic is required to read display_name/avatar for the preview;
    // video.upload powers the inbox/draft fallback (no audit needed);
    // video.publish enables Direct Post once the app is audited.
    scopes: ["user.info.basic", "video.upload", "video.publish"],
    usesPkce: true,
    // TikTok is non-standard: client_key (not client_id) + comma-separated scopes.
    clientIdParam: "client_key",
    scopeSeparator: ",",
    verified: false,
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    profile: { url: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url" },
  },
  x: {
    id: "x",
    label: "X / Twitter",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    // media.write is required to upload video via the v2 /2/media/upload endpoint
    // under OAuth2 user context; tweet.write alone only allows text posts.
    scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"],
    usesPkce: true,
    // Confidential client → credentials go in the Authorization: Basic header.
    tokenAuth: "basic",
    verified: false,
    clientIdEnv: "X_CLIENT_ID",
    clientSecretEnv: "X_CLIENT_SECRET",
    profile: { url: "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username" },
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "email", "w_member_social"],
    usesPkce: false,
    verified: false,
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    profile: { url: "https://api.linkedin.com/v2/userinfo" },
  },
  twitch: {
    id: "twitch",
    label: "Twitch",
    authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: ["clips:edit", "channel:read:stream_key", "analytics:read:games"],
    usesPkce: false,
    verified: false,
    clientIdEnv: "TWITCH_CLIENT_ID",
    clientSecretEnv: "TWITCH_CLIENT_SECRET",
    profile: { url: "https://api.twitch.tv/helix/users", needsClientId: true },
  },
};

export function getProvider(id: string): OAuthProvider {
  const p = PROVIDERS[id as PlatformId];
  if (!p) throw new Error(`unknown platform: ${id}`);
  return p;
}
