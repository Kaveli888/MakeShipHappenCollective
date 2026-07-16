export const PROOF_IMAGE_VERSION = "0.1.0";

export const PROOF_IMAGE_OUTPUT_FORMAT = {
  extension: "svg",
  mimeType: "image/svg+xml",
  encoding: "utf-8",
  width: 1200,
  height: 675,
  aspectRatio: "16:9",
} as const;

export const PROOF_CONTENT_REQUIREMENTS = [
  "A proof image must contain one clear verdict headline.",
  "A proof image must identify the lane, publication date, and proof type.",
  "A proof image must include at least one evidence-backed claim.",
  "Each claim must include a source label, source URL when available, and confidence level.",
  "Claims should be short enough for social preview cards: 120 characters or fewer.",
  "Images must avoid unverified superlatives, fabricated metrics, and unsourced price or performance claims.",
  "The output image format is UTF-8 SVG at 1200x675 with a matching JSON metadata sidecar.",
] as const;

export type ProofType =
  | "battle-card"
  | "news-card"
  | "launch-card"
  | "receipt-card"
  | "comparison-card";

export type ProofConfidence = "low" | "medium" | "high";

export type ProofClaim = {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
  confidence: ProofConfidence;
  checkedAt?: string;
};

export type ProofTemplateInput = {
  title: string;
  subtitle?: string;
  lane: string;
  proofType: ProofType;
  publicationDate: string;
  claims: ProofClaim[];
  audience?: string;
  brand?: {
    name?: string;
    domain?: string;
  };
  palette?: {
    background?: string;
    panel?: string;
    text?: string;
    muted?: string;
    accent?: string;
    border?: string;
  };
  footerNote?: string;
};

export type ProofTemplate = Required<
  Pick<ProofTemplateInput, "title" | "lane" | "proofType" | "publicationDate" | "claims">
> &
  Pick<ProofTemplateInput, "subtitle" | "audience" | "footerNote"> & {
    brand: Required<NonNullable<ProofTemplateInput["brand"]>>;
    palette: Required<NonNullable<ProofTemplateInput["palette"]>>;
    output: typeof PROOF_IMAGE_OUTPUT_FORMAT;
    requirements: readonly string[];
    createdAt: string;
  };

const DEFAULT_BRAND = {
  name: "MakeShipHappen",
  domain: "MakeShipHappen.tech",
};

const DEFAULT_PALETTE = {
  background: "#101820",
  panel: "#f7efe0",
  text: "#172026",
  muted: "#59636b",
  accent: "#f3a712",
  border: "#d7cab2",
};

export function createProofTemplate(input: ProofTemplateInput, createdAt = new Date().toISOString()): ProofTemplate {
  validateProofTemplateInput(input);

  return {
    title: normalizeText(input.title),
    subtitle: input.subtitle ? normalizeText(input.subtitle) : undefined,
    lane: normalizeText(input.lane),
    proofType: input.proofType,
    publicationDate: input.publicationDate,
    claims: input.claims.map((claim) => ({
      text: normalizeText(claim.text),
      sourceLabel: normalizeText(claim.sourceLabel),
      sourceUrl: claim.sourceUrl?.trim(),
      confidence: claim.confidence,
      checkedAt: claim.checkedAt,
    })),
    audience: input.audience ? normalizeText(input.audience) : undefined,
    brand: {
      ...DEFAULT_BRAND,
      ...input.brand,
    },
    palette: {
      ...DEFAULT_PALETTE,
      ...input.palette,
    },
    footerNote: input.footerNote ? normalizeText(input.footerNote) : undefined,
    output: PROOF_IMAGE_OUTPUT_FORMAT,
    requirements: PROOF_CONTENT_REQUIREMENTS,
    createdAt,
  };
}

export function validateProofTemplateInput(input: ProofTemplateInput): void {
  const errors: string[] = [];

  if (!input.title?.trim()) {
    errors.push("title is required");
  }

  if (input.title && input.title.trim().length > 92) {
    errors.push("title must be 92 characters or fewer");
  }

  if (!input.lane?.trim()) {
    errors.push("lane is required");
  }

  if (!input.proofType) {
    errors.push("proofType is required");
  }

  if (!input.publicationDate?.trim()) {
    errors.push("publicationDate is required");
  }

  if (!Array.isArray(input.claims) || input.claims.length === 0) {
    errors.push("at least one claim is required");
  }

  input.claims?.forEach((claim, index) => {
    const label = `claims[${index}]`;
    if (!claim.text?.trim()) {
      errors.push(`${label}.text is required`);
    }

    if (claim.text && claim.text.trim().length > 120) {
      errors.push(`${label}.text must be 120 characters or fewer`);
    }

    if (!claim.sourceLabel?.trim()) {
      errors.push(`${label}.sourceLabel is required`);
    }

    if (!claim.confidence) {
      errors.push(`${label}.confidence is required`);
    }

    if (claim.sourceUrl && !isLikelyUrl(claim.sourceUrl)) {
      errors.push(`${label}.sourceUrl must be an http(s) URL`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid proof template input: ${errors.join("; ")}`);
  }
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isLikelyUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
