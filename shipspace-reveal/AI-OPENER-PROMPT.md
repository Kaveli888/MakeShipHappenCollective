# ShipSpace Reveal — AI Silk-Opener Master Prompt

The Remotion comp has a slot for an AI-generated cinematic opener that replaces
Scene 1's background (the typed "Set a mission." text stays as a Remotion overlay,
so no AI text artifacts are possible).

## The golden rule

**Never let the AI render UI or words.** Fabric, light, and atmosphere only.
Every garbled "B-confiure-16x9" and "Ship The Verdicit" in the last attempt came
from asking the model to show screens and type. Real UI and all typography are
composited in Remotion afterward.

## Master prompt (Seedance 2.0 / OpenArt, 16:9, 4s, 1080p+)

> Cinematic product film opening shot. Complete darkness. A tall monolith draped
> in black silk cloth stands centered in an infinite black void. Beneath the silk,
> a wireframe globe emblem glows soft teal-cyan, its light bleeding through the
> fabric and illuminating the folds from within. Ultra-realistic cloth physics:
> heavy satin weight, soft specular highlights, deep folds. In the far background,
> faint vertical streams of glowing characters rain downward slowly — teal, magenta
> and violet, heavily defocused, like distant digital rainfall. Slow push-in toward
> the monolith with luxury commercial pacing. Volumetric haze, shallow depth of
> field, subtle atmospheric particles drifting through a single soft key light.
> At the end of the shot the silk begins to slip downward, just starting to reveal
> a hard glossy black edge underneath. The shot ends before anything under the
> cloth is visible.
>
> No text. No letters. No numbers. No words. No logos. No user interface. No
> screens. No buttons. No people. No hands. The glowing characters in the
> background must be abstract and unreadable, fully out of focus.

### Negative prompt (if the tool accepts one)

> text, words, letters, typography, captions, subtitles, UI, interface, screen,
> monitor, buttons, watermark, people, hands, faces, readable characters

## Per-clip notes

- Generate at least 4 seconds; the comp uses the first **3.2s (96 frames @ 30fps)**.
- Ask for several seeds and pick the take where the cloth motion peaks near the
  end — the cut to the Fleet scene lands on that motion.
- The emblem under the cloth should read as a glowing sphere, not the literal
  logo — Remotion shows the real emblem at the end card, so close is good enough.

## Dropping it in

1. Save the clip as `public/opener.mp4` in this project.
2. In `src/theme.ts`, set `USE_AI_OPENER = true`.
3. Re-render: `npm run render`.

The typed mission text, SHIPSPACE eyebrow, and push-in zoom render on top of the
footage automatically.
