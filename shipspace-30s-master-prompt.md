# ShipSpace — 30-Second Launch Film · Master Prompt Kit

Brand: **ShipSpace by MakeShipHappen.Tech** — no other brand appears, period.
Style engine: the Cascade teaser grammar (black studio void, glossy UI slabs, specular sweeps,
hero reveal) fused with ShipSpace's real identity (matrix-rain glyphs, teal glow, violet actions,
magenta accents, the glowing MAKE SHIP HAPPEN ring globe).
Target engines: **Seedance 2.0 (OpenArt Frame-to-Video)** · **Veo 3** · **nano-banana** (still prep).

---

## 1. ShipSpace visual identity (extracted from the real app)

- **Background:** near-black `#030305` with falling matrix-rain code glyphs in faint teal,
  violet, magenta and green — this is the signature, always alive, never static.
- **Wordmark:** "ShipSpace" in glowing teal/cyan with a dark rounded-square mark;
  tagline **"Build The Future"** in magenta glow beneath it.
- **Action color:** violet/indigo `#6C5CE7→#7C5CFA` gradient buttons (Launch Workspace,
  Configure Agents, NEXT, LAUNCH GANG).
- **Accent duo:** teal `#2DD4BF` (positive/glow/status) + magenta `#EC4899` (taglines, highlights).
- **Agent identity:** the **MAKE SHIP HAPPEN ring globe** — a teal wireframe globe inside a glowing
  ring of text, floating in the agent panel above "● READY".
- **The product:** an agentic terminal IDE — 6-session terminal grids running Claude Code, Codex,
  Gemini CLI side by side; AI Agent Fleet provisioning; ShipGang squad wizard; built-in browser
  (GitHub + web); Mission Control workshop (Goals, Journal, Kanban, Notebook, SEO, Studio);
  agent chat with voice.

## 2. The 30-second beat map (6 clips × 5s — Seedance native length)

| Clip | Time | Beat | Story job |
|------|------|------|-----------|
| C1 | 0–5 | **Cloth reveal.** Black satin drape over a monolith in a dark studio, the MAKE SHIP HAPPEN ring globe embossed in the fabric glowing faint teal through the weave. Cloth whips off — behind it, matrix rain ignites across the void. | Mystery → identity |
| C2 | 5–10 | **Configure Layout.** The workspace-creation panel floats as a glossy slab: the 18-color swatch row shimmers, layout templates (Single → 16 Sessions) light up in sequence, "6 Sessions" locks in, the violet **Configure Agents** button flares as a light sweep crosses. | You design your cockpit |
| C3 | 10–15 | **AI Agent Fleet.** Agent rows — Claude, Codex, Gemini, DeepSeek, Manus, Perplexity, ShipCode — as stacked slabs; checkboxes tick on one by one, slot counters climb, Fleet Utilization fills 6/6, **Launch Workspace** glows. | You command a fleet |
| C4 | 15–20 | **The grid assembles.** Six terminal panes fly in from the void and snap into a 3×2 grid (the donut-wedge move), colored CLI text streaming in each; the agent panel slides in from the right with the glowing ring globe and "● READY". | The machine comes alive |
| C5 | 20–25 | **LAUNCH GANG.** Full-screen matrix rain, the wizard stepper completes (ROSTER ✓ MISSION ✓ DIRECTORY ✓ CONTEXT ✓ NAME), the giant violet **LAUNCH GANG** button pulses and fires a ripple of light. | One button ships it |
| C6 | 25–30 | **End card.** Everything defocuses to black; the teal ring globe scales up gently, "**ShipSpace**" wordmark glows in beneath it, then "Set a Mission. Ship The Verdict." and **makeshiphappen.tech** — faint rain keeps falling. | Brand + call to action |

Swappable C5 alternates (same slot, same motion grammar): built-in browser opening GitHub,
or Mission Control's six gradient cards fanning out. Keep the film at ONE of these — 30s fits
exactly six beats, don't stuff it.

## 3. Conditioning frames (the part that makes it identical)

`~/Desktop/shipspace-ref-kit/real-ui/` — pulled at full res from the real app recording, 16:9
2560×1440 crops ready for upload:

