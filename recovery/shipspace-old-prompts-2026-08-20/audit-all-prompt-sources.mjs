import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const recoveryRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(recoveryRoot, '..', '..');
const reportRoot = join(recoveryRoot, 'reports');
const argumentValue = (name) => {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    if (!value) throw new Error(`${name} requires a path`);
    return value;
};
const liveRepo = resolve(argumentValue('--live-repo') ?? process.env.SHIPSPACE_LIVE_REPO ?? repositoryRoot);
const promptRoot = resolve(argumentValue('--prompt-root') ?? process.env.SHIPSPACE_PROMPT_ROOT ?? join(liveRepo, 'Prompts'));
const outputPath = resolve(argumentValue('--output') ?? join(reportRoot, 'all-source-audit.json'));
const skipLocalStorage = process.argv.includes('--skip-local-storage');

const hash = (...parts) => createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex');

const normalize = (value) => (value ?? '')
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .trim();

const canonicalProject = (name) => {
    const value = normalize(name);
    if (/bridgespace|bs multi-agent/i.test(value)) return 'BS Multi-Agent Prompts';
    if (/prompt library for coding|promp library for coding/i.test(value)) return 'Prompt Library for Coding';
    return value;
};

const normalizeSearch = (value) => normalize(value)
    .toLowerCase()
    .replace(/\bswarm\b/g, 'gang')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const promptRecord = ({ project, title, content, source, id = null }) => ({
    project: canonicalProject(project),
    title: normalize(title) || 'Untitled Prompt',
    content: normalize(content),
    source,
    id,
});

async function walk(root, predicate = () => true) {
    const found = [];
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    } catch {
        return found;
    }
    for (const entry of entries) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) found.push(...await walk(path, predicate));
        else if (entry.isFile() && predicate(path)) found.push(path);
    }
    return found;
}

async function readFilesystemPrompts() {
    const records = [];
    for (const projectEntry of await readdir(promptRoot, { withFileTypes: true })) {
        if (!projectEntry.isDirectory() || projectEntry.name.startsWith('.')) continue;
        const projectDir = join(promptRoot, projectEntry.name);
        for (const path of await walk(projectDir, (item) => /\.(txt|md)$/i.test(item))) {
            records.push(promptRecord({
                project: projectEntry.name,
                title: basename(path, extname(path)),
                content: await readFile(path, 'utf8'),
                source: `filesystem:${relative(promptRoot, path)}`,
            }));
        }
    }
    return records;
}

async function readLocalStoragePrompts() {
    const roots = [
        join(homedir(), 'Library', 'WebKit'),
        join(homedir(), 'Library', 'Containers'),
    ];
    const dbs = [];
    for (const root of roots) {
        dbs.push(...await walk(root, (path) => path.endsWith('/LocalStorage/localstorage.sqlite3')));
    }

    const snapshots = [];
    for (const path of dbs) {
        let db;
        try {
            db = new DatabaseSync(path, { readOnly: true });
            const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'shipspace-prompt-library'").get();
            if (!row) continue;
            const raw = typeof row.value === 'string'
                ? row.value
                : Buffer.from(row.value).toString('utf16le');
            const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
            const projects = parsed?.state?.projects ?? [];
            const records = projects.flatMap((project) => (project.prompts ?? []).map((prompt) => promptRecord({
                project: project.projectName,
                title: prompt.title,
                content: prompt.content,
                id: prompt.id,
                source: `localStorage:${path}`,
            })));
            snapshots.push({
                path,
                version: parsed?.version ?? null,
                projects: projects.length,
                records,
            });
        } catch {
            // Ignore unrelated, locked, or malformed WebKit stores.
        } finally {
            db?.close();
        }
    }
    return snapshots;
}

function collectProjects(value, exportName, source) {
    const projects = [];
    const candidates = Array.isArray(value) ? value : [value];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue;
        if (typeof candidate.projectName !== 'string' || !Array.isArray(candidate.prompts)) continue;
        projects.push(...candidate.prompts.map((prompt) => promptRecord({
            project: candidate.projectName,
            title: prompt.title,
            content: prompt.content,
            id: prompt.id,
            source: `${source}#${exportName}`,
        })));
    }
    return projects;
}

async function readGitPromptCatalogs() {
    const commitText = execFileSync('git', ['rev-list', '--all', '--', 'src/lib/data'], {
        cwd: liveRepo,
        encoding: 'utf8',
    });
    const commits = [...new Set(commitText.trim().split('\n').filter(Boolean))];
    if (!commits.length) return [];

    const requireFromRepo = createRequire(join(liveRepo, 'package.json'));
    let esbuild;
    try {
        esbuild = requireFromRepo('esbuild');
    } catch {
        throw new Error(`esbuild is required to audit historical TypeScript catalogs in ${liveRepo}`);
    }
    const tempRoot = await mkdtemp(join(tmpdir(), 'shipspace-prompt-history-'));
    const sources = [];
    try {
        for (const commit of commits) {
            const fileText = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', 'src/lib/data'], {
                cwd: liveRepo,
                encoding: 'utf8',
            });
            const files = fileText.trim().split('\n').filter((path) => /prompts.*\.ts$/i.test(path));
            if (!files.length) continue;
            const commitRoot = join(tempRoot, commit);
            for (const file of files) {
                const content = execFileSync('git', ['show', `${commit}:${file}`], {
                    cwd: liveRepo,
                    encoding: 'utf8',
                    maxBuffer: 20 * 1024 * 1024,
                });
                const outputPath = join(commitRoot, file);
                await mkdir(dirname(outputPath), { recursive: true });
                await writeFile(outputPath, content, 'utf8');
            }
            for (const file of files) {
                const entry = join(commitRoot, file);
                try {
                    const built = esbuild.buildSync({
                        entryPoints: [entry],
                        bundle: true,
                        platform: 'node',
                        format: 'cjs',
                        write: false,
                        logLevel: 'silent',
                        tsconfigRaw: { compilerOptions: {} },
                    });
                    const module = { exports: {} };
                    const run = new Function('module', 'exports', 'require', built.outputFiles[0].text);
                    run(module, module.exports, require);
                    for (const [exportName, value] of Object.entries(module.exports)) {
                        const records = collectProjects(value, exportName, `git:${commit}:${file}`);
                        if (records.length) sources.push({ commit, file, exportName, records });
                    }
                } catch (error) {
                    sources.push({ commit, file, error: String(error.message ?? error), records: [] });
                }
            }
        }
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
    return sources;
}

