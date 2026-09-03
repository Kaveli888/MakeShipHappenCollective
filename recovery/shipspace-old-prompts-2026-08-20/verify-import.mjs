import { readFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const recoveryRoot = dirname(fileURLToPath(import.meta.url));
const argumentValue = (name) => {
    const index = process.argv.indexOf(name);
    if (index < 0) return undefined;
    const value = process.argv[index + 1];
    if (!value) throw new Error(`${name} requires a path`);
    return value;
};
const reportPath = resolve(argumentValue('--report') ?? join(recoveryRoot, 'reports', 'import-result.json'));
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const promptRootOverride = argumentValue('--prompt-root') ?? process.env.SHIPSPACE_PROMPT_ROOT;
const promptRoot = promptRootOverride ? resolve(promptRootOverride) : report.promptRoot;
const failures = [];

for (const action of report.actions) {
    const portableSource = join(
        recoveryRoot,
        'recovered-only-library',
        action.project,
        basename(action.source),
    );
    const source = isAbsolute(action.source) ? portableSource : resolve(recoveryRoot, action.source);
    const destination = promptRootOverride
        ? join(promptRoot, relative(report.promptRoot, action.destination))
        : action.destination;
    try {
        const [sourceContent, destinationContent] = await Promise.all([
            readFile(source),
            readFile(destination),
        ]);
        if (!sourceContent.equals(destinationContent)) {
            failures.push({ title: action.title, reason: 'content mismatch', destination });
        }
    } catch (error) {
        failures.push({ title: action.title, reason: String(error), destination });
    }
}

console.log(JSON.stringify({
    checked: report.actions.length,
    passed: report.actions.length - failures.length,
    failed: failures.length,
    promptRoot,
    failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
