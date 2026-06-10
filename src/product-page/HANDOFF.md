# Product Page — Layout Scaffold (t1 → peers)

This is the **structure-only** scaffold owned by t1 (frontend layout). Peers fill the slots.

## File map

```
src/product-page/
├── layout.tsx              page shell + skip link
├── page.tsx                section composition order
├── styles.css              layout-only CSS (no brand/animation)
├── components/
│   ├── Container.tsx       width-constrained wrapper
│   └── Section.tsx         section primitive (variants: default|muted|accent|inverse)
└── sections/
    ├── Nav.tsx
    ├── Hero.tsx
    ├── SocialProof.tsx
    ├── Features.tsx
    ├── HowItWorks.tsx
    ├── Pricing.tsx
    ├── FAQ.tsx
    ├── CTA.tsx
    └── Footer.tsx
```

## Section order (page.tsx)

Nav → Hero → SocialProof → Features → HowItWorks → Pricing → FAQ → CTA → Footer.

Rationale: trust ladder (proof early), feature → mechanism → price, FAQ addresses objections right before the final ask.

## Slot conventions

Every slot is marked with `data-slot="<id>"` so peers can locate them deterministically.

- **t2 (assets/animations)**: `data-slot="*-icon"`, `*-media`, `logo-N`, `brand-mark`, `footer-social`. Hero media frame is `data-slot="hero-media"`.
- **t3 (copy)**: every visible text slot. Headlines/subs/eyebrows/CTA labels/FAQ Q&A/footer links. Empty children — fill with strings or i18n keys.
- **t6 (backend)**: interactive elements carry `data-action="<verb>"`:
  - `data-action="signup"` on the CTA `<form>` (POST target is `#` — wire real endpoint).
  - `data-action="hero-primary"`, `"hero-secondary"`, `"nav-cta"`, `"sign-in"`, `"select-tier-*"` on the buttons.

## Accessibility scaffolding (for t4)

- Skip link at top of `pp-root`.
- `<main id="main">` target.
- Landmarks: `<header role="banner">`, `<nav aria-label="...">`, `<main>`, `<footer role="contentinfo">`.
- Each `<Section>` gets an `aria-label`.
- FAQ uses native `<details>/<summary>` (keyboard accessible by default).
- Email input has a visually-hidden `<label>`.
- `@media (prefers-reduced-motion)` already neutralizes animations — t2 should respect this.
- Focus styles via `:focus-visible` on `.pp-btn`.

## Consistency hooks (for t5)

- Spacing tokens: `--pp-stack-sm/md/lg/xl`, `--pp-section-y`, `--pp-gutter`.
- Radii: `--pp-radius-sm/md/lg`.
- Containers: narrow=720, default=1080, wide=1280.
- Section variants: `default | muted | accent | inverse`.
- Type primitives: `.pp-h1/h2/h3`, `.pp-lede`, `.pp-body`, `.pp-eyebrow`.
- Button primitives: `.pp-btn` + `--primary|--ghost`, `--lg`, `--block`.

Brand colors and final type are intentionally neutral here — swap a theme layer at `:root` to apply Signature theme without touching markup.

## What t1 did NOT do (handoff)

- No copy: every text slot is empty.
- No imagery, icons, or animation: media frames are placeholder boxes.
- No backend wiring: form posts to `#`, buttons are anchor placeholders.
- No analytics events: add via `data-action` selectors when t6 is ready.
- No final visual theming: t5 owns colors, type, spacing polish.

## Out-of-scope concerns flagged

- The repo root has two existing HTML mockups (`shipmind-product-page-mockup*.html`) — t5 should reconcile this scaffold against the editorial v2 mockup if Shipmind is the target product.
- Framework assumption: React/Next-style files. If the orchestration expects plain HTML or another framework, raise it before t6 begins wiring.
