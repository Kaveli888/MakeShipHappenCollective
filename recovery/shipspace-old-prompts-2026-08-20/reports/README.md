# ShipSpace old prompt recovery

Recovered 832 unique prompts from 5 WebKit snapshots.

- Already present in the filesystem library: 457
- Recovered only from historical app storage: 375

## Snapshots

| Snapshot | Store version | Projects | Prompt records |
| --- | ---: | ---: | ---: |
| dev-current | 2 | 7 | 823 |
| stable-history-a | 0 | 5 | 606 |
| stable-history-b | 2 | 7 | 823 |
| legacy-shipspace | 0 | 5 | 308 |
| sandbox-history | 2 | 4 | 457 |

## Deduplicated projects

| Project | Unique | Already on disk | Recovered only |
| --- | ---: | ---: | ---: |
| ADE Desktop App | 5 | 0 | 5 |
| Agents | 198 | 98 | 100 |
| BS Multi-Agent Prompts | 60 | 0 | 60 |
| Goal Prompts | 80 | 80 | 0 |
| Prompt Library for Coding | 281 | 180 | 101 |
| Skills | 202 | 99 | 103 |
| Vibe Platform | 6 | 0 | 6 |

## Missing from the current dev snapshot

- Agents: A/B Testing Framework
- Agents: CI/CD Pipeline Overhaul
- BS Multi-Agent Prompts: 10 — Bridge Memory navigation: back/forward + history
- BS Multi-Agent Prompts: 20 — Mind-reading / zero-input feature research
- BS Multi-Agent Prompts: UI Polish / Styling Refinement
- Prompt Library for Coding: React SSR/SSG Setup
- Skills: CI/CD Pipeline Setup
- Skills: Pub/Sub System
- Skills: SSL/TLS Certificate Management

The raw UTF-16 values and normalized JSON snapshots are preserved alongside the deduplicated prompt files.
The `recovered-only-library` folder contains only prompts that are not present in the current filesystem library.

## Permanent import

Completed 2026-08-20.

- Imported: 375 recovered-only prompts
- New filenames: 373
- Same-title/different-content conflicts preserved with a recovery suffix: 2
- Permanent library total after import: 832 prompts
- Empty files: 0
- Byte-for-byte import verification: 375/375 passed
- Pre-import backup: `/Users/jake/MakeShipHappenCollective/Prompts.backup-before-old-prompt-import-2026-08-20`
- Detailed import log: `import-result.json`

## Second-sweep audit

Completed 2026-08-21 after specific historical titles were still difficult to find.

- Rechecked all 5 ShipSpace WebKit stores containing `shipspace-prompt-library`.
- Extracted and compared 17 prompt-catalog exports across 6 Git revisions.
- Checked the permanent filesystem library, recovery backup, and ShipSpace worktrees.
- Found one real content variation: `Live Agent Status Roll-Up` changed from `Mission control` to `Ship Control` during the naming migration.
- Preserved both versions as separate files; the permanent library now contains 833 non-empty prompt files.
- Identified 29 historical title-only aliases whose content was already present. These were mostly filename punctuation changes (`A/B` vs `A B`, colons, quotes) plus the old `Swarm` names now branded as `Gang`.
- ShipSpace search now normalizes punctuation and maps historical `Swarm` searches to `Gang`, so the old names resolve without adding another layer of repetitive duplicate records.
- Full machine-readable evidence: `all-source-audit.json`.

## Re-running the tools

The recovery tools default to the current repository and its `Prompts` folder. Override paths with `--prompt-root`, `--live-repo`, or the `SHIPSPACE_PROMPT_ROOT` and `SHIPSPACE_LIVE_REPO` environment variables.

```bash
# Rebuild the recovery inventory against this checkout.
node recovery/shipspace-old-prompts-2026-08-20/recover-prompts.mjs

# Re-audit this checkout without scanning macOS app storage.
node recovery/shipspace-old-prompts-2026-08-20/audit-all-prompt-sources.mjs \
  --skip-local-storage --output /tmp/shipspace-all-source-audit.json

# Preview an import without changing the library or committed report.
node recovery/shipspace-old-prompts-2026-08-20/import-recovered-prompts.mjs \
  --output /tmp/shipspace-prompt-import-plan.json

# Apply only to an explicitly selected library, then verify it.
node recovery/shipspace-old-prompts-2026-08-20/import-recovered-prompts.mjs \
  --apply --prompt-root /absolute/path/to/Prompts
node recovery/shipspace-old-prompts-2026-08-20/verify-import.mjs \
  --prompt-root /absolute/path/to/Prompts
```

`--apply` refuses to run unless the destination is explicit. This prevents a recovery command from writing to an unintended checkout.
