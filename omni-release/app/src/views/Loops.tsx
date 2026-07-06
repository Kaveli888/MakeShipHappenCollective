import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

interface LoopPrompt {
  id: string;
  name: string;
  mode: "orchestration" | "execution" | "verification" | "training";
  cadence: string;
  done: string;
  delegates: string[];
  prompt: string;
}

interface AgentPrompt {
  id: string;
  name: string;
  platform: string;
  stage: "trained" | "training" | "template";
  source: string;
  prompt: string;
  custom?: boolean;
}

interface ModelPrompt {
  id: string;
  name: string;
  provider: string;
  style: string;
  bestFor: string;
  prompt: string;
}

const AGENT_PROMPTS_KEY = "loops.agentPrompts";

const LOOP_PROMPTS: LoopPrompt[] = [
  {
    id: "publish-watchdog",
    name: "Publish Watchdog Loop",
    mode: "orchestration",
    cadence: "Every 2 minutes while awake",
    done: "Agent Queue is empty or every remaining card is marked needs_attention.",
    delegates: ["Agent Queue", "platform playbooks", "result contract"],
    prompt: `You are running the Omni Release Publish Watchdog Loop.

Goal:
Keep shipping every due Omni Release card until the queue is clear.

Loop:
1. Read Omni Release Agent Queue and outbox/due.
2. Pick the oldest due job first.
3. Read outbox/due/<job_id>/card.json and exact staged media files.
4. Read the matching platform playbook before publishing.
5. Open the platform in Jake's signed-in browser session.
6. Publish using the playbook, without rewriting the caption or substituting media.
7. Verify the platform's visible success signal.
8. Write the result JSON and proof screenshot back to the outbox.
9. Sync results in Omni Release.
10. Repeat until no due jobs remain.

Human gates:
If login, 2FA, CAPTCHA, checkpoint, missing media, platform UI change, upload failure, or unclear account identity blocks the run, write needs_attention with a specific reason and continue with any other due jobs.

Stop condition:
Stop only when every due job is posted or marked needs_attention.`,
  },
  {
    id: "human-gate-retry",
    name: "Human Gate Retry Loop",
    mode: "orchestration",
    cadence: "After Jake clears a browser gate",
    done: "Previously blocked job is posted or receives a new needs_attention reason.",
    delegates: ["needs_attention cards", "platform playbooks", "proof verification"],
    prompt: `You are running the Omni Release Human Gate Retry Loop.

Goal:
Resume blocked jobs after Jake clears the browser gate.

Loop:
1. Read Agent Queue for needs_attention jobs.
2. Pick the oldest needs_attention job first.
3. Read its attention_code and attention_message.
4. Open the handoff folder and platform URL.
5. Confirm the previous blocker is cleared.
6. Read the platform playbook again.
7. Retry the publish path from the safest resume point.
8. If posted, write posted result and proof.
9. If still blocked, write an updated needs_attention result with the new exact blocker.
10. Repeat for remaining needs_attention jobs.

Rule:
Never clear the job unless the platform shows the trained success signal.`,
  },
  {
    id: "platform-training",
    name: "Platform Training Loop",
    mode: "training",
    cadence: "Step by step with Jake",
    done: "A platform playbook is updated and ready for live proof.",
    delegates: ["screenshots", "platform playbook", "accomplishments log"],
    prompt: `You are running Omni Release Platform Training Mode.

Goal:
Turn Jake's walkthrough into a durable platform playbook.

Training mode rules:
1. Go in the exact order Jake provides screenshots or live steps.
2. Pause mentally at every click, field, modal, file picker, pop-up, and confirmation.
3. Record the required account/page identity.
4. Record what text and media are copied from Omni Release.
5. Record what settings should be left alone.
6. Record every human gate and the exact recovery instruction.
7. Record the visible success signal.
8. Update docs/platform-playbooks/<platform>.md.
9. Update docs/ACCOMPLISHMENTS.md.

Do not call the platform trained-live until one real Agent Queue card posts and clears.`,
  },
  {
    id: "proof-verification",
    name: "Proof Verification Loop",
    mode: "verification",
    cadence: "After each publish attempt",
    done: "Result JSON and proof evidence exist for the job.",
    delegates: ["platform success signal", "outbox result", "Omni sync"],
    prompt: `You are running the Omni Release Proof Verification Loop.

Goal:
Confirm a publish attempt is real before Omni Release clears the queue card.

Loop:
1. Inspect the platform page after the publish action.
2. Confirm the platform-specific success signal from the playbook.
3. Capture proof screenshot when possible.
4. Capture permalink as external_url when easy and reliable.
5. If permalink is not available, use the platform/page URL plus screenshot evidence.
6. Write outbox/done/<job_id>.result.json with outcome posted.
7. Run Sync agent results in Omni Release.
8. Confirm the queue card clears or moves to archive.

Fail closed:
If the success signal is not visible, do not write posted. Write needs_attention or retry according to the playbook.`,
  },
  {
    id: "queue-cleaner",
    name: "Queue Cleaner Loop",
    mode: "verification",
    cadence: "After syncing results",
    done: "No stale done jobs remain active in Agent Queue.",
    delegates: ["outbox archive", "attempt list", "audit log"],
    prompt: `You are running the Omni Release Queue Cleaner Loop.

Goal:
Make sure shipped jobs leave the active queue and blocked jobs stay visible.

Loop:
1. Run Sync agent results.
2. Check Agent Queue.
3. Check Publish attempts for the latest job result.
4. Check audit log for target/post status updates.
5. Confirm posted jobs are archived and no longer active.
6. Confirm needs_attention jobs remain visible with a clear code and message.
7. If a posted result exists but the queue did not clear, inspect the result JSON shape and report the mismatch.

Rule:
Never manually delete evidence just to make the queue look clean.`,
  },
  {
    id: "battle-tested-execution",
    name: "Battle-tested Execution Contract",
    mode: "execution",
    cadence: "Before any platform publish",
    done: "The agent knows which playbook owns the specialized action.",
    delegates: ["Facebook playbook", "YouTube playbook", "future platform playbooks"],
    prompt: `Use this execution contract before publishing from Omni Release.

1. The orchestration loop decides what job is due.
2. The platform playbook decides how to publish.
3. The proof loop decides whether the publish succeeded.
4. The result contract decides what Omni Release can clear.

Do not publish from memory when a playbook exists.
Do not invent unsupported settings.
Do not rewrite Jake's caption.
Do not swap media.
Do not clear the queue without proof.

If the required execution skill/playbook does not exist yet, enter Platform Training Mode instead of improvising.`,
  },
];

