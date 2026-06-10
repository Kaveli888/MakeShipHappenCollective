# ShipMind Product Page — Recording Shot List

This is the complete capture list for the new ShipMind product page. Record everything here, and the new page is fully populated. Skip nothing — each clip has a specific job.

---

## Setup (do this once)

**Software:** CleanShot X, ScreenFlow, or OBS. (CleanShot X is the fastest path; it exports MP4, GIF, and WebP.)

**Settings:**
- Resolution: **1920 × 1080** (1080p) at **60 fps**
- Cursor: turn ON cursor highlighting (subtle ring or yellow glow)
- Click effects: turn ON click ripples (so the viewer can see what you tapped)
- Audio: **none** (these are silent loops; sound goes on the founder video only)

**Window setup before each capture:**
- ShipMind window at exactly **1440 × 900** centered on screen, dark mode
- Hide menu bar (`Cmd+Shift+F` for fullscreen if helpful, or use a clean wallpaper)
- Use a single, branded test workspace called `Demo Workspace` so every clip looks consistent
- Pre-load the same set of demo sources every time (see "Demo dataset" below)

**Demo dataset (build once, reuse forever):**
Create a folder called `~/Demo Workspace/` containing:
- 3 PDFs (one product spec, one research paper, one founder memo)
- 1 audio file (a 5-min meeting recording)
- 1 .mp4 (a short product demo video)
- 1 CSV (customer feedback)
- 1 Markdown file (a launch plan)
- 1 YouTube URL saved as `youtube-link.txt`

Use this same dataset for every recording — it makes the brand feel consistent.

**File naming convention:**
`shipmind_[section]_[purpose]_v[N].mp4`
Examples: `shipmind_hero_loop_v1.mp4`, `shipmind_cap1_ingest_v1.mp4`, `shipmind_cap3_citations_v1.mp4`

Drop everything into `~/MakeShipHappenCollective/media/raw/` so I can pick them up.

---

## Tier 1 — Hero loop (highest priority)

This is the single most important asset on the page. It plays autoplay/muted in the hero. If a visitor watches nothing else, they watch this.

**`shipmind_hero_loop_v1.mp4`** — 6 to 8 seconds, looping, no audio

The clip flow:
1. (0:00–0:01) ShipMind open, empty workspace, calm.
2. (0:01–0:02) Drag a folder containing 4 mixed files (PDF, .mp3, .mov, .csv) onto the workspace from Finder.
3. (0:02–0:04) Files animate in with type icons. A subtle progress ring shows local indexing.
4. (0:04–0:05) Cut — typing appears in the input: *"What changed in the launch plan?"*
5. (0:05–0:07) Cut — answer streams with citation chips appearing inline.
6. (0:07–0:08) Cursor hovers a citation chip; it expands showing the source paragraph.

**Loop tip:** end on a still frame matching frame 1 so it loops cleanly.

---

## Tier 2 — Per-capability GIFs (one per section)

Each is 5–7 seconds, looping, silent. Goes into the matching capability section on the product page.

### `shipmind_cap1_ingest_v1.mp4` — Ingest anything (5 sec)
- Drag the demo folder onto ShipMind from Finder
- File-type chips light up sequentially: **PDF · Audio · Video · CSV · JSON · Web · Notes · Drive**
- End on the populated source list

### `shipmind_cap2_meetings_v1.mp4` — Meetings become memory (6 sec)
- Drag the demo audio file in
- Whisper indexing progress bar
- Cut to the rendered transcript: visible **Speaker 1 / Speaker 2** labels and clickable timestamps
- End: paste a YouTube URL and watch a transcript appear next to it

### `shipmind_cap3_citations_v1.mp4` — Ask once. Verify instantly. (7 sec)
- Type: *"What were the main revenue drivers in Q3?"*
- Answer streams with citation chips like `[1] [2]`
- Cursor hovers `[1]` — it expands inline showing the source paragraph + page/timestamp
- Click → page scrolls to the cited source. Brief highlight pulse on the source.

### `shipmind_cap4_contradictions_v1.mp4` — Find what doesn't add up (6 sec)
- Click "Find contradictions" or run the equivalent in Studio
- Two source cards animate in side-by-side: **Source A: Product Spec** / **Source B: Founder Meeting**
- A red-orange highlight ribbon labels the conflict: *"Launch date Q3"* vs *"delayed to Q4"*
- Hover the conflict; tooltip shows: *"Click to open both sources side-by-side"*

### `shipmind_cap5_studio_v1.mp4` — Studio: turn knowledge into work (7 sec)
- An answer is on screen
- Click the **Studio** mode dropdown
- Show 6+ visible options: **Brief / Study Guide / Status Update / Comparison Table / Meeting Minutes / Email**
- Pick "Status Update"
- The answer transforms in place into a polished, formatted artifact with sections and bullets
- Bonus: cursor clicks "Copy to clipboard"

