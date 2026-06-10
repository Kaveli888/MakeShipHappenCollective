# Business Protection Blueprint — Part 01: Corporate Protections

**Document type:** Business / corporate-governance wrapper around the v3 technical audit (NOT an engineering remediation plan).
**Subject:** Make Ship Happen / Ship Ecosystem — ShipTalk, ShipMind, ShipSpace (macOS desktop apps) + makeshiphappen.tech (Next.js commerce/identity website).
**Operator of record (per audit):** Jacob Felton, a single named natural person, operating commercially under "Make Ship Happen" with billing on a personal Stripe account titled **"ZZ GEMZ"** (`zzgemsjewelry@gmail.com`).
**Date:** 2026-06-07
**Posture assumed:** single founder, US-based, pre/early-revenue, actively selling paid software + a web subscription (live Stripe Pro $50 / Team $500).

> **Scope discipline.** This document recommends ONLY corporate-structure protections — entity formation, the liability shield, corporate formalities/veil maintenance, capitalization and IP assignment of founder-authored code into the entity, key-person/bus-factor governance, and business banking/payment-account titling. It does **not** prescribe code changes. Where an audit risk has a technical root cause (GPL ffmpeg, raw-shell agents, cli-login token relay), this document addresses only the *corporate-shield* dimension — i.e., ensuring those liabilities land on an entity, not on Jacob personally. The contractual instruments (EULA, AUP, warranty disclaimer, liability cap) live in the Legal Protections part; the privacy program lives in the Policy/Compliance parts. This part makes sure there is an *entity* for those instruments to protect.

---

## 1. Why Corporate Protection Is the Foundational Layer

The executive report and the liability review both flag the same structural defect, independent of any single bug:

- **Business Risk #2 (Critical):** "Liability concentrated on a single named individual, no apparent corporate shield — personal liability for licensing, privacy, and agent-action claims." (`00-EXECUTIVE-REPORT.md` §2)
- **Liability review §3.4:** "The hardcoded `OWNER_EMAILS = ['zzgemsjewelry@gmail.com']` and the personal Stripe account ('ZZ GEMZ') mean liability attaches to a named natural person with, apparently, no corporate liability shield interposed. **Strong recommendation (legal, not code): operate through an LLC/entity** so that the contractual liability caps in a future EULA actually protect personal assets." (`03-liability-review.md` §3.4, §11 step 2)
- **Website cluster:** the live commerce stack (Stripe "ZZ GEMZ", Printful, Supabase) is wired to a personal identity. (`14-website-cluster.md` §2.3, §6.3)

The corporate shield is **load-bearing for the entire blueprint.** The audit's single most valuable recommended instrument — an EULA with a warranty disclaimer and liability cap (`03-liability-review.md` §3.2: "the operator's primary loss-shifting instrument and it is absent") — only protects *personal* assets if there is an entity to be the counterparty. A liability cap in a contract signed by "Jacob Felton, an individual" caps the company's exposure at zero because there is no company; uncapped residual flows to the natural person. **Form the entity first, then sign every customer agreement, vendor contract, and provider account in the entity's name.** This is the highest-leverage, lowest-cost protection in the whole engagement.

The audit catalogs at least four distinct liability theories that, absent an entity, attach directly to Jacob's personal assets (home, savings, future income):

| Audit-sourced liability theory | Where it lands today | Why an entity matters |
|---|---|---|
| **Copyright infringement / GPL termination** (ShipMind ffmpeg, L-1 Critical) | Jacob personally — he is the distributor of record | Statutory copyright damages + injunction would name the individual distributor |
| **Product-liability / negligence** (ShipSpace raw-shell agent destroys customer data or harms a third party, §4) | Jacob personally — "operator" with documented `TODO(security)` knowledge | An entity is the named defendant; personal assets shielded if veil intact |
| **Privacy / breach-notification** (cli-login token theft S-1, MCP corpus exposure, no deletion path) | Jacob personally as data controller | An entity becomes the controller of record |
| **FTC §5 / UDAP false-advertising** ("100% on-device" contradicted by code, §8.1) | Jacob personally | Entity is the advertiser/seller of record |

