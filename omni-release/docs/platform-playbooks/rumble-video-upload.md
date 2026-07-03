# Rumble Video Uploads

Status: trained from Jake's screenshot walkthrough on 2026-07-03.
Live agent proof is still pending.

Use this playbook when Omni Release has a due Rumble card that should upload a
video through Jake's signed-in Chrome session.

## Scope

This flow covers Rumble video uploads through the standard `Upload Video` page:

- video file upload
- title
- description
- primary and secondary category
- optional auto-generated thumbnail choice
- visibility selection
- licensing option
- terms acceptance
- final submit

This flow does not yet cover:

- Rumble livestreams
- Rumble Studio
- Rumble Shorts-specific related video setup
- advanced syndication options
- additional video information accordions
- custom thumbnail upload
- scheduled publishing beyond selecting the visible `Scheduled` option

If a card asks for one of those untrained options, mark it `needs_attention`
unless Jake has provided exact instructions in the card.

## Entry

- Primary URL: `https://rumble.com/`
- Required account/session: Jake's signed-in Rumble account in Chrome.
- Entry signal: top-right green create/upload icon is visible next to the
  notification bell and account avatar.

If Rumble is logged out, asks for 2FA/CAPTCHA, or the upload icon is not
available, mark the job `needs_attention`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- video file from the card or staged outbox media folder
- video title from the card
- video description from the card
- category instructions from the card
- visibility instructions from the card
- tags if the card provides them

Do not rewrite the title or description during publishing. Do not substitute the
video file. If the video file is missing or rejected, mark `needs_attention`.

## Default Upload Settings

Unless Jake or the card explicitly says otherwise:

- Fill title from the card.
- Fill description from the card.
- Select the card's primary category.
- Select a secondary category when the card provides one or Rumble requires it.
- Skip custom thumbnail upload.
- Leave `Feature video on the top of your profile` unchecked.
- Visibility defaults to `Public` unless the card says `Unlisted`, `Private`, or
  `Scheduled`.
- Leave `Send mobile push notification to followers` unchecked unless the card
  explicitly says to send it.
- Licensing option: use `Rumble Only` when no other licensing option is
  specified.
- Do not open additional video information or syndication accordions unless the
  card explicitly requires them.

## Upload Flow

1. Open Rumble in Jake's signed-in Chrome session:

```text
https://rumble.com/
```

2. Click the green create/upload icon in the top-right header.

3. In the dropdown, click:

```text
Upload Video
```

4. On the upload page, click or drop the exact staged video file into:

```text
SELECT VIDEO TO UPLOAD
```

Visible upload constraints from Jake's walkthrough:

```text
Maximum file size: 15 GB
Videos 3 minutes or less with a vertical aspect ratio will automatically be created as a Rumble Short
```

5. Fill the `Video info` fields on the right side:

```text
Video Title
Video Description
Primary category
Secondary category, if required or provided
Tags, if provided
```

Jake's walkthrough says to skip thumbnail customization in this default flow.
Use Rumble's generated thumbnails unless the card gives explicit thumbnail
instructions.

6. Wait for the video upload progress to reach:

```text
100%
```

Do not click the first green `Upload` button while the upload is still in
progress.

7. Confirm the required fields are filled and the upload is at `100%`.

If a red validation message appears under categories, choose/fix the required
category fields before continuing. Jake's walkthrough showed Rumble requiring at
least one category.

8. Click the green page button:

```text
Upload
```

9. On the licensing page, choose the correct licensing option.

Default trained choice:

```text
Rumble Only
```

This is the non-exclusive option Jake showed selected in the walkthrough. Do not
select exclusive video management or personal use unless the card says to.

10. In `Terms and conditions`, check both boxes:

```text
You have not signed an exclusive agreement with any other parties.
Check here if you agree to our terms of service.
```

11. Click:

```text
Submit
```

12. Confirm completion on the final page.

The success signal from Jake's walkthrough is:

```text
VIDEO UPLOAD COMPLETE!
Direct Link
```

The page should show a direct Rumble URL such as:

```text
https://rumble.com/v7c7olk-gndf.html
```

Capture that direct link as the `external_url`.

## Success Signal

Treat the upload as published only after the final page shows:

```text
VIDEO UPLOAD COMPLETE!
```

Then capture:

- direct link
- screenshot proof
- visible title if available

## Known Gates

- `logged_out`: Rumble asks for login.
- `checkpoint`: 2FA, CAPTCHA, suspicious login, or account security prompt.
- `missing_video`: the card expects a video but no file is staged.
- `video_rejected`: Rumble rejects the selected file.
- `upload_stalled`: progress does not reach `100%` after a reasonable retry window.
- `required_fields`: title, description, category, or other required field is missing.
- `category_required`: Rumble shows a validation warning under categories.
- `licensing_required`: licensing page appears and required licensing choice or terms boxes are not complete.
- `terms_required`: either of the two terms checkboxes is not accepted.
- `ui_changed`: upload icon, upload form, licensing page, submit button, or completion page is no longer visible in the trained locations.
- `success_missing`: after `Submit`, no `VIDEO UPLOAD COMPLETE!` page appears.

## Result Contract

After the upload is visibly complete, write:

```json
{
  "platform": "rumble",
  "outcome": "posted",
  "external_url": "direct Rumble video URL",
  "evidence": "screenshot path if captured"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-07-03, in chronological order:

```text
/Users/jake/Library/Application Support/CleanShot/media/media_Xz9GKhD2qF/CleanShot 2026-07-03 at 15.33.24.png
/Users/jake/Library/Application Support/CleanShot/media/media_oKQZcDV0Wd/CleanShot 2026-07-03 at 15.34.03.png
/Users/jake/Library/Application Support/CleanShot/media/media_aLTeEqxMpP/CleanShot 2026-07-03 at 15.35.00.png
/Users/jake/Library/Application Support/CleanShot/media/media_CHvjpXgYKz/CleanShot 2026-07-03 at 15.35.43.png
/Users/jake/Library/Application Support/CleanShot/media/media_yFMVOLyMxV/CleanShot 2026-07-03 at 15.37.03.png
/Users/jake/Library/Application Support/CleanShot/media/media_5NYWcgPAII/CleanShot 2026-07-03 at 15.37.48.png
/Users/jake/Library/Application Support/CleanShot/media/media_JleX0SubKX/CleanShot 2026-07-03 at 15.40.00.png
/Users/jake/Library/Application Support/CleanShot/media/media_MTW6vujQfc/CleanShot 2026-07-03 at 15.40.04.png
/Users/jake/Library/Application Support/CleanShot/media/media_Njz9YVAY1t/CleanShot 2026-07-03 at 15.41.15.png
/Users/jake/Library/Application Support/CleanShot/media/media_8rGSb3jXpq/CleanShot 2026-07-03 at 15.41.49.png
```
