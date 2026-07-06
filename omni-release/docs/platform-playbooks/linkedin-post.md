# LinkedIn Browser Profile Posts

Status: trained from Jake's screenshot walkthrough on 2026-07-03.
Live agent proof is still pending.

Use this playbook when Omni Release has a due LinkedIn card that should publish
through LinkedIn's web composer in Jake's signed-in Chrome session.

## Scope

This flow covers LinkedIn profile posts from the Home composer:

- text-only profile posts
- image plus text profile posts
- video plus text profile posts

This flow does not yet cover:

- LinkedIn company Page posts
- newsletters
- articles
- polls
- events
- jobs
- boosted posts or ads
- document/carousel posts
- multi-image carousel behavior
- custom subtitles/captions beyond the default editor

If a card asks for one of those untrained options, mark it `needs_attention`
unless Jake has provided exact instructions in the card.

## Entry

- Primary URL: `https://www.linkedin.com/feed/`
- Required account/session: Jake's signed-in LinkedIn account in Chrome.
- Required identity: `Jacob Felton`.
- Required visible profile signal:

```text
Jacob Felton
Founder & CEO at MakeShipHappen.Tech
```

The trained flow posts as Jake's personal LinkedIn profile. It does not post as
the `MakeShipHappen.Tech` company Page unless Jake trains that separately.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- caption/text from the card
- media file from the card or staged outbox media folder, if present
- any explicit visibility/comment settings instructions

Do not rewrite the caption. Do not substitute media. If media is missing or
LinkedIn rejects it, mark `needs_attention`.

## Default Publish Settings

Unless Jake or the card explicitly says otherwise:

- Post identity stays `Jacob Felton`.
- Visibility stays `Post to Anyone`.
- Comments stay `Comments: Anyone`.
- Do not use `Write article`.
- Do not use company Page posting.
- Do not use `Enhance post`.
- Do not change scheduling, audience, comments, tagging, or paid/boost options.
- Use the default media editor; click `Next` without changing crop/captions.

## Posting Flow

1. Open LinkedIn Home in Jake's signed-in Chrome session:

```text
https://www.linkedin.com/feed/
```

2. Confirm the left profile card shows:

```text
Jacob Felton
Founder & CEO at MakeShipHappen.Tech
```

3. Click the Home composer field:

```text
Start a post
```

4. In the post modal, confirm the top identity says:

```text
Jacob Felton
Post to Anyone
Comments: Anyone
```

5. Paste the exact Omni Release caption into:

```text
Share your thoughts ...
```

6. If the card includes media, attach the exact staged image or video file using
the media control in the composer, or the Home composer `Video` / `Photo` entry
when that is the active path.

7. If LinkedIn opens the media `Editor`, review the preview without changing the
default edit settings and click:

```text
Next
```

Do not add captions/subtitles, duplicate media, delete media, or use the plus
button unless the card explicitly asks for it.

8. Back in the post modal, verify:

- caption is present when the card has text
- media preview is visible when the card has media
- identity is still `Jacob Felton`
- visibility is still `Post to Anyone`
- comments are still `Comments: Anyone`
- `Post` button is enabled

9. Click the blue:

```text
Post
```

10. After clicking `Post`, keep the page open and wait for LinkedIn's feed upload
status to complete.

The walkthrough showed:

```text
Uploading... Keep the page open to finish uploading
Processing...
```

Do not mark the job posted while these banners are still visible.

11. Confirm success in the feed.

The success signal from Jake's walkthrough is a fresh feed post showing:

```text
Jacob Felton
You
now
```

with the exact caption and media visible.

## Success Signal

Treat the LinkedIn post as published only after the feed shows the new post from
`Jacob Felton` with `You`, timestamp `now`, and the intended media/caption
visible.

If a permalink is easy to open from the post menu, capture it as `external_url`.
If not, use the LinkedIn feed/profile URL as fallback evidence and save
screenshot proof.

## Known Gates

- `logged_out`: LinkedIn asks for login.
- `wrong_identity`: visible profile is not `Jacob Felton`.
- `company_page_required`: the card asks for a company Page post, which is not trained yet.
- `checkpoint`: LinkedIn asks for 2FA, CAPTCHA, account approval, or suspicious-login confirmation.
- `missing_media`: the card expects media but no file is staged.
- `media_rejected`: LinkedIn rejects the selected image or video.
- `editor_required`: LinkedIn opens an editor screen and the expected `Next` path is unavailable.
- `upload_stalled`: upload progress does not complete.
- `processing_stalled`: LinkedIn remains stuck on `Processing...`.
- `caption_rejected`: caption is too long, malformed, or rejected.
- `settings_required`: card asks for audience, comments, company Page, tag people, schedule, boost, article, poll, or other settings outside the default trained path.
- `success_missing`: after upload/processing, no fresh `Jacob Felton · You · now` post appears.
- `ui_changed`: `Start a post`, composer, media editor, `Post`, upload banner, or success signal is no longer visible in the trained locations.

## Result Contract

After the post is visibly shared, write:

```json
{
  "platform": "linkedin",
  "outcome": "posted",
  "external_url": "LinkedIn post URL if available",
  "evidence": "screenshot path if captured",
  "route": "browser_profile_post"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-07-03, in chronological order:

```text
/Users/jake/Library/Application Support/CleanShot/media/media_NkeydBWOqN/CleanShot 2026-07-03 at 16.02.52.png
/Users/jake/Library/Application Support/CleanShot/media/media_fqbCPzV6Mp/CleanShot 2026-07-03 at 16.03.37.png
/Users/jake/Library/Application Support/CleanShot/media/media_ivzB3lJFjc/CleanShot 2026-07-03 at 16.05.01.png
/Users/jake/Library/Application Support/CleanShot/media/media_90Uw2L52Sn/CleanShot 2026-07-03 at 16.05.20.png
/Users/jake/Library/Application Support/CleanShot/media/media_MCzPTrXTwh/CleanShot 2026-07-03 at 16.05.27.png
/Users/jake/Library/Application Support/CleanShot/media/media_uJ5c8PoDEL/CleanShot 2026-07-03 at 16.05.33.png
/Users/jake/Library/Application Support/CleanShot/media/media_NF0A2pdPON/CleanShot 2026-07-03 at 16.06.00.png
```
