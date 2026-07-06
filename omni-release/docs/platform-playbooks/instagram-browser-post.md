# Instagram Browser Feed Posts

Status: trained from Jake's screenshot walkthrough on 2026-07-03.
Live agent proof is still pending.

Use this playbook when Omni Release has a due Instagram card that should publish
through Instagram's web composer in Jake's signed-in Chrome session.

## Scope

This flow covers Instagram web composer posts:

- single image feed posts
- single video feed posts when Instagram accepts the file through `Post`
- caption/text
- default crop
- default filter/edit pass
- final share

This flow does not yet cover:

- Instagram Reels through the browser composer
- Instagram Stories
- Instagram Live
- Instagram Ads
- carousels / multiple media items
- collab posts
- location tagging
- people tagging
- custom accessibility alt text
- advanced settings changes
- automatic sharing to Threads

If a card asks for one of those untrained options, mark it `needs_attention`
unless Jake has provided exact instructions in the card.

For the Meta Graph Reels API route, use:

```text
docs/platform-playbooks/instagram-post.md
```

## Entry

- Primary URL: `https://www.instagram.com/`
- Required account/session: Jake's signed-in Instagram account in Chrome.
- Required account signal: `makeshiphappentech2026` / `MSH Tech` is visible.
- Composer entry: left sidebar plus/create button.

If Instagram is logged out, asks for a checkpoint, or shows the wrong account,
mark the job `needs_attention`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- media file from the card or staged outbox media folder
- caption/text from the card
- hashtags from the card, if included
- any explicit account or settings instructions

Do not rewrite the caption. Do not substitute media. If media is missing or
Instagram rejects it, mark `needs_attention`.

## Default Publish Settings

Unless Jake or the card explicitly says otherwise:

- Use the `Post` composer, not `Live video` or `Ad`.
- Use the default crop after upload.
- Use the default `Original` filter/edit state.
- Do not add location.
- Do not add collaborators.
- Do not open or edit Accessibility.
- Do not change Advanced settings.
- Leave `Hide like and view counts on this post` off.
- Leave `Turn off commenting` off.
- Leave `Automatically share to Threads` off unless explicitly requested.

## Posting Flow

1. Open Instagram in Jake's signed-in Chrome session:

```text
https://www.instagram.com/
```

2. Confirm the correct account is visible:

```text
makeshiphappentech2026
MSH Tech
```

3. Click the left sidebar plus/create button.

4. In the `Create` menu, click:

```text
Post
```

Do not choose `Live video` or `Ad` for this trained flow.

5. In the `Create new post` modal, click:

```text
Select from computer
```

Then select the exact media file staged by Omni Release.

6. After the image or video loads, Instagram shows the `Crop` step. Leave the
default crop unless the card says otherwise, then click:

```text
Next
```

7. Instagram shows the `Edit` step with filters. Leave `Original` / default edit
settings unless the card says otherwise, then click:

```text
Next
```

8. On the final `Create new post` screen, click the caption box beside the
account name and paste the exact Omni Release caption.

Visible caption character limit from the walkthrough:

```text
2,200
```

9. Do not change `Add location`, `Add collaborators`, `Accessibility`, or
`Advanced settings` unless the card explicitly instructs it.

10. Click:

```text
Share
```

11. Wait for the completion screen.

The success signal from Jake's walkthrough is:

```text
Post shared
Your post has been shared.
Done
```

12. Click `Done` after the success message is visible.

## Success Signal

Treat the Instagram post as published only after the modal shows:

```text
Post shared
Your post has been shared.
```

Then capture screenshot proof. If a permalink is easy to open from the profile
or post view, capture it as `external_url`; otherwise use the Instagram account
URL as fallback evidence.

## Known Gates

- `logged_out`: Instagram asks for login.
- `wrong_identity`: visible account is not `makeshiphappentech2026` / `MSH Tech`.
- `checkpoint`: Instagram asks for 2FA, CAPTCHA, account approval, or
  suspicious-login confirmation.
- `missing_media`: the card expects media but no file is staged.
- `media_rejected`: Instagram rejects the selected image or video.
- `crop_required`: Instagram requires an untrained crop/aspect decision.
- `caption_rejected`: caption is too long, malformed, or rejected.
- `settings_required`: card asks for location, collaborators, alt text,
  comments, like/view counts, Threads sharing, or other settings outside the
  default trained path.
- `share_failed`: after clicking `Share`, Instagram shows an upload/share error.
- `success_missing`: no `Post shared` completion screen appears.
- `ui_changed`: plus/create button, `Post`, `Select from computer`, `Next`,
  `Share`, or success modal is no longer visible in the trained locations.

## Result Contract

After the post is visibly shared, write:

```json
{
  "platform": "instagram",
  "outcome": "posted",
  "external_url": "instagram post URL if available",
  "evidence": "screenshot path if captured",
  "route": "browser_feed_post"
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code and human-readable reason.

## Training Sources

Jake provided this screenshot walkthrough on 2026-07-03, in chronological order:

```text
/Users/jake/Library/Application Support/CleanShot/media/media_rh8wMJvjSP/CleanShot 2026-07-03 at 15.45.13.png
/Users/jake/Library/Application Support/CleanShot/media/media_8YorhaDBcc/CleanShot 2026-07-03 at 15.45.23.png
/Users/jake/Library/Application Support/CleanShot/media/media_Pn653GrrUr/CleanShot 2026-07-03 at 15.45.29.png
/Users/jake/Library/Application Support/CleanShot/media/media_HU7Z1fg9Si/CleanShot 2026-07-03 at 15.45.35.png
/Users/jake/Library/Application Support/CleanShot/media/media_TZDxL5rBdR/CleanShot 2026-07-03 at 15.45.44.png
/Users/jake/Library/Application Support/CleanShot/media/media_uDKMS74Zx8/CleanShot 2026-07-03 at 15.45.54.png
/Users/jake/Library/Application Support/CleanShot/media/media_SpsVWk5hza/CleanShot 2026-07-03 at 15.46.08.png
/Users/jake/Library/Application Support/CleanShot/media/media_ajjOIamkdg/CleanShot 2026-07-03 at 15.46.14.png
```
