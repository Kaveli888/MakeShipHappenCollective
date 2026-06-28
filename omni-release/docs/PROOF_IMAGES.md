# Proof Images

Proof images are evidence cards generated from researched, fact-checked content. They are designed for queue-only publishing by default and should always ship with metadata.

## Module Files

- `src/proof/proofTemplate.ts`: validates and normalizes image input.
- `src/proof/renderProofImage.ts`: renders a 1200x675 SVG proof card.
- `src/proof/proofMetadata.ts`: builds stable metadata, slugs, hashes, and requirement checks.
- `src/proof/proofAssetStore.ts`: saves SVG and JSON sidecar files under `proof-assets`.

## Required Image Content

Every proof image must contain:

- A single verdict headline.
- Content lane.
- Proof type.
- Publication date.
- At least one evidence-backed claim.
- Source labels and confidence levels.
- MakeShipHappen brand footer.

Metadata must also retain:

- All claims provided to the renderer.
- Source URLs when available.
- Content hash.
- Output dimensions and MIME type.
- Relative asset paths once saved.

## Default Output

The default output is SVG:

```text
format: svg
mime: image/svg+xml
size: 1200x675
encoding: utf-8
metadata: proof-image-metadata/v1 JSON
```

SVG keeps the proof pipeline deterministic and dependency-free for dry-run tests. PNG export can be added later as an adapter that consumes the SVG output.

## Usage

```ts
import { renderProofImage, saveProofAsset } from "../src/proof";

const rendered = renderProofImage({
  title: "Anthropic expands enterprise controls as model competition tightens",
  lane: "Evening Battle Card",
  proofType: "battle-card",
  publicationDate: "2026-06-26",
  claims: [
    {
      text: "The announcement names new enterprise controls and admin visibility features.",
      sourceLabel: "Company blog",
      sourceUrl: "https://example.com/source",
      confidence: "high",
    },
  ],
});

const saved = await saveProofAsset(rendered.template);
```

`rendered.content` is the SVG string. `saved.relativeImagePath` and `saved.relativeMetadataPath` are the values publisher queue items should reference.

## Validation Rules

The template validator rejects:

- Missing title, lane, proof type, publication date, or claims.
- Titles longer than 92 characters.
- Claim text longer than 120 characters.
- Claims without source labels.
- Invalid non-HTTP source URLs.

The metadata evaluator also marks risky proof language such as unsourced `best`, `guaranteed`, `#1`, `fastest`, or `cheapest` language as unsatisfied.

## Integration Notes

- The proof slice does not call external image APIs.
- The asset store writes only inside `proof-assets` by default.
- t6 can mock research and caption inputs, call `saveProofAsset`, and assert that both the SVG and metadata sidecar exist.
- t5 should place relative proof asset paths into queue markdown when a post includes media.
