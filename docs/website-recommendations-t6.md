# t6 — Prioritized Website Recommendations: makeshiphappen.tech

**Role:** website-recommendations (synthesis)  
**Date:** 2026-07-09  
**Sources:** peer slices t2 (UX), t4 (brand), t5 (strategy); live site crawl; prior lighthouse synthesis (`lighthouse-reports/SYNTHESIS.md`); marketing/claims + website cluster audits (`docs/audit-v3/`); brand doctrine (`makeshiphappenAi/brand/*`); t1/t3 incomplete at synthesis time — content/SEO items filled from live + prior technical work.

**Code changes:** none (recommendations only).

---

## Executive summary

makeshiphappen.tech already has a strong product family story, founder authenticity, commercial rails (auth, Stripe, downloads, legal), and a coherent dark “builder OS” aesthetic.

What blocks conversion and trust is not missing pages in the abstract — it is **conflicting truth**:

| Conflict | Surfaces |
| --- | --- |
| **Price** | `/pricing` + Terms = **$40/mo**; ShipMind CTA + download paywalls = **$50/mo** |
| **Availability** | Pricing: “four downloadable tools **today**”; homepage product cards: ShipMind/ShipSpace/ShipTalk = **`available: false` → “Soon”**; ShipCode only “Live” |
| **Category** | Site title = “Vibe Coding Platform”; meta/company = private OS; ShipMind = multi-vertical second brain |
| **Downloads** | Primary nav **Download** + ShipSpace “Download for macOS” → empty shell / **404 installer** |
| **Proof** | Blog/docs/community/events look like real products but are largely **shells or fictional** (e.g. ShipJam metrics, phantom docs cards) |

**North star for this list:** one commercial truth, one brand umbrella, one conversion path, honest status — then performance, docs, and growth systems.

---

## How to use this list

- **P0** — Do before any marketing push; breaks trust or conversion today.  
- **P1** — High leverage within 1–2 weeks; GTM and journey.  
- **P2** — Performance, SEO, brand polish.  
- **P3** — Strategic growth / ops (docs, trust hub, content flywheel).  
- **Remove / do not do** — Explicit anti-goals.

Action verbs: **ADD · UPDATE · REMOVE · IMPROVE**.

---

## P0 — Launch-critical (truth + conversion)

### 1. UPDATE — Single price source of truth
**What:** Pick **one** founding price ($40 *or* $50) and ship it on:
- `/pricing`, Terms, FAQ copy  
- ShipMind PricingTeaser + CTA (`$50` today)  
- `/download`, `/download/shipmind|shipspace|shiptalk` paywall UI  
- Any Stripe plan metadata/copy that surfaces to users  

**Why:** Conflicting prices are a hard trust failure (t2, t4, t5, live code).  
**Owner files (indicative):** `app/pricing/page.tsx`, `app/terms/page.tsx`, `app/v3/shipmind/sections/PricingTeaser.tsx`, `app/v3/shipmind/sections/CTA.tsx`, `app/download/**/page.tsx`.

### 2. UPDATE — Product status matrix (Live / Beta / Soon / platforms)
**What:** Define one matrix and apply sitewide:

| Product | Suggested status (confirm against real installers) | Platforms |
| --- | --- | --- |
| ShipMind | Live or Beta (if downloadable) | macOS now; Win/Linux next |
| ShipSpace | Live or Beta | macOS… |
| ShipTalk | Live or Beta | macOS… |
| ShipCode | Live (npm) | cross-platform |
| ShipRelease | Soon / in development | — |

**Fix specifically:** homepage `products[].available` currently `false` for Mind/Space/Talk → shows **“Soon”** while pricing sells four tools today (`app/page.tsx` ~50–98).  
**ADD:** public `/status` or Trust Center section (same matrix).

### 3. UPDATE / REMOVE — Broken and empty conversion paths
| Action | Item | Evidence |
| --- | --- | --- |
| **UPDATE** | ShipSpace macOS download | `/shipspace-installer.zip` → **404** |
| **UPDATE** | ShipMCP CTA | `/products/shipmcp` → **404** (rename is ShipMind) |
| **UPDATE** | Footer/nav dead ends | `/learn/vibe-coding`, `/company/press`, `/status`, `/learn/tutorials` → **404** |
| **IMPROVE** | `/download` hub | 200 but auth/empty shell for anonymous users — must show: what you get, platforms, “sign in / subscribe” states, links to real install endpoints |

**Canonical download path after fix:** Pricing → checkout → account → `/download` with three (or four) installers + ShipCode npm instructions.

### 4. UPDATE — CTA hierarchy (one primary job)
**Primary (sitewide):** `Get access — $X/mo` → `/pricing`  
**Secondary:** `Sign in` · product “How it works”  
**Tertiary:** Discord (community, not product start)  

