# Omni Release Accomplishments

This ledger keeps the timeline clear for Jake and any future agent. It records
what has been proven, what changed, and what should happen next.

## Current State

- Browser publishing bridge exists and uses the outbox contract.
- Agent Queue can stage due cards with exact captions, media, and instructions.
- Chrome/Profile-first publishing is the preferred route.
- YouTube Community image/text posting has been proven live.
- Platform playbooks now exist for durable training memory.
- Facebook Page-post screenshot training is documented; live proof is next.
- Instagram Reels are trained for the Meta Graph route; live proof is next.
- Instagram browser feed-post screenshot training is documented; live proof is next.
- Rumble video-upload screenshot training is documented; live proof is next.
- X browser-post screenshot training is documented; live proof is next.
- LinkedIn browser profile-post screenshot training is documented; live proof is next.
- TikTok Studio video-upload screenshot training is documented; live proof is next.
- Omni Release Operators and Loops now include trained Instagram Browser Feed, TikTok Studio Upload, Rumble Video Upload, X Browser Post, and LinkedIn Browser Profile agents.

## Timeline

| Date | Area | Accomplishment | Evidence |
| --- | --- | --- | --- |
| 2026-06-30 | YouTube | Published the first real YouTube Community image/text post from Omni Release through Jake's signed-in Chrome session. | `outbox/archive/job_59262db054194a6ba68b955a4550c583/screenshot.png` |
| 2026-06-30 | YouTube | Learned YouTube Community image posts require aspect ratio between `2:5` and `5:2`; created padded `_youtube.jpg` derivative. | `docs/platform-playbooks/youtube-community-post.md` |
| 2026-06-30 | Chrome | Confirmed Chrome Apple Events JavaScript control is required for smooth signed-in tab automation. | `docs/platform-playbooks/youtube-community-post.md` |
| 2026-06-30 | Agent Queue | Confirmed Omni ingests `posted` results, marks target/post published, archives handoff, and clears queue. | `docs/AGENT-BRIDGE.md` |
| 2026-06-30 | Training System | Added durable platform-training docs and playbook structure. | `docs/PLATFORM-TRAINING.md` |
| 2026-06-30 | Facebook | Captured Jake's Page-post screenshot training flow, including composer entry, media attach, Post settings, CTA pop-up handling, and `Just now` success confirmation. | `docs/platform-playbooks/facebook-post.md` |
| 2026-06-30 | Loops | Added the loop orchestration model and copy-ready prompts for watchdog, human gate retry, training, proof verification, queue cleanup, and execution contracts. | `docs/LOOP-ORCHESTRATION.md` |
| 2026-06-30 | Agents Only | Added portable platform-worker prompts inside Loops, starting with Facebook Page Agent, YouTube Community Agent, and a form to integrate custom trained prompts. | `app/src/views/Loops.tsx` |
| 2026-06-30 | AI Platform Adapters | Added Claude, OpenAI/Codex, DeepSeek, and Gemini adapter prompts so the same Omni Release loop can be handed to different agent platforms in their own instruction style. | `app/src/views/Loops.tsx` |
| 2026-06-30 | Operator Agency | Added the Operators control center with system operators, trained platform operators, training-needed platform operators, playbook links, and copyable operator prompts. | `docs/OPERATOR-AGENCY.md` |
| 2026-07-03 | Instagram | Trained the Instagram Operator for Omni Release's Meta Graph Reels route, including required `igUserId`, public `mediaUrl`, gates, result contract, and browser-proof limits. | `docs/platform-playbooks/instagram-post.md` |
| 2026-07-03 | Rumble | Captured Jake's Rumble video-upload screenshot training flow, including upload entry, video info, 100% upload wait, licensing, terms boxes, submit, and direct-link success signal. | `docs/platform-playbooks/rumble-video-upload.md` |
| 2026-07-03 | Instagram | Captured Jake's Instagram browser feed-post screenshot training flow, including create menu, media selection, crop/edit next steps, caption, share, and `Post shared` success signal. | `docs/platform-playbooks/instagram-browser-post.md` |
| 2026-07-03 | Operator Agency | Integrated the trained Instagram Browser Feed and Rumble Video Upload operators into the Omni Release Operators screen, Loops worker prompts, and agency docs. | `app/src/views/Operators.tsx`, `app/src/views/Loops.tsx`, `docs/OPERATOR-AGENCY.md` |
| 2026-07-03 | X | Captured Jake's X browser-post screenshot training flow, including Home composer entry, media upload wait, final `Post`, and fresh timestamp success signal. | `docs/platform-playbooks/x-post.md` |
| 2026-07-03 | Operator Agency | Integrated the trained X Operator into the Omni Release Operators screen, Loops worker prompts, and agency docs. | `app/src/views/Operators.tsx`, `app/src/views/Loops.tsx`, `docs/OPERATOR-AGENCY.md` |
| 2026-07-03 | LinkedIn | Captured Jake's LinkedIn browser profile-post screenshot training flow, including Home composer entry, media editor `Next`, final `Post`, upload/processing wait, and `Jacob Felton · You · now` success signal. | `docs/platform-playbooks/linkedin-post.md` |
| 2026-07-03 | Operator Agency | Integrated the trained LinkedIn Operator into the Omni Release Operators screen, Loops worker prompts, and agency docs. | `app/src/views/Operators.tsx`, `app/src/views/Loops.tsx`, `docs/OPERATOR-AGENCY.md` |
| 2026-07-03 | TikTok | Captured Jake's TikTok Studio video-upload screenshot training flow, including upload entry, automatic checks pop-up, editing pop-up, 100% wait, description, checks, final `Post`, and `Content under review` success signal. | `docs/platform-playbooks/tiktok-upload.md` |
| 2026-07-03 | Operator Agency | Integrated the trained TikTok Operator into the Omni Release Operators screen, Loops worker prompts, and agency docs. | `app/src/views/Operators.tsx`, `app/src/views/Loops.tsx`, `docs/OPERATOR-AGENCY.md` |