function uniqueBy(records, keyFn) {
    const values = new Map();
    for (const record of records) {
        const key = keyFn(record);
        const existing = values.get(key);
        if (existing) existing.sources.push(record.source);
        else values.set(key, { ...record, sources: [record.source] });
    }
    return [...values.values()];
}

function summarize(records) {
    const counts = {};
    for (const record of records) counts[record.project] = (counts[record.project] ?? 0) + 1;
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

const filesystem = await readFilesystemPrompts();
const localStorageSnapshots = skipLocalStorage ? [] : await readLocalStoragePrompts();
const gitSources = await readGitPromptCatalogs();

const exactKey = (record) => hash(record.project, record.title, record.content);
const titleContentKey = (record) => hash(record.title, record.content);
const contentKey = (record) => hash(record.content);
const filesystemExact = new Set(filesystem.map(exactKey));
const filesystemTitleContent = new Set(filesystem.map(titleContentKey));
const filesystemContent = new Set(filesystem.map(contentKey));

const allExternal = [
    ...localStorageSnapshots.flatMap((snapshot) => snapshot.records),
    ...gitSources.flatMap((source) => source.records),
];
const externalUnique = uniqueBy(allExternal, exactKey);
const exactMissing = externalUnique.filter((record) => !filesystemExact.has(exactKey(record)));
const genuinelyNewContent = exactMissing.filter((record) => !filesystemContent.has(contentKey(record)));
const titleAliases = exactMissing.filter((record) => filesystemContent.has(contentKey(record)));
const titleAliasDetails = titleAliases.map((record) => ({
    ...record,
    filesystemMatches: filesystem
        .filter((candidate) => contentKey(candidate) === contentKey(record))
        .map(({ project, title, source }) => ({ project, title, source })),
}));
const unresolvedTitleAliases = titleAliasDetails.filter((record) => {
    const query = normalizeSearch(record.title);
    return !filesystem.some((candidate) =>
        candidate.project === record.project
        && normalizeSearch(`${candidate.title} ${candidate.content}`).includes(query)
    );
});
const crossProjectMatches = genuinelyNewContent.filter((record) => filesystemTitleContent.has(titleContentKey(record)));

const currentDev = localStorageSnapshots.find((snapshot) => snapshot.path.includes('/com.shipspace.ade.dev/WebsiteData/Default/A0epzQ'));
const currentDuplicates = [];
if (currentDev) {
    const grouped = new Map();
    for (const record of currentDev.records) {
        const key = hash(record.project, record.content);
        const group = grouped.get(key) ?? [];
        group.push(record);
        grouped.set(key, group);
    }
    for (const group of grouped.values()) {
        if (group.length > 1) currentDuplicates.push(group.map(({ project, title, id }) => ({ project, title, id })));
    }
}

const report = {
    generatedAt: new Date().toISOString(),
    filesystem: {
        count: filesystem.length,
        uniqueExact: new Set(filesystem.map(exactKey)).size,
        uniqueContent: new Set(filesystem.map(contentKey)).size,
        projects: summarize(filesystem),
    },
    localStorage: {
        snapshots: localStorageSnapshots.map((snapshot) => ({
            path: snapshot.path,
            version: snapshot.version,
            count: snapshot.records.length,
            projects: summarize(snapshot.records),
        })),
        uniqueExact: uniqueBy(localStorageSnapshots.flatMap((snapshot) => snapshot.records), exactKey).length,
    },
    git: {
        sourceExports: gitSources.length,
        commits: [...new Set(gitSources.map((source) => source.commit))],
        errors: gitSources.filter((source) => source.error).map(({ commit, file, error }) => ({ commit, file, error })),
        uniqueExact: uniqueBy(gitSources.flatMap((source) => source.records), exactKey).length,
    },
    comparison: {
        externalUniqueExact: externalUnique.length,
        exactMissingCount: exactMissing.length,
        genuinelyNewContentCount: genuinelyNewContent.length,
        titleAliasCount: titleAliases.length,
        unresolvedTitleAliasCount: unresolvedTitleAliases.length,
        crossProjectMatchCount: crossProjectMatches.length,
        genuinelyNewContent,
        titleAliases: titleAliasDetails,
        unresolvedTitleAliases,
        crossProjectMatches,
    },
    currentDevDuplicateContentGroups: currentDuplicates,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    filesystem: report.filesystem,
    localStorageSnapshots: report.localStorage.snapshots.length,
    localStorageUniqueExact: report.localStorage.uniqueExact,
    gitSourceExports: report.git.sourceExports,
    gitUniqueExact: report.git.uniqueExact,
    gitErrors: report.git.errors.length,
    exactMissingCount: report.comparison.exactMissingCount,
    genuinelyNewContentCount: report.comparison.genuinelyNewContentCount,
    titleAliasCount: report.comparison.titleAliasCount,
    unresolvedTitleAliasCount: report.comparison.unresolvedTitleAliasCount,
    currentDevDuplicateContentGroups: report.currentDevDuplicateContentGroups,
}, null, 2));
