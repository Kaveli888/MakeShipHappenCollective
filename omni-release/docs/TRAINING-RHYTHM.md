# Omni Release Training Rhythm

This is the working rhythm for Jake teaching Omni Release platform publishing.
Use it at the start and end of every browser-training session.

## Session Start

1. Read `docs/ACCOMPLISHMENTS.md`.
2. Read `docs/PLATFORM-TRAINING.md`.
3. Read the target platform playbook under `docs/platform-playbooks/`.
4. Confirm Chrome is in Jake's intended profile.
5. Open Omni Release Agent Queue.
6. Open the due handoff with `Open due tabs` or `npm run agent:tabs`.

## While Jake Demonstrates

Capture only operational facts:

- exact starting URL
- active account, Page, channel, or profile
- button labels and field labels
- when a modal opens
- media upload path
- media limits or warnings shown by the platform
- final publish button label
- success message or visible published post
- anything that causes a human gate

Do not record passwords, cookies, recovery codes, backup codes, or private
security prompts.

## After The Demonstration

1. Update the platform playbook immediately.
2. Add a short line to `docs/ACCOMPLISHMENTS.md`.
3. If a blocker happened, add it to the playbook's known gates.
4. If a media workaround was needed, record the derivative naming rule.
5. If code changed, run the relevant verification before calling the session done.

## Smooth Handoff Phrase

When a new agent enters this project, say:

```text
Read docs/ACCOMPLISHMENTS.md, docs/PLATFORM-TRAINING.md, and the relevant
docs/platform-playbooks/<platform>.md before touching browser publishing.
```

## Definition Of Trained

A platform is trained when:

- the correct entry URL is documented
- the account/page identity is documented
- the composer flow is documented
- media rules are documented
- success signal is documented
- known human gates are documented
- at least one real or dry-run proof exists

## Definition Of Shipped

A platform post is shipped when:

- the platform visibly shows the new post
- `outbox/done/<job_id>.result.json` has `outcome: posted`
- Omni Release ingests the result
- Agent Queue clears the card
- proof screenshot is archived
