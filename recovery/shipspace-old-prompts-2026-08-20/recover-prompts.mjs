import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const recoveryRoot = dirname(fileURLToPath(import.meta.url));
const jsonRoot = join(recoveryRoot, 'json');
const outputRoot = join(recoveryRoot, 'deduplicated-library');
const recoveredOnlyRoot = join(recoveryRoot, 'recovered-only-library');
const reportsRoot = join(recoveryRoot, 'reports');
const filesystemRoot = '/Users/jake/MakeShipHappenCollective/Prompts';

const snapshots = [
    'dev-current',
    'stable-history-a',
    'stable-history-b',
    'legacy-shipspace',
    'sandbox-history',
];

const fingerprint = (project, title, content) => createHash('sha256')
    .update(JSON.stringify([project, title, content]))
    .digest('hex');

const safeName = (value, fallback) => {
    const cleaned = value
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^\.+|\.+$/g, '');
    return (cleaned || fallback).slice(0, 140).trim();
};

async function collectFiles(root, recursive = false) {
    const files = [];
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const path = join(root, entry.name);
        if (entry.isDirectory() && recursive) {
            files.push(...await collectFiles(path, true));
        } else if (entry.isFile() && /\.(txt|md)$/i.test(entry.name)) {
            files.push(path);
        }
    }
    return files;
}

async function filesystemFingerprints() {
    const sources = [
        ['Agents', join(filesystemRoot, 'Agents'), false],
        ['Skills', join(filesystemRoot, 'Skills'), false],
        ['Goal Prompts', join(filesystemRoot, 'Goal Prompts'), false],
        ['Prompt Library for Coding', join(filesystemRoot, 'Promp Library For Coding'), true],
    ];
    const keys = new Set();
    for (const [project, root, recursive] of sources) {
        const files = await collectFiles(root, recursive);
        for (const path of files) {
            const title = path.split('/').at(-1).replace(/\.(txt|md)$/i, '');
            const content = await readFile(path, 'utf8');
            keys.add(fingerprint(project, title, content));
        }
    }
    return keys;
}

const onDisk = await filesystemFingerprints();
const recovered = new Map();
const snapshotSummary = [];

for (const snapshot of snapshots) {
    const raw = JSON.parse(await readFile(join(jsonRoot, `${snapshot}.json`), 'utf8'));
    const projects = raw?.state?.projects ?? [];
    let promptCount = 0;
    for (const project of projects) {
        for (const prompt of project.prompts ?? []) {
            promptCount += 1;
            const projectName = project.projectName || 'Recovered';
            const title = prompt.title || 'Untitled Prompt';
            const content = typeof prompt.content === 'string' ? prompt.content : '';
            const key = fingerprint(projectName, title, content);
            const existing = recovered.get(key);
            if (existing) {
                existing.sources.add(snapshot);
                for (const tag of prompt.tags ?? []) existing.tags.add(tag);
            } else {
                recovered.set(key, {
                    key,
                    projectName,
                    title,
                    content,
                    tags: new Set(prompt.tags ?? []),
                    sources: new Set([snapshot]),
                    alreadyOnDisk: onDisk.has(key),
                });
            }
        }
    }
    snapshotSummary.push({
        snapshot,
        version: raw?.version ?? null,
        projects: projects.length,
        prompts: promptCount,
    });
}

await mkdir(outputRoot, { recursive: true });
await mkdir(reportsRoot, { recursive: true });

const usedPaths = new Map();
const manifest = [];
const ordered = [...recovered.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName) || a.title.localeCompare(b.title)
);

for (const prompt of ordered) {
    const projectDir = safeName(prompt.projectName, 'Recovered');
    const dir = join(outputRoot, projectDir);
    await mkdir(dir, { recursive: true });
    const base = safeName(prompt.title, 'Untitled Prompt');
    let fileName = `${base}.txt`;
    const pathKey = `${projectDir}/${fileName}`.toLowerCase();
    if (usedPaths.has(pathKey) && usedPaths.get(pathKey) !== prompt.key) {
        fileName = `${base}--${prompt.key.slice(0, 10)}.txt`;
    }
    usedPaths.set(`${projectDir}/${fileName}`.toLowerCase(), prompt.key);
    const outputPath = join(dir, fileName);
    await writeFile(outputPath, prompt.content, 'utf8');
    manifest.push({
        project: prompt.projectName,
        title: prompt.title,
        file: relative(recoveryRoot, outputPath),
        tags: [...prompt.tags].sort(),
        sources: [...prompt.sources].sort(),
        alreadyOnDisk: prompt.alreadyOnDisk,
        sha256: prompt.key,
    });
}