## Platform Training Status

| Platform | Status | Next Step |
| --- | --- | --- |
| YouTube Community Posts | Trained and live-proven | Convert successful manual-control recipe into a repeatable runner recipe. |
| YouTube Video Upload | Not trained | Train separately through YouTube Studio upload. |
| Facebook Page Posts | Trained from screenshots; live proof pending | Run a real Agent Queue Facebook card and verify posted result plus queue clear. |
| Instagram Reels | Trained for Meta Graph route; live proof pending | Run a real Agent Queue Instagram Reel proof and verify returned media id plus queue clear. |
| Instagram Browser Feed Posts | Trained from screenshots; live proof pending | Run a real Agent Queue Instagram browser-feed card and verify `Post shared` plus queue clear. |
| TikTok Studio Video Uploads | Trained from screenshots; live proof pending | Run a real Agent Queue TikTok video card and verify `Content under review` plus queue clear. |
| LinkedIn Profile Posts | Trained from screenshots; live proof pending | Run a real Agent Queue LinkedIn profile card and verify `Jacob Felton · You · now` plus queue clear. |
| X / Twitter | Trained from screenshots; live proof pending | Run a real Agent Queue X card and verify fresh timestamp result plus queue clear. |
| Rumble Video Uploads | Trained from screenshots; live proof pending | Run a real Agent Queue Rumble video card and verify direct-link result plus queue clear. |

## Open Improvements

- Add a one-click `Train Platform` mode in Omni Release.
- Add a playbook status panel inside Agent Queue.
- Add automatic media normalization per platform before upload.
- Add platform-specific runner recipes after each training session.
- Add a retry loop that uses each playbook's known gates and success signals.

## Next Session

Target: Rumble live proof or Instagram live proof.

Goal: run a real due card through the Agent Queue, publish through the trained
route, confirm the platform success signal, and verify the queue clears.
