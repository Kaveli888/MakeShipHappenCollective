# Loop Orchestration

Omni Release loops are reusable orchestration prompts. They are meant to be
copied into any active agent session so the agent can repeatedly check Omni
Release, delegate to platform playbooks, verify the result, and keep moving
until the queue is clear or blocked by a real human gate.

## Core Distinction

Prompt loops and schedulers are related, but they are not the same thing.

| Layer | Responsibility |
| --- | --- |
| Prompt loop | Tells an already-awake agent what to repeat. |
| Scheduler | Wakes an agent, process, or automation at the right time. |
| Omni Release queue | Stores what is due, where it goes, exact media, and status. |
| Agent packet | Normalizes one due job into post type, publish surface, URL, copy, media paths, checklist, and result contract. |
| Platform playbook | Describes the exact browser execution flow. |
| Verification bridge | Defines the proof required before a job is complete. |

A prompt can keep an agent looping only while the agent session is alive. If the
agent sleeps, closes, hits a platform limit, or loses browser access, an outside
scheduler or manual restart has to wake it again.

## Four-Condition Loop Test

Only turn a task into a loop when all four conditions pass:

1. Repeatable: the task can run again and again without being redesigned.
2. Done state: the loop has a clear completion signal.
3. Affordable: the loop fits token, time, and browser limits.
4. Tool-ready: the agent has the files, browser access, and verification method.

If any condition fails, run the task in training mode first.

## Orchestration Rule

The orchestration loop should not do specialized platform work from memory.
It should delegate:

```text
Orchestration loop -> platform playbook -> proof verification -> result contract
```

For example:

```text
Publish Watchdog Loop
  reads due agent.json packets
  calls Facebook Page Posts playbook
  verifies "Just now"
  writes posted result
  repeats
```

## Loop Training Mode

Use training mode when a platform or task has not been battle-tested.

Training mode requirements:

- pause at every step
- capture the exact button, field, modal, and pop-up behavior
- record what settings should not be touched
- record the success signal
- update the platform playbook
- update the accomplishments log
- run one live proof before calling the loop autonomous

## Loop Memory

Every loop should write lessons into durable files so future agents do not start
from scratch.

Primary memory files:

```text
docs/ACCOMPLISHMENTS.md
docs/PLATFORM-TRAINING.md
docs/platform-playbooks/<platform>.md
outbox/archive/<job_id>/
```

## Omni Release Loop Pack

The app's Loops section currently stores these copy-ready prompts:

- Publish Watchdog Loop
- Human Gate Retry Loop
- Platform Training Loop
- Proof Verification Loop
- Queue Cleaner Loop
- Battle-tested Execution Contract

## Agents Only

The `Agents Only` section stores portable platform-worker prompts. These are the
prompts Jake can copy into another tool-capable agent when he wants that agent
to act like an Omni Release publisher for one trained platform.

Agent prompts are narrower than orchestration loops:

| Prompt Type | Job |
| --- | --- |
| Loop prompt | Decides what due job to run and keeps repeating. |
| Agent prompt | Executes one trained platform flow correctly. |

Current built-in agent prompts:

- Facebook Page Agent
- YouTube Community Agent
- New Platform Training Agent

Custom prompts added through `Integrate prompt` are stored in local Omni Release
state under:

```text
loops.agentPrompts
```

An Agents Only prompt should always include:

- source of truth
- required platform identity
- supported post type
- exact execution steps
- human gates
- result contract
- playbook path or training source

## AI Platforms

The `AI Platforms` section stores model-specific adapter prompts. The core Omni
Release loop stays the same, but each AI system gets instructions phrased for
how it usually performs best.

Current adapter prompts:

- Claude Adapter
- OpenAI / Codex Adapter
- DeepSeek Adapter
- Gemini Adapter

These adapters do not replace the loop or the media-platform playbook. They wrap
the same operating contract in a platform-specific dialect:

```text
AI platform adapter -> loop prompt -> Agents Only prompt -> platform playbook
```

The adapter should always preserve the same hard rules:

- Omni Release is the source of truth.
- The platform playbook owns the publish path.
- Captions and media are exact.
- Browser gates become `needs_attention`.
- Proof is required before `posted`.

## Autonomy Boundary

Omni Release can organize the loop, queue, prompt, playbook, and results.

Something still has to keep the agent awake or wake it later:

- Codex automation
- a local worker/watchdog
- macOS launchd
- cron
- a platform's native scheduled automation
- Jake manually starting a loop prompt in an agent

The practical model is:

```text
Scheduler wakes agent.
Loop tells agent what to repeat.
Omni Release provides the work.
Playbooks provide the how.
Proof decides when it is done.
```
