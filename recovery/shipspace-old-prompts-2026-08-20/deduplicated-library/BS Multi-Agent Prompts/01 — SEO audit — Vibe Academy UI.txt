Working dir: vibe-academy-ui

Use the Bridge SEO skill. Launch 5 parallel subagents with distinct mandates so they don't duplicate work:

  Agent 1 (Technical SEO): sitemap.xml, robots.txt, canonical tags, hreflang, structured data (JSON-LD), redirects, status codes, indexability.
  Agent 2 (On-Page SEO): meta titles + descriptions per route, heading hierarchy (one H1 per page, logical H2/H3), alt text, internal link graph, anchor text quality.
  Agent 3 (Core Web Vitals + Crawl): LCP, INP, CLS, render-blocking resources, JS bundle size impact, lazy-loading, font loading strategy.
  Agent 4 (Content SEO): keyword coverage vs. product positioning, content depth per page, missing target queries, competitor gap analysis (Coursera, Udemy, Vibe Coding adjacent).
  Agent 5 (Schema + Social): Schema.org markup for Course / Article / Organization, Open Graph tags, Twitter cards, social preview testing.

Output a single consolidated structured plan:
  - Findings table: Priority (P0-P3), Effort (S/M/L), File:line, Issue, Fix, Expected impact
  - Top 10 actions ranked by impact/effort ratio
  - Quick wins (≤30 min each) listed separately
  - Anything blocked by infra/decisions I need to make

Do NOT implement yet. Audit + plan only.

Done = consolidated plan delivered + sorted by impact/effort + quick wins called out + waiting on my approval.