# Agent Communication Protocols — Audit (t1)

**Scope reviewed (read-only, with user approval):** `makeshiphappenAi/lib/agents/**`
**Owner of this report:** t1 (frontend / protocol audit)
**Reports to peers:** t2 (handoff), t4 (bottlenecks), t5 (docs), t6 (fixes)

---

## 1. Two distinct protocols coexist — they don't talk

Two communication contracts live in this module and do **not** share types or roles:

| Protocol | File | Direction | Transport | Shape |
|---|---|---|---|---|
| **A. `runAgent`** | `base-agent.ts` | server-side, one-shot | `chat.sendMessage()` (Gemini SDK, non-streaming) | `RunAgentParams` → `AgentResult` (parsed JSON in fenced block) |
| **B. `streamChat`** | `providers/*.ts` + `types.ts` | client → `/api/chat/<provider>` proxy | SSE (`data: …\n`), `[DONE]` sentinel | `StreamChatOptions` (callbacks: `onChunk`/`onDone`/`onError`) |

Protocol A serves the Cody/Lumi/Sonic teaching agents (Gemini-only).
Protocol B is a generic streaming chat adapter (Anthropic, OpenAI, Google, DeepSeek, nano-banana stub).

There is **no shared message envelope and no inter-agent handoff path** between A and B, or between roles inside A.

---

## 2. Findings (protocol-level)

### P1 · Role enum drift between the two protocols — `severity: medium` → **t6**
- Protocol A `sessionHistory` items use `{ role: 'user' | 'agent' }` (`base-agent.ts:179`).
- Protocol B `ApiMessage` uses `{ role: 'user' | 'assistant' }` (`types.ts:46`).

Any future bridge that pipes a streaming chat into a runAgent session (or vice versa) must remap `agent ↔ assistant`. Pick one canonical role enum.

### P2 · `apiKey` field on `StreamChatOptions` is dead — `severity: medium` → **t6**, doc note to **t5**
`StreamChatOptions.apiKey` is declared (`types.ts:54`) but **no adapter reads it**. Every provider uses `authedFetch('/api/chat/<provider>', …)`; keys live server-side. A caller could assume they need to ship a key from the client and inadvertently leak it through the proxy boundary. Either remove the field or rename it to make its server-only semantics explicit.

### P3 · No structured error contract — `severity: medium` → **t6**
Every adapter throws `new Error(string)` with no `.code`, `.status`, or provider tag. UX layers must string-match on messages to differentiate auth vs rate-limit vs server errors. Worse, providers handle error shape inconsistently:

| Provider | 401 | 429 | Other |
|---|---|---|---|
| anthropic | parsed `error.message` | parsed `error.message` | parsed `error.message` |
| openai | friendly string | friendly string | raw body |
| deepseek | friendly string | friendly string | raw body |
| google | (only 400 `API_KEY_INVALID` string-match) | friendly string | raw body |
| nano-banana | n/a | n/a | n/a (mock) |

Recommendation for t6: a `StreamChatError { provider, status, code, message }` thrown from every adapter.

### P4 · Anthropic `MODEL_ID_MAP` points at stale models — `severity: high` → **t6**
`providers/anthropic.ts:4-7` maps `claude-sonnet-4 → claude-sonnet-4-5` and `claude-opus-4 → claude-opus-4-5`. The current Claude family is 4.6/4.7. Users picking "claude-sonnet-4" get silently downgraded by two minor versions.

### P5 · `'codex'` is silently rerouted to `gpt-4o` — `severity: medium` → **t6** + doc to **t5**
`types.ts:20` advertises `codex` as a selectable OpenAI model; `providers/openai.ts:9` quietly swaps it to `gpt-4o`. Either:
- drop `codex` from `PROVIDERS.openai.models`, or
- surface a UI hint that "codex" routes to gpt-4o.

The current behavior makes the model selector lie.

### P6 · DeepSeek model rewrite is undocumented — `severity: low` → **t5**
`deepseek-r1 → deepseek-reasoner` (`providers/deepseek.ts:8`). Fine, but not documented anywhere a user can see.

### P7 · `nano-banana` is a mock provider but labeled like a real one — `severity: low` → **t5**
`providers/nano-banana.ts` picks one of 5 canned responses with a random delay. It's registered in `PROVIDERS` (`types.ts:32-36`) and routed by `getStreamAdapter` like any other provider. Production callers may not realize it's stubbed.

### P8 · Abort-during-stream is not checked inside the reader loop — `severity: medium` → **t4** (perf), **t6**
Real providers (`anthropic`/`openai`/`google`/`deepseek`) only guard `signal.aborted` in the outer `catch`. If a user aborts mid-stream, the reader keeps pulling chunks (and firing `onChunk` callbacks) until the server closes the connection. Only `nano-banana` checks `signal.aborted` per token.
Recommendation: check `signal?.aborted` at the top of each loop iteration and `return` cleanly.

### P9 · `getStreamAdapter` returns `null` silently — `severity: low` → **t4/t6**
Typos in the model name return `null` with no diagnostic. Caller must remember to handle the null. Logging or a typed error is cheap.

### P10 · `runAgent` has no streaming variant — `severity: medium if unification is a goal` → **t6**
Protocol A awaits the full response (`chat.sendMessage()`). If/when Cody/Lumi/Sonic should stream into the same UI surface as Protocol B, you'll need either a streaming `runAgent` or a different convergence strategy.

### P11 · `parseAgentResponse` smuggles raw text into `teaching_note` on failure — `severity: low` → **t4**
`base-agent.ts:152-158` falls back to placing the unparsed raw response into `teaching_note`. Downstream consumers may render unstructured agent output as a "clean" teaching note. Add a `parse_failed: boolean` flag or a separate `raw_fallback` field.

### P12 · `AGENT_META` duplicates `AGENT_CONFIGS` — `severity: low` → **t4**
`displayName`, `role`, `color` exist in both `AGENT_CONFIGS` (`base-agent.ts:13-127`) and `AGENT_META` (`:253-278`). Drift risk; derive one from the other.

---

## 3. Findings explicitly *not* in scope for t1

Flagged so peers can pick up cleanly:

- **No inter-agent handoff protocol exists.** `next_suggested_prompt` is a string aimed at the **user**, not a routable handoff token between Cody/Lumi/Sonic. → **t2** to design the handoff contract; **t6** to implement.
- **No tests exist** for any of the protocol behaviors above. → **t3**.
- **No public documentation** of either protocol. → **t5**.

---

## 4. Recommended next steps (priority for t6)

1. P4 (model IDs) — silent quality regression, fix first.
2. P3 (structured errors) — unlocks better UX and proper retry logic.
3. P1 (role enum) — pick canonical roles before t2's handoff design lands.
4. P2 (`apiKey` field) — remove or rename before more callers depend on it.
5. P5 / P7 (model-selector honesty) — small but user-facing.
6. P8 (mid-stream abort) — perf/UX, paired with t4's bottleneck pass.

---

## 5. Files touched by t1

- Created: `src/agents/PROTOCOL_AUDIT.md` (this file).
- No edits to `makeshiphappenAi/**` or any other path.
