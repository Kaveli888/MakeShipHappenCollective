import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const recoveryRoot = dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(await readFile(join(recoveryRoot, 'reports', 'import-result.json'), 'utf8'));
const failures = [];

for (const action of report.actions) {
    try {
        const [source, destination] = await Promise.all([
            readFile(action.source),
            readFile(action.destination),
        ]);
        if (!source.equals(destination)) {
            failures.push({ title: action.title, reason: 'content mismatch', destination: action.destination });
        }
    } catch (error) {
        failures.push({ title: action.title, reason: String(error), destination: action.destination });
    }
}

console.log(JSON.stringify({
    checked: report.actions.length,
    passed: report.actions.length - failures.length,
    failed: failures.length,
    failures,
}, null, 2));

if (failures.length) process.exitCode = 1;
