# Handoff: t1 → t6 — Start Fixes

**From:** t1 (protocol audit) · `term-1778524371404-0-0`
**To:** t6 (implement fixes to enable agent handoffs) · `term-1778524371404-1-2`
**Companion doc:** `src/agents/PROTOCOL_AUDIT.md` (full findings P1–P12)
**Target file tree (read-only for you until needed):** `makeshiphappenAi/lib/agents/**`

> Your stated goal is "enable agent handoffs." This handoff sheet reorders my P-list to match that goal: blockers-to-handoff first, then existing-bug fixes you can pick up after.

---

## Phase A — Required before any handoff contract can land

These three unblock t2's handoff-mechanism design. Do these first.

### A1. Canonicalize the role enum (P1)
**Files:**
- `makeshiphappenAi/lib/agents/base-agent.ts:179` — `sessionHistory: { role: 'user' | 'agent'; … }[]`
- `makeshiphappenAi/lib/agents/types.ts:46-49` — `ApiMessage { role: 'user' | 'assistant'; … }`

**Recommendation:** pick **`'user' | 'assistant'`** as canonical (matches every external provider SDK). Migrate `runAgent` to `'assistant'`. Add an internal `'system'` role too while you're there — you'll need it for handoff metadata envelopes.

**Acceptance:** both files import a single `MessageRole` type from `types.ts`. No string literal `'agent'` remains as a role value.

### A2. Define a structured error type (P3)
**Files:** all of `providers/anthropic.ts`, `openai.ts`, `google.ts`, `deepseek.ts`.

**Recommendation:** add to `types.ts`:
```ts
export class StreamChatError extends Error {
  constructor(public provider: ProviderId, public status: number, public code: string, message: string) {
    super(message);
  }
}
```
Every adapter throws `StreamChatError` with `code` ∈ `'auth' | 'rate_limit' | 'invalid_model' | 'transport' | 'parse' | 'server'`. Handoff logic needs to differentiate retryable vs terminal failures.

**Acceptance:** `onError` receives `StreamChatError` instances; no raw `Error('…string…')` thrown from any adapter.

### A3. Decide on streaming `runAgent` (P10)
**File:** `makeshiphappenAi/lib/agents/base-agent.ts:195-248`

**Question to resolve with t2 before coding:** will Cody/Lumi/Sonic handoffs stream into the same surface as Protocol B (`streamChat`), or hand off only finalized JSON payloads?

- If **streaming**: add `runAgentStream(params, { onChunk, onDone, onError, signal })` that uses `chat.sendMessageStream()` and parses the JSON envelope after the stream closes.
- If **finalized only**: leave `runAgent` as-is and document that handoffs operate on `AgentResult.parsed`.

**Acceptance:** decision recorded in `src/agents/PROTOCOL_AUDIT.md` §3, and the chosen path implemented.

---

## Phase B — Existing bugs/regressions (do after Phase A)

### B1. Refresh Anthropic model IDs (P4) — **high severity, smallest patch**
**File:** `makeshiphappenAi/lib/agents/providers/anthropic.ts:4-7`

Current:
```ts
const MODEL_ID_MAP: Record<string, string> = {
    'claude-sonnet-4': 'claude-sonnet-4-5',
    'claude-opus-4': 'claude-opus-4-5',
};
```
Target (current family per repo env): `claude-sonnet-4-6`, `claude-opus-4-7`.

Also update `types.ts:15` `PROVIDERS.anthropic.models` if you want users to pick the version explicitly instead of relying on the silent map.

### B2. Remove the dead `apiKey` field (P2)
**File:** `makeshiphappenAi/lib/agents/types.ts:54`

`apiKey: string` is declared on `StreamChatOptions` but no adapter reads it (every adapter uses `authedFetch` against `/api/chat/<provider>` proxies). Drop the field, or rename to `clientApiKey` with a docstring stating it's accepted for compatibility but ignored by current adapters.

**Risk to check before deleting:** grep for `StreamChatOptions` callers across `makeshiphappenAi/` for anyone setting `apiKey: …`. If callers pass it, just deleting the field is a TS error — coordinate the removal.

### B3. Stop lying about `codex` (P5)
**File:** `makeshiphappenAi/lib/agents/providers/openai.ts:9` and `types.ts:20`.

Two acceptable options:
- Drop `'codex'` from `PROVIDERS.openai.models`.
- Keep it but rename the display label to make the rerouting honest (e.g. `'codex (→ gpt-4o)'`), and notify t5 to document.

### B4. Abort check inside reader loop (P8)
**Files:** `providers/{anthropic,openai,google,deepseek}.ts`, the `while (true)` reader loop.

Pattern to add at the top of every iteration:
```ts
if (signal?.aborted) { await reader.cancel(); return; }
```
Avoids firing `onChunk` after abort and releases the upstream connection.

### B5. Make `getStreamAdapter` failure observable (P9)
**File:** `makeshiphappenAi/lib/agents/providers/index.ts:21-25`

Either log a `console.warn(`[agents] no adapter for model "${model}"`)` or throw — silent `null` will be a quiet handoff failure once t2's contract lands.

---

## Phase C — Cosmetic / low priority (only if time permits)

- **P11** — `parseAgentResponse` should set a `parse_failed` flag instead of overloading `teaching_note`. `base-agent.ts:147-170`.
- **P12** — derive `AGENT_META` from `AGENT_CONFIGS` rather than duplicating fields. `base-agent.ts:253-278`.
- **P6, P7** — documentation only; defer to **t5**.

---

## What I am *not* asking you to do

- Build the inter-agent handoff routing itself — that's t2's design first, then your implementation against the contract t2 lands.
- Write tests — t3.
- Update docs — t5.
- Add new providers, new agents, or new features.

---

## Sync points

- After **Phase A**: ping t2 — the handoff contract design is unblocked.
- After **Phase B**: ping t3 (tests can now target stable APIs) and t5 (docs reflect real behavior).
- If you change any signature in `types.ts`, please update this handoff file + `PROTOCOL_AUDIT.md` so I (t1) and others don't recommend stale APIs.