**REMOVE / demote confusion:** “Start Shipping,” “Get Started,” “Join the Workshop,” “Subscribe & download,” “Start Vibing” as peer-level primaries with different destinations.

### 5. UPDATE — Brand entity string
**Lock:** **MakeShipHappen** + domain makeshiphappen.tech  
**Scrub user-facing / meta:** `MakeShipHappen.Ai`, `MakeShipHappenTech` (ShipTalk packaging, `layout.tsx` authors/creator/publisher).

---

## P1 — GTM, messaging, and journey (1–2 weeks)

### 6. UPDATE — Pick one umbrella category
**Recommended (matches doctrine + company page):**

> **MakeShipHappen — a private operating system for independent builders.**  
> From knowledge → execution → capture → control → release.

**Demote “Vibe Coding Platform”** to keyword, social, or community slang — not the permanent `<title>` / OG master frame unless GTM deliberately rides that SEO wave for a fixed window.

**Canonical description (already close):** meta description is good; force title/H1 to match it.

### 7. UPDATE — Homepage hierarchy to match ShipMind-led GTM
Internal hierarchy: **ShipMind → ShipSpace → ShipTalk → ShipCode → ShipRelease**.

**Live problem:** hero = vibe coding + **ShipSpace gallery / “Deploy a swarm”** before ShipMind as front door.

**Concrete layout:**
1. Hero: OS promise + dual CTA: *Start with ShipMind* | *See the platform*  
2. ShipMind flagship band (3 bullets + one demo)  
3. Ecosystem strip → `/products`  
4. ShipSpace as execution engine (not the brand)  
5. ShipTalk / ShipCode short  
6. Founder letter  
7. Pricing CTA  

**REMOVE** banned/hype language from doctrine: **“swarm”** (gallery slide-3 label + “Deploy a swarm” headlines in `app/page.tsx`).

### 8. UPDATE — Audience ladder
| Surface | Audience |
| --- | --- |
| Home / company | Independent builders who ship apps & sites |
| ShipMind depth page | Use cases (research, study, work) — not a rebrand to “legal OS” |
| ShipSpace | Builders running agents/terminals |

**Soften** ShipMind legal/edu/privileged framing until Trust Center + accurate privacy language exist (t5, claims audit). Keep the good non-certification disclaimer; drop unsubstantiated “law-tech teams ship on” style claims if still present.

### 9. UPDATE — Lock product taglines
| Product | Canonical (proposal) |
| --- | --- |
| Brand | A private operating system for independent builders |
| ShipMind | **The second brain that listens** (restore from AGENTS; currently absent) |
| ShipSpace | One ADE. Every agent. You approve the verdict. |
| ShipTalk | Voice into any app — on your machine |
| ShipCode | Plain-language agents in your terminal |
| ShipRelease | Sign and ship on your terms *(when ready)* |

### 10. IMPROVE — Canonical home; kill parallel IA
- Pick **`/` as canonical**; `/v3` redirect or label experimental.  
- Early home link: **See the four tools → `/products`** (best orientation page today).  
- Clarify ShipCode in one line next to install: **free on npm vs membership-gated features**.

### 11. ADD — Post-purchase onboarding surface
After Stripe success: checklist  
1. Account confirmed  
2. Download ShipMind / ShipSpace / ShipTalk  
3. Install ShipCode (`npm i -g shipcode-cli`)  
4. Join Discord  
5. First 15 minutes per product  

Pricing promise of “direct founder access” needs a **process** (email, Discord role, office hours) — not only a bullet.

### 12. UPDATE / REMOVE — Hollow community & content shells
| Action | Item |
| --- | --- |
| **UPDATE** or **hide** | Empty showcase / “Built by Directors” → builder language |
| **UPDATE** | Stale/expired ShipJam as active; unverifiable prize/attendee claims until real |
| **UPDATE** or mark draft | Blog posts without real URLs (list items 404) |
| **UPDATE** | Docs hub cards that link nowhere real (ShipMind/Space/Talk docs 404; only ShipCode docs exist) |
| **IMPROVE** | Ship only real ShipLog entries; better empty state than fake feed |

---

## P2 — Performance, SEO, accessibility (technical)

*Grounded in lighthouse synthesis + live headers/meta + t2 404 list. Re-run Lighthouse after P0.*

### 13. IMPROVE — Mobile performance (site-wide CWV)
Prior findings (May 2026 audits; revalidate): desktop ~95–100; **mobile LCP often 6–8s** on marketing routes.

