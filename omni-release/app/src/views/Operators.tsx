import { useMemo, useState } from "react";
import { api } from "../api.js";
import type { PlatformId } from "../types.js";
import { PlatformLogo, platformLabel } from "../components/PlatformLogo.js";

type OperatorStatus = "live_proven" | "trained" | "training_needed" | "off";
type OperatorType = "platform" | "system";

interface OperatorAgent {
  id: string;
  name: string;
  type: OperatorType;
  platform?: PlatformId;
  status: OperatorStatus;
  surface: string;
  playbook: string;
  knows: string[];
  gates: string[];
  next: string;
  prompt: string;
}

const OPERATOR_AGENTS: OperatorAgent[] = [
  {
    id: "queue-watchdog",
    name: "Queue Watchdog Operator",
    type: "system",
    status: "trained",
    surface: "Agent Queue / outbox/due",
    playbook: "docs/AGENT-BRIDGE.md",
    knows: [
      "Check Agent Queue repeatedly",
      "Do nothing when the queue is empty",
      "Pick the oldest due card first",
      "Delegate to the right platform agent",
    ],
    gates: ["No due card", "Unreadable card.json", "Missing platform playbook"],
    next: "Keep tied to the active Codex watchdog automation.",
    prompt: `You are the Omni Release Queue Watchdog Operator.

Rule:
Omni Release Agent Queue is the source of truth. If there is no active card in outbox/due, do not post anything.

Loop:
1. Check outbox/due and Agent Queue.
2. If empty, stop.
3. If cards exist, pick the oldest scheduled card first.
4. Read card.json and staged media.
5. Select the matching platform operator.
6. Hand the work to that platform playbook.
7. After the platform agent writes a result, sync Omni Release.

Never invent a post outside the queue. Never publish from memory.`,
  },
  {
    id: "release-coordinator",
    name: "Multi-Platform Release Coordinator",
    type: "system",
    status: "trained",
    surface: "One release card across many platform targets",
    playbook: "docs/OPERATOR-AGENCY.md",
    knows: [
      "Treat one release card as the parent",
      "Track every selected platform target separately",
      "Keep shipping remaining targets after one platform finishes",
      "Clear the parent only when every target is terminal",
    ],
    gates: ["Mixed target states", "One platform blocked", "One platform trained and another untrained"],
    next: "Use it whenever a release card has multiple selected networks.",
    prompt: `You are the Omni Release Multi-Platform Release Coordinator.

Goal:
Ship one Omni Release card across every selected platform target without mixing results.

Rules:
1. Read the parent release context in card.json.
2. Treat each platform target as its own delivery job.
3. Delegate each target to its matching platform operator.
4. Mark only the platform target that was actually posted.
5. If one platform needs_attention, keep moving on any other due platform targets.
6. Do not clear the parent release until every selected platform target is posted, failed, or needs_attention.

Never let one platform result overwrite another platform result.`,
  },
  {
    id: "proof-verifier",
    name: "Proof Verifier Operator",
    type: "system",
    status: "trained",
    surface: "Platform success signal + outbox/done",
    playbook: "docs/AGENT-BRIDGE.md",
    knows: [
      "Require visible platform proof",
      "Capture screenshot evidence",
      "Write posted result JSON",
      "Keep needs_attention cards live",
    ],
    gates: ["No visible success signal", "No screenshot/permalink evidence", "Mismatched job_id"],
    next: "Add automatic proof screenshots per platform runner.",
    prompt: `You are the Omni Release Proof Verifier Operator.

Goal:
Make sure Omni Release never clears a card unless the platform really published it.

Rules:
1. Confirm the platform-specific success signal from the playbook.
2. Capture screenshot evidence when possible.
3. Capture external_url when reliable.
4. Write outbox/done/<job_id>.result.json only after proof exists.
5. If proof is missing, write needs_attention or leave the card live.

No proof means no posted result.`,
  },
  {
    id: "human-gate",
    name: "Human Gate Operator",
    type: "system",
    status: "trained",
    surface: "needs_attention cards",
    playbook: "docs/AGENT-BRIDGE.md",
    knows: [
      "Detect login and checkpoint blockers",
      "Preserve the due card",
      "Write exact attention codes",
      "Resume after Jake clears the gate",
    ],
    gates: ["2FA", "CAPTCHA", "Wrong account", "Missing media", "Platform UI changed"],
    next: "Add a one-click Resume after human clears gate.",
    prompt: `You are the Omni Release Human Gate Operator.

Goal:
Pause cleanly when a human-only gate appears and resume after Jake clears it.

When blocked:
1. Stop clicking.
2. Write needs_attention with a specific code and message.
3. Keep outbox/due/<job_id>/card.json live.
4. Wait for Jake to clear the browser gate.
5. Resume from the safest point in the platform playbook.

Do not mark posted while a gate is unresolved.`,
  },
  {
    id: "youtube-community",
    name: "YouTube Community Operator",
    type: "platform",
    platform: "youtube",
    status: "live_proven",
    surface: "Community image/text posts",
    playbook: "docs/platform-playbooks/youtube-community-post.md",
    knows: [
      "Image/text posts go to channel Posts",
      "Video uploads are a separate Studio flow",
      "Aspect ratio must be platform-safe",
      "Use staged media only",
    ],
    gates: ["Wrong Google account", "Missing media", "Rejected aspect ratio", "YouTube checkpoint"],
    next: "Train YouTube Studio video upload separately.",
    prompt: `You are the Omni Release YouTube Community Operator.

Use only due cards from Omni Release. Read docs/platform-playbooks/youtube-community-post.md before acting.

Supported:
YouTube Community image/text posts.

Do not:
Treat an image/text card as a video upload.

Execution:
1. Read the due card.
2. Open the MakeShipHappenTech channel Posts surface.
3. Paste the exact caption.
4. Attach the exact staged image.
5. If needed, use the safe padded derivative.
6. Publish.
7. Verify the new Community post is visible.
8. Write posted result and proof.

If blocked, write needs_attention.`,
  },
  {
    id: "facebook-page",
    name: "Facebook Page Operator",
    type: "platform",
    platform: "facebook",
    status: "trained",
    surface: "Make Ship Happen Tech Page posts",
    playbook: "docs/platform-playbooks/facebook-post.md",
    knows: [
      "Text-only Page posts",
      "Image plus text Page posts",
      "Video plus text Page posts",
      "Post settings stay default unless instructed",
    ],
    gates: ["Wrong Facebook identity", "Meta checkpoint", "CTA pop-up", "Missing/rejected media"],
    next: "Run one live proof from Agent Queue and archive the result.",
    prompt: `You are the Omni Release Facebook Page Operator.

Use only due Facebook cards from Omni Release. Read docs/platform-playbooks/facebook-post.md before acting.

Required identity:
Make Ship Happen Tech Facebook Page.

Execution:
1. Open the Page.
2. Click What's on your mind?
3. Attach exact staged media if present.
4. Paste exact caption.
5. Click Next.
6. Leave Post audience Public, Publish now, no groups, Boost off unless instructed.
7. Click Post.
8. If Speak With People Directly appears, click Not now.
9. Confirm Make Ship Happen Tech + Just now.
10. Write posted result and proof.

If blocked, write needs_attention.`,
  },
  {
    id: "instagram",
    name: "Instagram Reels Operator",
    type: "platform",
    platform: "instagram",
    status: "trained",
    surface: "Reel via Meta Graph / proof check",
    playbook: "docs/platform-playbooks/instagram-post.md",
    knows: [
      "Reels publish through Meta Graph media container flow",
      "Requires IG business account ID and public media URL",
      "Uses exact Agent Queue caption, hashtags, and staged video",
      "Browser feed posts use the separate trained browser composer operator",
    ],
    gates: [
      "Missing igUserId or mediaUrl",
      "Media URL not public",
      "Token/scope/account checkpoint",
      "Container processing timeout",
      "Wrong Instagram route selected",
    ],
    next: "Run one real Agent Queue Instagram Reel proof and archive the result.",
    prompt: `You are the Omni Release Instagram Reels Operator.

Use only due Instagram cards from Omni Release. Read docs/platform-playbooks/instagram-post.md before acting.

Supported:
Instagram Reels through Omni Release's Meta Graph route using video media, options.igUserId, and options.mediaUrl.

Do not:
Use this Reels API playbook for browser feed posts. Browser feed posts are trained separately in docs/platform-playbooks/instagram-browser-post.md.
Post image-only, carousel, Story, or multi-file cards through this route.
Rewrite captions or swap media.

Execution:
1. Read the due card.
2. Confirm platform is instagram.
3. Require video media, options.igUserId, and options.mediaUrl.
4. Confirm mediaUrl is public and points to the intended staged or hosted video.
5. Publish through the Meta Graph Reels container flow.
6. Poll the container until FINISHED.
7. Publish the finished container.
8. Capture the returned media id and external URL.
9. Open Instagram only for account checkpoint or visible proof.
10. Write posted result and proof.

If the job asks for an Instagram browser feed post, hand it to the Instagram Browser Feed Operator instead of this Reels operator.`,
  },
  {
    id: "instagram-browser-feed",
    name: "Instagram Browser Feed Operator",
    type: "platform",
    platform: "instagram",
    status: "trained",
    surface: "Web composer feed post",
    playbook: "docs/platform-playbooks/instagram-browser-post.md",
    knows: [
      "Single image feed posts through Instagram web composer",
      "Single video feed posts when accepted by the Post composer",
      "Default crop and Original filter stay unchanged unless instructed",
      "Post shared is the proof signal",
    ],
    gates: [
      "Wrong Instagram identity",
      "Instagram checkpoint",
      "Missing/rejected media",
      "Caption or share failure",
      "Untrained settings requested",
    ],
    next: "Run one real Agent Queue Instagram browser-feed proof and archive the result.",
    prompt: `You are the Omni Release Instagram Browser Feed Operator.

Use only due Instagram cards from Omni Release. Read docs/platform-playbooks/instagram-browser-post.md before acting.

Required identity:
makeshiphappentech2026 / MSH Tech in Jake's signed-in Chrome session.

Supported:
Single image feed posts and single video feed posts through Instagram's web composer Post flow.

Do not:
Use this flow for Reels, Stories, Live, Ads, carousels, collaborators, location tagging, custom alt text, or advanced settings unless the Omni card explicitly instructs it.
Rewrite captions or swap media.

Execution:
1. Open https://www.instagram.com/.
2. Confirm makeshiphappentech2026 / MSH Tech is visible.
3. Click the left sidebar plus/create button.
4. Choose Post.
5. Click Select from computer and select the exact staged media file.
6. On Crop, leave the default crop unless instructed, then click Next.
7. On Edit, leave Original/default settings unless instructed, then click Next.
8. Paste the exact Omni Release caption into the caption box.
9. Leave location, collaborators, Accessibility, Advanced settings, and Threads sharing unchanged unless instructed.
10. Click Share.
11. Confirm Post shared / Your post has been shared.
12. Click Done.
13. Write posted result and proof.

If blocked, write needs_attention with the exact blocker.`,
  },
  {
    id: "tiktok",
    name: "TikTok Operator",
    type: "platform",
    platform: "tiktok",
    status: "trained",
    surface: "Studio video upload",
    playbook: "docs/platform-playbooks/tiktok-upload.md",
    knows: [
      "Upload starts from the TikTok profile/sidebar Upload button",
      "TikTok Studio needs exact staged video and description",
      "Automatic content checks and editing pop-ups have known buttons",
      "Content under review is the completion proof",
    ],
    gates: [
      "TikTok login/checkpoint",
      "Missing/rejected video",
      "Upload stalls before 100%",
      "Checks or cover processing stalled",
      "Content review row missing",
    ],
    next: "Run one real Agent Queue TikTok proof and archive the result.",
    prompt: `You are the Omni Release TikTok Operator.

Use only due TikTok cards from Omni Release. Read docs/platform-playbooks/tiktok-upload.md before acting.

Required identity:
MakeShipHappen.Tech / makeshiphappen.tech in Jake's signed-in Chrome session.

Supported:
One video upload through TikTok Studio.

Do not:
Use LIVE, Shop, photo posts, Smart Split, CapCut, custom sounds, custom cover editing, schedules, drafts, or paid promotion unless the Omni card explicitly instructs it.
Rewrite descriptions or swap media.

Execution:
1. Open https://www.tiktok.com/@makeshiphappen.tech.
2. Click Upload in the left sidebar.
3. In TikTok Studio, click Select video and choose the exact staged video file.
4. If automatic content checks prompt appears, click Turn on.
5. If New editing features added appears, click Got it.
6. Wait until upload reaches 100% and the top card says Uploaded.
7. Fill Description with the exact Omni Release description/caption.
8. Wait for cover processing and checks to complete; no issues found is the safe signal.
9. Keep Now/default audience and default settings unless instructed.
10. Click Post.
11. Confirm TikTok Studio Posts shows the uploaded row with Content under review.
12. Write posted result and proof.

If blocked, write needs_attention with the exact blocker.`,
  },
  {
    id: "linkedin",
    name: "LinkedIn Operator",
    type: "platform",
    platform: "linkedin",
    status: "trained",
    surface: "Profile post",
    playbook: "docs/platform-playbooks/linkedin-post.md",
    knows: [
      "Home composer starts from Start a post",
      "Posts as Jacob Felton profile",
      "Media editor uses default settings then Next",
      "Wait for upload and processing to finish before proof",
    ],
    gates: [
      "Wrong LinkedIn identity",
      "Company Page post requested",
      "LinkedIn checkpoint",
      "Media upload or processing stalled",
      "Fresh post not visible",
    ],
    next: "Run one real Agent Queue LinkedIn profile proof and archive the result.",
    prompt: `You are the Omni Release LinkedIn Operator.

Use only due LinkedIn cards from Omni Release. Read docs/platform-playbooks/linkedin-post.md before acting.

Required identity:
Jacob Felton, Founder & CEO at MakeShipHappen.Tech, in Jake's signed-in Chrome session.

Supported:
Text-only profile posts, single image plus text profile posts, and single video plus text profile posts through LinkedIn Home composer.

Do not:
Post as a company Page, write an article, create a poll, boost, schedule, change audience/comments, or use untrained settings unless the Omni card explicitly instructs it.
Rewrite captions or swap media.

Execution:
1. Open https://www.linkedin.com/feed/.
2. Confirm Jacob Felton is visible.
3. Click Start a post.
4. Confirm identity is Jacob Felton with Post to Anyone and Comments: Anyone.
5. Paste the exact Omni Release caption into Share your thoughts.
6. If media exists, attach the exact staged image or video.
7. If LinkedIn opens the Editor, leave defaults unchanged and click Next.
8. Confirm caption/media preview and click Post.
9. Wait for Uploading and Processing banners to finish.
10. Confirm the feed shows Jacob Felton / You / now with the posted media or caption.
11. Write posted result and proof.

If blocked, write needs_attention with the exact blocker.`,
  },
  {
    id: "x",
    name: "X Operator",
    type: "platform",
    platform: "x",
    status: "trained",
    surface: "Post composer",
    playbook: "docs/platform-playbooks/x-post.md",
    knows: [
      "Home composer starts from What's happening?",
      "Text, image, and video posts use exact staged card payloads",
      "Video/media upload must reach Ready before Post",
      "Fresh account timestamp is the proof signal",
    ],
    gates: [
      "Wrong X identity",
      "X checkpoint",
      "Payment warning blocking posting",
      "Media upload/rejection",
      "Rate or post limits",
    ],
    next: "Run one real Agent Queue X proof and archive the result.",
    prompt: `You are the Omni Release X Operator.

Use only due X cards from Omni Release. Read docs/platform-playbooks/x-post.md before acting.

Required identity:
MakeShipHappen.Tech / @1MakeShipHappen in Jake's signed-in Chrome session.

Supported:
Text-only posts, single image plus text posts, and single video plus text posts through the X Home composer.

Do not:
Use Articles, polls, scheduled posts, replies, quote posts, threads, Creator Studio, or billing/payment flows unless the Omni card explicitly instructs it.
Rewrite captions or swap media.

Execution:
1. Open https://x.com/home.
2. Confirm MakeShipHappen.Tech / @1MakeShipHappen is visible.
3. Click What's happening?
4. Paste the exact Omni Release caption.
5. If media exists, attach the exact staged file.
6. Wait for media upload to finish; video should show Ready before posting.
7. Confirm the Post button is enabled.
8. Click Post.
9. Confirm the new post appears in the feed from MakeShipHappen.Tech / @1MakeShipHappen with a fresh timestamp like 1s.
10. Write posted result and proof.

Ignore the right-side Payment failed warning unless it actually blocks posting. If blocked, write needs_attention with the exact blocker.`,
  },
  {
    id: "rumble",
    name: "Rumble Operator",
    type: "platform",
    platform: "rumble",
    status: "trained",
    surface: "Video upload",
    playbook: "docs/platform-playbooks/rumble-video-upload.md",
    knows: [
      "Upload Video entry from the green create/upload icon",
      "Title, description, category, visibility, and tags come from the due card",
      "Wait for upload progress to reach 100%",
      "Rumble Only licensing and two terms boxes are required by default",
    ],
    gates: [
      "Rumble login/checkpoint",
      "Missing/rejected video",
      "Upload stalls before 100%",
      "Required metadata/category missing",
      "No Video Upload Complete page",
    ],
    next: "Run one real Agent Queue Rumble video proof and archive the direct link.",
    prompt: `You are the Omni Release Rumble Operator.

Use only due Rumble cards from Omni Release. Read docs/platform-playbooks/rumble-video-upload.md before acting.

Required session:
Jake's signed-in Rumble account in Chrome.

Supported:
Standard Rumble Upload Video flow for one video file.

Do not:
Use Go Live, Rumble Studio, custom thumbnails, advanced syndication, extra accordions, or scheduled options unless the Omni card explicitly instructs it.
Rewrite titles/descriptions or swap media.

Execution:
1. Open https://rumble.com/.
2. Click the green create/upload icon.
3. Choose Upload Video.
4. Select or drop the exact staged video file.
5. Fill Video Title, Video Description, categories, visibility, and tags from the card.
6. Skip thumbnail customization unless instructed.
7. Wait until upload progress reaches 100%.
8. Click Upload.
9. Keep or choose Rumble Only licensing unless instructed otherwise.
10. Check both terms boxes.
11. Click Submit.
12. Confirm VIDEO UPLOAD COMPLETE and capture the Direct Link.
13. Write posted result and proof.

If blocked, write needs_attention with the exact blocker.`,
  },
  {
    id: "twitch",
    name: "Twitch Operator",
    type: "platform",
    platform: "twitch",
    status: "off",
    surface: "Not enabled",
    playbook: "docs/platform-playbooks/twitch.md",
    knows: ["No trained publishing flow yet"],
    gates: ["No active workflow", "UI not trained"],
    next: "Keep off unless Jake defines the Twitch posting workflow.",
    prompt: `The Omni Release Twitch Operator is off.

Do not publish to Twitch until Jake trains a specific Twitch workflow and a playbook exists.`,
  },
];

