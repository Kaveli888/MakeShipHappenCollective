import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const recoveryRoot = dirname(fileURLToPath(import.meta.url));
const inventoryPath = join(recoveryRoot, 'reports', 'inventory.json');
const reportPath = join(
    recoveryRoot,
    'reports',
    process.argv.includes('--apply') ? 'import-result.json' : 'import-plan.json',
);
const promptRoot = '/Users/jake/MakeShipHappenCollective/Prompts';
const apply = process.argv.includes('--apply');

const destinationFolders = {
    'Agents': join(promptRoot, 'Agents'),
    'Skills': join(promptRoot, 'Skills'),
    'Prompt Library for Coding': join(promptRoot, 'Promp Library For Coding', '_Recovered'),
    'ADE Desktop App': join(promptRoot, 'ADE Desktop App'),
    'BS Multi-Agent Prompts': join(promptRoot, 'BS Multi-Agent Prompts'),
    'Vibe Platform': join(promptRoot, 'Vibe Platform'),
};

const exists = async (path) => {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
};

const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
const recoveredOnly = inventory.prompts.filter((prompt) => !prompt.alreadyOnDisk);
const actions = [];

for (const prompt of recoveredOnly) {
    const destinationDir = destinationFolders[prompt.project];
    if (!destinationDir) {
        actions.push({ ...prompt, action: 'error', reason: `No destination mapping for ${prompt.project}` });
        continue;
    }

    const source = join(recoveryRoot, prompt.recoveredOnlyFile);
    const sourceContent = await readFile(source, 'utf8');
    let destination = join(destinationDir, basename(source));
    let action = 'copy';

    if (await exists(destination)) {
        const existingContent = await readFile(destination, 'utf8');
        if (existingContent === sourceContent) {
            action = 'skip-identical';
        } else {
            const extensionIndex = destination.lastIndexOf('.');
            const stem = extensionIndex >= 0 ? destination.slice(0, extensionIndex) : destination;
            destination = `${stem}--recovered-${prompt.sha256.slice(0, 10)}.txt`;
            if (await exists(destination)) {
                const recoveredContent = await readFile(destination, 'utf8');
                action = recoveredContent === sourceContent ? 'skip-identical' : 'error';
            } else {
                action = 'copy-renamed-conflict';
            }
        }
    }

    actions.push({
        project: prompt.project,
        title: prompt.title,
        source,
        destination,
        action,
        sha256: prompt.sha256,
    });

    if (apply && action.startsWith('copy')) {
        await mkdir(destinationDir, { recursive: true });
        await copyFile(source, destination);
    }
}

const summary = actions.reduce((counts, item) => {
    counts[item.action] = (counts[item.action] ?? 0) + 1;
    return counts;
}, {});

const report = {
    mode: apply ? 'apply' : 'dry-run',
    createdAt: new Date().toISOString(),
    promptRoot,
    requested: recoveredOnly.length,
    summary,
    actions,
};

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ mode: report.mode, requested: report.requested, summary }, null, 2));

if (summary.error) process.exitCode = 1;