await mkdir(recoveredOnlyRoot, { recursive: true });
const recoveredOnlyUsedPaths = new Map();
for (const prompt of ordered.filter((item) => !item.alreadyOnDisk)) {
    const projectDir = safeName(prompt.projectName, 'Recovered');
    const dir = join(recoveredOnlyRoot, projectDir);
    await mkdir(dir, { recursive: true });
    const base = safeName(prompt.title, 'Untitled Prompt');
    let fileName = `${base}.txt`;
    const pathKey = `${projectDir}/${fileName}`.toLowerCase();
    if (recoveredOnlyUsedPaths.has(pathKey) && recoveredOnlyUsedPaths.get(pathKey) !== prompt.key) {
        fileName = `${base}--${prompt.key.slice(0, 10)}.txt`;
    }
    recoveredOnlyUsedPaths.set(`${projectDir}/${fileName}`.toLowerCase(), prompt.key);
    const outputPath = join(dir, fileName);
    await writeFile(outputPath, prompt.content, 'utf8');
    const manifestItem = manifest.find((item) => item.sha256 === prompt.key);
    if (manifestItem) manifestItem.recoveredOnlyFile = relative(recoveryRoot, outputPath);
}

const projectSummary = new Map();
for (const item of manifest) {
    const summary = projectSummary.get(item.project) ?? { total: 0, alreadyOnDisk: 0, recoveredOnly: 0 };
    summary.total += 1;
    if (item.alreadyOnDisk) summary.alreadyOnDisk += 1;
    else summary.recoveredOnly += 1;
    projectSummary.set(item.project, summary);
}

const inventory = {
    recoveredAt: new Date().toISOString(),
    source: 'ShipSpace WebKit localStorage key shipspace-prompt-library',
    snapshots: snapshotSummary,
    uniquePrompts: manifest.length,
    alreadyOnFilesystem: manifest.filter((item) => item.alreadyOnDisk).length,
    recoveredOnly: manifest.filter((item) => !item.alreadyOnDisk).length,
    missingFromCurrentDevSnapshot: manifest.filter((item) => !item.sources.includes('dev-current')).length,
    projects: Object.fromEntries([...projectSummary].sort(([a], [b]) => a.localeCompare(b))),
    prompts: manifest,
};

await writeFile(join(reportsRoot, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');

const markdown = [
    '# ShipSpace old prompt recovery',
    '',
    `Recovered ${inventory.uniquePrompts} unique prompts from ${snapshots.length} WebKit snapshots.`,
    '',
    `- Already present in the filesystem library: ${inventory.alreadyOnFilesystem}`,
    `- Recovered only from historical app storage: ${inventory.recoveredOnly}`,
    '',
    '## Snapshots',
    '',
    '| Snapshot | Store version | Projects | Prompt records |',
    '| --- | ---: | ---: | ---: |',
    ...snapshotSummary.map((item) => `| ${item.snapshot} | ${item.version} | ${item.projects} | ${item.prompts} |`),
    '',
    '## Deduplicated projects',
    '',
    '| Project | Unique | Already on disk | Recovered only |',
    '| --- | ---: | ---: | ---: |',
    ...[...projectSummary]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([project, counts]) => `| ${project} | ${counts.total} | ${counts.alreadyOnDisk} | ${counts.recoveredOnly} |`),
    '',
    '## Missing from the current dev snapshot',
    '',
    ...manifest
        .filter((item) => !item.sources.includes('dev-current'))
        .map((item) => `- ${item.project}: ${item.title}`),
    '',
    'The raw UTF-16 values and normalized JSON snapshots are preserved alongside the deduplicated prompt files.',
    'The `recovered-only-library` folder contains only prompts that are not present in the current filesystem library.',
    '',
].join('\n');

await writeFile(join(reportsRoot, 'README.md'), markdown, 'utf8');
console.log(JSON.stringify({
    uniquePrompts: inventory.uniquePrompts,
    alreadyOnFilesystem: inventory.alreadyOnFilesystem,
    recoveredOnly: inventory.recoveredOnly,
    projects: inventory.projects,
}, null, 2));
