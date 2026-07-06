# Platform Capability Matrix (living doc)

> ⚠️ **Verify before you build.** Platform APIs, scopes, pricing and review gates change
> often. The rows below reflect best knowledge as of **early 2026** and **must be
> re-checked against each platform's official docs** at the start of its integration
> sprint. Treat every "Yes" as "Yes, *if* the access tier/review/account type below is satisfied."
> Confidence: 🟢 stable · 🟡 changes often / needs re-check · 🔴 volatile or gated.

## Summary matrix

| Capability | YouTube | TikTok | Instagram | Facebook | X / Twitter | Twitch |
|---|---|---|---|---|---|---|
| Upload video via API | 🟢 Yes (Data API v3 `videos.insert`) | 🟡 Yes (Content Posting API) | 🟡 Yes (Graph, Reels/video) | 🟢 Yes (Graph, Page video/Reels) | 🟡 Yes (media upload + post) | 🔴 **No** generic VOD upload API |
| Direct publish (no human step) | 🟢 Yes | 🟡 Yes *after app approval* | 🟡 Yes (container→publish) | 🟢 Yes | 🟡 Yes | 🔴 N/A |
| Draft / unaudited fallback | scheduled/private upload | 🟡 "upload to inbox" / draft (unaudited apps) | ❌ no real draft API | limited | ❌ | clips/VOD metadata only |
| Native scheduled publish via API | 🟡 partial (set publishAt + private) | ❌ schedule in-app only | ❌ | 🟢 Yes (scheduled Page posts) | ❌ | N/A |
| Requires business/creator acct | personal ok | 🟡 developer app + product access | 🔴 **Yes** Business/Creator + linked FB Page | 🔴 Page + roles | tier-dependent | channel/account |
| Requires app review | quota only | 🔴 **Yes** for direct post / unaudited limits | 🔴 **Yes** (Advanced Access) | 🔴 **Yes** (Advanced Access) | tier/use-case | dev app |
| Requires paid API tier | 🟢 free (quota) | free (approval-gated) | free (review-gated) | free (review-gated) | 🔴 **paid tiers** for most write access | free |
| Supports link in post | 🟢 (description) | 🟡 limited | 🟡 bio/limited | 🟢 | 🟢 | 🟢 |
| Supports hashtags | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | channel tags |
| Supports custom thumbnail | 🟢 (`thumbnails.set`, verified acct) | ❌ (cover frame only) | 🟡 cover frame | 🟡 | n/a (media) | 🟢 |
| Analytics via API | 🟢 YouTube Analytics API | 🟡 limited (approval) | 🟡 Insights (review) | 🟢 Insights | 🟡 tier-dependent | 🟢 |
| Omni implementation status | ❌ not started (Phase 2) | ❌ (Phase 4) | ❌ (Phase 3) | ❌ (Phase 3) | ❌ (Phase 5, was stubbed) | ❌ investigate (Phase 6) |

## Per-platform notes & required OAuth scopes (verify at build time)

### YouTube — 🟢 best first integration
- **API:** YouTube Data API v3 (`videos.insert` resumable upload), `thumbnails.set`, YouTube Analytics API.
- **Auth:** Google OAuth 2.0. Scopes: `youtube.upload`, `youtube` (manage), `yt-analytics.readonly`.
- **Reality:** free, mature, well-documented. Quota-limited (a video upload costs ~1600 quota units;
  default 10k/day ≈ a handful of uploads/day — request a quota increase early). Scheduled publish =
  upload `privacyStatus: private` + `publishAt` timestamp. **Build this first.**

### Instagram — 🟡 (Meta)
- **API:** Instagram Graph API (Content Publishing): create media container → publish. Reels & video supported.
- **Auth:** Facebook Login. **Requires an Instagram Business/Creator account linked to a Facebook Page.**
  Scopes: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `business_management`.
- **Reality:** **Advanced Access requires Meta App Review** before non-test users work. No true scheduling API
  (schedule client-side, publish at the time). Rate limits on publishes/24h. Single videos must be hosted at a
  public URL Meta can fetch (or use the resumable upload path) — plan media hosting.

### Facebook — 🟢/🟡 (Meta)
- **API:** Graph API Page video / Reels publishing; supports natively scheduled Page posts.
- **Auth:** Facebook Login. Scopes: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`,
  `business_management`, plus a **Page access token** (exchange user token → long-lived → page token).
- **Reality:** needs the Page + admin role + App Review for Advanced Access. Shares the Meta app with IG —
  do them together.

### TikTok — 🟡/🔴
- **API:** Content Posting API (video + photo; "Direct Post" or "Upload"/inbox-draft).
- **Auth:** TikTok OAuth. Scopes: `video.upload`, `video.publish` (direct post). Requires a registered
  developer app **and approved product access**; unaudited apps are limited to private/draft posting and a
  small allow-list of test users. **Direct public publish requires approval.**
- **Reality:** plan for the **draft/inbox fallback** until approval lands. Honor their content-disclosure rules.

### X / Twitter — 🟡/🔴
- **API:** v2 posts + media upload (chunked for video).
- **Auth:** OAuth 2.0 (user context). Scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
  (refresh). OAuth 1.0a still used by some media endpoints — verify current media-upload auth.
- **Reality:** **most write access is on paid tiers**; the free tier is very limited and pricing/limits change.
  The engine already has a stub (`OMNI_X_*`) but it is text-only and not wired. Confirm the current tier and
  cost **before** committing; this is the most volatile platform commercially.

### Twitch — 🔴 different beast
- **Not** a TikTok-style "upload a video and post it." Twitch is live-streaming + VOD + clips.
- **Helix API** can manage stream metadata, create **clips**, read VODs, EventSub for live events, analytics.
- **There is no public "upload a finished MP4 as a VOD" API.** Treat Twitch as: schedule/announce streams,
  capture clips, store VOD/clip URLs & metadata, embed — **not** as a video-publishing target.
  Set this expectation in the UI so users aren't misled.

## Design rule enforced by this matrix
Every publisher module ships with a **mock/test mode** and a **capability descriptor** (the row above, in code),
so the Composer/Calendar can **disable or warn** on unsupported combinations (e.g. "schedule" on IG, "upload VOD"
on Twitch) instead of letting a user queue something that can never succeed.
