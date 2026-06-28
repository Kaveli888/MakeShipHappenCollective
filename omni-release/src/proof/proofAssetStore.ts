import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { buildProofMetadata, type ProofAssetMetadata } from "./proofMetadata.js";
import { renderProofImage } from "./renderProofImage.js";
import type { ProofTemplate, ProofTemplateInput } from "./proofTemplate.js";

export type SaveProofAssetOptions = {
  rootDir?: string;
  assetRoot?: string;
  runId?: string;
  basename?: string;
};

export type SavedProofAsset = {
  imagePath: string;
  metadataPath: string;
  relativeImagePath: string;
  relativeMetadataPath: string;
  metadata: ProofAssetMetadata;
};

export async function saveProofAsset(
  input: ProofTemplateInput | ProofTemplate,
  options: SaveProofAssetOptions = {},
): Promise<SavedProofAsset> {
  const rootDir = options.rootDir ?? process.cwd();
  const assetRoot = options.assetRoot ?? "proof-assets";
  const rendered = renderProofImage(input);
  const slug = options.basename ?? rendered.metadata.slug;
  const shortHash = rendered.metadata.output.contentHash.slice(0, 8);
  const laneDir = sanitizePathSegment(input.lane);
  const dateDir = sanitizePathSegment(input.publicationDate);
  const runDir = options.runId ? sanitizePathSegment(options.runId) : "manual";
  const relativeDir = path.join(assetRoot, laneDir, dateDir, runDir);
  const imageFilename = `${slug}.${shortHash}.${rendered.fileExtension}`;
  const metadataFilename = `${slug}.${shortHash}.metadata.json`;
  const relativeImagePath = path.join(relativeDir, imageFilename);
  const relativeMetadataPath = path.join(relativeDir, metadataFilename);
  const absoluteDir = path.join(rootDir, relativeDir);
  const imagePath = path.join(rootDir, relativeImagePath);
  const metadataPath = path.join(rootDir, relativeMetadataPath);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(imagePath, rendered.content, "utf8");

  const metadata = buildProofMetadata(rendered.template, rendered.content, {
    imagePath: relativeImagePath,
    metadataPath: relativeMetadataPath,
  });

  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return {
    imagePath,
    metadataPath,
    relativeImagePath,
    relativeMetadataPath,
    metadata,
  };
}

function sanitizePathSegment(value: string): string {
  const segment = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return segment || "proof";
}
