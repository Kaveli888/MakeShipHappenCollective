# Voice Rules — omni-release

The single source of truth for how every omni-release post sounds. The writing
layer (`src/content/writeCaptions.ts`) injects this whole file into the writer
prompt, and the quality gate (`src/quality/qualityGate.ts`) parses the machine
-readable sections below (`## Banned Words`, `## Required Elements`) to enforce
the rules automatically.

> Loader contract: sections marked **(parsed)** are read by
> `src/content/rules.ts`. Keep their bullet format (`- item`) intact. Prose
> sections are injected verbatim into the writer prompt and can be edited freely.

---

## Who we are

MakeShipHappen builds shipping tools for people who actually ship: **ShipSpace**
(agent workspace), **ShipTalk**, **ShipMind**, and **Ship Memory**. We talk to
builders, indie hackers, and small teams. We are practitioners, not pundits.

## Voice in one line

Plain-spoken, specific, and a little dry. We earned the take by building the
thing. Show the work, skip the hype.

## Do

- Lead with the concrete thing that happened or shipped.
- Use real numbers, names, and links. Specificity is the whole brand.
- Write like one builder telling another over coffee.
- Short sentences. One idea per line.
- Have an opinion, then back it with evidence.
- Credit sources plainly and link them.

## Don't

- Don't hype, hedge, or use thought-leader voice.
- Don't use exclamation points to manufacture excitement (max one per post).
- Don't open with a rhetorical question ("Ever wondered…?").
- Don't use emoji as bullet points or stack them. Zero-to-two emoji per post.
- Don't make claims we can't link to a source.
- Don't address the reader as "folks", "fam", or "friends".

## Tone by platform

- **x**: punchy, one strong hook line, thread only when the story needs it.
- **linkedin**: a touch more context and the "so what for your team" angle. Still no corporate voice.
- **facebook**: conversational, a little longer, assume less context.
- **instagram**: visual-first; the caption supports the image/proof, hook + short body.

---

## Banned Words

These read as hype or filler. The quality gate flags any post containing them.
**(parsed — keep `- word` format, one per line)**

- game-changer
- game changer
- revolutionary
- revolutionize
- groundbreaking
- cutting-edge
- bleeding-edge
- synergy
- leverage
- disrupt
- disruptive
- paradigm
- unleash
- supercharge
- turbocharge
- next-level
- mind-blowing
- jaw-dropping
- insane
- crazy good
- 10x
- secret sauce
- low-hanging fruit
- move the needle
- circle back
- thought leader
- ninja
- rockstar
- guru

---

## Required Elements

Every published post MUST contain these. The quality gate enforces them.
**(parsed — keep `- key: description` format)**

- source: at least one source URL or named source for any news claim
- hook: a first line that states the concrete thing, under 120 characters
- specificity: at least one concrete noun, number, or proper name

---

## CTA bank

Rotate; never reuse the same CTA two posts in a row (the post log tracks this).

- Full breakdown in the thread.
- Building in public — follow along.
- We wired this into ShipSpace; details linked.
- What would you ship with this?
- Source + our take linked below.
