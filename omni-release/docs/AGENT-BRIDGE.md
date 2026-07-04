# Agent Bridge — Omni Release → Claude (browser publishing)

> How Omni Release hands scheduled posts to a Claude agent that publishes them by
> driving a logged-in browser — **no per-platform developer apps**. The app stays
> the single source of truth and the only writer to `omni.db`; the agent only
> reads job-cards and writes back results, through a file "outbox" in the repo.

## Why this exists

The `server/` OAuth path already works in code, but each platform needs its own
registered developer app (slow, throttled approvals). This bridge skips that:
Claude posts the way a human would, in a browser you're already logged into.

## Principle

- **App = command center.** You load media, captions, campaigns, platform rules,
  schedules, and approval rules in Omni Release. It owns `omni.db`.
- **Agent = hands.** Claude reads what's due, posts it, reports the result.
- **They talk through files** under `<repo>/outbox/` (the repo is mounted, so the
  agent can read it). The agent never touches `omni.db` directly.

## Folder layout (under `<repo>/outbox/`)

```
outbox/
  due/<job_id>/card.json        # app writes when a job comes due
  due/<job_id>/media/<file>     # app copies the media here (agent uploads this)
  done/<job_id>.result.json     # agent writes after attempting
  done/<job_id>.png             # agent's screenshot proof of the post
  due/<job_id>/attention.json   # latest resumable human gate, if any
  archive/<job_id>/             # app moves card + result here after ingest
```

The app copies media into the outbox because the live media library lives in the
app-data dir (outside the repo); staging a copy is what makes it reachable.

## Job-card — app writes `due/<job_id>/card.json`

Resolved from `ScheduledJob` + `PostPlatformTarget` + `Post` + `MediaAsset`:

```json
{
  "job_id": "job_…",
  "idempotency_key": "…",
  "target_id": "tgt_…",
  "post_id": "post_…",
  "platform": "x | facebook | youtube | instagram | tiktok | linkedin | rumble",
  "scheduled_for": "2026-06-30T14:00:00Z",
  "timezone": "America/New_York",
  "caption": "resolved caption (caption_override ?? master_caption)",
  "title": "title_override or null",
  "hashtags": ["#ai", "#build"],
  "link": "https://… or null",
  "cta": "… or null",
  "privacy": "public | unlisted | private | null",
  "options": {
    "publishSurface": "youtube_community_post | youtube_video_upload | ...",
    "youtubeSurface": "posts | studio_upload"
  },
  "release": {
    "post_id": "post_…",
    "target_count": 8,
    "platforms": ["youtube", "facebook", "instagram", "tiktok", "x", "linkedin", "rumble"],
    "target_statuses": [
      { "target_id": "tgt_…", "platform": "facebook", "status": "awaiting_agent" }
    ],
    "done_count": 0,
    "needs_attention_count": 0,
    "pending_count": 8
  },
  "delivery": {
    "index": 2,
    "total": 8,
    "clear_rule": "Clear this platform target only after proof; clear the parent release only after every selected platform target is terminal."
  },
  "media": [
    { "file": "media/clip.mp4", "mime": "video/mp4", "filename": "clip.mp4",
      "duration_sec": 42, "aspect_ratio": "9:16", "thumbnail": "media/thumb.jpg" }
  ],
  "instructions": "free-text per-platform posting rules carried from the app",
  "approval": { "required": false, "approved_by": null }
}
```

## Result — agent writes `done/<job_id>.result.json`

```json
{
  "job_id": "job_…",
  "idempotency_key": "…",
  "platform": "x",
  "outcome": "posted | failed | needs_attention",
  "external_url": "https://x.com/you/status/123 or null",
  "external_post_id": "123 or null",
  "posted_at": "2026-06-30T14:00:07Z",
  "screenshot": "done/job_….png",
  "error_code": "login_required | captcha | upload_rejected | … or null",
  "error_message": "human-readable or null"
}
```

`needs_attention` is a resumable pause, not a terminal state. Use it for gates a
human must clear inside the already-open browser: login, 2FA, CAPTCHA, account
checkpoint, missing file, upload prompt, or a platform page the agent cannot
recognize. Omni Release records the attempt, writes `attention.json` beside the
live card, and keeps `outbox/due/<job_id>/card.json` in place so the browser
agent can retry after the blocker is cleared.

## Status flow

1. The app scheduler claims each due platform target and — under the **`agent`** route instead of
   `mock` — writes `card.json`, copies the media into `due/<job_id>/media/`, sets
   the target status to `awaiting_agent`, and marks the job `done` (so it never
   retries or double-fires).
2. One release card can create many target jobs. The agent treats the parent
   release as shared context, then posts one platform target at a time.
3. The agent (on a schedule) reads each `due/*/card.json`, posts via the browser,
   saves a screenshot, and writes `done/<job_id>.result.json`.
4. The app's **ingest** step reads `done/*.result.json` and records a
   `publish_attempts` row.
5. `posted` marks only that target published and archives that due card. `failed` marks
   the target failed and archives the due card. `needs_attention` marks the
   target needs-attention, archives only that attempt result, writes
   `due/<job_id>/attention.json`, and leaves the due card/media live for resume.
6. The parent post clears only when every selected platform target is terminal:
   published, failed, or needs_attention.
