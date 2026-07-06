# TikTok Studio Video Uploads

Status: trained from Jake's screenshot walkthrough on 2026-07-03.
Live agent proof is still pending.

Use this playbook when Omni Release has a due TikTok card that should upload a
video through TikTok Studio in Jake's signed-in Chrome session.

## Scope

This flow covers TikTok Studio video uploads:

- one video file
- description/caption
- default cover processing
- default `Now` posting
- default audience
- content/copyright checks
- final `Post`

This flow does not yet cover:

- TikTok LIVE
- Shop posts
- Stories
- photo posts
- multi-video/carousel behavior
- CapCut/Smart Split editing
- custom sounds
- custom cover editing
- scheduled posts
- drafts
- paid promotion

If a card asks for one of those untrained options, mark it `needs_attention`
unless Jake has provided exact instructions in the card.

## Entry

- Profile URL: `https://www.tiktok.com/@makeshiphappen.tech`
- Studio/upload surface: TikTok Studio `Upload`.
- Required account/session: Jake's signed-in TikTok account in Chrome.
- Required account signal: `MakeShipHappen.Tech` / `makeshiphappen.tech` is visible.
- Composer entry: left sidebar `Upload`.

If TikTok is logged out, asks for a checkpoint, or shows the wrong account, mark
the job `needs_attention`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- video file from the card or staged outbox media folder
- description/caption from the card
- hashtags/mentions if the card includes them
- any explicit schedule/audience/location instructions

Do not rewrite the description. Do not substitute media. If the video is missing
or TikTok rejects it, mark `needs_attention`.

## Default Publish Settings

Unless Jake or the card explicitly says otherwise:

- Use TikTok Studio `Upload`.
- Post timing stays `Now`.
- Audience stays the default selected audience.
- Leave high-quality uploads enabled when it is already enabled.
- Do not add location unless instructed.
- Do not edit cover unless instructed.
- Do not add sounds/text/editing features unless instructed.
- Use automatic music copyright and content checks when TikTok prompts for them.

## Upload Flow

1. Open the TikTok profile or TikTok Studio in Jake's signed-in Chrome session:

```text
https://www.tiktok.com/@makeshiphappen.tech
```

2. Click the left sidebar:

```text
Upload
```

3. On TikTok Studio, click:

```text
Select video
```

Then select the exact staged video file from Omni Release.

Visible upload guidance from Jake's walkthrough:

```text
Maximum size: 30 GB
Video duration: 60 minutes
Recommended file format: mp4
Recommended aspect ratios: 16:9 landscape, 9:16 vertical
```

4. If TikTok asks:

```text
Turn on automatic content checks?
```

click:

```text
Turn on
```

This enables the music copyright check and content check lite.

5. If TikTok shows the `New editing features added` pop-up, click:

```text
Got it
```

6. Wait for the upload percentage to reach `100%`.

Do not click `Post` while the top upload card still shows a percentage such as:

```text
83.11%
```

7. After upload completes, verify the top card says:

```text
Uploaded
```

8. Fill the `Description` box with the exact Omni Release description/caption.

9. Wait for the cover and checks to finish processing.

During processing, TikTok may show:

```text
Cover: Processing...
Music copyright check: Checking in progress.
Content check lite: Checking in progress.
```

Do not post until the required checks show completion or safe status. Jake's
walkthrough showed:

```text
No issues found.
```

10. Verify before publishing:

- video shows `Uploaded`
- description/caption is filled
- cover preview is no longer stuck on `Processing...`
- checks have completed or show no issues
- `When to post` is `Now`
- audience/default settings are unchanged
- `Post` button is enabled

11. Click the pink:

```text
Post
```

12. Confirm completion in TikTok Studio `Posts`.

The success signal from Jake's walkthrough is a new row in the posts table with:

```text
Content under review
```

The row should show the just-uploaded thumbnail/title. TikTok may show the
privacy as `Only me` while content is under review. Treat the row plus `Content
under review` as the platform-accepted completion signal.

## Success Signal

Treat the TikTok upload as complete only after TikTok Studio shows the new post
row with:

```text
Content under review
```

Capture screenshot proof of that row. If TikTok provides an external URL later,
capture it; otherwise use the TikTok Studio post row as evidence.

## Known Gates

- `logged_out`: TikTok asks for login.
- `wrong_identity`: visible account is not `MakeShipHappen.Tech` / `makeshiphappen.tech`.
- `checkpoint`: TikTok asks for 2FA, CAPTCHA, account approval, or suspicious-login confirmation.
- `missing_video`: the card expects video but no file is staged.
- `video_rejected`: TikTok rejects the selected video.
- `upload_stalled`: upload percentage does not reach `100%`.
- `cover_processing_stalled`: cover remains stuck on `Processing...`.
- `checks_prompt`: automatic checks prompt appears; click `Turn on`.
- `editing_features_popup`: new editing features pop-up appears; click `Got it`.
- `music_check_failed`: music copyright check reports an issue.
- `content_check_failed`: content check lite reports an issue.
- `settings_required`: card asks for schedule, location, custom cover, sounds, text, privacy, or other settings outside the default trained path.
- `post_disabled`: `Post` button stays disabled after upload/checks complete.
- `success_missing`: after clicking `Post`, no `Content under review` row appears.
- `ui_changed`: upload button, select video, checks, `Post`, or success row is no longer visible in the trained locations.

## Result Contract

After the upload is visibly accepted, write:

```json
{
  "platform": "tiktok",
  "outcome": "posted",
  "external_url": "TikTok URL if available",
  "evidence": "screenshot path if captured",
  "route": "tiktok_studio_video_upload",
  "review_status": "content_under_review"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-07-03, in chronological order:

```text
/Users/jake/Library/Application Support/CleanShot/media/media_xZ4pvzUgYJ/CleanShot 2026-07-03 at 16.12.23.png
/Users/jake/Library/Application Support/CleanShot/media/media_TBXzC5BwRJ/CleanShot 2026-07-03 at 16.12.31.png
/Users/jake/Library/Application Support/CleanShot/media/media_CvJQTAFuxL/CleanShot 2026-07-03 at 16.12.45.png
/Users/jake/Library/Application Support/CleanShot/media/media_mqIc7Y6H8o/CleanShot 2026-07-03 at 16.12.52.png
/Users/jake/Library/Application Support/CleanShot/media/media_sWmaSRvuoI/CleanShot 2026-07-03 at 16.13.01.png
/Users/jake/Library/Application Support/CleanShot/media/media_A9iTXzogfD/CleanShot 2026-07-03 at 16.13.17.png
/Users/jake/Library/Application Support/CleanShot/media/media_HR02oy5YOf/CleanShot 2026-07-03 at 16.13.22.png
/Users/jake/Library/Application Support/CleanShot/media/media_2xfoOAeeUh/CleanShot 2026-07-03 at 16.18.56.png
/Users/jake/Library/Application Support/CleanShot/media/media_O3oAMCOnTn/CleanShot 2026-07-03 at 16.19.43.png
```