None of these technical issues are fixed by incorporation — but incorporation determines **whose assets satisfy the judgment.** That is the corporate-protections mandate.

---

## 2. Entity Formation & the Liability Shield

### 2.1 Recommendation: form a single-member LLC, taxed as a disregarded entity (default), with an S-corp election deferred until revenue justifies it

For a single-founder, pre/early-revenue US software venture, a **single-member LLC (SMLLC)** is the correct vehicle:

- It interposes a liability shield between the business's obligations (the four theories above) and Jacob's personal assets.
- It is cheap, fast, and low-formality relative to a C-corp.
- It is the entity type the liability review explicitly names ("operate through an LLC/entity").
- A C-corp is **not** recommended now: it adds double-taxation and board/stock formalities with no offsetting benefit absent outside equity investment. Revisit only if Jacob intends to raise priced venture financing (investors typically require a Delaware C-corp). **Decision record this** (see §6).

> **Single-member-LLC caveat (must be understood, not ignored):** in several states a charging-order/veil analysis treats SMLLCs less protectively than multi-member LLCs, and some courts have reverse-pierced SMLLCs whose formalities were thin. The shield is therefore only as strong as the formalities in §4. For a solo founder this is acceptable, but it raises the importance of the operating agreement, separate banking, and no commingling — all below.

### 2.2 Choice of state — Nevada vs. California (the audit references both)

Project memory and the audit reference both **Nevada / Clark County** (the ShipSpace bundle identifier and prior formation context) and **California** (operator location signals). The state decision is a genuine fork with cost and protection consequences:

| Factor | **Nevada (Clark County)** | **California** |
|---|---|---|
| State income tax on the entity | None | 1.5% franchise / $800 minimum |
| Annual cost | ~$350 (business license + annual list) | **$800 minimum franchise tax** even at $0 revenue, due every year |
| Charging-order / veil protection | Strong, founder-friendly statute | Standard |
| **"Doing business" trap** | — | **If Jacob lives/works in CA, CA deems the LLC to be "doing business" in CA regardless of formation state** → must register as foreign LLC + pay the $800 anyway |
| Net for a CA-resident founder | Nevada-formed + CA foreign registration = **two filings, two fees, $800 still owed** | One filing, $800 |

**Decision rule (record it):**
- **If Jacob is physically resident and operating in California:** forming in Nevada to "escape" the $800 is the classic, costly mistake — California will still tax and require foreign-qualification, so a Nevada LLC means paying *both* states. In that case **form a California LLC** (single filing) OR keep the existing Nevada entity *and accept it must be foreign-registered in CA*. Do not run a CA-resident business through an unregistered Nevada-only LLC — that itself can void the shield in a CA court.
- **If Jacob is genuinely resident/operating in Nevada:** form (or maintain) the **Nevada LLC** — no state income tax, strong statute, ~$350/yr.
- **This is the single most important corporate decision to get a 30-minute consult on** before paying any filing fee. (See §7 checklist item E-1.)

> Whichever is chosen, the entity must be **registered (or foreign-qualified) in every state where Jacob actually lives and works**, because that is where a plaintiff or regulator will sue, and an unregistered foreign entity can be denied access to that state's courts and have its veil challenged.

### 2.3 Naming consistency — reconcile the "ZZ GEMZ" / "Make Ship Happen" / Ship-mark sprawl

The audit surfaces an identity-naming mismatch that is itself a veil and consumer-protection hazard: the **brand** is "Make Ship Happen" / "Ship Ecosystem," the **Stripe account** is titled "**ZZ GEMZ**" (a jewelry business name, per the `zzgemsjewelry@gmail.com` address), and the **product marks** are the "Ship*" family (`03-liability-review.md` §7.5). Three different commercial identities collecting the same customers' money is a commingling and misrepresentation red flag. The corporate fix:

