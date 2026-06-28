# Publisher Routing — omni-release

How an approved post gets from the queue to a platform. Two modes sit behind one
interface (`Publisher` in `src/core/types.ts`), so official-API publishing can
replace browser-assisted publishing later without touching the orchestrator.

> Implementation: `src/publish/publishers.ts` (adapters + route resolution) and
> `src/publish/readyToPost.ts` (the fallback package writer). The orchestrator
> (`src/runs/runLane.ts`) decides queue vs. live and always writes a
> ready-to-post package so a post is **never** silently dropped.

---

## Modes

### `queue` (default — safe)

Nothing is sent to a live platform. Every approved post is written to
`ready-to-post/<run-id>.md` for a human to post manually. This is what runs do
unless you explicitly pass `--mode live`.

### `live` (opt-in)

The orchestrator asks the per-platform publisher to post. If the publisher
**cannot** publish live (missing credentials / no session) or the attempt fails,
the post is saved to `ready-to-post/` with the failure reason recorded — it is
never lost.

---

## Routes

Each platform resolves to one route. Override per platform with
`OMNI_ROUTE_<PLATFORM>` = `api` | `browser`.

| Platform   | Default route | Goes live when…                                              |
|------------|---------------|-------------------------------------------------------------|
| `x`        | `api`         | `OMNI_X_API_KEY`, `OMNI_X_API_SECRET`, `OMNI_X_ACCESS_TOKEN`, `OMNI_X_ACCESS_SECRET` all set |
| `linkedin` | `api`         | `OMNI_LINKEDIN_ACCESS_TOKEN`, `OMNI_LINKEDIN_AUTHOR_URN` set |
| `facebook` | `api`         | `OMNI_FACEBOOK_PAGE_ID`, `OMNI_FACEBOOK_PAGE_TOKEN` set      |
| `browser`  | `browser`     | `OMNI_BROWSER_SESSION` set **and** a session adapter wired   |

### A. API mode

For official platform APIs (X, Meta/Facebook Pages, LinkedIn). Credentials come
from the environment (never source). In the current MVP the credential **gate**
is implemented but the live API calls are not — so even with credentials present,
an attempt returns `failed` and falls back to a ready-to-post package. This is
the seam where real API clients drop in later.

### B. Browser-assisted mode

For the no-paid-API workflow: drive a logged-in Chrome/browser session
(Playwright or the Claude-in-Chrome bridge) behind the same `Publisher`
interface. Not wired in the MVP; `browser`-routed posts fall back to
ready-to-post until a session adapter is added.

---

## The ready-to-post fallback

`ready-to-post/<run-id>.md` always contains everything needed to post by hand:
date/time, lane, topic, sources, proof image path, per-platform captions,
hashtags, CTA, failure reason, and manual posting instructions. List the queue
with `npm run queue:list`.

---

## Adding a new platform

1. Add it to the `Platform` union and `DEFAULT_PLATFORM_LIMITS` in `src/core/`.
2. Add hashtag rules for it in `hashtag-rules.md`.
3. Add its credential keys to `API_CREDENTIAL_KEYS` in `src/publish/publishers.ts`
   (or route it to `browser`).
4. Add the platform to the lanes that should target it in `src/core/config.ts`.
