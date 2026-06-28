import { createHash } from "node:crypto";
import { PROOF_IMAGE_VERSION, type ProofClaim, type ProofTemplate } from "./proofTemplate.js";

export type ProofRequirementStatus = {
  requirement: string;
  satisfied: boolean;
};

export type ProofAssetMetadata = {
  schemaVersion: "proof-image-metadata/v1";
  proofImageVersion: string;
  generatedAt: string;
  title: string;
  slug: string;
  lane: string;
  proofType: string;
  publicationDate: string;
  output: {
    format: "svg";
    mimeType: "image/svg+xml";
    width: number;
    height: number;
    contentHash: string;
  };
  brand: {
    name: string;
    domain: string;
  };
  evidence: {
    sourceCount: number;
    claims: ProofClaim[];
  };
  requirements: ProofRequirementStatus[];
  files?: {
    imagePath?: string;
    metadataPath?: string;
  };
};

export function buildProofMetadata(
  template: ProofTemplate,
  renderedSvg: string,
  options: { imagePath?: string; metadataPath?: string; generatedAt?: string } = {},
): ProofAssetMetadata {
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  return {
    schemaVersion: "proof-image-metadata/v1",
    proofImageVersion: PROOF_IMAGE_VERSION,
    generatedAt,
    title: template.title,
    slug: createProofSlug(template),
    lane: template.lane,
    proofType: template.proofType,
    publicationDate: template.publicationDate,
    output: {
      format: "svg",
      mimeType: "image/svg+xml",
      width: template.output.width,
      height: template.output.height,
      contentHash: createContentHash(renderedSvg),
    },
    brand: template.brand,
    evidence: {
      sourceCount: countUniqueSources(template.claims),
      claims: template.claims,
    },
    requirements: evaluateProofRequirements(template),
    files:
      options.imagePath || options.metadataPath
        ? {
            imagePath: options.imagePath,
            metadataPath: options.metadataPath,
          }
        : undefined,
  };
}

export function createProofSlug(template: Pick<ProofTemplate, "title" | "lane" | "publicationDate">): string {
  return normalizeSlug(`${template.publicationDate}-${template.lane}-${template.title}`);
}

export function normalizeSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);

  return slug || "proof-image";
}

export function createContentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function evaluateProofRequirements(template: ProofTemplate): ProofRequirementStatus[] {
  return template.requirements.map((requirement) => ({
    requirement,
    satisfied: isRequirementSatisfied(requirement, template),
  }));
}

function countUniqueSources(claims: ProofClaim[]): number {
  const sources = new Set(claims.map((claim) => claim.sourceUrl ?? claim.sourceLabel));
  return sources.size;
}

function isRequirementSatisfied(requirement: string, template: ProofTemplate): boolean {
  if (requirement.includes("verdict headline")) {
    return template.title.length > 0 && template.title.length <= 92;
  }

  if (requirement.includes("lane, publication date, and proof type")) {
    return Boolean(template.lane && template.publicationDate && template.proofType);
  }

  if (requirement.includes("at least one evidence-backed claim")) {
    return template.claims.length > 0;
  }

  if (requirement.includes("source label, source URL when available, and confidence level")) {
    return template.claims.every((claim) => Boolean(claim.sourceLabel && claim.confidence));
  }

  if (requirement.includes("120 characters or fewer")) {
    return template.claims.every((claim) => claim.text.length <= 120);
  }

  if (requirement.includes("unverified superlatives")) {
    return template.claims.every((claim) => !containsBannedProofLanguage(claim.text));
  }

  if (requirement.includes("UTF-8 SVG")) {
    return template.output.extension === "svg" && template.output.encoding === "utf-8";
  }

  return true;
}

function containsBannedProofLanguage(value: string): boolean {
  return /\b(best|guaranteed|always|never|#1|number one|fastest|cheapest)\b/i.test(value);
}
