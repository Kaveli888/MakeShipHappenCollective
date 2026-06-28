# Implementation Roadmap & Sprint 1

## Phasing (build the foundation before chasing platforms)

### Phase 0 — Cleanup & safety (do first, ~1–2 days)
- Archive/delete divergent `~/omni-release` copy; declare `Documents/.../omni-release` canonical.
- Fix S1 (CSP), S2 (`open_path` validation), S9 (`bundle.targets`).
- Add `npm audit` + `cargo audit`; pin lockfiles.

### Phase 1 — Foundation (no live publishing yet)
- Stand up backend (Supabase: Auth + Postgres + Storage) and apply the schema in `02-…DATA-MODEL.md`.
- Cloudflare in front of the public API.
- **Media Library**: chunked video upload → object storage; extract duration/resolution/aspect/thumbnail
  (ffmpeg, already on this machine); validate size/MIME; CRUD + statuses.
- **Composer**: master post + per-platform overrides UI; reuse engine for AI caption/hashtag assist + proof.
- **Calendar UI**: month/week/day, drag-drop, status/platform filters, timezone-aware (local drafts ok).
- Local-only "draft" mode still works with no account (keep current value).

### Phase 2 — YouTube (first real platform; most mature)
- Google OAuth (PKCE in app, exchange on backend), token vault, refresh.
- Resumable `videos.insert` upload via the worker; `thumbnails.set`; scheduled publish via `publishAt`+private.
- Store confirmed `external_url`; publish_attempts logging; mock mode + dry-run.
- **Definition of done for every platform from here on:** OAuth + upload + confirmed-URL capture +
  retry/idempotency + audit log + mock mode + capability descriptor wired into Composer/Calendar.

### Phase 3 — Meta (Facebook + Instagram together; shared app)
- One Meta app, App Review for Advanced Access; Page + IG Business/Creator linking.
- FB Page video/Reels + native scheduled posts; IG container→publish (Reels/video).
- Document review requirements + business-account prerequisites in-app.

### Phase 4 — TikTok
- Content Posting API; ship **draft/inbox fallback first** (works pre-approval), direct post after approval.

### Phase 5 — X
- **Verify current tier + pricing first** (gate the work on cost). OAuth 2.0 + chunked media upload + post.
- Replace existing text-only stub.

### Phase 6 — Twitch (reframed)
- No VOD upload. Helix: stream metadata/announce, clip creation, VOD/clip URL + metadata capture, embed, analytics.
- UI must set correct expectations (not a "post a video" target).

### Phase 7 — Analytics & automation
- `analytics_snapshots` fetchers per platform; campaign dashboards; best-time suggestions; AI performance summary; AI captions.

## Capability/cost gates (don't build blind)
- **App review:** TikTok (direct post), Meta (IG/FB Advanced Access). Start review paperwork early — it's the long pole.
- **Paid tier:** X. Decide go/no-go before Phase 5.
- **Account prereqs:** IG Business/Creator + linked FB Page; FB Page admin; YT quota increase.

## Sprint 1 task list (Foundation, concrete)

1. **Repo hygiene & safety PR** — archive `~/omni-release`; set strict CSP; validate `open_path`;
   scope `bundle.targets`; add `npm/cargo audit` to CI. *(small, ship immediately)*
2. **Backend bootstrap** — Supabase project; apply schema; enable RLS on all user tables; service-role
   key server-only; Cloudflare DNS/WAF in front of the API.
3. **Auth** — Supabase Auth in the Tauri client; JWT attached to API calls; workspace creation on signup.
4. **Media upload pipeline** — Tauri chunked upload command → storage; server records `media_assets`;
   ffmpeg worker fills duration/resolution/aspect + thumbnail; size/MIME validation; reject unsupported.
5. **Media Library UI** — grid + detail; title/description/tags/campaign/notes; draft/ready/archived.
6. **Composer v1** — master caption/link/cta + per-platform override rows (caption/title/hashtags/privacy/
   thumbnail); wire engine AI-assist (captions/hashtags/proof) as suggestions; capability descriptors
   disable unsupported fields per platform.
7. **Calendar v1** — month/week/day, drag-drop, filters, timezone handling; create `scheduled_jobs`
   (status `pending`), no live publish yet — show as "scheduled (no account connected)".
8. **Publisher contract + mock** — port `Publisher` interface to backend; implement a **mock publisher**
   that flows through scheduling → attempt → confirmed-URL → audit log, end to end, with zero network.
9. **Audit log + publish_attempts plumbing** — every state transition recorded; failure_reason surfaced in UI.

**Exit criteria for Sprint 1:** a user can sign in, upload a video, compose a master post with per-platform
overrides, schedule it on the calendar, and watch it flow through the **mock** publisher to a "published"
state with a (fake) URL and full audit trail — **no real platform connected, nothing can leak, nothing fakes a
real post.** That proves the entire spine before a single real OAuth credential exists.
