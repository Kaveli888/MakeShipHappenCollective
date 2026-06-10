# Privacy Matrix

Purpose: give users, attorneys, insurers, and future enterprise buyers a clear product-by-product map of data processing.

## Public Summary Table

| Product | Data processed | Default location | External providers | User controls | Retention baseline |
|---|---|---|---|---|---|
| Website / account | Email, auth session, subscription tier, billing metadata, usage events | Supabase, Stripe, Vercel | Supabase, Stripe, Vercel, Sentry if enabled | Account settings, deletion/export request | Account life + legal billing retention |
| ShipMind | Documents, PDFs, web content, YouTube/transcripts, notes, embeddings, questions, answers, citations, optional voice | Local by default when configured locally; cloud if provider selected | Ollama, OpenAI, Anthropic, Groq, Google, OpenRouter, Perplexity depending mode | Source deletion, local file deletion, provider selection | Until user deletes locally; cloud provider retention per provider |
| ShipSpace | Source code, project paths, terminal output, agent chats, mission specs, voice prompts, workspace state | Local app storage / WebKit localStorage / filesystem | OpenAI, Anthropic, Groq, Google, DeepSeek, Supabase depending mode | Workspace deletion, provider selection, local app data deletion | Until user deletes local app data |
| ShipTalk | Audio, transcript text, hotkeys, account/session data, optional cloud transcription/polish data | Local app storage; provider cloud if enabled | Whisper local, OpenAI, Anthropic, Groq, Supabase depending mode | Transcription deletion, provider selection, account sign-out | Until user deletes locally/cloud account data |
| ShipCode | Prompts, selected files, source-code context, session history, provider config, auth token | Local config/session files; cloud provider if used | Anthropic, OpenAI, Groq, Gemini, OpenRouter, Ollama, Supabase, Sentry if enabled | Session deletion, provider selection, local config deletion | Until local deletion; account telemetry per policy |
| ShipWatch | Screenshots, mic/system audio, summaries, OCR, clipboard, URLs, window titles, app activity | Local SQLite/media files by default | Ollama local, Anthropic/cloud proxy if configured | Capture toggles, retention settings, blocked apps, clear memories | User-configured, default should be documented |
| ShipTranscribe | Audio/video files, transcripts | Local | Whisper/local tools; updater provider | File deletion | Until user deletes local files |
| Ship Memory | Markdown notes, metadata, tags, backlinks, search index | Local `.shipmemory` vault | MCP clients selected by user | File deletion, vault deletion, readonly mode | Until user deletes vault |
| Ship AOS | Local chats, vault notes, Stripe dashboard data, local agent outputs | Local server/app storage and `~/.ship-aos` for Stripe token | Stripe, local agent CLIs, AI APIs depending configured agents | Disconnect Stripe, delete local config, clear local chats | Until user deletes local files |
| Merch | Name, email, shipping address, order items, payment metadata | Stripe + Printful | Stripe, Printful | Support request | Tax/accounting/shipping retention |

## Required Privacy Notices

1. "Local-first" does not mean "never cloud." Cloud transmission depends on product, provider selection, and feature.
2. Audio and transcripts can contain third-party personal information.
3. Screenshot, clipboard, OCR, URL, and window-title capture can collect extremely sensitive information.
4. BYO provider accounts are governed by the provider's terms and privacy policies.
5. Local data may remain on the user's device after account deletion unless the user deletes local app data.
6. Billing records may be retained for tax, accounting, fraud, and legal reasons.

