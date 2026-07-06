import { buildProofMetadata, type ProofAssetMetadata } from "./proofMetadata.js";
import { createProofTemplate, type ProofTemplate, type ProofTemplateInput } from "./proofTemplate.js";

export type ProofRenderResult = {
  format: "svg";
  mimeType: "image/svg+xml";
  fileExtension: "svg";
  width: number;
  height: number;
  content: string;
  metadata: ProofAssetMetadata;
  template: ProofTemplate;
};

export function renderProofImage(input: ProofTemplateInput | ProofTemplate): ProofRenderResult {
  const template = isProofTemplate(input) ? input : createProofTemplate(input);
  const content = renderSvg(template);
  const metadata = buildProofMetadata(template, content);

  return {
    format: "svg",
    mimeType: template.output.mimeType,
    fileExtension: template.output.extension,
    width: template.output.width,
    height: template.output.height,
    content,
    metadata,
    template,
  };
}

function renderSvg(template: ProofTemplate): string {
  const { width, height } = template.output;
  const palette = template.palette;
  const titleLines = wrapText(template.title, 22, 3);
  const subtitleLines = template.subtitle ? wrapText(template.subtitle, 54, 2) : [];
  const claims = template.claims.slice(0, 3);
  const sourceLabels = Array.from(new Set(template.claims.map((claim) => claim.sourceLabel))).slice(0, 4);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(template.title)}</title>
  <desc id="desc">Proof image for ${escapeXml(template.lane)} with ${template.claims.length} evidence-backed claim${template.claims.length === 1 ? "" : "s"}.</desc>
  <rect width="${width}" height="${height}" fill="${palette.background}"/>
  <rect x="44" y="42" width="1112" height="591" rx="26" fill="${palette.panel}" stroke="${palette.border}" stroke-width="2"/>
  <rect x="44" y="42" width="1112" height="18" rx="9" fill="${palette.accent}"/>
  <text x="82" y="112" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.accent}" letter-spacing="2">${escapeXml(template.proofType.toUpperCase())}</text>
  <text x="82" y="150" font-family="Inter, Arial, sans-serif" font-size="22" fill="${palette.muted}">${escapeXml(template.lane)} | ${escapeXml(template.publicationDate)}</text>
${renderMultilineText(titleLines, 82, 230, 58, 64, palette.text, 800)}
${subtitleLines.length > 0 ? renderMultilineText(subtitleLines, 82, 398, 26, 34, palette.muted, 500) : ""}
  <g transform="translate(720 110)">
    <rect x="0" y="0" width="374" height="338" rx="18" fill="#ffffff" stroke="${palette.border}" stroke-width="2"/>
    <text x="28" y="52" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800" fill="${palette.text}">Evidence</text>
${claims.map((claim, index) => renderClaim(claim.text, claim.sourceLabel, claim.confidence, index, palette)).join("\n")}
  </g>
  <g transform="translate(82 528)">
    <text x="0" y="0" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="${palette.text}">Sources</text>
    <text x="0" y="34" font-family="Inter, Arial, sans-serif" font-size="18" fill="${palette.muted}">${escapeXml(sourceLabels.join(" | "))}</text>
  </g>
  <text x="1116" y="588" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="800" fill="${palette.text}">${escapeXml(template.brand.name)}</text>
  <text x="1116" y="616" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="16" fill="${palette.muted}">${escapeXml(template.footerNote ?? template.brand.domain)}</text>
</svg>
`;
}

function renderClaim(text: string, sourceLabel: string, confidence: string, index: number, palette: ProofTemplate["palette"]): string {
  const y = 90 + index * 78;
  const claimLines = wrapText(text, 39, 2);
  const confidenceLabel = confidence.toUpperCase();

  return `    <g transform="translate(28 ${y})">
      <circle cx="9" cy="9" r="9" fill="${palette.accent}"/>
      ${renderMultilineText(claimLines, 30, 3, 16, 22, palette.text, 700, 300, "Inter, Arial, sans-serif")}
      <text x="30" y="53" font-family="Inter, Arial, sans-serif" font-size="13" fill="${palette.muted}">${escapeXml(sourceLabel)} | ${escapeXml(confidenceLabel)}</text>
    </g>`;
}

function renderMultilineText(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  fill: string,
  fontWeight: number,
  maxWidth?: number,
  fontFamily = "Inter, Arial, sans-serif",
): string {
  const widthAttr = maxWidth ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"` : "";

  return lines
    .map(
      (line, index) =>
        `  <text x="${x}" y="${y + index * lineHeight}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}"${widthAttr}>${escapeXml(line)}</text>`,
    )
    .join("\n");
}

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const lastIndex = maxLines - 1;
    const lastLine = lines[lastIndex];

    if (lastLine) {
      lines[lastIndex] = `${lastLine.replace(/\.+$/, "")}...`;
    }
  }

  return lines;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isProofTemplate(input: ProofTemplateInput | ProofTemplate): input is ProofTemplate {
  return "output" in input && "requirements" in input && "createdAt" in input;
}
