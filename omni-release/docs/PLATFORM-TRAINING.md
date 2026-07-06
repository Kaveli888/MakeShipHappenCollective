# Platform Training — Browser Publishing Playbooks

This is the durable training memory for Omni Release browser publishing.

Jake can teach a platform by showing the logged-in browser flow once. The agent
turns that walkthrough into a platform playbook: exact URLs, buttons, media
rules, gates, success signals, and recovery steps. New agents should read this
file first, then the relevant file under `docs/platform-playbooks/`.

For the smooth session rhythm, read `docs/TRAINING-RHYTHM.md`. For the progress
timeline, read `docs/ACCOMPLISHMENTS.md`. For reusable agent loops, read
`docs/LOOP-ORCHESTRATION.md`.

## Training Method

1. Open Chrome in the correct Jake/MakeShipHappen profile.
2. Open Omni Release Agent Queue and the platform page for the due card.
3. Jake demonstrates the publish path once, slowly enough for the agent to
   capture each screen, click, field, and decision.
4. The agent records:
   - entry URL
   - account/profile/page identity
   - post type being trained
   - composer open path
   - text field behavior
   - media upload behavior
   - media constraints
   - final publish button
   - success signal after publish
   - common blockers and recovery steps
5. The agent updates the platform playbook immediately after the walkthrough.
6. The next automated run follows the playbook before experimenting.

## Hard Rules

- Do not store raw passwords, backup codes, recovery codes, or private cookies.
- Do not switch Chrome profiles during publishing.
- Prefer the existing signed-in Chrome session over isolated automation profiles.
- If a platform asks for 2FA, CAPTCHA, checkpoint, suspicious-login approval, or
  page ownership confirmation, mark the job `needs_attention`.
- Never clear an Agent Queue card until the platform shows a visible success
  signal and Omni Release has a written `posted` result.
- If a media file fails platform requirements, create a platform-safe derivative
  in the staged media folder and update the card before retrying.

## Playbook Index

- [Playbook Template](platform-playbooks/_template.md)
- [YouTube Community Posts](platform-playbooks/youtube-community-post.md)
- [Facebook Posts](platform-playbooks/facebook-post.md)
- [Instagram Reels](platform-playbooks/instagram-post.md)
- [Instagram Browser Feed Posts](platform-playbooks/instagram-browser-post.md)
- [TikTok Studio Video Uploads](platform-playbooks/tiktok-upload.md)
- [Rumble Video Uploads](platform-playbooks/rumble-video-upload.md)
- [X Browser Posts](platform-playbooks/x-post.md)
- [LinkedIn Browser Profile Posts](platform-playbooks/linkedin-post.md)
- [Loop Orchestration](LOOP-ORCHESTRATION.md)

## Training Capture Template

Use this structure for each new platform or post type.

```text
Platform:
Post type:
Primary URL:
Required account/page:
Supported media:
Unsupported media:
Known media constraints:
Composer entry:
Caption field:
Media attach:
Preview checks:
Final publish:
Success signal:
Result external_url:
Needs-human gates:
Retry behavior:
Notes:
```

## Agent Queue Contract

Each platform playbook assumes the app has already staged a due card:

```text
outbox/due/<job_id>/card.json
outbox/due/<job_id>/media/<file>
```

The agent should read the card, open the platform URL in Jake's normal Chrome
profile, publish from that active session, then write:

```text
outbox/done/<job_id>.result.json
outbox/done/<job_id>.png
```

See `docs/AGENT-BRIDGE.md` for the full file bridge contract.