- `A-configure-layout-16x9.png` → C2 start frame
- `B-agent-fleet-16x9.png` → C3 start frame
- `C-workspace-grid-16x9.png` → C4 END frame (the grid lands here)
- `D-gang-mission-16x9.png` → C5 alt start ("Define the mission")
- `E-gang-launch-16x9.png` → C5 start frame (Name your gang + LAUNCH GANG)
- `F-website-hero-16x9.png` → optional closing alt ("Set a Mission. Ship The Verdict.")
- Plus `*-full.png` ultrawide originals for custom crops.

C1 (cloth) and C6 (end card) have no screenshots — generate their stills with nano-banana
(section 6) or let the engine go pure text-to-video (no UI text to break).

## 4. SEEDANCE 2.0 @ OpenArt — per-clip recipes (Frame-to-Video → Start/End Frame)

Settings every clip: 16:9 · highest resolution offered (720p is fine for test passes; regenerate
finals at 1080p) · 5s · Audio OFF (score gets added in the edit) · Mode Normal.

Append this **guard clause** to every prompt:
> The interface is a real screenshot: every pixel of text, icons and layout is rigid and must not
> change, warp, morph or invent new elements. No people, no hands, no captions, no watermark,
> no camera shake.

**C1 — no frames, text only (or nano-banana still as start):**
"Cinematic product film in a pitch-black studio. A standing monolith draped in flowing black satin,
a circular wireframe-globe emblem embossed in the fabric, glowing faint teal through the weave.
One soft key light from upper right. The cloth ripples once in slow motion, then whips off to the
right in elegant billows — behind it, thin streams of glowing code glyphs in teal, violet and
magenta begin to rain down through the darkness like digital rainfall. Premium, mysterious,
Apple-keynote energy."

**C2 — start: A-configure-layout-16x9.png:**
"Slow cinematic push-in toward the centered panel while a soft white specular sweep travels across
its glossy surface left to right. The colored swatch row glints as the light passes. The faint
code-rain in the background keeps drifting downward slowly. Shallow depth of field, the panel
stays tack sharp."

**C3 — start: B-agent-fleet-16x9.png:**
"Gentle macro dolly drifting diagonally up-right across the panel, shallow depth of field racking
focus from the agent list to the fleet-utilization card. A soft violet glow pulses once on the
Launch Workspace button as a thin light sweep crosses the panel. Background code-rain drifts
slowly. Everything else perfectly still."

**C4 — end: C-workspace-grid-16x9.png (use END frame slot; no start frame):**
"Out of darkness, six dark terminal panels fly in one after another from different directions with
smooth overshoot easing and snap into a tidy grid, assembling the exact final interface; a sidebar
panel slides in from the right edge last, carrying a glowing teal ring emblem. Streams of tiny
colored text flicker alive inside each panel as it lands. Ends exactly on the provided frame,
perfectly frontal."

**C5 — start: E-gang-launch-16x9.png:**
"Slow push-in toward the large violet gradient button at the bottom while glowing code glyphs rain
down through the black background. The button pulses brighter twice like a heartbeat, then emits a
single soft ring of violet light that expands outward and dissolves. Cinematic, weighty, restrained."

**C6 — no frames, text only (or nano-banana end-card still as END frame):**
"Pure black screen with faint teal, violet and magenta code glyphs raining gently in the far
background. A glowing teal wireframe globe surrounded by a circular ring of small text fades in at
center and scales up slowly with a soft bloom. Beneath it the word 'ShipSpace' glows on in clean
teal letters, then a smaller line 'Set a Mission. Ship The Verdict.' in white and magenta, and
finally 'makeshiphappen.tech' in small grey type. One final gentle pulse of light. End card, locked
camera."

## 5. VEO 3 — 4 clips × 8s cut plan (Veo renders audio: use it for whoosh/score stems)

Merge beats: V1 = C1+rain ignition (8s) · V2 = C2→C3 cross-drift (8s) · V3 = C4 assembly (8s)
· V4 = C5 button fire → C6 end card (8s). Trim to 30 in the edit.
Use the same prompts as section 4, joined per pair, each with the guard clause, plus an audio line:
"AUDIO: dark minimal electronic pulse; a satin whoosh on the cloth; soft glass ticks as panels
land; one deep bass hit when the button fires; no voiceover, no speech."
Veo 3 takes one reference image per clip — give V2 `A-configure-layout-16x9.png`,
V3 `C-workspace-grid-16x9.png`, V4 `E-gang-launch-16x9.png`.