| Priority | Action | Est. impact |
| --- | --- | --- |
| P0-tech | Keep / verify **navbar hamburger** (present in current Navbar; was P0 historically) | Mobile nav usable |
| P1 | Convert static product pages to **Server Components**; drop entrance-only framer-motion | −mainthread, +perf pts |
| P1 | `optimizePackageImports` for lucide / framer | −bundle |
| P1 | Drop unused global CSS (e.g. xterm if still imported sitewide) | −CSS |
| P1 | Responsive grids: homepage terminal triptychs / mock 3–4 cols → stack &lt;640px | No overflow |
| P2 | Tap targets ≥44px; sticky mobile CTA on pricing | A11y + conversion |
| P2 | Split massive `app/page.tsx` into server shell + islands | Long-term maintainability |

### 14. UPDATE — SEO foundations
**Already good:** robots allow + sitemap, canonical, OG/Twitter cards, HSTS/CSP baseline, most routes 200.

| Action | Detail |
| --- | --- |
| **UPDATE** title/OG | Align with OS umbrella (not only “Vibe Coding Platform”) |
| **UPDATE** author meta | MakeShipHappen.Ai → MakeShipHappen |
| **ADD** per-route titles | Unique titles/descriptions for each product page (ShipMind = private second brain / NotebookLM-alternative keywords) |
| **ADD** structured data | Organization + SoftwareApplication for flagship products |
| **FIX** 404s | Crawl waste + trust (list in §3) |
| **IMPROVE** `/download` SSR | Meaningful HTML for crawlers/a11y, not client-empty shell |
| **IMPROVE** image LCP | Hero: prioritize one LCP image; don’t preload entire ShipSpace gallery + YouTube thumb |

### 15. UPDATE — Privacy vs analytics honesty
Live layout loads **Meta Pixel** (default ID present) and optional **GA4**. CSP allows Facebook + Sentry endpoints.

| Action | Detail |
| --- | --- |
| **UPDATE** Privacy Policy | Disclose actual analytics/ads pixels if used; remove unused vendors (historical: Sentry/Groq/OpenRouter listed when absent; DeepSeek used but omitted — re-verify live) |
| **ADD** cookie/consent posture | If EU/UK traffic matters: consent before marketing pixels |
| **IMPROVE** claims | “Private by default” on products ≠ “we run no marketing pixels on the marketing site” — say both clearly |

### 16. IMPROVE — Claim discipline (content accuracy / legal-marketing)
From claims audit + doctrine — treat as content updates:

| Pattern | Fix |
| --- | --- |
| Absolute “on-device / never leaves” | Mode-scoped: local mode vs cloud model egress |
| “Secure Documents” / legal teams as primary | “Local documents” / builder-first; keep non-cert disclaimer |
| ShipSpace “you always approve” | Only if auto-approve modes are disclosed |
| Artifact counts (10 vs 13 vs 20+) | One number, one source of truth |
| Agent roster | One set of role names (Coordinator/Builder/Scout/Reviewer *or* Architect/Builder/Tester/Reviewer — not both) |

---

## P3 — Strategic systems (business front door)

### 17. ADD — Trust Center (`/trust` or expand `/security`)
Minimum viable:
- Local-first model (what stays on disk; what leaves when)  
- BYO keys / keychain  
- Subprocessors (accurate)  
- Product status matrix  
- Vulnerability disclosure  
- No fake certifications  

Supports privacy GTM without enterprise theater.

### 18. ADD — Real docs MVP (all paid products)
| Product | Minimum docs |
| --- | --- |
| ShipMind | Install macOS, first source, first cited chat, privacy modes |
| ShipSpace | Install, first mission, approval model, BYOK |
| ShipTalk | Install, hotkey, engines (local vs cloud) |
| ShipCode | Already strongest — keep as reference quality bar |
| Account | Billing, cancel, download, team seats if any |

**REMOVE** phantom “API Reference / multi-agent guide” cards until real.

### 19. ADD — Changelog / ShipLog (real)
Back “frequent updates” with dated release notes. Even a simple markdown-backed page beats a fake blog.

### 20. ADD — Content → product funnel
- Real posts only; each ends at pricing/download  
- Footer links for YouTube / TikTok when channels are primary distribution  
- Showcase: founder-built apps first (matches “built for ourselves first”)

### 21. ADD — Segmented paths (lightweight)
Not a full rebrand — a chooser:
- “I need a private second brain” → ShipMind  
- “I need an agent workspace” → ShipSpace  
- “I live in the terminal” → ShipCode  
- “I need voice into any app” → ShipTalk  

### 22. IMPROVE — Roadmap honesty
`/company/roadmap` should mirror status matrix (ShipRelease, Win/Linux, team). Label Planned/Beta. Do not sell enterprise packaging yet.

---

## Explicit REMOVE / de-emphasize

