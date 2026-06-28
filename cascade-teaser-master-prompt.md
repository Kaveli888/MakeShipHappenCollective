# Cascade-Style Product Teaser — Master Prompt Kit

Source: `~/Desktop/tFjtxd6gS_IPb5Qt.mp4` — 25.07s, 1920x1080, 30fps, H.264, stereo AAC (Twitter export, created 2026-06-10).
Subject: launch teaser for **Cascade**, a crypto perpetuals trading platform. Music + SFX only, no voiceover.

---

## 1. What the video actually is (technique)

This is NOT screen capture. The entire UI is rendered as **physical 3D objects in a black void studio**:
every panel, pill, table row and chart is an extruded glossy slab (rounded corners, clear-coat
material with subtle leather/brushed grain visible at macro distance), lit by a single soft key light
plus animated **specular sweeps** that travel across the surfaces. Camera is a virtual macro lens with
very shallow depth of field and heavy directional motion blur. Think "Apple keynote hardware film,
but the hardware is the UI itself." (Production-wise: Cinema 4D/Blender + After Effects, or a
heavily post-processed Spline/Jitter scene.)

This matters for prompting: you describe *a cinematic studio film of physical objects*, not *a screen
recording*.

## 2. Shot-by-shot timeline (25s original)

| # | Time | Shot | Motion / transition |
|---|------|------|---------------------|
| 1 | 0.0–1.0 | Black frame; silhouette of a monolith (covered screen), top-right rim light only. Silence. | Light blooms in slowly. Music enters at ~1s. |
| 2 | 1.0–3.0 | Standing 16:9 screen draped in **black satin cloth**, brand logo faintly embossed in the fabric, catching light as cloth ripples. | Cloth slides/whips off to the right in slow-mo billows (whoosh SFX). |
| 3 | 3.0–8.0 | Macro dolly across the **top navigation bar** as 3D slabs: logo, "Primary Portfolio ▾" pill, Portfolio Value $104,090.00, P&L +$1,042.35 (+1.05%) in green, Cross Leverage 3.2x; second row: blue ETH coin pill "ETH 25x ⌘K", Mark Price $2,130.23, Oracle Price $2,140.41, 24H Change +$18.3/+0.87%, 24H Volume $1,508,000,644. Left sidebar icons (grid, line-chart [active, highlighted], target, orbit). | Slow lateral dolly right→left, rack focus, specular highlight sweep travels across the glossy bars. One pill ("ETH 25x ⌘K") flares bright white as light passes it. |
| 4 | 8.0–10.0 | **Markets table** lying almost flat like a tabletop; camera sweeps low across it with heavy motion blur. Header "Markets", search field, filter chips: All ★ Crypto Commodities Forex Index Stocks. Rows: AMD 10x, BNB 15x, BTC 15x, COIN 10x, CRCL 10x, ETH 25x, EUR 50x, GBP 25x, GOOGL 10x, HOOD 10x — with Last Price, 24H Change (red/green), 8H Funding, Volume, Open Interest columns, star favorites. | Fast whip-pan onto the table; rows light up as camera passes; settles to elevated 3/4 view. |
| 5 | 10.0–13.0 | Pitch black → a **mint-green chart line draws itself** with a glowing rounded dot at the tip, snaking across the void; camera pulls up and back; the line lands inside a "Performance over time" card that flattens to a frontal 2D dashboard view: tabs Total Balance / PnL, ranges 24H 7D 30D 3M [6M] YTD 1Y 2Y, big "$104,090.00", green pill "+$1,042.35 (+1.05%) Last 24H", gradient area fill, Jan–Dec axis, right axis 0–100,000. Stat cards above: Portfolio Value / PnL / 14D Volume $800,301.28. | Line draw-on is the hero move; ends on a clean flat 2D hold (~1s). |
| 6 | 13.0–16.0 | **Current Holdings** card tilted in 3D: tabs Positions/Cash, Filter button. A **donut chart assembles from flying 3D wedges** — glossy emissive green "petals" fly in from the right, snap into a ring around a dark pie (60.00%, $60,000.00; legend: Crypto $180,000.00 60.00%, second row 15.00%/$4,500.00). | Wedges fly in with overshoot/settle easing, strong green emissive glow, card rotates slightly toward camera. |
| 7 | 16.0–19.5 | Panels floating in dark space: **order-entry panel** close-up at a steep angle — tabs Limit/Market/Conditional, green Buy / Sell toggle, Available Balance $100,000.00, Current Position 2.52 ETH, Price 2,130.23 Mid %, Size ETH, leverage slider, Reduce Only, Take Profit/Stop Loss block (TP Price, SL Price, Gain %, Loss %, toggle), white "Place Trade ⌘↵" button, summary: Order Value $22,534.53, Margin Required $226.21, Liquidation Price $2,504.41, Fees $3.22, Price Impact None. Order-book columns and positions rows drift blurred in background. | Slow drift/parallax between floating slabs; rack focus pulls between layers. |
| 8 | 19.5–23.0 | The **complete trading terminal** lies tilted back ~30°, then rises/tilts upright to face the camera dead-on while a white specular sweep crosses it. Full dashboard: ETH-USD-PERP · 5 · CASCADE candlestick chart with volume, order book (red asks above / green bids below, Spread 1.93 0.100%), buy panel on right, bottom positions table: All Positions (4), Open Orders (2), Order History, Trade History — BTC 40x $68,000.60/1.11 BTC +1,024.26 +2.45%, SOL 20x -640.54 -2.45%, ETH 20x +32,326.23 +42.45%, Deposit ⌘D / Transfer ⌘T buttons top right. | "Stand up" hero move + light sweep; brief hold on the full product. |
| 9 | 23.0–25.0 | UI defocuses and dims to a dark blur; **white logo + "Cascade" wordmark** scale up gently in the center. End card. | Crossfade + scale-in; final bass hit lands exactly here (~24s). |