## 6. NANO-BANANA — still prep prompts (Image tab on OpenArt)

1. **Cinematize a screenshot** (per UI still): "Keep this interface screenshot pixel-perfect and
   unchanged. Place it as a glossy dark glass slab floating in a pitch-black studio void, tilted
   8 degrees with subtle 3D perspective, thin bright edge light along its border, soft reflection
   below it fading into black, faint teal and magenta code glyphs raining in the far background,
   gentle vignette. Do not redraw, rewrite or alter any text or icons in the screenshot."
2. **C1 cloth still:** "Photoreal cinematic studio shot, pitch-black void, single soft key light
   from upper right: a tall rectangular monolith fully draped in flowing black satin fabric, deep
   elegant folds, and a circular emblem embossed in the cloth — a wireframe globe inside a ring of
   small text — glowing faintly teal through the fabric. Premium tech-keynote mood, true blacks,
   no people, no text anywhere else."
3. **C6 end-card still:** "Pure black background with very faint thin streams of teal, violet and
   magenta code glyphs falling like digital rain. Centered: a glowing teal wireframe globe inside a
   luminous ring, above the word 'ShipSpace' in clean rounded teal letters with a soft outer glow,
   a thin line 'Set a Mission. Ship The Verdict.' in white with the last two words in magenta, and
   'makeshiphappen.tech' in small grey type at the bottom. Minimal, premium, cinematic."
   (nano-banana handles short text well — if the tagline garbles, regenerate or strip it and
   add the type in the edit.)

## 7. ONE-SHOT MASTER PROMPT (single-prompt engines / storyboard mode)

"30-second cinematic launch film for ShipSpace, an AI agent terminal IDE by MakeShipHappen.Tech.
Photoreal 3D product-film style: pitch-black studio void, faint matrix-rain of teal, violet and
magenta code glyphs falling in the far background throughout, dark glass UI slabs with glossy
clear-coat and hairline lit edges, traveling white specular sweeps, macro lens, shallow depth of
field, heavy directional motion blur on transitions.
0–5s: a monolith draped in black satin, a wireframe-globe ring emblem embossed and glowing teal
through the fabric; the cloth whips away in slow motion as code-rain ignites behind it.
5–10s: slow push-in on a floating dark setup panel titled 'Configure Layout' — a row of colored
swatches glints, session-grid templates light up in sequence, a violet 'Configure Agents' button
flares under a light sweep.
10–15s: macro dolly across an 'AI Agent Fleet' panel — rows named Claude, Codex, Gemini, DeepSeek,
Manus, Perplexity, ShipCode tick on one by one, a fleet meter fills to 6/6, a violet 'Launch
Workspace' button glows.
15–20s: six dark terminal panes fly in from the void with overshoot easing and snap into a 3×2
grid, tiny colored command-line text streaming alive in each; an agent panel slides in from the
right bearing a glowing teal ring globe and the status READY.
20–25s: full-screen code-rain; a wizard completes its steps and a huge violet gradient button
labeled 'LAUNCH GANG' pulses twice and fires an expanding ring of violet light.
25–30s: everything defocuses to black; the teal ring globe scales up at center, 'ShipSpace' glows
in beneath it, then 'Set a Mission. Ship The Verdict.' and 'makeshiphappen.tech'. Faint rain still
falling. AUDIO: dark minimal electronic score entering after one second of silence, satin whoosh on
the reveal, soft ticks as panels land, one deep bass hit on the button, final hit under the logo.
No people, no hands, no voiceover, no watermarks, no brands other than ShipSpace and
MakeShipHappen.Tech. UI text must stay rigid and legible, never morphing."

## 8. Assembly

- Cut points on the hits: 5 / 10 / 15 / 20 / 25 / 30.
- 1s silence → score in at the cloth move; biggest hit at 25s (button) and 28s (logo).
- Grade: crush blacks, protect the teal/violet/magenta glows, slight bloom on highlights.
- The HTML mock frames in `~/Desktop/shipspace-ref-kit/*.png` (Cascade-noir style) are optional
  B-roll only — the real-UI stills above are the source of truth for branding.
