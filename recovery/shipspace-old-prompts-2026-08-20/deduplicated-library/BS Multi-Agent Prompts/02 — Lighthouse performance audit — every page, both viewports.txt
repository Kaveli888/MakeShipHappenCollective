Working dir: vibe-academy-ui

Launch 5 parallel deep-dive agents using Lighthouse CLI. Test EVERY route on BOTH desktop and mobile profiles.

Agent split:
  Agent 1 (Discovery + Run): Enumerate all routes (parse sitemap + crawl). For each route, run Lighthouse CLI in mobile and desktop modes. Save raw JSON reports to ./lighthouse-reports/<route>/<device>.json
  Agent 2 (Performance Triage): Parse all reports. Build a matrix of LCP / INP / CLS / FCP / TBT / TTI per route per device. Flag every metric that fails Core Web Vitals thresholds.
  Agent 3 (Asset Analysis): Identify the heaviest assets across the site — images not optimized, fonts not preloaded, JS chunks too large, render-blocking CSS, third-party scripts impact.
  Agent 4 (Render Path): Audit the critical render path. Identify bundle splitting opportunities, lazy-load candidates, components that should be Server Components, hydration costs.
  Agent 5 (Mobile-Specific): Mobile-only issues — touch target sizing, viewport config, network throttling impact, mobile bundle weight, image srcset coverage.

Output:
  - Per-route scorecard (mobile + desktop) — green/yellow/red per metric
  - Site-wide asset/bundle report
  - Prioritized fix list: P0 (failing CWV) → P1 (close to threshold) → P2 (polish)
  - Estimated score improvement per fix
  - Quick wins (single-file changes worth >5 points)

Hard rules:
  - Test against the production build, not dev mode (run `npm run build && npm run start` first).
  - Throttle network + CPU like real Lighthouse does — don't run unthrottled.
  - Run each test 3x and report median (single runs are noisy).

Done = ./lighthouse-reports/ populated + scorecard table + ranked fix list + median values reported.