| Remove or hide | Why |
| --- | --- |
| Conflicting $40/$50 | Trust |
| Homepage “Soon” on downloadable products | Contradicts pricing |
| “Deploy a swarm” / swarm gallery labels | Doctrine ban + hype |
| `/products/shipmcp` links | Renamed; 404 |
| Dead footer: press, vibe-coding guide, status (until real) | 404s |
| Fake community proof (ShipJam stats, empty Directors showcase) | “Real outcomes” brand |
| Phantom docs / API cards | Overpromise |
| Unowned open-source kit downloads if not real | Noise |
| Lifetime $1,200 offers | Not attorney-reviewed (t5) |
| Public ShipWatch / Ship AOS as OS map peers | Until Live + installers |
| Absolute privacy/security superlatives | Claims audit risk |

---

## Prioritized backlog (execution order)

| # | Priority | Action | Type | Primary sources |
|---|----------|--------|------|-----------------|
| 1 | P0 | Unify price sitewide | UPDATE | t2 t4 t5 live |
| 2 | P0 | Status matrix + fix homepage Soon badges | UPDATE | t2 t4 t5 code |
| 3 | P0 | Fix installer 404 + rebuild `/download` | UPDATE/ADD | t2 live |
| 4 | P0 | Kill broken footer/nav links (or ship pages) | REMOVE/UPDATE | t2 |
| 5 | P0 | One primary CTA hierarchy | UPDATE | t2 t4 |
| 6 | P0 | Normalize brand name (no .Ai / Tech mashups) | UPDATE | t4 meta |
| 7 | P1 | Lock OS umbrella; demote vibe-coding title | UPDATE | t4 t5 doctrine |
| 8 | P1 | ShipMind-first homepage hierarchy; ban swarm | UPDATE | t4 brand hierarchy |
| 9 | P1 | Canonical taglines | UPDATE | t4 AGENTS |
| 10 | P1 | Canonical home (`/` vs `/v3`); promote `/products` | UPDATE | t2 t5 |
| 11 | P1 | Post-purchase onboarding checklist | ADD | t2 t5 |
| 12 | P1 | Hollow community/blog/docs cleanup | REMOVE/UPDATE | t5 live 404s |
| 13 | P1 | Claim soften + number consistency | UPDATE | claims audit t1-proxy |
| 14 | P2 | Mobile LCP / server components / responsive mocks | IMPROVE | lighthouse |
| 15 | P2 | SEO titles + JSON-LD + download SSR | IMPROVE | t3-proxy |
| 16 | P2 | Privacy policy vs Meta/GA honesty | UPDATE | layout + policy |
| 17 | P3 | Trust Center | ADD | t5 business-protection |
| 18 | P3 | Docs MVP for Mind/Space/Talk | ADD | t5 |
| 19 | P3 | Real changelog + content funnel | ADD | t5 |
| 20 | P3 | Product chooser + honest roadmap | ADD | t2 t5 |

---

## Success metrics (after P0–P1)

| Metric | Target signal |
| --- | --- |
| Price/support tickets | Near-zero “wrong price / is it live?” |
| Download path | 0 404s on installer CTAs; download start rate up |
| Home → Pricing CTR | Up; Discord no longer steals primary intent |
| Mobile LCP (home, shipmind, pricing) | &lt; 2.5s (CWV good) after perf pass |
| Bounce on `/download` | Down (page explains state without looking broken) |
| Docs engagement | Time-on-page for real install guides |

---

## Source map (peer handoffs)

| Task | Role | Status used in t6 |
| --- | --- | --- |
| t1 | Content accuracy | Incomplete final; substituted with live content + claims audit |
| t2 | UX / navigation | Complete — conversion 404s, CTA chaos, journeys, download shell |
| t3 | SEO / performance | Incomplete final; substituted with lighthouse synthesis + live meta/route probe |
| t4 | Brand / messaging | Complete — umbrella conflict, entity names, taglines, hierarchy |
| t5 | Strategic alignment | Complete — commercial truth, Trust Center, docs, hollow community, non-goals |
| t6 | This document | Synthesis |

---

## Handoff

- **Implementers:** start at backlog #1–6 (P0) in `makeshiphappenAi/`; no design ambiguity — price, status, links, CTAs.  
- **Copy owner:** umbrella line + tagline lock (#7–9) against `brand/messaging.md` + `brand/doctrine.md`.  
- **t1/t3 owners:** if their finals land later, merge only net-new items; do not reopen closed P0 commercial truths.  
- **Do not expand scope** into enterprise packaging, lifetime offers, or public ShipWatch/AOS marketing until status matrix allows.

**t6 status:** complete  
**Artifacts:** `docs/website-recommendations-t6.md` only  
**Ready for:** implementation planning / ShipSpace execution tasks