const BUILT_IN_AGENT_PROMPTS: AgentPrompt[] = [
  {
    id: "facebook-page-agent",
    name: "Facebook Page Agent",
    platform: "Facebook",
    stage: "trained",
    source: "docs/platform-playbooks/facebook-post.md",
    prompt: `You are the Omni Release Facebook Page Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact caption, media, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/facebook-post.md before posting.

Required identity:
Make Ship Happen Tech Facebook Page. The page should show Manage Page and the Page composer.

Supported post types:
Text-only Page posts, image plus text Page posts, and video plus text Page posts.

Default settings:
Post audience Public. Scheduling options Publish now. Leave Share to groups unchanged. Boost post off. Do not open or change these unless the Omni card or Jake explicitly instructs it.

Execution:
1. Open https://www.facebook.com/profile.php?id=61589607458265.
2. Confirm the Page identity is Make Ship Happen Tech.
3. Click What's on your mind?
4. In the Create post modal, click the text box.
5. If the card has media, attach the exact staged file by drag/drop into the modal or by using the green Photo/video button.
6. Paste the exact caption from Omni Release.
7. Confirm the caption and media preview are visible.
8. Click Next.
9. Review Post settings without changing defaults.
10. Click Post.
11. If Speak With People Directly appears, click Not now.
12. Confirm the Page feed shows Make Ship Happen Tech with timestamp Just now.

Human gates:
If logged out, wrong identity, checkpoint, 2FA, CAPTCHA, missing media, rejected media, changed UI, or no Just now post appears, write needs_attention with the exact blocker.

Result:
Only after the Just now success signal appears, write posted result JSON and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "youtube-community-agent",
    name: "YouTube Community Agent",
    platform: "YouTube",
    stage: "trained",
    source: "docs/platform-playbooks/youtube-community-post.md",
    prompt: `You are the Omni Release YouTube Community Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact caption and media from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/youtube-community-post.md before posting.

Required identity:
MakeShipHappenTech YouTube channel in Jake's signed-in Chrome profile.

Supported post type:
YouTube Community image/text posts. Do not treat image/text cards as video uploads. If the card is a real video upload, stop unless a YouTube Studio video upload playbook exists.

Execution:
1. Open the MakeShipHappenTech channel Posts/Community surface.
2. Start a Community post from the channel posts composer.
3. Paste the exact Omni Release caption.
4. Attach the exact staged image file.
5. If the image is rejected for aspect ratio, create or use the platform-safe padded derivative from the staged media folder.
6. Publish the post.
7. Confirm the new Community post appears on the channel posts page.

Human gates:
If logged out, wrong account, YouTube checkpoint, missing media, rejected media without a safe derivative, changed UI, or no new post appears, write needs_attention with the exact blocker.

Result:
Only after the visible post appears, write posted result JSON and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "instagram-browser-feed-agent",
    name: "Instagram Browser Feed Agent",
    platform: "Instagram",
    stage: "trained",
    source: "docs/platform-playbooks/instagram-browser-post.md",
    prompt: `You are the Omni Release Instagram Browser Feed Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact caption, media, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/instagram-browser-post.md before posting.

Required identity:
makeshiphappentech2026 / MSH Tech in Jake's signed-in Chrome profile.

Supported post types:
Single image feed posts and single video feed posts through Instagram's web composer Post flow.

Default settings:
Use default crop. Use Original/default filter/edit settings. Do not add location, collaborators, custom alt text, advanced settings, or Threads sharing unless the Omni card or Jake explicitly instructs it.

Execution:
1. Open https://www.instagram.com/.
2. Confirm makeshiphappentech2026 / MSH Tech is visible.
3. Click the left sidebar plus/create button.
4. Choose Post.
5. Click Select from computer and choose the exact staged media file.
6. On Crop, leave default crop unless instructed and click Next.
7. On Edit, leave Original/default settings unless instructed and click Next.
8. Paste the exact Omni Release caption into the caption field.
9. Leave location, collaborators, Accessibility, Advanced settings, and Threads sharing unchanged unless instructed.
10. Click Share.
11. Confirm Post shared / Your post has been shared.
12. Click Done.

Human gates:
If logged out, wrong identity, checkpoint, 2FA, CAPTCHA, missing media, rejected media, untrained settings, changed UI, share failure, or no Post shared screen appears, write needs_attention with the exact blocker.

Result:
Only after the Post shared success signal appears, write posted result JSON and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "rumble-video-upload-agent",
    name: "Rumble Video Upload Agent",
    platform: "Rumble",
    stage: "trained",
    source: "docs/platform-playbooks/rumble-video-upload.md",
    prompt: `You are the Omni Release Rumble Video Upload Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact video, title, description, categories, visibility, tags, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/rumble-video-upload.md before posting.

Required session:
Jake's signed-in Rumble account in Chrome.

Supported post type:
Standard Rumble Upload Video flow for one video file.

Default settings:
Skip custom thumbnail upload. Leave Feature video unchecked. Use Public unless the card says Unlisted, Private, or Scheduled. Leave mobile push notification unchecked unless instructed. Use Rumble Only licensing unless instructed otherwise.

Execution:
1. Open https://rumble.com/.
2. Click the green create/upload icon.
3. Choose Upload Video.
4. Select or drop the exact staged video file.
5. Fill Video Title, Video Description, category fields, visibility, and tags from the card.
6. Wait until upload progress reaches 100%.
7. Click Upload.
8. Keep or choose Rumble Only licensing unless instructed otherwise.
9. Check both terms boxes.
10. Click Submit.
11. Confirm VIDEO UPLOAD COMPLETE.
12. Capture the Direct Link.

Human gates:
If logged out, checkpoint, 2FA, CAPTCHA, missing video, rejected video, upload stalls before 100%, required metadata/category is missing, licensing/terms cannot be completed, changed UI, or no VIDEO UPLOAD COMPLETE page appears, write needs_attention with the exact blocker.

Result:
Only after VIDEO UPLOAD COMPLETE appears, write posted result JSON with the Direct Link and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "tiktok-studio-upload-agent",
    name: "TikTok Studio Upload Agent",
    platform: "TikTok",
    stage: "trained",
    source: "docs/platform-playbooks/tiktok-upload.md",
    prompt: `You are the Omni Release TikTok Studio Upload Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact video, description, hashtags, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/tiktok-upload.md before posting.

Required identity:
MakeShipHappen.Tech / makeshiphappen.tech in Jake's signed-in Chrome profile.

Supported post type:
One video upload through TikTok Studio.

Default settings:
Use Now/default audience. Leave high-quality uploads enabled if already enabled. Do not add location, edit cover, add sounds/text, schedule, draft, use Smart Split, CapCut, LIVE, Shop, or paid promotion unless the Omni card or Jake explicitly instructs it.

Execution:
1. Open https://www.tiktok.com/@makeshiphappen.tech.
2. Click Upload in the left sidebar.
3. In TikTok Studio, click Select video and choose the exact staged video file.
4. If Turn on automatic content checks appears, click Turn on.
5. If New editing features added appears, click Got it.
6. Wait until the upload reaches 100% and the top card says Uploaded.
7. Fill Description with the exact Omni Release caption/description.
8. Wait for cover processing and checks to complete.
9. Confirm checks show No issues found or another safe completion state.
10. Click Post.
11. Confirm TikTok Studio Posts shows the uploaded row with Content under review.

Human gates:
If logged out, wrong identity, checkpoint, 2FA, CAPTCHA, missing video, rejected video, upload stalls before 100%, cover processing stalls, checks fail, post stays disabled, changed UI, or no Content under review row appears, write needs_attention with the exact blocker.

Result:
Only after the Content under review row appears, write posted result JSON with review_status content_under_review and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "x-browser-post-agent",
    name: "X Browser Post Agent",
    platform: "X",
    stage: "trained",
    source: "docs/platform-playbooks/x-post.md",
    prompt: `You are the Omni Release X Browser Post Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact caption, media, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/x-post.md before posting.

Required identity:
MakeShipHappen.Tech / @1MakeShipHappen in Jake's signed-in Chrome profile.

Supported post types:
Text-only posts, single image plus text posts, and single video plus text posts through the X Home composer.

Default settings:
Use the Home composer. Leave Everyone can reply unchanged. Do not add polls, schedule, location, emoji changes, caption files, threads, quote posts, Articles, Creator Studio, or billing/payment flows unless the Omni card or Jake explicitly instructs it.

Execution:
1. Open https://x.com/home.
2. Confirm MakeShipHappen.Tech / @1MakeShipHappen is visible.
3. Click What's happening?
4. Paste the exact Omni Release caption.
5. If the card has media, attach the exact staged image or video file.
6. If media is uploading, wait until X shows Ready.
7. Confirm the caption and media preview are visible.
8. Click Post.
9. Confirm the new post appears in the feed from MakeShipHappen.Tech / @1MakeShipHappen with a fresh timestamp like 1s.

Human gates:
If logged out, wrong identity, checkpoint, 2FA, CAPTCHA, payment warning blocks posting, missing media, rejected media, media upload stalls, rate limit, changed UI, or no fresh post appears, write needs_attention with the exact blocker.

Result:
Only after the fresh timestamp success signal appears, write posted result JSON and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "linkedin-profile-post-agent",
    name: "LinkedIn Profile Post Agent",
    platform: "LinkedIn",
    stage: "trained",
    source: "docs/platform-playbooks/linkedin-post.md",
    prompt: `You are the Omni Release LinkedIn Profile Post Agent.

Source of truth:
Use Omni Release Agent Queue and outbox/due. Use the exact caption, media, platform, and schedule from the due card. Do not rewrite copy. Do not substitute media.

Required playbook:
Read docs/platform-playbooks/linkedin-post.md before posting.

Required identity:
Jacob Felton, Founder & CEO at MakeShipHappen.Tech, in Jake's signed-in Chrome profile.

Supported post types:
Text-only profile posts, single image plus text profile posts, and single video plus text profile posts through LinkedIn Home composer.

Default settings:
Post as Jacob Felton. Keep Post to Anyone. Keep Comments: Anyone. Do not use company Page posting, Write article, Enhance post, polls, scheduling, boosting, tagging, or untrained settings unless the Omni card or Jake explicitly instructs it.

Execution:
1. Open https://www.linkedin.com/feed/.
2. Confirm Jacob Felton is visible.
3. Click Start a post.
4. Confirm the composer identity is Jacob Felton with Post to Anyone and Comments: Anyone.
5. Paste the exact Omni Release caption into Share your thoughts.
6. If the card has media, attach the exact staged image or video file.
7. If LinkedIn opens the Editor, leave defaults unchanged and click Next.
8. Confirm the caption and media preview are visible.
9. Click Post.
10. Keep the page open while LinkedIn shows Uploading or Processing.
11. Confirm the feed shows Jacob Felton / You / now with the intended caption/media.

Human gates:
If logged out, wrong identity, company Page is required, checkpoint, 2FA, CAPTCHA, missing media, rejected media, media editor changes, upload stalls, processing stalls, changed UI, or no fresh Jacob Felton / You / now post appears, write needs_attention with the exact blocker.

Result:
Only after the fresh LinkedIn feed success signal appears, write posted result JSON and proof screenshot back to Omni Release, then sync agent results.`,
  },
  {
    id: "new-platform-training-agent",
    name: "New Platform Training Agent",
    platform: "Any platform",
    stage: "template",
    source: "training template",
    prompt: `You are the Omni Release Platform Training Agent.

Goal:
Turn Jake's screenshots or live walkthrough into a reusable platform agent prompt and platform playbook.

Training method:
1. Follow Jake's screenshots or live steps in exact chronological order.
2. Capture the required account, profile, Page, or channel identity.
3. Capture the first URL or entry surface.
4. Capture every click, field, modal, file picker, upload path, setting, pop-up, and final publish action.
5. Record exactly which settings should be left alone.
6. Record what counts as success.
7. Record every human gate and the recovery action.
8. Update the platform playbook.
9. Create or update an Agents Only prompt for that platform.
10. Do not call it autonomous until one real Agent Queue card posts and clears.

Output:
Create a concise platform agent prompt that another tool-capable agent can copy and run.`,
  },
];

