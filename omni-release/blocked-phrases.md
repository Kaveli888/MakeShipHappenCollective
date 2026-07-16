# Blocked Phrases — omni-release

Hard stops. Unlike the soft "Banned Words" in `voice-rules.md` (which downgrade
quality score), anything matched here is a **blocking** quality-gate failure: the
post will not be queued or published until it's removed.

Two reasons a phrase lands here:
1. **Legal / trust risk** — promises, guarantees, or claims we can't stand behind.
2. **Spam signals** — phrasing that gets posts throttled or shadow-flagged on platforms.

> Loader contract: `src/quality/blockedPhrases.ts` parses the two sections below.
> Keep `- ` bullet format. Patterns in `## Blocked Patterns` are JS-regex source
> wrapped in backticks and matched case-insensitively.

---

## Blocked Phrases

Plain-text, case-insensitive substring matches.

- guaranteed returns
- guaranteed results
- get rich
- make money fast
- passive income on autopilot
- risk-free
- no risk
- 100% safe
- 100% guaranteed
- limited time only
- act now
- once in a lifetime
- you won't believe
- doctors hate
- this one trick
- click here now
- dm me to learn how
- link in bio for the secret
- not financial advice but
- to the moon
- guaranteed virality
- we promise
- best in the world
- the only tool you'll ever need

---

## Blocked Patterns

JS regex source (matched case-insensitively, `i` flag applied by the loader).

- `\bguarantee(d|s)?\b`
- `\b\d{2,}%\s*(off|guaranteed|returns?)\b`
- `\bfree\s+money\b`
- `\b(buy|sell)\s+now\b`
- `\bdouble\s+your\b`
- `\b#?follow4follow\b`
- `\b#?f4f\b`
- `\bsub4sub\b`
