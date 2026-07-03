# Instagram Reels

Status: trained for Omni Release's Meta Graph Reels route on 2026-07-03.
Live agent proof is still pending. Instagram browser feed posts are trained in
`docs/platform-playbooks/instagram-browser-post.md`.

Use this playbook when Omni Release has a due Instagram card that should publish
a Reel through the connected Meta/Instagram account.

## Scope

This flow covers:

- Instagram Reels from video media
- official Meta Graph publishing through Omni Release
- browser use for account checkpoints and visible proof

This flow does not yet cover:

- image-only feed posts
- carousels
- Stories
- manual browser composer posting; use
  `docs/platform-playbooks/instagram-browser-post.md` for trained browser feed
  posts
- collab posts
- boosted posts or ads
- music/audio selection inside Instagram

If a card asks for one of those untrained surfaces, mark it `needs_attention`
instead of improvising.

## Entry

- App surface: Omni Release Composer / Agent Queue
- Platform target: `instagram`
- Browser proof URL: `https://www.instagram.com/`
- Required account identity: Jake's intended MakeShipHappen Instagram account
- Required connected account: Instagram provider connected through the Meta app

Required target options:

```json
{
  "platform": "instagram",
  "options": {
    "igUserId": "Instagram Business or Creator account id",
    "mediaUrl": "https://publicly-reachable-video-url.mp4"
  }
}
```

If `igUserId` or `mediaUrl` is missing, stop and mark `needs_attention` with
`missing_ig_params`.

## Source Inputs

Read the due card from Omni Release and use the exact staged payload:

- caption from the card
- hashtags from the card
- video media from the card
- `options.igUserId`
- `options.mediaUrl`

Do not rewrite the caption. Do not substitute media. Do not publish from memory.

## Publishing Flow

1. Confirm the due card platform is `instagram`.
2. Confirm the card has video media. Instagram text-only and image-only cards are
   outside this trained path.
3. Confirm `options.igUserId` is present.
4. Confirm `options.mediaUrl` is present, public, and points to the intended
   staged or hosted video asset.
5. Send the exact caption plus hashtags through the Meta Graph Reels route.
6. Create the Instagram media container with:

```text
media_type=REELS
video_url=<options.mediaUrl>
caption=<resolved card caption + hashtags>
```

7. Poll the returned container until `status_code` is `FINISHED`.
8. Publish the container through `media_publish`.
9. Capture the returned media id and external URL.
10. If a browser proof check is available, open Instagram and confirm the new
    Reel appears on the intended account.
11. Write the posted result and screenshot proof.

If the browser bridge opens `instagram.com` and the card explicitly calls for a
browser feed post, use `docs/platform-playbooks/instagram-browser-post.md`.
Otherwise, do not fall back from this Reels API route to the browser composer
without a card instruction.

## Media Rules

- Supported media: one video/Reel asset reachable through a public HTTPS URL.
- Unsupported media: text-only, image-only, carousel, Story, and multi-file cards.
- Preferred shape: vertical Reel-safe video when available.
- Multi-file behavior: unsupported in this trained path.
- Thumbnail behavior: not managed by the current Omni Release Instagram route.
- Platform-safe derivative rule: if the staged video is not the public URL, create
  or select a hosted Instagram-specific derivative first, then set `mediaUrl` to
  that public URL before publishing.

If the media URL is private, expired, localhost-only, points to the wrong asset,
or Meta cannot fetch/process it, mark `needs_attention`.

## Success Signal

For the API route, treat the post as published only after `media_publish` returns
an Instagram media id. Use browser proof as the stronger confirmation when it is
available.

After success, write:

```json
{
  "platform": "instagram",
  "outcome": "posted",
  "external_url": "https://www.instagram.com/reel/<media-id>",
  "external_post_id": "<media-id>",
  "evidence": "screenshot path if captured"
}
```

Also capture screenshot proof to `outbox/done/<job_id>.png` when the browser can
show the posted Reel.

## Known Gates

- `missing_ig_params`: `igUserId` or `mediaUrl` is missing from target options.
- `video_required`: card has no video media.
- `media_url_private`: Meta cannot fetch the supplied public media URL.
- `wrong_identity`: browser proof shows the wrong Instagram account.
- `login_required`: Instagram browser proof requires login.
- `checkpoint`: Meta/Instagram asks for 2FA, CAPTCHA, account approval, or
  suspicious-login confirmation.
- `missing_scope`: connected Meta token does not have Instagram publishing scope.
- `container_timeout`: media container never reaches `FINISHED`.
- `media_rejected`: Instagram rejects the video or caption.
- `wrong_route`: the job requires browser feed-post clicks; use
  `instagram-browser-post.md` instead of this Reels API playbook.
- `proof_not_visible`: API returned an id, but the Reel cannot be confirmed in
  browser proof when proof is required.

## Result Contract

After the Reel is visibly published or the API route returns a successful media
id, write:

```json
{
  "job_id": "<job_id>",
  "platform": "instagram",
  "outcome": "posted",
  "external_url": "https://www.instagram.com/reel/<media-id>",
  "external_post_id": "<media-id>",
  "posted_at": "<iso timestamp>",
  "screenshot": "done/<job_id>.png",
  "error_code": null,
  "error_message": null
}
```

If blocked, write `needs_attention`, keep the due card live, and include the
specific gate code plus a human-readable reason.

## Training Sources

- Jake selected the Instagram Operator for training in Omni Release on 2026-07-03.
- Existing Meta publisher implementation:
  `server/src/core/meta.ts`
- Existing publish router:
  `server/src/core/publish.ts`
- Existing Composer target options:
  `app/src/views/Composer.tsx`
- Existing unit coverage:
  `server/src/core/publishers.test.ts`