1. Form the entity under a clean legal name (e.g., "Make Ship Happen LLC").
2. File a **DBA / fictitious business name** if the customer-facing brand ("Make Ship Happen," "Ship Ecosystem") differs from the registered legal name.
3. **Re-title or migrate the Stripe account** so the merchant-of-record name the customer sees on their card statement matches the entity (see §5).

---

## 3. Capitalization & IP Assignment of Founder-Created Code Into the Entity

This is the corporate step most solo founders skip and the one that most often guts the shield and the product's value. **Today, the code is Jacob's personal property; the entity owns nothing.** That has three consequences:

1. The entity cannot grant the customer license it purports to grant in a future EULA (it does not own the IP it is licensing) — and the audit already flags that the products have **no license of record** at all (`Cargo.toml license=""`, `authors=["you"]`, missing `package.json license`; `03-liability-review.md` §3.2, §7; `14-website-cluster.md` L-5).
2. In any infringement or breach claim, a court can find Jacob and the "company" are the same person (no separation of assets), defeating the veil.
3. The product has no clean chain of title for any future sale, financing, or acquisition (the audit calls the attribution/IP gaps a "deal-blocker, not just a fine," §7.2).

### 3.1 Required instruments (documents to draft and execute)

| Document | Purpose | Audit risk it cures |
|---|---|---|
| **Founder IP Assignment Agreement** (Jacob → entity) | Assigns all existing copyrights in ShipTalk, ShipMind, ShipSpace, makeshiphappen.tech source, brand assets, and the "Ship*" marks to the LLC, in exchange for membership interest (capital contribution) | Establishes the entity as owner/licensor so a future EULA can actually license the product; separates personal vs. company assets (veil) |
| **Capital Contribution / Membership Ledger entry** | Records that the IP (and any cash) was contributed in exchange for 100% membership units | Documents capitalization; shows the entity is adequately capitalized (anti-thin-capitalization, a veil-piercing factor) |
| **Confirmatory Assignment for marks** | Specifically assigns "ShipTalk / ShipMind / ShipSpace / Make Ship Happen / Ship Ecosystem" | Pairs with the trademark clearance advisory (§7.5 of liability review) |
| **Contractor/AI-tooling IP clause** (going forward) | Any future contractor, and a statement on AI-assisted code, assigns work product to the entity | Keeps chain of title clean as the codebase grows |

### 3.2 The GPL ffmpeg interaction (corporate angle only)

The audit's #1 legal risk is the GPLv2+ ffmpeg bundled in paid ShipMind (`03-liability-review.md` §7.1, Critical). The technical/licensing remediation belongs to the Legal and Operational parts. **The corporate-protections obligation is narrower and still essential:** assign the *first-party* ShipMind code into the entity **with a representation that the assignor is not knowingly conveying clean title to the third-party GPL component**, and ensure the distributor of record is the entity, not Jacob. A copyright-holder enforcement action (the audit notes the SFC actively pursues this pattern) should name the LLC, so that a settlement or statutory-damages judgment attaches to entity assets, not Jacob's house. **Do not let the IP-assignment paperwork over-represent that the company owns clean, unencumbered rights in the *entire* shipped binary** — that misstatement could later be used against Jacob personally. Flag the ffmpeg encumbrance in the assignment schedule.

---

## 4. Corporate Formalities to Preserve the Veil

An LLC shield is only as strong as the separation it maintains. For a single-member LLC the bar is *higher*, not lower, because courts scrutinize solo entities for alter-ego/commingling. The following are the concrete formalities to adopt and maintain. Each is cheap; skipping them is the most common way solo founders lose the shield they paid to create.