const MODEL_PROMPTS: ModelPrompt[] = [
  {
    id: "claude-adapter",
    name: "Claude Adapter",
    provider: "Claude",
    style: "structured reasoning, careful verification",
    bestFor: "long platform playbooks, training notes, and cautious browser handoffs",
    prompt: `Use this as the Claude adapter for Omni Release.

Role:
You are a careful Omni Release publishing agent. Treat Omni Release as the source of truth and use the platform playbooks as the execution law.

Claude operating style:
1. Read the full task context first.
2. Separate orchestration, execution, and verification.
3. State assumptions only when they affect the publish result.
4. Do not invent platform behavior.
5. Prefer a short checklist before acting.
6. Stop and mark needs_attention when the browser hits a real gate.

Core loop:
1. Read Omni Release Agent Queue.
2. Pick the oldest due card.
3. Read outbox/due/<job_id>/card.json and staged media.
4. Read the matching platform playbook.
5. Publish through the signed-in browser session.
6. Verify the trained success signal.
7. Write posted or needs_attention result.
8. Sync Omni Release.
9. Continue until the queue is clear or blocked.

Hard rules:
Do not rewrite Jake's caption. Do not substitute media. Do not change account/profile/page identity. Do not clear a card without visible proof.`,
  },
  {
    id: "openai-codex-adapter",
    name: "OpenAI / Codex Adapter",
    provider: "OpenAI",
    style: "tool-first execution, repo/file awareness",
    bestFor: "Codex, ChatGPT with tools, browser automation, and file/result writing",
    prompt: `Use this as the OpenAI/Codex adapter for Omni Release.

Mission:
Operate as a tool-capable publishing worker for Omni Release. Execute directly, verify, and write results back.

OpenAI/Codex operating style:
1. Use tools proactively.
2. Inspect local files before guessing.
3. Use the platform playbook before publishing.
4. Keep actions scoped to the due job.
5. Report the final outcome concisely.

Execution loop:
1. Read Agent Queue and outbox/due.
2. Select the oldest due job.
3. Read card.json, media files, and platform target.
4. Read docs/platform-playbooks/<platform>.md.
5. Open the platform in Jake's signed-in Chrome/browser session.
6. Perform the trained publish flow.
7. Capture proof only after the trained success signal appears.
8. Write outbox result JSON: posted or needs_attention.
9. Sync agent results in Omni Release.
10. Repeat until no due jobs remain.

Failure behavior:
If blocked by login, 2FA, CAPTCHA, checkpoint, missing media, rejected upload, wrong profile, or changed UI, write needs_attention with a specific code and reason. Do not keep clicking blindly.`,
  },
  {
    id: "deepseek-adapter",
    name: "DeepSeek Adapter",
    provider: "DeepSeek",
    style: "compact checklist, explicit state machine",
    bestFor: "lean local/low-cost workers that need strict step boundaries",
    prompt: `Use this as the DeepSeek adapter for Omni Release.

Task:
Run Omni Release jobs using a strict state machine. Do not improvise outside the current state.

State machine:
STATE 1: READ_QUEUE
- Read Agent Queue.
- If no due jobs, stop.
- Select oldest due job.

STATE 2: READ_JOB
- Read card.json.
- Confirm platform, caption, schedule, and media files.
- If required media is missing, write needs_attention.

STATE 3: READ_PLAYBOOK
- Read the platform playbook.
- If no playbook exists, switch to training mode.

STATE 4: PUBLISH
- Open the signed-in browser session.
- Execute only the playbook steps.
- Do not rewrite text or swap media.

STATE 5: VERIFY
- Check the platform success signal.
- If visible, write posted result.
- If not visible, write needs_attention or retry once only when the playbook says it is safe.

STATE 6: SYNC_AND_REPEAT
- Sync Omni Release results.
- Return to READ_QUEUE.

Output contract:
Every job must end as posted or needs_attention. Never leave the state ambiguous.`,
  },
  {
    id: "gemini-adapter",
    name: "Gemini Adapter",
    provider: "Gemini",
    style: "multimodal context, screenshot-aware verification",
    bestFor: "flows trained from screenshots and visual platform confirmations",
    prompt: `Use this as the Gemini adapter for Omni Release.

Role:
You are a visual publishing assistant for Omni Release. Use screenshots, browser state, and platform playbooks to publish and verify posts.

Gemini operating style:
1. Use visual context carefully.
2. Match screenshots to the platform playbook.
3. Confirm the correct account/page/channel before acting.
4. Treat visible UI changes as important.
5. Verify success visually before writing posted.

Loop:
1. Read the due Omni Release job.
2. Read its caption, media, platform, and schedule.
3. Open the relevant platform playbook.
4. Compare the current browser screen to the trained flow.
5. Follow the exact trained UI sequence.
6. If a pop-up appears, handle it only if the playbook names it.
7. Confirm the visual success signal.
8. Write posted result and proof screenshot.
9. If blocked, write needs_attention with the visible blocker.
10. Repeat until the due queue is clear.

Rules:
No caption rewrites. No media substitutions. No untrained settings changes. No posted result without visual proof.`,
  },
];

