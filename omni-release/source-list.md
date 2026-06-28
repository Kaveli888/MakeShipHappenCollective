# omni-release · Source List

Human-readable mirror of the in-code registry in
[`src/research/sourceRegistry.ts`](./src/research/sourceRegistry.ts). **That
file is the source of truth** — edit it to add/disable a source, then update
this table to match.

Columns:

- **Weight** — ranking multiplier (higher = surfaced more aggressively).
- **On** — `✓` enabled by default, `–` disabled (still selectable by explicit id).
- **Access** — how it's fetched. `browser` sources are skipped by the auto lane
  and handed to the browser collector/publisher lane (t5).

## Categories

The registry organizes every source into one of seven categories. A research-lane
run can target any subset via `options.categories`.

| Category     | What it covers                                            |
| ------------ | --------------------------------------------------------- |
| `lab-blog`   | Official AI lab / company announcement + engineering blogs |
| `research`   | Papers and preprints (arXiv, Papers with Code)            |
| `aggregator` | Community surfaces (Hacker News, Reddit)                  |
| `newsletter` | Curated AI newsletters                                    |
| `news`       | Tech-press AI desks                                       |
| `product`    | Launches, changelogs, trending repos                      |
| `social`     | X lists / threads (browser-gated)                         |

## Sources

### lab-blog

| id                     | Name                   | Weight | On | Access |
| ---------------------- | ---------------------- | ------ | -- | ------ |
| `openai-blog`          | OpenAI Blog            | 1.6    | ✓  | rss    |
| `anthropic-news`       | Anthropic News         | 1.6    | ✓  | rss    |
| `google-deepmind-blog` | Google DeepMind Blog   | 1.4    | ✓  | rss    |
| `google-ai-blog`       | Google Research Blog   | 1.2    | ✓  | atom   |
| `meta-ai-blog`         | Meta AI Blog           | 1.2    | ✓  | rss    |
| `mistral-news`         | Mistral AI News        | 1.1    | ✓  | rss    |
| `huggingface-blog`     | Hugging Face Blog      | 1.1    | ✓  | rss    |

### research

| id                 | Name                       | Weight | On | Access |
| ------------------ | -------------------------- | ------ | -- | ------ |
| `arxiv-cs-ai`      | arXiv cs.AI (recent)       | 1.0    | ✓  | atom   |
| `arxiv-cs-cl`      | arXiv cs.CL (NLP, recent)  | 1.0    | ✓  | atom   |
| `arxiv-cs-lg`      | arXiv cs.LG (ML, recent)   | 0.9    | ✓  | atom   |
| `papers-with-code` | Papers with Code (latest)  | 0.9    | –  | rss    |

### aggregator

| id                         | Name                       | Weight | On | Access      |
| -------------------------- | -------------------------- | ------ | -- | ----------- |
| `hn-ai`                    | Hacker News · AI stories   | 1.3    | ✓  | json-hn     |
| `reddit-machinelearning`   | r/MachineLearning (new)    | 1.0    | ✓  | json-reddit |
| `reddit-localllama`        | r/LocalLLaMA (new)         | 1.1    | ✓  | json-reddit |
| `reddit-artificial`        | r/artificial (new)         | 0.8    | –  | json-reddit |

### newsletter

| id            | Name                        | Weight | On | Access |
| ------------- | --------------------------- | ------ | -- | ------ |
| `the-batch`   | The Batch · DeepLearning.AI | 1.2    | ✓  | rss    |
| `import-ai`   | Import AI · Jack Clark      | 1.1    | ✓  | rss    |
| `bens-bites`  | Ben's Bites                 | 0.9    | ✓  | rss    |

### news

| id              | Name             | Weight | On | Access |
| --------------- | ---------------- | ------ | -- | ------ |
| `venturebeat-ai`| VentureBeat · AI | 1.0    | ✓  | rss    |
| `techcrunch-ai` | TechCrunch · AI  | 1.0    | ✓  | rss    |
| `theverge-ai`   | The Verge · AI   | 0.9    | ✓  | rss    |
| `arstechnica-ai`| Ars Technica · AI| 0.9    | ✓  | rss    |

### product

| id                   | Name                          | Weight | On | Access  |
| -------------------- | ----------------------------- | ------ | -- | ------- |
| `github-trending-ai` | GitHub Trending · AI (proxy)  | 0.8    | –  | rss     |
| `producthunt-ai`     | Product Hunt · AI             | 0.7    | –  | browser |

### social

| id          | Name                    | Weight | On | Access  |
| ----------- | ----------------------- | ------ | -- | ------- |
| `x-ai-list` | X · AI builders list    | 0.6    | –  | browser |

## Adding a source

1. Append a `Source` object to `SOURCE_REGISTRY` in `sourceRegistry.ts`.
2. Pick the correct `type`:
   - `rss` / `atom` — a feed URL (most blogs, newsletters, news, arXiv API).
   - `json-hn` — Hacker News via Algolia; put `{query}` where lane keywords go.
   - `json-reddit` — a Reddit `*.json` listing endpoint.
   - `json-generic` — any JSON API; set `itemsPath` to the items array.
   - `manual` + `needsBrowser: true` — no public feed; collected by the t5 lane.
3. Set `enabled`, a `weight` (~0.6–1.6), and topical `tags`.
4. Mirror the row into this file.

## Default scope

20 of 25 sources are enabled by default (run `summarizeRegistry()` to confirm).
Disabled sources are either unverified feeds or browser-gated; enable them per
run via `options.sourceIds` or by flipping `enabled` in the registry.
