# Hashtag Rules — omni-release

Per-platform hashtag policy. The formatting layer
(`src/content/platformFormatting.ts`) reads these to cap, order, and filter
hashtags; the quality gate enforces the `max` count and the `avoid` list.

> Loader contract: `src/content/rules.ts#loadHashtagRules` parses each
> `### <platform>` block. Recognized bullet keys: `max:`, `core:`, `avoid:`.
> `core` and `avoid` are space-separated `#tags`. Keep the format.

---

## Global

- Hashtags go at the END of the post, never inline in a sentence.
- Prefer fewer, high-signal tags over a wall of tags.
- Never invent a hashtag with spaces or punctuation.
- `core` tags are preferred fillers when the lane doesn't supply enough topical tags.
- Anything in a platform's `avoid` list is stripped silently before publish.

---

### x

- max: 2
- core: #AI #BuildInPublic
- avoid: #followback #f4f #sub4sub #like4like #teamfollowback

### linkedin

- max: 5
- core: #AI #ArtificialIntelligence #BuildInPublic #DevTools
- avoid: #followback #f4f #spam

### facebook

- max: 3
- core: #AI #DevTools #BuildInPublic
- avoid: #followback #f4f #like4like

### browser

The `browser` platform is the manual / assisted-paste lane (e.g. Instagram,
Threads, or an X list reached through the browser). Hashtag-friendly, so the cap
is higher — but still capped by the platform's `maxHashtags` in core config.

- max: 6
- core: #AI #BuildInPublic #DevTools #IndieHacker #Startup #Coding
- avoid: #followback #f4f #like4like #sub4sub #spam #l4l