function modeClass(mode: LoopPrompt["mode"]): string {
  if (mode === "orchestration") return "busy";
  if (mode === "verification") return "ok";
  if (mode === "training") return "warn";
  return "muted";
}

function stageClass(stage: AgentPrompt["stage"]): string {
  if (stage === "trained") return "ok";
  if (stage === "training") return "warn";
  return "muted";
}

function newCustomPrompt(): AgentPrompt {
  return {
    id: `custom-${Date.now()}`,
    name: "",
    platform: "",
    stage: "training",
    source: "custom",
    prompt: "",
    custom: true,
  };
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

export default function Loops() {
  const [section, setSection] = useState<"loops" | "agents" | "models">("loops");
  const [activeLoopId, setActiveLoopId] = useState(LOOP_PROMPTS[0]?.id ?? "");
  const [activeAgentId, setActiveAgentId] = useState(BUILT_IN_AGENT_PROMPTS[0]?.id ?? "");
  const [activeModelId, setActiveModelId] = useState(MODEL_PROMPTS[0]?.id ?? "");
  const [customAgents, setCustomAgents] = useState<AgentPrompt[]>([]);
  const [draft, setDraft] = useState<AgentPrompt>(() => newCustomPrompt());
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api
      .stateGet(AGENT_PROMPTS_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as AgentPrompt[];
        setCustomAgents(parsed.map((item) => ({ ...item, custom: true })));
      })
      .catch(() => {
        /* missing or invalid saved prompts should not block the view */
      });
  }, []);

  const agents = useMemo(() => [...BUILT_IN_AGENT_PROMPTS, ...customAgents], [customAgents]);

  const activeLoop = useMemo(
    () => LOOP_PROMPTS.find((loop) => loop.id === activeLoopId) ?? LOOP_PROMPTS[0],
    [activeLoopId],
  );

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === activeAgentId) ?? agents[0],
    [activeAgentId, agents],
  );

  const activeModel = useMemo(
    () => MODEL_PROMPTS.find((model) => model.id === activeModelId) ?? MODEL_PROMPTS[0],
    [activeModelId],
  );

  async function persistCustomAgents(next: AgentPrompt[]) {
    setCustomAgents(next);
    await api.stateSet(AGENT_PROMPTS_KEY, JSON.stringify(next));
  }

  async function copyPrompt(id: string, prompt: string) {
    setError(null);
    try {
      await copyToClipboard(prompt);
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch (e) {
      setError(String(e));
    }
  }

  async function copyAll() {
    setError(null);
    try {
      const items = section === "agents"
        ? agents.map((agent) => `# ${agent.name}\n\n${agent.prompt}`)
        : section === "models"
          ? MODEL_PROMPTS.map((model) => `# ${model.name}\n\n${model.prompt}`)
          : LOOP_PROMPTS.map((loop) => `# ${loop.name}\n\n${loop.prompt}`);
      await copyToClipboard(items.join("\n\n---\n\n"));
      setNotice(
        section === "agents"
          ? "Copied the agents-only prompt pack."
          : section === "models"
            ? "Copied the AI platform adapter pack."
            : "Copied the full loop pack.",
      );
      setTimeout(() => setNotice(null), 1800);
    } catch (e) {
      setError(String(e));
    }
  }

  async function saveDraft() {
    const name = draft.name.trim();
    const platform = draft.platform.trim();
    const prompt = draft.prompt.trim();
    if (!name || !platform || !prompt) {
      setError("Name, platform, and prompt are required.");
      return;
    }

    setError(null);
    const saved = { ...draft, name, platform, prompt, custom: true };
    const next = [...customAgents.filter((agent) => agent.id !== saved.id), saved];
    try {
      await persistCustomAgents(next);
      setActiveAgentId(saved.id);
      setShowDraft(false);
      setDraft(newCustomPrompt());
      setNotice("Integrated agent prompt.");
      setTimeout(() => setNotice(null), 1800);
    } catch (e) {
      setError(String(e));
    }
  }

  async function deleteCustomAgent(id: string) {
    const next = customAgents.filter((agent) => agent.id !== id);
    try {
      await persistCustomAgents(next);
      setActiveAgentId(BUILT_IN_AGENT_PROMPTS[0]?.id ?? "");
      setNotice("Removed custom agent prompt.");
      setTimeout(() => setNotice(null), 1800);
    } catch (e) {
      setError(String(e));
    }
  }

  async function openDocs() {
    setError(null);
    try {
      await api.openPath("docs/LOOP-ORCHESTRATION.md");
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="view loops-view">
      <div className="view-head">
        <div>
          <h2>Loops</h2>
          <p className="sub">Copy-ready orchestration and agent prompts for any active worker.</p>
        </div>
        <div className="loop-actions">
          <div className="seg">
            <button className={section === "loops" ? "on" : ""} onClick={() => setSection("loops")}>
              Loop prompts
            </button>
            <button className={section === "agents" ? "on" : ""} onClick={() => setSection("agents")}>
              Agents Only
            </button>
            <button className={section === "models" ? "on" : ""} onClick={() => setSection("models")}>
              AI Platforms
            </button>
          </div>
          <button className="ghost sm" onClick={openDocs}>
            Open docs
          </button>
          <button className="primary sm" onClick={copyAll}>
            {section === "agents" ? "Copy agents pack" : section === "models" ? "Copy AI pack" : "Copy loop pack"}
          </button>
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}
      {notice && <div className="banner ok">{notice}</div>}

      {section === "loops" ? (
        <>
          <div className="loop-principles">
            <div>
              <strong>Orchestration</strong>
              <span>Chooses the due job, delegates the work, and repeats.</span>
            </div>
            <div>
              <strong>Execution</strong>
              <span>Follows the platform playbook for the actual publish path.</span>
            </div>
            <div>
              <strong>Verification</strong>
              <span>Requires proof before Omni Release clears the queue.</span>
            </div>
          </div>

          <div className="loops-layout">
            <div className="loop-list">
              {LOOP_PROMPTS.map((loop) => (
                <button
                  key={loop.id}
                  className={`loop-row${loop.id === activeLoop.id ? " on" : ""}`}
                  onClick={() => setActiveLoopId(loop.id)}
                >
                  <span className={`status ${modeClass(loop.mode)}`}>{loop.mode}</span>
                  <strong>{loop.name}</strong>
                  <span>{loop.cadence}</span>
                </button>
              ))}
            </div>

            <section className="loop-detail" aria-live="polite">
              <div className="loop-detail-head">
                <div>
                  <span className={`status ${modeClass(activeLoop.mode)}`}>{activeLoop.mode}</span>
                  <h3>{activeLoop.name}</h3>
                </div>
                <button className="primary sm" onClick={() => copyPrompt(activeLoop.id, activeLoop.prompt)}>
                  {copied === activeLoop.id ? "Copied" : "Copy prompt"}
                </button>
              </div>

              <div className="loop-meta-grid">
                <div>
                  <span>Cadence</span>
                  <strong>{activeLoop.cadence}</strong>
                </div>
                <div>
                  <span>Done</span>
                  <strong>{activeLoop.done}</strong>
                </div>
              </div>

              <div className="loop-delegates">
                {activeLoop.delegates.map((delegate) => (
                  <span className="chip" key={delegate}>
                    {delegate}
                  </span>
                ))}
              </div>

              <pre className="loop-prompt">{activeLoop.prompt}</pre>
            </section>
          </div>
        </>
      ) : section === "agents" ? (
        <>
          <div className="loop-principles">
            <div>
              <strong>Agents Only</strong>
              <span>Portable worker prompts for trained social platforms.</span>
            </div>
            <div>
              <strong>Platform Memory</strong>
              <span>Each agent points back to a playbook and success signal.</span>
            </div>
            <div>
              <strong>Custom Prompts</strong>
              <span>Add new trained prompts as Jake teaches more flows.</span>
            </div>
          </div>

          <div className="agent-prompt-toolbar">
            <button className="primary sm" onClick={() => setShowDraft((show) => !show)}>
              {showDraft ? "Close integrate prompt" : "Integrate prompt"}
            </button>
            <span className="sub">{agents.length} agent prompt{agents.length === 1 ? "" : "s"} available</span>
          </div>

          {showDraft && (
            <section className="loop-detail agent-draft">
              <div className="loop-detail-head">
                <div>
                  <span className="status warn">training</span>
                  <h3>Integrate Agent Prompt</h3>
                </div>
                <button className="primary sm" onClick={saveDraft}>
                  Save prompt
                </button>
              </div>

              <div className="agent-form-grid">
                <label className="field">
                  <span>Name</span>
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Instagram Reel Agent"
                  />
                </label>
                <label className="field">
                  <span>Platform</span>
                  <input
                    value={draft.platform}
                    onChange={(e) => setDraft((current) => ({ ...current, platform: e.target.value }))}
                    placeholder="Instagram"
                  />
                </label>
                <label className="field">
                  <span>Stage</span>
                  <select
                    value={draft.stage}
                    onChange={(e) =>
                      setDraft((current) => ({ ...current, stage: e.target.value as AgentPrompt["stage"] }))
                    }
                  >
                    <option value="training">training</option>
                    <option value="trained">trained</option>
                    <option value="template">template</option>
                  </select>
                </label>
                <label className="field">
                  <span>Source</span>
                  <input
                    value={draft.source}
                    onChange={(e) => setDraft((current) => ({ ...current, source: e.target.value }))}
                    placeholder="docs/platform-playbooks/instagram-post.md"
                  />
                </label>
              </div>

              <label className="field">
                <span>Prompt</span>
                <textarea
                  value={draft.prompt}
                  onChange={(e) => setDraft((current) => ({ ...current, prompt: e.target.value }))}
                  rows={10}
                  placeholder="Paste the trained agent prompt here..."
                />
              </label>
            </section>
          )}

          <div className="loops-layout">
            <div className="loop-list">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className={`loop-row${agent.id === activeAgent.id ? " on" : ""}`}
                  onClick={() => setActiveAgentId(agent.id)}
                >
                  <span className={`status ${stageClass(agent.stage)}`}>{agent.stage}</span>
                  <strong>{agent.name}</strong>
                  <span>{agent.platform}</span>
                </button>
              ))}
            </div>

            <section className="loop-detail" aria-live="polite">
              <div className="loop-detail-head">
                <div>
                  <span className={`status ${stageClass(activeAgent.stage)}`}>{activeAgent.stage}</span>
                  <h3>{activeAgent.name}</h3>
                </div>
                <div className="agent-detail-actions">
                  {activeAgent.custom && (
                    <button className="ghost sm danger" onClick={() => deleteCustomAgent(activeAgent.id)}>
                      Delete
                    </button>
                  )}
                  <button className="primary sm" onClick={() => copyPrompt(activeAgent.id, activeAgent.prompt)}>
                    {copied === activeAgent.id ? "Copied" : "Copy agent"}
                  </button>
                </div>
              </div>

              <div className="loop-meta-grid">
                <div>
                  <span>Platform</span>
                  <strong>{activeAgent.platform}</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>{activeAgent.source}</strong>
                </div>
              </div>

              <div className="loop-delegates">
                <span className="chip">Omni Release</span>
                <span className="chip">Agent Queue</span>
                <span className="chip">platform playbook</span>
                <span className="chip">proof required</span>
              </div>

              <pre className="loop-prompt">{activeAgent.prompt}</pre>
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="loop-principles">
            <div>
              <strong>AI Platforms</strong>
              <span>Translate the same Omni Release loop into each model's working style.</span>
            </div>
            <div>
              <strong>Same Core</strong>
              <span>Every adapter still uses the queue, playbooks, and proof contract.</span>
            </div>
            <div>
              <strong>Different Dialect</strong>
              <span>Claude, OpenAI, DeepSeek, and Gemini get tailored instructions.</span>
            </div>
          </div>

          <div className="loops-layout">
            <div className="loop-list">
              {MODEL_PROMPTS.map((model) => (
                <button
                  key={model.id}
                  className={`loop-row${model.id === activeModel.id ? " on" : ""}`}
                  onClick={() => setActiveModelId(model.id)}
                >
                  <span className="status busy">{model.provider}</span>
                  <strong>{model.name}</strong>
                  <span>{model.style}</span>
                </button>
              ))}
            </div>

            <section className="loop-detail" aria-live="polite">
              <div className="loop-detail-head">
                <div>
                  <span className="status busy">{activeModel.provider}</span>
                  <h3>{activeModel.name}</h3>
                </div>
                <button className="primary sm" onClick={() => copyPrompt(activeModel.id, activeModel.prompt)}>
                  {copied === activeModel.id ? "Copied" : "Copy adapter"}
                </button>
              </div>

              <div className="loop-meta-grid">
                <div>
                  <span>Style</span>
                  <strong>{activeModel.style}</strong>
                </div>
                <div>
                  <span>Best for</span>
                  <strong>{activeModel.bestFor}</strong>
                </div>
              </div>

              <div className="loop-delegates">
                <span className="chip">same queue</span>
                <span className="chip">same playbooks</span>
                <span className="chip">same proof rules</span>
                <span className="chip">model-specific wording</span>
              </div>

              <pre className="loop-prompt">{activeModel.prompt}</pre>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
