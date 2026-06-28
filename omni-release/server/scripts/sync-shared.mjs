// Copies src/core → supabase/functions/_shared/core for the Deno edge runtime,
// rewriting NodeNext ".js" import specifiers to ".ts" (Deno resolves real files).
// Run: npm run fn:sync  (before `supabase functions deploy`).
import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src/core");
const outDir = join(root, "supabase/functions/_shared/core");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const name of await readdir(srcDir)) {
  if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
  const code = (await readFile(join(srcDir, name), "utf8")).replace(
    /from\s+"(\.\/[^"]+)\.js"/g,
    'from "$1.ts"',
  );
  await writeFile(join(outDir, name), code);
}
console.log(`synced core → ${outDir}`);
