# Responsibility Matrix

Purpose: define who is responsible when a feature is used, misused, or causes harm.

Responsible party labels:

- User: individual using the product.
- Administrator: team owner, workspace owner, or account admin.
- Platform Owner: MakeShipHappen.
- Third-Party Provider: vendor or AI/payment/hosting provider.
- Shared: responsibility is split and must be explained.

| Feature | Primary responsibility | Platform responsibility | Required user-facing position |
|---|---|---|---|
| AI-generated answers | User | Provide disclaimers and reasonable product documentation | User must verify outputs before relying. |
| AI-generated code | User | Provide clear review/testing disclaimers | User owns review, testing, security, deployment, and maintenance. |
| Agent file edits | User / Shared | Explain agent risks and product mode limitations | User approves or enables actions and owns final changes. |
| Danger/bypass/auto modes | User after explicit opt-in; otherwise Shared | Make risk unmistakable in docs and policies | User assumes added risk when enabling automation that reduces review. |
| Local terminal commands | User | Document that local shells can affect the user's machine | User responsible for command outcomes in their environment. |
| BYO API keys | User | Explain provider terms and key handling | User owns provider account, costs, and provider-side data handling. |
| Company-held provider keys | Platform Owner | Metering, abuse prevention, vendor disclosure | Platform responsible for hosted provider use and cost controls. |
| Local files and source code | User | Explain local access boundaries | User controls what folders/files are used. |
| Recording/transcription | User | Warn about consent and legal obligations | User must obtain required consent and authority. |
| Third-party meeting participants | User / Administrator | Provide policy warnings | User/admin responsible for notice to participants. |
| ShipWatch capture | User / Shared | Disclose sensitivity and retention clearly | User responsible for enabling capture in permitted contexts. |
| Clipboard/OCR/window URL capture | User / Shared | Provide privacy notice and recommended exclusions | User responsible for configuring blocked apps and retention. |
| Team invitations | Administrator | Provide admin terms and account controls | Admin responsible for invited users and team activity. |
| Team member actions | Administrator / User | Enforce account boundaries | Admin owns org setup; user owns individual misuse. |
| Billing and subscription | Platform Owner + Stripe | Accurate pricing/refund/cancel terms | Stripe handles card data; platform handles plan access and support. |
| Merch fulfillment | Platform Owner + Printful | Accurate shipping/refund policy and support | Printful fulfills; platform owns customer communication. |
| Imported copyrighted content | User | Prohibit infringement in AUP | User warrants rights to imported material. |
| Web/YouTube ingestion | User | Explain legal limits and platform/provider terms | User responsible for source rights and platform ToS compliance. |
| MCP connections | User / Shared | Document what data each MCP exposes | User responsible for connecting trusted clients only. |
| Local device security | User | Document encryption/backups/security assumptions | User responsible for device access, backups, and local deletion. |
| Security vulnerabilities | Platform Owner | Maintain reporting and response process | Platform handles reported vulnerabilities in good faith. |

## Unclear Responsibility That Must Be Resolved in Terms

1. Agent-caused file damage.
2. Unauthorized recording or workplace monitoring.
3. Cloud transmission under local-first marketing.
4. Ingestion of copyrighted or confidential third-party material.
5. Generated code security defects.
6. Team member misuse.
7. Local-only data deletion after account deletion.
8. AI provider retention/training for BYO providers.

