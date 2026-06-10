# ShipMind — Product Page Copy

> Marketing copy for the `/v3/shipmind` product page on makeshiphappen.tech.
> Sections are ordered to match the funnel: Hero → Problem → Solution → Features → Pricing → Trust → Final CTA.
> Drafted by parallel sub-agents (t2) for handoff to t3 (scaffolding) and t4 (styling).

---

## Hero

**Headline:** Your second brain, local-first.

**Subheadline:** ShipMind is a private AI workspace that reads, searches, and reasons across your documents locally by default — cloud AI is optional and clearly labeled.

**Primary CTA:** Download for Mac
**Secondary CTA:** See how it works

---

## The Problem

Every cloud AI tool asks you to make the same trade: upload your most sensitive material, or work without it. Lawyers can't paste privileged work into a public chatbot. People who handle confidential records can't drop them into Claude. Analysts can't share term sheets with a model that trains on its inputs.

So the work that would benefit most from AI gets done the hardest way — by hand, across dozens of PDFs, contracts, and transcripts no one has time to read twice. Students hit the same wall from the other side: a semester of lecture recordings, slide decks, and journal articles, none of it searchable, none of it talking to each other.

The compromise is everywhere. Either you hand your confidential life to a server farm, or you give up the leverage modern AI is supposed to provide.

---

## The Solution

ShipMind runs the whole stack on your machine. Documents, transcripts, notes, and embeddings live on your disk. Indexing and semantic search use a bundled local model, so your indexing and search never touch the cloud. When you want a cloud LLM for chat, you bring your own key — stored in the OS keychain, never in a database we own.

Drop in a folder of case files, a thesis bibliography, or a year of meeting transcripts, and ask real questions across all of it. ShipMind retrieves the passages that matter, cites them back to the source, and keeps every artifact under your control.

It's the AI workflow professionals already wanted, without the disclosure problem attached.

---

## Features

### Local Privacy

**Your documents stay on your Mac** unless you turn on an optional cloud feature.

ShipMind indexes everything on-device using bundled Ollama with nomic-embed-text for embeddings. Source content, transcripts, and notes stay in local storage — there's no upload step, no sync server, no third-party processor reading your files.

*For anyone who'd rather not hand their working memory to a vendor.*

### Secure Documents

**Drop sensitive files in. Indexing and search stay local** — your files leave only as the specific excerpts you send to an opted-in cloud model.

Drag a PDF contract, a research paper, or a case file into ShipMind and it's parsed, chunked, and embedded locally within seconds. If you use a cloud model for chat, the API key lives in the macOS keychain — not localStorage, not a config file. ShipMind never uploads your whole library, but to answer a question a cloud model receives your prompt plus the relevant retrieved passages from your sources (and any image you ask about). Choose a local model to keep every request on-device.

*For professionals who handle confidential work.*

### Fast AI

**Fast local search across thousands of sources.**

Because embeddings run locally, indexing runs locally and search is near-instant — speed depends on corpus size and hardware, with no round-trip to a remote vector DB. For chat, pick your model: OpenAI, Anthropic, or Groq, with prompt caching where the provider supports it so long-context conversations stay cheap.

### Legal & Compliance

**Built for sensitive work.**

ShipMind's local-first design means your source documents stay on your machine by default — no third-party processor touches them unless you opt into a cloud model. For people who handle confidential material and want to keep it that way.

*ShipMind makes no compliance certification — you decide whether it fits your obligations.*

### Education Use

**A second brain for your coursework.**

Ingest a semester of readings, lecture transcripts, and your own notes, then chat across the whole corpus to outline papers, prep for exams, or trace an idea back to its source. Everything stays on your laptop, which matters when you're working with unpublished research or draft work you're not ready to share.

*For students and researchers building a private knowledge base over years, not sessions.*

---

## Pricing

Start free, upgrade when your second brain outgrows the basics.

### Free
**$0**
- Local search across up to 25 sources
- Bundled Ollama embeddings, fully offline
- Single-device use

**CTA:** Get ShipMind Free

### Pro
**$20 / month**
- Unlimited sources and groups
- Cloud-LLM chat with your own API keys (OpenAI, Anthropic, Groq)
- Signature theme and advanced source analysis
- Priority updates across the MakeShipHappen suite

**CTA:** Start Pro

### Team
**$40 / seat / month**
- Everything in Pro for every seat
- Multi-user license with centralized billing
- Priority support and onboarding
- Shared prompt and group templates

**CTA:** Talk to Sales

---

## Trust

### Local-first by default
Your sources live on your disk. API keys live in your OS keychain. Cloud providers are opt-in and clearly labeled. ShipMind runs locally on Tauri with bundled Ollama embeddings — not in localStorage or on our servers.

### Built by an indie maker, in the open
ShipMind is built by one developer who ships in public. Architecture, decisions, and roadmap are transparent — no faceless roadmap committee.

### One suite, one workflow
ShipMind connects natively to ShipTalk, ShipSpace, and ShipCode. Capture a thought, search your brain, and ship the work without leaving the Collective.

---

## Final CTA

**Headline:** Give your thinking a place to live.

**Subhead:** A private, local-first second brain built for makers who ship. Install in under a minute.

**Primary CTA:** Download ShipMind
**Secondary CTA:** Read the docs

---

## Handoff notes (for t3)

- Section order above matches the intended funnel — render in this order on `/v3/shipmind`.
- Each `##` heading maps to one React section component (Hero, Problem, Solution, Features, Pricing, Trust, FinalCTA).
- Feature blocks (`###` under `## Features`) should render as a 5-card grid or stacked feature rows; each card has: title, bold benefit line, body, optional italic audience line.
- Pricing has three tier cards; "Pro" is the recommended/highlighted tier.
- CTA button labels are written as plain text — wire them to the appropriate routes (download link, docs, signup, sales contact).
- Placeholder prices ($20 / $40) — flag with Jake before launch if finalized pricing differs.
