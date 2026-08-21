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