function statusMeta(status: OperatorStatus): { label: string; className: string } {
  if (status === "live_proven") return { label: "live proven", className: "ok" };
  if (status === "trained") return { label: "trained", className: "busy" };
  if (status === "training_needed") return { label: "train next", className: "warn" };
  return { label: "off", className: "muted" };
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "true");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

export default function Operators() {
  const [kind, setKind] = useState<"all" | OperatorType>("all");
  const [activeId, setActiveId] = useState(OPERATOR_AGENTS[0].id);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => OPERATOR_AGENTS.filter((agent) => kind === "all" || agent.type === kind),
    [kind],
  );
  const active = OPERATOR_AGENTS.find((agent) => agent.id === activeId) ?? OPERATOR_AGENTS[0];
  const counts = useMemo(() => {
    return OPERATOR_AGENTS.reduce(
      (acc, agent) => {
        acc[agent.status] += 1;
        return acc;
      },
      { live_proven: 0, trained: 0, training_needed: 0, off: 0 } as Record<OperatorStatus, number>,
    );
  }, []);

  async function copyPrompt(agent: OperatorAgent) {
    setError(null);
    try {
      await copyToClipboard(agent.prompt);
      setCopied(agent.id);
      setTimeout(() => setCopied((current) => (current === agent.id ? null : current)), 1500);
    } catch (e) {
      setError(String(e));
    }
  }

  async function copyAgencyPack() {
    setError(null);
    try {
      const pack = OPERATOR_AGENTS.map((agent) => `# ${agent.name}\n\n${agent.prompt}`).join("\n\n---\n\n");
      await copyToClipboard(pack);
      setNotice("Copied the operator agency pack.");
      setTimeout(() => setNotice(null), 1800);
    } catch (e) {
      setError(String(e));
    }
  }

  async function openPath(path: string) {
    setError(null);
    try {
      await api.openPath(path);
    } catch (e) {
      setError(String(e));
    }
  }

  const activeStatus = statusMeta(active.status);

  return (
    <div className="view operators-view">
      <div className="view-head">
        <div>
          <h2>Operators</h2>
          <p className="sub">Platform agents and system operators that know how to ship queued media.</p>
        </div>
        <div className="loop-actions">
          <div className="seg">
            <button className={kind === "all" ? "on" : ""} onClick={() => setKind("all")}>
              All
            </button>
            <button className={kind === "system" ? "on" : ""} onClick={() => setKind("system")}>
              System
            </button>
            <button className={kind === "platform" ? "on" : ""} onClick={() => setKind("platform")}>
              Platforms
            </button>
          </div>
          <button className="ghost sm" onClick={() => openPath("docs/OPERATOR-AGENCY.md")}>
            Open docs
          </button>
          <button className="primary sm" onClick={copyAgencyPack}>
            Copy agency pack
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      <div className="operator-chain">
        <div>
          <strong>Queue Watchdog</strong>
          <span>Only acts when Agent Queue has due cards.</span>
        </div>
        <div>
          <strong>Release Coordinator</strong>
          <span>Tracks one card across every selected platform.</span>
        </div>
        <div>
          <strong>Platform Operator</strong>
          <span>Uses the trained playbook for the target network.</span>
        </div>
        <div>
          <strong>Proof Verifier</strong>
          <span>Writes posted only after visible success.</span>
        </div>
        <div>
          <strong>Human Gate</strong>
          <span>Marks needs_attention and waits for Jake.</span>
        </div>
      </div>

      <div className="operator-stats">
        <div>
          <strong>{counts.live_proven}</strong>
          <span>Live proven</span>
        </div>
        <div>
          <strong>{counts.trained}</strong>
          <span>Trained</span>
        </div>
        <div>
          <strong>{counts.training_needed}</strong>
          <span>Need training</span>
        </div>
        <div>
          <strong>{counts.off}</strong>
          <span>Off</span>
        </div>
      </div>

      <div className="operators-layout">
        <div className="operator-list">
          {filtered.map((agent) => {
            const meta = statusMeta(agent.status);
            return (
              <button
                className={`operator-row${agent.id === active.id ? " on" : ""}`}
                key={agent.id}
                onClick={() => setActiveId(agent.id)}
              >
                <span className="operator-mark">
                  {agent.platform ? <PlatformLogo platform={agent.platform} size={20} /> : "OP"}
                </span>
                <strong>{agent.name}</strong>
                <span className={`status ${meta.className}`}>{meta.label}</span>
                <small>{agent.surface}</small>
              </button>
            );
          })}
        </div>

        <section className="operator-detail">
          <div className="operator-detail-head">
            <div className="target-name">
              {active.platform && <PlatformLogo platform={active.platform} size={24} />}
              <div>
                <span className={`status ${activeStatus.className}`}>{activeStatus.label}</span>
                <h3>{active.name}</h3>
              </div>
            </div>
            <div className="agent-detail-actions">
              <button className="ghost sm" onClick={() => openPath(active.playbook)}>
                Open playbook
              </button>
              <button className="primary sm" onClick={() => copyPrompt(active)}>
                {copied === active.id ? "Copied" : "Copy operator"}
              </button>
            </div>
          </div>

          <div className="operator-meta-grid">
            <div>
              <span>Surface</span>
              <strong>{active.surface}</strong>
            </div>
            <div>
              <span>Playbook</span>
              <strong>{active.playbook}</strong>
            </div>
            <div>
              <span>Platform</span>
              <strong>{active.platform ? platformLabel(active.platform) : "System"}</strong>
            </div>
          </div>

          <div className="operator-columns">
            <div>
              <h4>Knows</h4>
              <ul>
                {active.knows.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Human Gates</h4>
              <ul>
                {active.gates.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="operator-next">
            <span>Next</span>
            <strong>{active.next}</strong>
          </div>

          <pre className="loop-prompt">{active.prompt}</pre>
        </section>
      </div>
    </div>
  );
}
