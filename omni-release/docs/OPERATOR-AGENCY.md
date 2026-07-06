# Operator Agency

Omni Release has three different layers:

```text
Agent Queue = what needs to ship
Operators = who knows how to ship it
Platform playbooks = exact browser steps and proof rules
```

The Agent Queue stays the source of truth. Operators should never invent a post
or publish from memory. They only act when Omni Release creates an
`outbox/due/<job_id>/card.json` handoff.

## Operator Chain

```text
Queue Watchdog Operator
  checks Agent Queue
  does nothing if empty
  selects oldest due card

Multi-Platform Release Coordinator
  treats one release card as the parent
  tracks every selected platform target independently
  keeps moving if one platform is blocked

Platform Operator
  reads exact card data
  follows the matching platform playbook
  publishes through the signed-in browser

Proof Verifier Operator
  confirms visible success signal
  writes posted result only after proof

Human Gate Operator
  marks needs_attention for login, 2FA, CAPTCHA, missing media, or UI changes
  keeps the due card live for resume
```

## Platform Coverage

| Operator | Status | Playbook |
| --- | --- | --- |
| Queue Watchdog Operator | Trained | `docs/AGENT-BRIDGE.md` |
| Multi-Platform Release Coordinator | Trained | `docs/OPERATOR-AGENCY.md` |
| Proof Verifier Operator | Trained | `docs/AGENT-BRIDGE.md` |
| Human Gate Operator | Trained | `docs/AGENT-BRIDGE.md` |
| YouTube Community Operator | Live proven | `docs/platform-playbooks/youtube-community-post.md` |
| Facebook Page Operator | Trained, live proof pending | `docs/platform-playbooks/facebook-post.md` |
| Instagram Reels Operator | Trained, live proof pending | `docs/platform-playbooks/instagram-post.md` |
| Instagram Browser Feed Operator | Trained, live proof pending | `docs/platform-playbooks/instagram-browser-post.md` |
| TikTok Operator | Trained, live proof pending | `docs/platform-playbooks/tiktok-upload.md` |
| LinkedIn Operator | Trained, live proof pending | `docs/platform-playbooks/linkedin-post.md` |
| X Operator | Trained, live proof pending | `docs/platform-playbooks/x-post.md` |
| Rumble Operator | Trained, live proof pending | `docs/platform-playbooks/rumble-video-upload.md` |
| Twitch Operator | Off | `docs/platform-playbooks/twitch.md` |

## Operator Rules

- Agent Queue is the boss.
- Empty queue means do nothing.
- Oldest due card goes first.
- One release card can have many platform targets.
- Every platform target is posted and verified separately.
- Captions are exact.
- Media files are exact.
- The platform playbook owns the browser steps.
- Human gates become `needs_attention`.
- Proof is required before `posted`.
- A blocked platform must not stop other due platform targets.
- The parent release clears only after every selected platform target is terminal.
- Omni Release remains the only writer to `omni.db`.
- Agents write results only under `outbox/done/`.

## Training Rule

If a platform operator is marked `training_needed`, it must not publish
autonomously. Run Platform Training Mode first, update the platform playbook, and
then run one real Agent Queue proof before calling it trained.
