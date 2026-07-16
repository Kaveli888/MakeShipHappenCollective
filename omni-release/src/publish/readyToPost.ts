/**
 * ready-to-post writer.
 *
 * Serializes a `ReadyToPostPackage` to a single markdown file under
 * `ready-to-post/`. This is the durable fallback that guarantees a post is never
 * silently dropped: whether publishing was queued, skipped, or failed, the full
 * post (captions, hashtags, CTA, sources, proof image, failure reason, and
 * manual posting steps) lands on disk for a human to act on.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ReadyToPostPackage } from "./types.js";

/** Platform → human label + manual posting hint. */
const PLATFORM_LABEL: Record<string, string> = {
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  facebook: "Facebook Page",
  browser: "Browser / manual paste",
};

function fence(body: string): string {
  // Use a tilde fence so backticks/hashes inside the post don't break it.
  return `~~~\n${body}\n~~~`;
}

function renderPost(p: ReadyToPostPackage["posts"][number]): string {
  const lines: string[] = [];
  lines.push(`### ${PLATFORM_LABEL[p.platform] ?? p.platform}`);
  lines.push("");
  lines.push(`- **Characters:** ${p.charCount}`);
  lines.push(`- **CTA:** ${p.cta}`);
  if (p.imageAltText) lines.push(`- **Image alt text:** ${p.imageAltText}`);
  if (p.result) {
    lines.push(`- **Publish attempt:** ${p.result.status}${p.result.error ? ` — ${p.result.error}` : ""}`);
    if (p.result.externalId) lines.push(`- **Published URL/id:** ${p.result.externalId}`);
  }
  lines.push("");
  lines.push("**Caption:**");
  lines.push("");
  lines.push(fence(p.body));
  lines.push("");
  lines.push(`**Hashtags:** ${p.hashtags.length ? p.hashtags.join(" ") : "(none)"}`);
  lines.push("");
  return lines.join("\n");
}

/** Render the package to markdown. */
export function renderReadyToPost(pkg: ReadyToPostPackage): string {
  const out: string[] = [];
  out.push(`# Ready to post — ${pkg.laneName}`);
  out.push("");
  out.push(`- **Run id:** ${pkg.runId}`);
  out.push(`- **Lane:** ${pkg.laneName} (\`${pkg.laneId}\`)`);
  out.push(`- **Date/time:** ${pkg.createdAt}`);
  out.push(`- **Topic:** ${pkg.topic}`);
  out.push(`- **Mode:** ${pkg.mode}${pkg.dryRun ? " (dry run)" : ""}`);
  if (pkg.proofImagePath) out.push(`- **Proof image:** ${pkg.proofImagePath}`);
  if (pkg.failureReason) out.push(`- **Why this needs manual posting:** ${pkg.failureReason}`);
  out.push("");

  out.push("## Sources");
  out.push("");
  if (pkg.sources.length) {
    for (const s of pkg.sources) out.push(`- ${s.name} — ${s.url}`);
  } else {
    out.push("- (no sources captured)");
  }
  out.push("");

  out.push("## Platform captions");
  out.push("");
  for (const p of pkg.posts) out.push(renderPost(p));

  out.push("## Manual posting instructions");
  out.push("");
  out.push("1. Open each target platform and start a new post.");
  out.push("2. Copy the caption block for that platform exactly (it already fits the character limit).");
  if (pkg.proofImagePath) {
    out.push(`3. Attach the proof image: \`${pkg.proofImagePath}\` (SVG — open it and export a PNG if the platform rejects SVG).`);
  } else {
    out.push("3. No proof image was generated for this run.");
  }
  out.push("4. Confirm the hashtags are at the end of the post.");
  out.push("5. Post, then (optionally) paste the live URL back into `social-post-log.jsonl`.");
  out.push("");

  return out.join("\n");
}

export interface WriteReadyToPostOptions {
  /** Project root; the package is written under `<rootDir>/ready-to-post/`. */
  rootDir: string;
  /** Override the directory name (default `ready-to-post`). */
  dirName?: string;
}

/** Write the package to `ready-to-post/<runId>.md`. Returns the absolute path. */
export async function writeReadyToPostPackage(
  pkg: ReadyToPostPackage,
  options: WriteReadyToPostOptions,
): Promise<string> {
  const dir = join(options.rootDir, options.dirName ?? "ready-to-post");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${pkg.runId}.md`);
  await writeFile(path, renderReadyToPost(pkg), "utf8");
  return path;
}
