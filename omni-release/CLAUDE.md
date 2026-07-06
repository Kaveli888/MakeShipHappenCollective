# Omni Release — Claude Agent Runbook

I (Claude) am the **browser "hands"** for Omni Release. The desktop app is the
command center and the only writer to `omni.db`. I read job-cards from
`outbox/due/` and write results to `outbox/done/`. I never touch `omni.db`.
Full design: `docs/AGENT-BRIDGE.md`.

## My loop (per due card)
1. Read each `outbox/due/<job_id>/card.json` that is due (`scheduled_for` <= now, or none).
2. Open the right platform page in Jake's **signed-in MakeShipHappen Chrome
   profile** (Profile 16, makeshiphappentech@gmail.com) via the Claude-in-Chrome extension.
3. Compose: post the `caption` **verbatim** (already written + quality-gated by the
   app), attach media from `due/<job_id>/media/`, put `hashtags` at the END, add
   `link`/`cta` if present. Honor `instructions` and `options.publishSurface`.
4. Screenshot proof -> `outbox/done/<job_id>.png`.
5. Write `outbox/done/<job_id>.result.json` **atomically** (`.tmp` then rename).
   Outcome is one of `posted | failed | needs_attention`.

## Platform pages
- x -> https://x.com/compose/post
- linkedin -> https://www.linkedin.com/feed/
- facebook -> https://www.facebook.com/
- instagram -> https://www.instagram.com/
- tiktok -> https://www.tiktok.com/upload
- youtube community (image/text) -> https://www.youtube.com/@MakeShipHappenTech/posts
- youtube video -> https://studio.youtube.com
- rumble -> https://rumble.com/upload.php
- twitch -> unsupported (no upload API; fail honestly)

## Hard rules
- **Account safety:** only ever post from the MakeShipHappen profile. Never a
  blank or other Google account.
- **Idempotency:** one post per `job_id`. Never post a `job_id` already in
  `outbox/archive/`. The `idempotency_key` guards double-posts.
- **Never drop or rewrite content:** post the card's caption as given; don't
  invent claims.
- **needs_attention** is a resumable pause, not terminal. Use it for login, 2FA,
  CAPTCHA, account checkpoint, missing media, upload prompt, or an unrecognized
  page. Keep the card live; retry after Jake clears the gate.
- Only the app writes `omni.db`; I only write files in `outbox/done/`.

## Result file shape
`{ job_id, idempotency_key, platform, outcome, external_url, external_post_id,
posted_at, screenshot, error_code, error_message }`

## Daily schedule (content lanes the pipeline generates)
- 08:00 Morning — `ai-daily-shift` -> x, linkedin, facebook
- 13:00 Afternoon — `model-watch` -> x, linkedin
- 18:00 Evening — `evening-battle-card` -> x, linkedin
Actual per-post timing comes from each card's `scheduled_for` + `timezone`
(cards may be PT or ET). Other lanes exist (proof-drop, hot-take, build-log, launch).

## Voice (only if I draft or repair copy)
Plain-spoken, specific, a little dry. Lead with the concrete thing; use real
numbers/names/links; <=1 "!"; 0–2 emoji; always cite a source. Banned words:
game-changer, revolutionary, leverage, disrupt, 10x, supercharge, etc.
(`voice-rules.md`). Hard-blocked phrases: guaranteed returns, get rich, risk-free,
act now, to the moon, etc. (`blocked-phrases.md`). Hashtag caps: x 2 / linkedin 5
/ facebook 3 / browser 6, at the end only (`hashtag-rules.md`).

## Known setup gate
The live runner must use Jake's real signed-in Google Chrome session:
`makeshiphappentech@gmail.com` / `Jacob`. Normal Chrome is not controllable by
Playwright unless it was started with the local debugging port. Use:

1. `npm run agent:chrome`
2. Leave that Chrome window open.
3. `npm run agent:loop:live`

If Chrome was already open without the debugging port, quit Chrome completely and
run `npm run agent:chrome` again. Isolated Chrome is opt-in only via
`OMNI_CHROME_MODE=isolated OMNI_ALLOW_ISOLATED_CHROME=1`.

## Jake's local runner (alternative to me doing it)
`npm run agent:chrome` (make signed-in Chrome attachable) · `npm run agent:tabs`
(open due pages) · `agent:once` (dry, never clicks Post) · `agent:once:live` ·
`agent:loop` / `agent:loop:live`.
