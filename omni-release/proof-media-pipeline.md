# Proof Media Pipeline

Task slice: `t4`

The proof media pipeline converts research and caption outputs into citation-backed proof cards for social posting. The first implementation is dependency-free and renders deterministic SVG so the queue and CLI can run before browser or image libraries are installed.

## Inputs

Required fields:

- `title`: one verdict headline, 92 characters or fewer.
- `lane`: content lane name, for example `Evening Battle Card`.
- `proofType`: `battle-card`, `news-card`, `launch-card`, `receipt-card`, or `comparison-card`.
- `publicationDate`: ISO-style date string used in the card and asset path.
- `claims`: one or more short evidence-backed claims.

Each claim requires:

- `text`: claim copy, 120 characters or fewer.
- `sourceLabel`: human-readable source name.
- `sourceUrl`: optional HTTP(S) source URL.
- `confidence`: `low`, `medium`, or `high`.
- `checkedAt`: optional timestamp from the fact-checking layer.

## Content Requirements

- The image must include the verdict headline, lane, proof type, and publication date.
- Every visible claim must be tied to a source label and confidence level.
- The metadata sidecar must preserve all claims, including claims not rendered because of space.
- Avoid unsourced performance, price, or ranking language.
- Keep visible claim text compact enough for a social preview card.

## Output Format

- Primary output: UTF-8 SVG.
- Dimensions: 1200x675.
- Aspect ratio: 16:9.
- MIME type: `image/svg+xml`.
- Metadata: JSON sidecar using schema `proof-image-metadata/v1`.

The renderer intentionally starts with SVG because it is inspectable, deterministic, and easy to validate in integration tests. A later adapter can rasterize the same SVG to PNG without changing the proof metadata contract.

## Asset Storage

`saveProofAsset(input, options)` writes both files to:

```text
proof-assets/<lane>/<publication-date>/<run-id>/<slug>.<hash>.svg
proof-assets/<lane>/<publication-date>/<run-id>/<slug>.<hash>.metadata.json
```

The content hash is derived from the rendered SVG. This makes repeated dry-runs stable and helps the publisher queue avoid duplicate proof assets.

## Handoff Contract

Expected importer:

```ts
import { renderProofImage, saveProofAsset } from "./src/proof";
```

Typical flow:

```ts
const saved = await saveProofAsset({
  title: "OpenAI ships a new model while rivals compress pricing",
  lane: "Evening Battle Card",
  proofType: "battle-card",
  publicationDate: "2026-06-26",
  claims: [
    {
      text: "Primary source confirms the launch window and positioning.",
      sourceLabel: "OpenAI News",
      sourceUrl: "https://openai.com/news/",
      confidence: "high",
    },
  ],
});
```

The returned object includes absolute paths, relative paths, and the full metadata payload for downstream queue items.