## 3. Design system (extracted tokens)

- **Background:** pure black studio (#000–#0a0a0a), faint floor reflection, vignette.
- **Panels:** charcoal #111418–#1a1d21 extruded slabs; corner radius ≈ 16–24px; glossy clear-coat over a subtle grain; 1px hairline lighter edge; soft drop shadow into the void.
- **Brand logo:** six white rounded rectangular bars arranged in a hexagonal pinwheel (camera-shutter / cascade spiral motif).
- **Typography:** geometric grotesque sans (Poppins / PP Neue Montreal feel), medium weight, slightly wide; tabular figures for all numbers; white #FFFFFF primary, gray #9aa0a6 labels.
- **Accent green (brand + positive):** bright mint #4ADE80 / #34D399, emissive glow; deep emerald gradient fills (#065f46 → transparent).
- **Negative red:** #ef4444 / #f87171.
- **Coin colors:** ETH blue circle #3b82f6, BTC orange, BNB yellow.
- **Components:** rounded-full pill buttons with thin strokes, leverage badges ("25x"), ⌘K/⌘D/⌘T keyboard chips, star favorites, segmented tabs with underline, toggles, sliders.
- **Light:** one soft white key from top-right + traveling specular streak; everything else falls to black.

## 4. Audio blueprint

- 0–1s silence → music in at 1s.
- Mid-tempo dark electronic score; energy bumps at each transition (~6s, ~9s, ~17s, ~20s); loudest hit at ~24s under the logo (RMS peaks at -14.8dB there vs -18 to -21dB average).
- Cloth whoosh at the reveal; soft whooshes on whip transitions; subtle UI tick/glass SFX as elements snap in.
- No voiceover.

---

## 5. MASTER PROMPT (one-shot, 15–30s engines)

> Use as a single prompt for engines that handle long durations (Veo 3.1 w/ extension chaining, Kling, Hailuo). Swap the {VARIABLES} to rebrand.

```
Cinematic product launch teaser, 25 seconds, 16:9, photoreal 3D render style — an
"Apple keynote hardware film" where the hardware is a software interface. Pitch-black
studio void, single soft white key light from upper right, faint floor reflections,
shallow macro depth of field, heavy directional motion blur, traveling specular light
sweeps across glossy surfaces. No people, no hands, no devices — the UI panels
themselves are physical objects: dark charcoal (#15181c) extruded slabs with rounded
corners, glossy clear-coat with subtle grain, hairline lit edges, floating in black space.

SEQUENCE:
0-3s — A standing rectangular screen draped in black satin cloth, the {BRAND_LOGO}
faintly embossed in the fabric catching rim light; the cloth ripples and whips away in
slow motion to the right.
3-8s — Extreme macro dolly across a dark trading-app navigation bar rendered as 3D
slabs: a pill reading "{HERO_PILL_TEXT}", glowing white as a specular streak passes;
stat labels and numbers in clean geometric sans ("Portfolio Value $104,090.00",
"+$1,042.35 (+1.05%)" in mint green #4ADE80); a vertical icon sidebar on the left.
8-10s — Whip transition: a markets data table lies flat like a tabletop; the camera
sweeps low across rows of asset tickers with red and green 24-hour changes, motion-blurred.
10-13s — Black void: a glowing mint-green line chart draws itself with a luminous round
dot at its tip, snaking upward; camera pulls back as it settles into a flat frontal
"Performance over time" dashboard card with a soft green gradient area fill and the
figure "$104,090.00".
13-16s — A portfolio card tilted in 3D: glossy emissive green donut-chart wedges fly in
one by one with overshoot easing and snap into a ring reading "60.00%".
16-19s — Floating panels drift in parallax: a close-up order-entry form with a green
"Buy" toggle and a white "Place Trade" button, order-book columns blurred behind it.
19-23s — The complete trading terminal lies tilted back, then rises to face the camera
dead-on as a white light sweep crosses it: candlestick chart, red/green order book,
positions table — one confident hold on the full product.
23-25s — The interface defocuses into darkness; the white {BRAND_LOGO} and the wordmark
"{BRAND_NAME}" scale up gently, centered. End card.

GRADE: true blacks, white text, single mint-green accent (#4ADE80) for positives and
glow, red (#ef4444) only inside data; restrained, premium, fintech-noir.
AUDIO: one second of silence, then a dark mid-tempo electronic score; whoosh on the
cloth reveal, soft hits on each transition, hardest bass hit landing on the logo at 24s.
No voiceover, no captions.
```

Variables: `{BRAND_NAME}` = Cascade · `{BRAND_LOGO}` = "six white rounded bars in a
hexagonal pinwheel" · `{HERO_PILL_TEXT}` = "ETH 25x ⌘K".

## 6. Per-shot prompts (for 5–8s engines, cut together)

Prepend this **global style block** to every shot:

```
STYLE: photoreal 3D render, cinematic product film. Pitch-black studio void, single soft
key light upper-right, traveling specular sweeps, macro lens, shallow DOF, heavy motion
blur, faint floor reflection. UI panels are physical objects: dark charcoal extruded
slabs, rounded corners, glossy clear-coat, hairline lit edges. Text: white geometric
sans; labels gray; positives mint green #4ADE80 with soft glow; negatives muted red.
Premium fintech-noir, true blacks, no people, no devices, no captions.
```

1. **Cloth reveal (5s):** "A standing 16:9 monolith draped in flowing black satin, a pinwheel logo embossed in the fabric catching rim light; after a beat the cloth whips off to the right in slow-motion billows, revealing the glowing edge of a dark interface. Camera locked, slight push-in."
2. **Nav macro dolly (6s):** "Extreme macro lateral dolly across a dark trading-app navigation bar built of 3D slabs: a glowing pill 'ETH 25x ⌘K' with a blue coin icon, stats 'Portfolio Value $104,090.00' and '+$1,042.35 (+1.05%)' in mint green, vertical sidebar of white line icons. A white specular streak travels across the glossy surfaces as the camera moves; rack focus between foreground and background rows."
3. **Markets sweep (4s):** "A dark markets data table lying nearly flat like a tabletop in black space; low-angle camera sweeps across it fast with strong motion blur: rows of crypto and stock tickers with round icons, leverage badges, red and green price changes lighting up as the camera passes; settles into an elevated three-quarter view."
4. **Chart draw-on (5s):** "In pure darkness a luminous mint-green line draws itself, a glowing rounded dot at its tip, curving and climbing; the camera pulls up and back as a dashboard materializes around it — gradient area fill under the line, big white figure '$104,090.00', a green pill '+$1,042.35 (+1.05%)'; ends flat and frontal like a 2D dashboard."
5. **Donut assembly (4s):** "A dark portfolio card tilted in 3D space titled 'Current Holdings'; glossy emissive green donut-chart wedges fly in from off-screen one after another with overshoot easing and snap into a ring reading '60.00%', casting green glow on the panel."
6. **Terminal rise (5s):** "A complete dark trading terminal — candlestick chart, red and green order book, buy panel, positions table — lies tilted back 30 degrees in black space, then rises and tilts upright to face the camera dead-on while a white light sweep crosses its glossy surface; one confident frontal hold."
7. **Logo end card (3s):** "The interface falls out of focus into darkness; a white pinwheel logo and the wordmark 'Cascade' in clean geometric sans scale up gently in the center of the black frame; a final pulse of light. End card."

## 7. THE ONE-SHOT PIPELINE — image-conditioned generation (use this, not text-only)

**Truth first:** no engine produces an *identical* video from text alone. Text prompts are lossy —
the model has never seen Cascade's exact layout, and video models cannot render legible UI text
(numbers come out as gibberish). The professional workflow is **image-to-video with frame
conditioning**: you hand the engine an exact picture of the shot (and ideally the end picture too),
and the prompt describes ONLY the motion. The image carries 100% of the design; the prompt carries
the camera. This is how you get a one-shot, faithful result.

**Reference kit:** `~/Desktop/cascade-ref-kit/` — 14 full-resolution frames pulled from the source,
named per shot (`shotN-name-start.jpg` / `-end.jpg`).

### Per-shot recipe (start frame + end frame + motion-only prompt)

Use engines that accept first+last frame: **Kling (start/end frame), Runway Gen-4 (keyframes),
Luma Dream Machine (keyframes), Veo 3.1 (first/last frame + reference images), Pika (keyframes)**.
Generate each shot at its native length, then cut together on the beat.

Append to every motion prompt: *"The interface layout, text and numbers are rigid and must not
change, warp or morph. No new elements appear. No people, no captions, no camera shake."*

| Shot | Start frame | End frame | Len | Motion-only prompt |
|------|------------|-----------|-----|--------------------|
| 1 Cloth reveal | shot1-cloth-start | shot1-cloth-end | 4s | "Studio lighting slowly blooms across the draped satin. The cloth ripples gently in slow motion, then begins to slide off toward the upper right, billowing as it goes. Camera locked with a very slight push-in." |
| 2 Navbar macro | shot2-navbar-start | shot2-navbar-end | 5s | "Slow lateral macro dolly from right to left across the glossy interface slabs. A soft white specular streak travels across the surfaces, briefly flaring on the pill button. Shallow depth of field racks focus from the foreground row to the background row. The UI itself is completely static." |
| 3 Markets sweep | shot3-markets-start | shot3-markets-end | 3s | "Fast low-angle sweep across the table decelerating smoothly to a stop at an elevated three-quarter view; heavy motion blur at the start resolving to tack-sharp at the end. A thin edge light glints along the table's near edge as the camera settles." |
| 4 Chart draw-on | shot4-chartline-start | shot4-chartline-end | 5s | "The glowing mint-green line continues drawing itself forward, its luminous dot leading, while the camera rises and pulls back smoothly; the dashboard card around it brightens into view and the view flattens to a perfectly frontal 2D composition." |
| 5 Donut assembly | shot5-donut-start | shot5-donut-end | 3s | "The glossy green wedges fly in from the right one after another with a slight overshoot and settle into the donut ring; their emissive glow casts soft green light onto the panel. The card rotates a few degrees toward the camera as it completes." |
| 6 Order panel drift | shot6-orderpanel | (none) | 4s | "Slow parallax drift between floating interface panels; the camera glides a few degrees around the order panel while focus racks from the blurred background columns to the sharp foreground panel. Everything else is still." |
| 7 Terminal rise | shot7-terminal-start | shot7-terminal-end | 4s | "The full terminal tilts upright to face the camera dead-on, like a monolith standing up, while a white specular sweep crosses its glossy surface from left to right. Ends in a perfectly frontal, symmetrical hold." |
| 8 Logo end card | shot7-terminal-end | shot8-logo-endcard | 3s | "The interface falls out of focus and dims into darkness while the white logo and wordmark fade in and scale up gently at the center. A final soft pulse of light, then hold." |

### Assembly
Cut at: 4 / 9 / 12 / 17 / 20 / 24 / 28s (≈28s total — trim shot tails to land 25s).
30fps, 1080p. Score: dark electronic, hits on every cut, biggest hit under the logo. 1s of
silence before the music enters.

### The remix step (your end goal)
Because the design lives in the *images*, rebranding = editing 14 stills, not re-prompting video:
1. Take each ref frame into an image-edit model (GPT-image / nano-banana / Flux Kontext) — or
   better, rebuild the UI as real HTML/Remotion frames — and swap: logo, wordmark, accent color,
   pill text, table contents (e.g. ShipSpace sessions instead of tickers).
2. Run the exact same motion prompts over your edited frames.
Same film, your brand, and the text stays legible because you authored the pixels.

## 8. Reality check + upgrade path (the "build it up a notch" plan)

- **AI video engines will not render legible UI text reliably.** The numbers/labels will be
  gibberish up close. The original avoids this because the UI is a real asset. Strategy:
  - Use AI gen for the *atmosphere shots* (cloth reveal, light sweeps, logo card) — they have no text.
  - Build the UI shots from a **real rendered UI** (your Remotion pipeline, or React UI →
    screenshots → 3D-extruded panels in Blender/Spline, or Remotion with 3D CSS transforms +
    animated gradient "light sweeps"). You already have `shipspace-promo/` — this style is
    achievable there: black void, panels with `transform: perspective() rotateX()`, masked
    moving white gradient for the specular sweep, motion blur via frame-accumulation.
- **To rebrand for ShipSpace:** swap logo/wordmark, keep the grammar: cloth reveal → macro
  pill shot (e.g. a terminal tab pill "claude ⌘K") → table sweep (sessions/workspaces list) →
  chart draw-on (tokens/commits over time) → component assembly (panel grid flying in) →
  full app rises to face camera → logo card. Same 7-beat skeleton, same lighting, same audio map.
```
