# YouTube Community Posts

Status: trained from a successful real publish on 2026-06-30.

## Scope

Use this playbook for YouTube image/text community posts from the
MakeShipHappenTech channel. Do not use this flow for video uploads.

## Entry

- URL: `https://www.youtube.com/@MakeShipHappenTech/posts`
- Chrome profile: Jake's normal signed-in MakeShipHappen Chrome session.
- Account/channel signal: page header shows `MakeShipHappenTech`.
- Surface: channel `Posts` tab.

## Card Routing

Use this flow when:

```json
"platform": "youtube",
"options": {
  "publishSurface": "youtube_community_post",
  "youtubeSurface": "posts"
}
```

Use YouTube Studio upload only when media is video and the card says
`youtube_video_upload`.

## Composer

Visible page signals:

- `Give a shoutout! Type @ to mention a channel`
- buttons: `Image`, `Image poll`, `Text poll`, `Video`, `Quiz`, `Post`
- tabs below composer: `PUBLISHED`, `SCHEDULED`, `ARCHIVED`

Flow:

1. Open the channel Posts URL.
2. Click `Image` for image/text posts.
3. Fill `ytd-commentbox #contenteditable-root` with the card caption.
4. Attach the image through YouTube's image file input.
5. Wait for image preview and enabled `Post` button.
6. Click `Post`.
7. Confirm the new post appears at the top of `PUBLISHED`.

## Media Rules

YouTube Community image posts reject very wide or very tall images.

Observed page copy:

```text
Upload an image with an aspect ratio between 2:5 and 5:2
```

If the staged image is outside that range, make a platform-safe derivative before
uploading. Do not crop text-heavy screenshots unless Jake asks. Prefer white
padding so the source content remains intact.

Successful example:

- Original: `2048x654` (`1024:327`), too wide.
- Fixed derivative: `2048x820` (`512:205`), accepted by YouTube.
- File suffix used: `_youtube.jpg`.

## Success Signal

A successful post appears at the top of the Posts page with:

- channel name `MakeShipHappenTech`
- timestamp like `0 seconds ago`
- the posted caption text
- attached image preview

After this is visible, write `outbox/done/<job_id>.result.json` with:

```json
{
  "platform": "youtube",
  "outcome": "posted",
  "external_url": "https://www.youtube.com/@MakeShipHappenTech/posts"
}
```

Also capture screenshot proof to `outbox/done/<job_id>.png`.

## Known Gates

- Wrong Google account/profile: use `npm run agent:tabs` or Agent Queue
  `Open due tabs`, which opens Jake's normal signed-in Chrome session.
- Chrome automation blocked: enable Chrome menu
  `View > Developer > Allow JavaScript from Apple Events`.
- Image aspect ratio rejected: create a padded `_youtube.jpg` derivative.
- File picker blocked by synthetic clicks: use the page file input if Chrome
  allows JavaScript control; otherwise mark `needs_attention`.

## Notes From First Successful Run

The first real post was published on 2026-06-30 from job:

```text
job_59262db054194a6ba68b955a4550c583
```

The post caption began:

```text
The Trump administration is close to restoring Fable 5 access.
```

The flow proved the account-safe model works: Omni stages the card, Chrome opens
the correct signed-in page, the agent fills and posts, then Omni ingests the
result and clears Agent Queue.
