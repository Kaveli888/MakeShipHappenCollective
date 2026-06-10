# Vendor Risk Register

Status: Internal governance tracker.

| Vendor | Criticality | Data sensitivity | Contract / DPA status | Security review status | Owner | Review cadence | Risk notes |
|---|---|---:|---|---|---|---|---|
| Supabase | Critical | High | To verify | To verify | Founder | Quarterly | Auth/database/RLS dependency. |
| Stripe | Critical | High | To verify | To verify | Founder | Quarterly | Payments, disputes, tax records. |
| Vercel | High | Moderate | To verify | To verify | Founder | Semiannual | Hosting/logging. |
| Printful | Medium | Moderate | To verify | To verify | Founder | Semiannual | Shipping PII and fulfillment promises. |
| Sentry | Medium | Moderate | To verify | To verify | Founder | Semiannual | Avoid sensitive data in error payloads. |
| OpenAI | High | High | To verify | To verify | Founder/User | Quarterly | Cloud AI, audio/transcription in some modes. |
| Anthropic | High | High | To verify | To verify | Founder/User | Quarterly | Cloud AI, transcript/prompt processing. |
| Groq | Medium | High | To verify | To verify | Founder/User | Semiannual | Transcription/TTS/provider mode. |
| Google/Gemini | Medium | High | To verify | To verify | Founder/User | Semiannual | Cloud AI provider mode. |
| DeepSeek | Medium | High | To verify | To verify | Founder/User | Semiannual | Cloud AI provider mode. |
| OpenRouter | Medium | High | To verify | To verify | Founder/User | Semiannual | Routes prompts to downstream models. |
| Discord | Low | Low/Moderate | To verify | To verify | Founder | Annual | Community data/moderation. |
| GitHub | Medium | Moderate/High | To verify | To verify | Founder/User | Semiannual | Releases, source, repo integrations. |
| npm | Medium | Low | To verify | To verify | Founder | Annual | CLI distribution. |

## Vendor Review Checklist

1. Privacy policy reviewed.
2. Security page reviewed.
3. DPA or data terms reviewed.
4. Data categories documented.
5. Retention documented.
6. Breach notification terms documented.
7. Subprocessor status documented.
8. Account owner and MFA status documented.
9. Cancellation/export path documented.
10. Risk accepted by founder.

