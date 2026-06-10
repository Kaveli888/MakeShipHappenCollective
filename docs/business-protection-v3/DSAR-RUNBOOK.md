# Data Subject Access Request (DSAR) Runbook — Deletion & Export

_Owner: Jake (sole operator) · Created: 2026-06-08 · Source of obligation: `/privacy`, `/deletion-export`, Audit v3 Critical finding #10._

This is the **logged manual process** that backs the Access / Export / Delete rights the website promises. A reliably-executed, logged manual process is legally sufficient for a single operator and requires no new code. **Every request must be logged in the register in §6** — the log is the evidence that the promise was honored. Target turnaround: **30 days** from verified request (the clock the policy commits to).

> Scope note: This covers data MakeShipHappen controls (Supabase, Stripe, Printful) and tells the user how to remove local desktop-app data, which lives only on their own device and which we cannot reach.

---

## 1. Intake & Identity Verification

1. Requests arrive at **privacy@makeshiphappen.tech**. Record receipt date immediately (starts the 30-day clock).
2. Verify identity: the request must come **from the email address on the account**, or the requester must complete an action proving control of that mailbox (reply to a verification email). Do not act on an unverified request.
3. Determine the request type: **Access** (copy of data), **Export** (machine-readable copy), **Delete** (erasure), or a combination.
4. If you cannot match the email to an account, reply that no account was found and log it as closed.

---

## 2. Locate All Data (the data map)

Check every store below for the user's `auth.users.id` (UUID) and email.

### Supabase (primary database) — tables keyed to the user
- `profiles` — profile / personalization
- `subscribers` — subscription tier / status mirror
- `subscriptions` — subscription records
- `usage_events` — per-user feature/provider/model activity log
- `usage_ledger` — usage accounting
- `teams` / `team_members` — if the user owns or belongs to a team
- `lesson_progress`, `lab_completions`, `lab_sessions`, `agent_messages`, `achievements` — curriculum/labs data (only if the user used those features)
- `auth.users` — the account itself
- `ip_rate_events` — keyed to **IP, not user_id**; cannot be reliably tied to one user, retained short-term for abuse prevention, excluded from per-user deletion (note this in the response).
- `processed_stripe_events` — webhook idempotency log; **retain** (billing/fraud integrity, not personal content).

### Stripe
- Customer object, subscriptions, invoices, payment history (look up by email / customer ID).

### Printful
- Only if the user purchased physical goods: order(s) containing shipping name + address.

### AI providers (Anthropic / OpenAI / Google / DeepSeek)
- We do **not** retain prompts server-side beyond the request; any retention is governed by the provider. Note this and point the user to the relevant provider for provider-side deletion.

---

## 3. Fulfilling an ACCESS or EXPORT request

1. For each Supabase table in §2, run a `select * where user_id = '<uuid>'` (or email match) and collect the rows.
2. Pull the Stripe customer + subscription/invoice summary.
3. Pull Printful order records if any.
4. Assemble into a single **JSON** file (one top-level key per source: `account`, `profile`, `subscription`, `usage`, `stripe`, `printful`, `curriculum`). JSON satisfies the portability promise on `/privacy`.
5. Deliver to the **verified account email** only. Log the export (§6).

---

## 4. Fulfilling a DELETE request

Work top-down and check each off in the register:

1. **Stripe** — cancel any active subscription, then delete or anonymize the customer object (retain the minimum invoice/tax records the law requires; note the carve-out to the user).
2. **Printful** — request deletion of stored customer/shipping PII for the user's orders (retain what tax/fulfillment law requires).
3. **Supabase app tables** — delete the user's rows from every table in §2 (profiles, subscribers, subscriptions, usage_events, usage_ledger, teams/team_members where sole owner, curriculum tables). 
4. **Supabase auth** — delete the auth user (`auth.admin.deleteUser`, or the Supabase dashboard → Authentication → delete user). This is the step that removes the account itself.
5. **Retention carve-outs** — keep only what billing, tax, fraud-prevention, security, legal-claim, or compliance obligations require; `processed_stripe_events` and minimal billing records stay. State the carve-out in the confirmation.
6. **Local device data (tell, don't do — we can't reach it).** Confirmation must remind the user that desktop apps keep data only on their own machine and account deletion does not remove it. Tell them how:
   - **ShipMind** — deleting a transcript/source in-app removes the database row but **leaves the raw audio and copied source files on disk**. To fully remove them, delete the ShipMind application-data directory (and any folders they imported from). _Known orphan defect — flag in confirmation until the in-app delete is fixed to remove files._
   - **ShipTalk** — delete local transcripts and the app data directory; remove API keys from Settings and from the provider dashboards.
   - **ShipSpace** — clear terminal scrollback / workspace state and the app data directory.
7. Send the confirmation to the verified account email. Log completion + date (§6).

---

## 5. Edge Cases

- **Team owner deletes account:** decide and record whether the team is transferred or dissolved; deleting a sole owner may orphan `team_members` rows — clean them up.
- **Active paid subscription:** cancel before deleting the Stripe customer; note any pro-rata/refund per the Terms (no-refund + legal carve-out).
- **Legal hold / dispute:** if records are under a legal hold, pause deletion of those specific records, tell the user, and log the reason.
- **Identity not provable:** do not delete; respond explaining what verification is needed.

---

## 6. Request Register (the log — fill one row per request)

| Date received | Requester email | Account UUID | Type (A/E/D) | Identity verified (Y/N + method) | Stores touched | Carve-outs retained | Date completed | Notes |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

> Keep this register up to date for every request. It is the auditable proof that the deletion/export promise is honored within 30 days. Store it where billing/compliance records live, not in the public repo if it contains personal data.

---

## 7. Follow-up Engineering (out of scope for this runbook, tracked separately)

The manual process above is the compliant minimum **today**. Two code fixes would reduce manual effort and close the known defects:
- Fix ShipMind `delete_transcript` / `delete_source` to remove the raw audio and copied source files from disk, not just the DB row (closes the orphan defect in §4.6).
- Build a self-serve export endpoint (`auth.admin` + per-table select → JSON) and an in-account delete flow, so §3/§4 become one click instead of a manual run.