| Formality | Concrete action | Why (veil-piercing factor it defeats) |
|---|---|---|
| **Operating Agreement** | Adopt a single-member operating agreement (even though one member); state purpose, management, capital, distributions, and that the entity is separate from the member | Many states presume no shield without one for SMLLCs; primary evidence the entity is real |
| **Registered agent** | Appoint a registered agent in the formation state (and in CA if foreign-qualified) | Statutory requirement; failure can administratively dissolve the entity (no entity = no shield) |
| **Separate business bank account** | Open a business checking account **in the entity name** (EIN-based); never run business income/expenses through personal accounts | Commingling is the #1 veil-piercing finding; directly cures the "ZZ GEMZ"/personal blend |
| **No commingling** | Pay personal expenses only from personal funds; take owner draws by explicit transfer, never by paying personal bills from the business card | Alter-ego doctrine |
| **EIN** | Obtain a federal EIN for the entity; use it for banking, Stripe, taxes | Establishes the entity as a distinct taxpayer |
| **Minutes / written consents** | Keep a minute book; record annual written consent and any major decision (entity-type election, IP assignment, opening accounts, signing the EULA) as a dated resolution | Demonstrates the entity acts as an entity, not as the member's pocket |
| **Capitalization** | Contribute enough cash/IP that the entity is not "thin" relative to its foreseeable liabilities | Undercapitalization is a veil factor — relevant given the uncapped-liability exposures in §1 |
| **Contract in entity name** | Sign every customer agreement, vendor contract, and account "Make Ship Happen LLC, by Jacob Felton, Member" — never as an individual | Ensures the counterparty is the entity, so caps/disclaimers protect Jacob |
| **Annual filings** | File the annual report/list and pay franchise tax/business-license fee on time | Lapse → administrative dissolution → personal liability for acts during the lapse |

> **Resolution to draft now:** a one-page **"Founding Resolutions"** consent that (a) adopts the operating agreement, (b) ratifies the IP assignment and capital contribution, (c) authorizes opening the bank/Stripe accounts in the entity name, and (d) authorizes Jacob as the sole signatory. This single document anchors the minute book.

---

## 5. Business Banking & Payment-Account Titling (the "ZZ GEMZ" problem)

The audit specifically calls out the personal Stripe account titled **"ZZ GEMZ"** as the payment processor handling subscriptions and merch (`03-liability-review.md` §3.4; `14-website-cluster.md` §2.3 "Stripe (account 'ZZ GEMZ')", §6.3). This is a corporate-hygiene defect with three failure modes:

1. **Veil:** business revenue flowing through a personally-titled account (named after an unrelated jewelry business) is textbook commingling.
2. **Consumer-protection / chargeback:** customers paying for "Make Ship Happen / ShipMind" who see "**ZZ GEMZ**" on their card statement do not recognize the charge → elevated chargeback and friendly-fraud rate, and a UDAP-adjacent "who is actually charging me?" problem that compounds the §8 marketing risks.
3. **Tax:** mixing software-subscription revenue with any remaining jewelry activity under one Stripe identity muddies the entity's books.

**Corrective actions:**

| Action | Effort | Notes |
|---|---|---|
| Open a **new Stripe account in the entity's legal name** (or fully update the existing account's legal/business name + statement descriptor to "MAKESHIPHAPPEN" / "SHIP ECOSYSTEM") once the EIN exists | Low | The customer-visible **statement descriptor** must say a name the customer recognizes |
| Open a **business bank account** in the entity name; point the new Stripe payout to it | Low | Pairs with §4 separate-account formality |
| Re-title **Printful** and any other merchant accounts to the entity | Low | `14-website-cluster.md` §6.3 |
| Migrate existing customers/subscriptions to the entity-titled processor (or, if updating in place, document the legal-name change in the minute book) | Medium | Stripe supports business-profile updates; keep an audit trail |
| **Consistency check:** entity legal name == bank account name == Stripe legal name == DBA on the website footer == statement descriptor (family-resemblance) | Low | One reconciliation pass; record as a resolution |

---

## 6. Key-Person / Bus-Factor Mitigation (Governance of the Crown-Jewel Credentials)

