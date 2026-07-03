# Facebook Page Posts

Status: trained from Jake's screenshot walkthrough on 2026-06-30.
Live agent proof is still pending.

Use this playbook when Omni Release has a due Facebook card that should publish
to the Make Ship Happen Tech Facebook Page through Jake's signed-in Chrome
session.

## Scope

This flow covers Facebook Page feed posts from the Page composer:

- text-only posts
- image plus text posts
- video plus text posts

This flow does not yet cover:

- Jake's personal profile
- Facebook groups
- Facebook Stories
- Facebook Reels as a separate Reel workflow
- boosted posts or ad setup
- scheduled Facebook publishing through Meta's scheduling UI

If a card asks for one of those untrained surfaces, mark it `needs_attention`
instead of improvising.

## Entry

- URL: `https://www.facebook.com/profile.php?id=61589607458265`
- Required Page identity: `Make Ship Happen Tech`
- Required visible signals:
  - left sidebar says `Manage Page`
  - Page name says `Make Ship Happen Tech`
  - composer is on the Page, not on a personal profile

If the browser is signed into the wrong Facebook account, logged out, or cannot
see the `Make Ship Happen Tech` Page composer, stop and mark `needs_attention`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- caption/text from the card
- media files from the card or staged outbox media folder
- platform instructions from the card

Do not rewrite the caption during publishing. Do not substitute media. If media
is missing or rejected, mark `needs_attention`.

## Default Publish Settings

Unless Jake or the card explicitly says otherwise:

- `Post audience`: `Public`
- `Scheduling options`: `Publish now`
- `Share to groups`: leave unchanged
- `Boost post`: off

Do not open the settings dropdowns or toggle Boost unless the card specifically
requires it.

## Posting Flow

1. Open the Make Ship Happen Tech Facebook Page:

```text
https://www.facebook.com/profile.php?id=61589607458265
```

2. Confirm the Page identity is correct:

```text
Manage Page -> Make Ship Happen Tech
```

3. Click the Page composer field:

```text
What's on your mind?
```

4. When the `Create post` modal opens, click inside the modal text box:

```text
What's on your mind?
```

5. Attach media if the Omni card includes media.

Preferred methods:

- Drag or paste the exact media file into the modal text box / `Drop Photos or
  Videos` area.
- Or click the green `Photo/video` icon in the `Add to your post` row and select
  the exact staged file from the file picker.

If the file picker opens, navigate to the Omni Release file directory or the
card's staged media location and select the exact file attached to the card.
Jake's walkthrough showed the app directory here:

```text
/Users/jake/Documents/Ship Ecosystem/MakeShipHappenCollective/omni-release
```

6. Paste the card caption/text into the composer.

Media and text order does not need to be fragile, but the final post must show
the caption and the correct media preview before continuing.

7. Verify the modal before moving on:

- text is visible
- image/video preview is visible when media exists
- Page identity still says `Make Ship Happen Tech`
- `Next` button is blue/enabled

8. Click `Next`.

9. On `Post settings`, review only. Leave defaults alone unless instructed:

```text
Post audience: Public
Scheduling options: Publish now
Share to groups: unchanged
Boost post: off
```

10. Click the blue `Post` button.

11. If the `Speak With People Directly` pop-up appears, click:

```text
Not now
```

Do not click `Add Button` unless Jake explicitly asks for a call-to-action
button. The post may not complete until this pop-up is dismissed.

12. Confirm success in the Page posts feed.

The success signal from Jake's walkthrough is:

```text
Make Ship Happen Tech
Just now
```

The latest post should show the just-published caption and attached media.

## Success Signal

Treat the Facebook post as published only after the Page feed shows the new post
from `Make Ship Happen Tech` with a fresh timestamp such as:

```text
Just now
```

If a permalink is easy to open, capture it as `external_url`. If the permalink
is not easily available, use the Page URL as fallback evidence and save a
screenshot of the visible `Just now` post.

## Known Gates

- `logged_out`: Facebook asks for login.
- `wrong_identity`: browser is not acting as a user/page that can post to `Make Ship Happen Tech`.
- `checkpoint`: Meta security checkpoint, 2FA, suspicious login, or CAPTCHA.
- `missing_media`: the card expects media but no file is staged.
- `media_rejected`: Facebook rejects or fails to attach the selected file.
- `settings_required`: card asks for audience, schedule, groups, boost, or other settings outside the default trained path.
- `cta_popup`: `Speak With People Directly` appears; click `Not now` and continue.
- `ui_changed`: composer, `Next`, `Post`, or confirmation signals are no longer visible in the trained locations.
- `post_not_visible`: after clicking `Post` and handling pop-ups, no fresh `Just now` post appears.

## Result Contract

After the post is visibly published, write:

```json
{
  "platform": "facebook",
  "outcome": "posted",
  "external_url": "facebook post URL if available",
  "evidence": "screenshot path if captured"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-06-30, in chronological order:

```text
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 11.50.07.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 11.50.19.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 11.57.21.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 11.59.29.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.00.54.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.01.45.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.02.42.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.04.25.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.05.19.png
/Users/jake/Desktop/Facebook/CleanShot 2026-06-30 at 12.06.27.png
```
