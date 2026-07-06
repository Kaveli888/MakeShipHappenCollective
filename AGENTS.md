# AGENTS.md - Jake Felton / MakeShipHappen Project Context

This file is durable project context for Codex and other coding agents working in `/Users/jake/MakeShipHappenCollective/`.

## Operating Rules

1. Execute, don't clarify. Jake provides raw material expecting work product back. Ask questions only when something is genuinely ambiguous or risky.
2. Respect the "Ship" naming family. Do not rename products or invent alternate product names unless Jake explicitly asks.
3. Default to plain text for operational prompts and skill docs unless markdown is explicitly requested or needed for structure.
4. Keep ShipMind and ShipSpace architecturally distinct.
5. Use `/Users/jake/MakeShipHappenCollective/` as the working root for this ecosystem.
6. Keep tone concise, direct, and focused on shipping.

## Identity And Brand

- Name: Jake Felton
- Location: Palm Springs, California
- Role: solo founder and entrepreneur
- Brand: MakeShipHappen
- Domain: MakeShipHappen.tech
- GitHub: `Kaveli888`
- Main project root: `/Users/jake/MakeShipHappenCollective/`
- Daily AI News storage: `/Users/jake/Daily Ai News`
- Daily brief email: `lifestyle78@icloud.com`

## Product Ecosystem

Jake is building an integrated ecosystem of AI products under the MakeShipHappen brand. The "Ship" naming family is intentional and brand-locked.

### ShipMind

- Lead GTM product and public-facing hook.
- Local, offline-first AI knowledge/document app.
- Positioning: private NotebookLM alternative; citation-grounded and fully offline-capable.
- Architecture pattern: one grounded context, many output shapes.
- Ingestion targets: YouTube, PDFs, RSS, and voice memos.
- Cost model: hybrid local/API with Ollama for local and Claude Sonnet for chat.
- Brand: amber accent color.
- Tagline: "The second brain that listens".
- ShipMind is standalone from ShipSpace.

### ShipSpace

- Multi-agent orchestration platform / Agent Development Environment.
- Strategic role: invisible infrastructure powering other products.
- Agent roster: Coordinator, Builder, Scout, Reviewer.
- Flagship feature: ShipGang.
- ShipGang uses a state object passed between agents, tag-delimited outputs, and a six-phase execution pipeline.

### ShipTalk

- Tauri cross-platform desktop voice-to-text app.
- Modes: hold-to-talk and toggle.
- UI: floating overlay icon with status animations.
- Transcription: local Whisper.
- Auth: MakeShipHappen account login gate.
- Includes local searchable transcription history.

### ShipCode CLI

- Forthcoming developer distribution channel.
- Modeled on a CLI-to-dashboard pipeline.

### BridgeSpace

- Tauri-based desktop application.
- Includes browser tool, file editor, Bridge Memory, skills panel, workspaces, and multi-agent terminal support.

## Strategic Positioning

| Product | Role |
| --- | --- |
| ShipMind | Lead GTM / public hook |
| ShipSpace | Invisible infrastructure |
| ShipCode CLI | Developer distribution funnel |
| ShipTalk | Utility / ecosystem entry point |

## Active Work

- Learning AI fundamentals deeply: LLMs, transformers, RAG, agents, MCP, and alignment.
- Transitioning toward AI engineering as the primary career path.
- Supercharging the BridgeSpace / MakeShipHappen prompt library for precision and actionability.
- Active skill documents include BridgeSEO, BridgeSecurity, BridgeGithub, BridgeMind MCP, BridgeObsidian, and BridgeMemory.
- Competitive intelligence system: structured prompts for YouTube and web extraction, synthesis, and weekly competitor dossiers.
- Daily AI intelligence brief workflow: Claude plus web search, static brief fetched on demand, covering model leaderboards, news, and Polymarket signals.

## Recent Project History

- Heavy build-out of BridgeSpace desktop app.
- Iterative prompt sharpening across large batches of operational prompts and skills.
- Built competitive intelligence system with structured plain-text prompts.
- Refined ShipMind architecture as a standalone NotebookLM alternative distinct from ShipSpace.
- Worked on ShipMind summarization prompt architecture and multi-source ingestion.
- Set up daily AI intelligence brief workflow.
- Designed ShipSpace multi-agent architecture with four agents and ShipGang.
- Finalized ShipTalk specs: Tauri, hold-to-talk plus toggle, local Whisper, account gate.
- Built ShipMind prompt packs, artifact generators, voice-to-voice pipeline, and brand assets.
- Researched NotebookLM to inform ShipMind architecture.
- Converted an HTML game to mobile using Capacitor.
- Built MakeShipHappen client docs, intake forms, and dark luxury brand assets.

## Technical Background

- Web development and freelance work under the MakeShipHappen brand.
- Music production with Pro Tools.
- Familiar tools and stacks: Tauri, Capacitor, Ollama, Claude API, MCP servers, Whisper, Capacitor, local-first apps, and desktop app workflows.
- AI video exploration: Hedra, Kling 3.0, HeyGen Avatar IV.

## Audience And Distribution

- TikTok has significant accumulated views and remains an active creator channel.
- Planned vehicles include YouTube and Discord communities.
- Long-term mission: empower solo builders, generate income online, and teach others to do the same.

## Special Context

- NBA betting analysis collaborators: JuiceVortex and Mara.
- Betting framework: structured, low-volatility, focused on totals.
- Preference: live betting after observing early game flow.

## Key Paths

| Item | Path / Value |
| --- | --- |
| Project root | `/Users/jake/MakeShipHappenCollective/` |
| Daily AI News storage | `/Users/jake/Daily Ai News` |
| GitHub handle | `Kaveli888` |
| Brief delivery email | `lifestyle78@icloud.com` |
| Brand domain | `MakeShipHappen.tech` |

## MCP Server Lifecycle Rule

The four MCP servers in this repo (shipspace-mcp, shiptalk-mcp, shipmind-mcp,
ship-memory/packages/mcp) MUST self-exit when their host session dies — see the
"Exit with the host session" block at the end of each src/index.ts (commit 5f59cb3).
Never remove or bypass those handlers, and never spawn long-lived node children
without an equivalent cleanup path. Orphaned MCP servers accumulated to ~750
processes / 36 GB on 2026-07-05 and kernel-panicked the machine twice.
