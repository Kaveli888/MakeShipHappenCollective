# X Browser Posts

Status: trained from Jake's screenshot walkthrough on 2026-07-03.
Live agent proof is still pending.

Use this playbook when Omni Release has a due X card that should publish through
X's web composer in Jake's signed-in Chrome session.

## Scope

This flow covers X web composer posts:

- text-only posts
- single image plus text posts
- single video plus text posts

This flow does not yet cover:

- long-form Articles
- X livestreams
- polls
- scheduled posts
- replies/quote posts
- threads
- paid/subscriber-only posts
- Creator Studio flows
- payment/billing updates

If a card asks for one of those untrained options, mark it `needs_attention`
unless Jake has provided exact instructions in the card.

## Entry

- Primary URL: `https://x.com/home`
- Required account/session: Jake's signed-in X account in Chrome.
- Required account signal: `MakeShipHappen.Tech` / `@1MakeShipHappen` is visible.
- Composer entry: top Home composer field labeled `What's happening?`

If X is logged out, asks for a checkpoint, or shows the wrong account, mark the
job `needs_attention`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- caption/text from the card
- media file from the card or staged outbox media folder, if present
- any explicit reply/audience settings instructions

Do not rewrite the caption. Do not substitute media. If media is missing or X
rejects it, mark `needs_attention`.

## Default Publish Settings

Unless Jake or the card explicitly says otherwise:

- Use the Home composer, not Articles or Creator Studio.
- Leave reply audience as the default `Everyone can reply`.
- Do not add a poll, location, emoji, schedule, or other composer options.
- Do not upload caption files unless the card explicitly provides one.
- Do not interact with the right-side `Warning: Payment failed` / `Update Billing`
  panel during publishing. Jake's walkthrough shows it is not required for a
  successful post.

## Posting Flow

1. Open X in Jake's signed-in Chrome session:

```text
https://x.com/home
```

2. Confirm the correct account is visible:

```text
MakeShipHappen.Tech
@1MakeShipHappen
```

3. Click the Home composer field:

```text
What's happening?
```

4. Paste the exact Omni Release caption into the composer.

5. If the due card includes image or video media, attach the exact staged file
   through the composer media button or supported file drop/paste behavior.

6. If media is uploading, wait for the status to complete. For video, Jake's
   walkthrough showed the status changing from an upload percentage to:

```text
Ready
```

Do not click `Post` while the file still shows an upload percentage.

7. Verify before publishing:

- caption text is visible
- attached image/video preview is visible when media exists
- media status says `Ready` when X shows a status
- `Post` button is enabled
- account identity still matches `MakeShipHappen.Tech` / `@1MakeShipHappen`

8. Click the black:

```text
Post
```

9. Confirm the new post appears at the top of the Home feed.

The success signal from Jake's walkthrough is a fresh post by:

```text
MakeShipHappen.Tech
@1MakeShipHappen
```

with a timestamp like:

```text
1s
```

and the exact caption/media visible.

## Success Signal

Treat the X post as published only after the new post is visible in the feed with
the intended account, caption, media preview when applicable, and a fresh
timestamp such as `1s`.

If a permalink is easy to open from the post menu or timestamp, capture it as
`external_url`. If not, use `https://x.com/1MakeShipHappen` or
`https://x.com/home` as fallback evidence and save screenshot proof.

## Known Gates

- `logged_out`: X asks for login.
- `wrong_identity`: visible account is not `MakeShipHappen.Tech` / `@1MakeShipHappen`.
- `checkpoint`: X asks for 2FA, CAPTCHA, account approval, or suspicious-login confirmation.
- `payment_warning`: the right-side payment warning is visible; ignore it unless it blocks posting.
- `payment_blocked`: X blocks posting because of billing/subscription status.
- `missing_media`: the card expects media but no file is staged.
- `media_rejected`: X rejects the selected image or video.
- `media_upload_stalled`: media upload does not reach `Ready`.
- `caption_rejected`: caption is too long, malformed, or rejected.
- `rate_limited`: X blocks the post because of rate or posting limits.
- `settings_required`: card asks for poll, schedule, thread, quote, reply, location, audience, or other settings outside the default trained path.
- `success_missing`: after clicking `Post`, no fresh post appears in the feed.
- `ui_changed`: composer, media attach, `Ready`, `Post`, or success signal is no longer visible in the trained locations.

## Result Contract

After the post is visibly shared, write:

```json
{
  "platform": "x",
  "outcome": "posted",
  "external_url": "X post URL if available",
  "evidence": "screenshot path if captured",
  "route": "browser_home_composer"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-07-03, in chronological order:

```text
/Users/jake/Library/Application Support/CleanShot/media/media_aqQFPxBDEy/CleanShot 2026-07-03 at 15.58.38.png
/Users/jake/Library/Application Support/CleanShot/media/media_ogQ64JGhd0/CleanShot 2026-07-03 at 15.59.46.png
/Users/jake/Library/Application Support/CleanShot/media/media_5kdjwUhjrx/CleanShot 2026-07-03 at 16.00.34.png
/Users/jake/Library/Application Support/CleanShot/media/media_zperfXAYmC/CleanShot 2026-07-03 at 16.01.01.png
```
