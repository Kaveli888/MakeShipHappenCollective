# Subprocessor Register

Status: Public-ready draft for attorney review.

Purpose: disclose third-party providers that may process user data depending on product, feature, and configuration.

| Provider | Purpose | Data categories | Products/features | Notes |
|---|---|---|---|---|
| Supabase | Authentication, database, account/profile/subscription/team data | Email, auth metadata, profile, subscription tier, usage records, transcripts if product stores them | Website, ShipMind, ShipSpace, ShipTalk, ShipCode | Public anon key model requires correct RLS. |
| Stripe | Payments, checkout, subscriptions, billing portal, chargebacks | Customer email, payment metadata, subscription, invoices, card data handled by Stripe | Website commerce | Platform should remain outside raw card data. |
| Printful | Merch fulfillment | Name, shipping address, email, order items | Merch/shop | Must be disclosed if merch checkout is active. |
| Vercel | Website hosting and serverless functions | IP address, request metadata, logs | Website/API | Hosting provider. |
| Sentry | Error reporting | Error messages, stack traces, device/app metadata, possible user identifiers if configured | Website/CLI/apps if enabled | Avoid sending sensitive content. |
| OpenAI | AI models, transcription, TTS, chat | Prompts, audio, transcripts, code/context depending feature | ShipMind, ShipSpace, ShipTalk, ShipWatch, web chat if configured | May be user BYO or platform-hosted. |
| Anthropic | AI chat, polish, summaries, code/reasoning | Prompts, transcripts, excerpts, code/context depending feature | ShipMind, ShipSpace, ShipTalk, ShipWatch, web chat if configured | May be user BYO or platform-hosted. |
| Groq | AI inference, speech transcription, TTS | Audio, transcripts, prompts | ShipSpace, ShipTalk, possible other apps | Feature/provider dependent. |
| Google / Gemini | AI inference | Prompts, excerpts, code/context | ShipMind, ShipSpace, web chat if configured | Provider dependent. |
| DeepSeek | AI inference | Prompts, code/context | ShipSpace/web chat if configured | Provider dependent. |
| OpenRouter | AI model routing | Prompts, excerpts, code/context | ShipMind/ShipCode if configured | Provider dependent. |
| Perplexity | Search/AI answer provider | Prompts/search queries/context | ShipMind if configured | Provider dependent. |
| Ollama | Local model runtime | Prompts/context processed locally | ShipMind, ShipSpace, ShipCode, ShipWatch | Local to user's device unless user exposes it. |
| GitHub | Source hosting, releases, downloads | Repo data, release assets, account metadata | ShipCode, ShipTalk/ShipTranscribe releases if used | User may separately connect GitHub. |
| Discord | Community | Usernames, messages, community content | Community | Governed by Discord terms. |
| npm | Package distribution | Package download metadata, account/package info | ShipCode CLI | Governed by npm terms. |

## Required Public Note

Some subprocessors apply only when a user chooses a cloud provider, connects a third-party account, buys merch, joins the community, or uses a specific product feature. Local-only use may involve fewer subprocessors.

