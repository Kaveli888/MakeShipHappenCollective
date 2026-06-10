# Legal Risk Status — Honest Snapshot

_Date: 2026-06-08 · Plain-language status after the remediation sprint. **This is advisory, not legal advice.** It reflects risk *reduction*, not immunity, and is not a substitute for a licensed attorney reviewing your actual situation._

---

## 🟢 GREEN — handled, live, low risk now

- **Website marketing claims** — the false "documents never leave" / "100% on-device" statements are corrected and live on makeshiphappen.tech.
- **Cancel / billing path** — real, reachable Stripe billing portal + account link (satisfies the FTC "cancel as easy as you signed up" rule). Live.
- **Terms, AUP, Subprocessor list, Privacy** — updated and live.
- **Database protections** — Stripe webhook replay-guard, checkout rate-limiting, and invite email-confirmation are applied and active.
- **GPL ffmpeg (Apple Silicon)** — clean LGPL build done; a build-time gate now blocks shipping any GPL ffmpeg. No GPL binary has been distributed.

## 🟡 YELLOW — reduced, but finish before your next move

- **Desktop apps (ShipTalk / ShipMind / ShipSpace)** — the consent gates and ffmpeg fix are **written but not yet in a released build, and no users have the apps yet.** That means there's no live exposure today. The one rule: **the first build anyone downloads must be the fixed one** — do not hand out old builds. Before that release: finish the Intel (x86_64) LGPL ffmpeg build so the license gate passes.
- **Deletion / export** — a written, logged manual runbook exists (legally defensible for a solo operator who actually follows it). The desktop "delete" buttons still leave some raw files on disk — clean that up in the next app release.

## 🔴 RED — still genuinely exposed

- **No LLC.** This is the big one. Right now every contract, every liability cap, and every term is between your customers and **you personally** — there is no company shield, so a claim lands on you directly. Forming the entity is the single highest-value protection remaining. _(Owner: planned soon.)_
- **No attorney has reviewed any of this.** Everything above is a structured self-audit. Before scaling paid sales, a one-time review by the right lawyer converts "probably fine" into "actually covered."

---

## Bottom line

You took your protections from *findings on paper* to *live in production*, and you closed the specific, identified exposures that were within reach. That genuinely lowers your risk. It does **not** make you lawsuit-proof — nothing does. The two remaining real shields are **forming the LLC** and **a lawyer's eyes**, in that order.