### `shipmind_cap6_voice_v1.mp4` — Talk to your workspace (5 sec)
- User holds the ShipTalk hotkey (overlay shows "Listening…")
- Voice waveform animates
- Release the hotkey
- Transcribed text appears in ShipMind's input
- Answer starts streaming

---

## Tier 3 — Privacy proof screenshots (3 stills)

These are static screenshots, not video. They go in the "Local-first isn't a marketing claim" section.

### `shipmind_proof_local_storage.png`
- macOS Finder window open at the actual ShipMind data directory
- Show the SQLite file (`shipmind.db` or whatever your real filename is)
- Bonus: file size visible to communicate "yes this is real local data"

### `shipmind_proof_ollama.png`
- ShipMind's model picker dropdown open
- Show a list with **Llama 3 (local)** at the top, then cloud options (Anthropic, OpenAI) below
- A small green dot or "Local · running" badge next to Llama

### `shipmind_proof_keys.png`
- ShipMind's settings panel showing API keys
- Keys masked (`sk-•••••••••AB12`) but visible field for OpenAI / Anthropic / Together
- A note: *"Stored locally in your macOS Keychain. Never sent to MakeShipHappen."*

---

## Tier 4 — Use case screenshots (4 stills)

One per use case card. Static screenshots, 16:10 ratio, dark theme.

### `shipmind_use_specs.png` — Product specs / PRDs
- Two PDFs open, ShipMind highlighting changes between v1 and v2
- Sidebar shows the diff request: *"What changed since the last review?"*

### `shipmind_use_meetings.png` — Meeting & call context
- Transcript view with highlighted action items pulled to the side
- Speaker labels visible

### `shipmind_use_research.png` — Research / competitive scan
- A comparison table generated by Studio with 4 competitors and structured columns

### `shipmind_use_launch.png` — Launch plans / status updates
- A drafted stakeholder update in Studio with citations inline

---

## Tier 5 — First Win onboarding screenshots (6 small stills)

One per step in the "From zero to a real win" section. These can be smaller (~800px wide, square or 4:3).

1. `step1_add_source.png` — empty workspace with a drop-zone highlighted
2. `step2_indexing.png` — sources visible, indexing progress ring on one
3. `step3_ask_question.png` — input box with cursor, suggestion chips below
4. `step4_cited_answer.png` — answer with visible citation chips
5. `step5_studio_artifact.png` — Studio mode picker open
6. `step6_export.png` — copy/export menu open

---

## Tier 6 — Founder video (optional but high-impact)

**`shipmind_founder_jake_v1.mp4`** — 60–90 seconds, with audio

You, Jake, talking to camera. Webcam quality is fine — authenticity > production value.

Suggested beats:
- (0:00–0:10) "I'm Jake. I built ShipMind because…" (one specific pain point — make it real)
- (0:10–0:30) "Here's what's in the box…" (cut to a quick screen capture of the hero flow)
- (0:30–0:50) "Why local-first matters to me…" (show the file path, the airplane mode test, whatever)
- (0:50–1:20) "If you're tired of [X], try this." (CTA, on camera)
- (1:20–1:30) End frame with download button overlay.

This goes near the bottom of the page, above the FAQ. It's the trust accelerant.

---

## Post-production notes

- **GIF vs. MP4:** Send me MP4. Browsers play MP4 with `<video autoplay muted loop playsinline>` at much smaller file sizes than GIF and look 10× better.
- **Compression target:** each per-capability clip should land **under 1 MB** after compression. Use Handbrake → web-optimized H.264 → quality 24.
- **Posters:** every video needs a static "poster" image (first frame) so it doesn't show black on slow connections. CleanShot X exports these automatically.
- **Captions inside the video:** generally don't add captions; the surrounding page copy explains what's happening. Exception: if a UI element is too small to read, add a small subtle label *just for that element*.

---

## Delivery — when you're ready

1. Put all raw files in `~/MakeShipHappenCollective/media/raw/`
2. Tell me when they're there
3. I'll trim, compress, generate posters, write surrounding alt text, and slot each into the right section of the page mockup

If recording all of Tier 1–5 feels like too much in one sitting, here's the priority order if you have to phase it:

**Day 1 (highest value):** Hero loop + Cap 3 citations + Cap 5 Studio
**Day 2:** Cap 1 ingest + Cap 2 meetings + Privacy proof stills
**Day 3:** Cap 4 contradictions + Cap 6 voice + Use case screenshots
**Day 4 (polish):** First Win stills + Founder video