7. The browser agent keeps polling live due cards with backoff. After Jake clears
   the gate, it retries the same card and eventually writes `posted` or `failed`.

**Single-writer rule:** only the app writes `omni.db`; the agent only writes files
in `outbox/done/`. The `idempotency_key` guards against any double-post.

## Browser Runner loop

The local runner is the piece that turns Agent Queue into a shipping loop:

```bash
npm run agent:chrome      # make Jake's signed-in Google Chrome attachable
npm run agent:tabs        # open due platform pages in your normal signed-in Chrome
npm run agent:once        # dry-run one pass; does not click final Post
npm run agent:once:live   # process due cards once and publish
npm run agent:loop        # dry-run polling loop
npm run agent:loop:live   # live polling loop; keeps trying due cards
```

The required account-safe flow is **Chrome/Profile first, Omni second**:

1. Use Jake's real Google Chrome profile:
   `makeshiphappentech@gmail.com` / `Jacob`.
2. Start attachable Chrome with `npm run agent:chrome`. If normal Chrome was
   already open without the debugging port, quit Chrome completely and run the
   command again.
3. Leave that Chrome window open.
4. Run `npm run agent:loop:live`.

The live runner now defaults to active Chrome mode. It attaches to
`http://127.0.0.1:9222` and refuses to post if that signed-in Chrome session is
not attachable. This prevents the agent from ever falling back to a blank Google
profile or the wrong Google account.

`npm run agent:tabs` remains the manual rescue command: it opens each due
platform page in the already-signed-in Chrome session and reveals staged media
files.

Loop contract:

- Future cards sit until `scheduled_for` is reached.
- Past-due cards are due now, even if the original scheduled time was missed.
- A due card remains in `outbox/due/` until the app ingests a result.
- `needs_attention` is a pause, not a delete; the loop retries after backoff once
  Jake clears login, 2FA, CAPTCHA, upload issues, or UI-change gates.
- Isolated Chrome is opt-in only. Use
  `OMNI_CHROME_MODE=isolated OMNI_ALLOW_ISOLATED_CHROME=1` or
  `npm run agent:loop:live:isolated` only after that isolated runner browser has
  been manually signed into `makeshiphappentech@gmail.com`.

## Per-platform method

| Platform  | Method                     | Notes                                            |
|-----------|----------------------------|--------------------------------------------------|
| X         | browser                    | Easiest — first pilot.                            |
| Facebook  | browser                    | Page post.                                        |
| YouTube   | browser *or* existing API  | Image/text cards go to channel Posts/Community; videos go to Studio upload. |
| Instagram | browser                    | May need a one-off tap (2FA/checkpoint).          |
| TikTok    | browser                    | May need a one-off tap; or lands as a draft.      |
| LinkedIn  | browser                    | Personal profile or page post.                    |
| Rumble    | browser                    | No public API exists — browser only.              |
| Twitch    | — (unsupported)            | No video-upload exists anywhere; not a post target.|

Detailed browser walkthroughs live in `docs/PLATFORM-TRAINING.md` and
`docs/platform-playbooks/`. Read those before changing a platform recipe.

## App change — implemented

Done in `app/src-tauri/src/`:

- **`agent.rs`** (new): `handoff()` writes the card + stages media + sets the
  target to `awaiting_agent`; `ingest_results()` reads `outbox/done/`, records a
  `publish_attempts` row, marks the target published/failed/needs_attention, and
  keeps `needs_attention` cards live for automatic resume.
- **`scheduler.rs`**: the publish route now comes from `OMNI_PUBLISH_ROUTE`
  (default `agent`). Each tick it ingests results, then hands off due jobs. Set
  `OMNI_PUBLISH_ROUTE=mock` to fall back to the old in-process publisher.
- **`commands.rs` / `lib.rs`**: new `ingest_agent_results` command (a manual
  "sync now"); `engine_root()` is exposed to the crate.
- **`spine_tests.rs`**: `agent_handoff_and_ingest_roundtrip` covers the full loop;
  `agent_needs_attention_keeps_due_card_live_until_resume` covers human-gate
  resume.

Verify, then run: `cd app/src-tauri && cargo test` → `cd app && npm run app`.

## Prerequisites

- **Claude in Chrome** extension connected (the agent drives it).
- **One-time login** to each platform in that browser. No developer apps, ever.
- The app (and computer) running at scheduled times, since the app emits the cards.
- For fully controlled browser posting from the normal Chrome window, macOS must
  allow the automation controller through Chrome Apple Events or Accessibility;
  otherwise the safe tab-pack flow opens the exact pages/files for handoff.

## YouTube routing rule

For YouTube targets the card's `options.publishSurface` tells the browser agent
which page to use:

- `youtube_community_post`: open `https://www.youtube.com/@MakeShipHappenTech/posts`,
  choose the channel post composer, add the text, and use the Image option for
  attached image files.
- `youtube_video_upload`: open YouTube Studio and use the normal video upload
  flow.

## Honest limits

- "Fully unattended" needs the computer awake with the browser logged in; the
  strict platforms (Instagram, TikTok) may occasionally need a tap — you get a
  `needs_attention` notification when that happens.
- The only truly hands-off alternative is the `server/` + official-API route,
  which is the developer-app path this bridge is here to avoid.