The audit flags **single-developer key-person dependency** twice as a standalone business risk (`00-EXECUTIVE-REPORT.md` Business Risk #24, Doc Gap #5: "Administrator role (RLS, email-confirm, release keys) load-bearing but undocumented — no owner of the controls that make the system safe"). The release-signing key (minisign), the Supabase **service-role key** (full-data blast radius, `14-website-cluster.md` I-6), and the Stripe admin all rest on one person with no documented succession. If Jacob is unavailable, the company cannot ship updates, respond to a breach, or process refunds — and there is no continuity owner.

This is a **governance/operational** protection (not a code change). The corporate instruments:

| Protection | What to do | Mitigates |
|---|---|---|
| **Credential inventory & custody record** | Document every crown-jewel credential (minisign release key, Supabase service-role key, Stripe admin, Vercel, Printful, domain registrar, Apple developer ID) — who holds it, where it lives, recovery path. Store the inventory itself securely (password manager / sealed). | Business Risk #24; Doc Gap #5 |
| **Administrator-role definition (RACI)** | Write a one-page doc assigning the "administrator" duties the audit says are unowned: who confirms Supabase email-confirmation is ON, who applies migrations, who owns release signing, who triggers deploys. Today all are "Jacob," but *naming* them creates accountability and a handoff template. | Doc Gap #5; cli-login + owner-bypass operational confirmations (`14-website-cluster.md` §9) |
| **Business-continuity / "bus-factor" plan** | A sealed continuity document: how a trusted successor (family member, co-founder, fractional CTO) regains control of the entity, accounts, and signing keys if Jacob is incapacitated. Name the successor in the operating agreement (a single-member LLC should designate a successor manager to avoid the entity freezing on the member's incapacity). | Key-person risk; entity continuity |
| **Apple Developer / code-signing identity in entity name** | Hold the Apple Developer membership and signing identity under the entity (organization account), not Jacob's personal Apple ID, so the company — not the individual — controls distribution. | Veil + continuity |
| **Domain & trademark held by entity** | Register makeshiphappen.tech and the "Ship*" marks to the entity. | Chain of title; §7.5 advisory |

> This part stops at *governance*: defining roles, custody, and succession on paper. The *technical* hardening of those credentials (rotation, CI-only service-role key, fixing the cli-login relay) belongs to the Operational and Engineering tracks and is explicitly out of scope here.

---

## 7. Entity-Setup Checklist (Prioritized: Highest Protection / Lowest Effort First)

Legend — **Effort:** Low (hours/days) · Medium (1–3 weeks, may need a vendor/counsel) · Long-term (ongoing/recurring). **Protection:** High / Medium / Low.

### Phase A — Form the shield (do first)

- [ ] **E-1. 30-minute counsel/CPA consult on state choice** (NV vs CA based on Jacob's actual residence/operations) — **Effort: Low · Protection: High.** Prevents the costly Nevada-while-CA-resident double-fee + veil trap (§2.2). *Blocks everything below.*
- [ ] **E-2. File Articles of Organization for the LLC** in the chosen state — **Effort: Low · Protection: High.** Creates the shield (Business Risk #2).
- [ ] **E-3. Foreign-qualify in any state where Jacob lives/works** if formed elsewhere — **Effort: Low · Protection: High.** Without this the shield can be disregarded in the home-state court.
- [ ] **E-4. Obtain EIN** — **Effort: Low · Protection: High.** Prerequisite for banking, Stripe, taxes.
- [ ] **E-5. Adopt the single-member Operating Agreement** (with successor manager named) — **Effort: Low · Protection: High.** Primary evidence the entity is real; covers §4 + §6 continuity.
- [ ] **E-6. Appoint a registered agent** — **Effort: Low · Protection: Medium.** Statutory; lapse can dissolve the entity.
- [ ] **E-7. File DBA(s)** for "Make Ship Happen" / "Ship Ecosystem" if different from legal name — **Effort: Low · Protection: Medium.** Naming consistency (§2.3).

### Phase B — Capitalize & assign IP (do alongside A)

- [ ] **E-8. Execute the Founder IP Assignment** (code + marks → entity), with the GPL-ffmpeg encumbrance disclosed on the schedule — **Effort: Medium · Protection: High.** Lets a future EULA actually license the product; separates assets (§3).
- [ ] **E-9. Record capital contribution + membership ledger** (IP + initial cash) — **Effort: Low · Protection: Medium.** Anti-thin-capitalization; documents ownership.
- [ ] **E-10. Adopt Founding Resolutions** (ratify OA, IP assignment, account openings, sole signatory) and open the minute book — **Effort: Low · Protection: Medium.** Anchors formalities (§4).

### Phase C — Re-title money & accounts (do immediately after EIN)

- [ ] **E-11. Open a business bank account in the entity name** — **Effort: Low · Protection: High.** Cures commingling (#1 veil factor).
- [ ] **E-12. Re-title / replace the "ZZ GEMZ" Stripe account** to the entity legal name + recognizable statement descriptor — **Effort: Low · Protection: High.** Fixes the audit-named "ZZ GEMZ" defect (veil + chargeback).
- [ ] **E-13. Re-title Printful, Vercel, Supabase, domain registrar, Apple Developer to the entity** — **Effort: Medium · Protection: Medium.** Chain of title + continuity (§5, §6).
- [ ] **E-14. Reconcile all account names** (entity == bank == Stripe == DBA == descriptor) — **Effort: Low · Protection: Medium.** One pass; record as resolution (§5).

### Phase D — Govern the crown jewels (do within 30 days)

- [ ] **E-15. Build the credential inventory & custody record** — **Effort: Low · Protection: Medium.** Key-person mitigation (Business Risk #24).
- [ ] **E-16. Write the Administrator-Role / RACI one-pager** — **Effort: Low · Protection: Medium.** Closes Doc Gap #5.
- [ ] **E-17. Seal a business-continuity / bus-factor plan** naming a successor — **Effort: Medium · Protection: Medium.** Entity survives founder incapacity (§6).

### Phase E — Strategic / ongoing

- [ ] **E-18. Record an entity-type decision memo** (why SMLLC now, S-corp/C-corp trigger conditions) — **Effort: Low · Protection: Low.** Governance hygiene; pre-decides the financing path (§2.1).
- [ ] **E-19. Trademark clearance + filing for the "Ship*" family** held by the entity — **Effort: Long-term · Protection: Medium.** §7.5 advisory; protect brand before further investment.
- [ ] **E-20. Maintain annual formalities** (annual report/list, franchise tax/business license, minute-book updates) — **Effort: Long-term · Protection: High.** Lapse → administrative dissolution → personal liability.
- [ ] **E-21. Quote business-owner / management-liability insurance to the entity** (tech E&O / cyber / general liability) — **Effort: Medium · Protection: High.** *Coordinated with the Insurance part; flagged here because the policy must be written to the entity, not the individual, to backstop the veil.*

---

## 8. Sequencing Note & Hand-off

The strict order that maximizes protection per dollar:

1. **E-1 (state-choice consult)** — 30 minutes, prevents the single most expensive structural mistake.
2. **E-2 → E-6 (form + qualify + EIN + OA + agent)** — the shield itself.
3. **E-11 → E-12 (bank + Stripe re-titling)** — stop commingling the day the EIN lands; this is where the "ZZ GEMZ" exposure is bleeding now.
4. **E-8 (IP assignment)** — so the Legal part's EULA has an owner to license from.
5. Everything else within 30 days.

**Dependencies for other blueprint parts:** the **Legal part's EULA / warranty disclaimer / liability cap is inert until E-2 and E-8 are done** (no entity = no protected counterparty; no IP ownership = nothing to license). The **Insurance part (E-21) must name the entity.** The **Policy/Compliance parts' "data controller of record" is the entity** once formed. Form the entity first; everything else attaches to it.

---

*This is an internal business-protection blueprint prepared from the v3 audit. It is not legal, tax, or accounting advice and must be confirmed with licensed counsel and a CPA in the operator's jurisdiction (the NV-vs-CA decision in particular). All recommendations are corporate/governance instruments; none modify product code.*
