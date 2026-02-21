import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const allowedModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'deepseek', 'deepseek-r1'];
const nextModel = process.argv[2];

if (!nextModel) {
    console.error(`Usage: npm run switch -- <model>\nAllowed: ${allowedModels.join(', ')}`);
    process.exit(1);
}

if (!allowedModels.includes(nextModel)) {
    console.error(`Invalid model: ${nextModel}\nAllowed: ${allowedModels.join(', ')}`);
    process.exit(1);
}

const envPath = resolve(process.cwd(), '.env');
const envExists = existsSync(envPath);
const current = envExists ? readFileSync(envPath, 'utf8') : '';

let next = current;
if (/^\s*AI_MODEL\s*=.*$/m.test(next)) {
    next = next.replace(/^\s*AI_MODEL\s*=.*$/m, `AI_MODEL=${nextModel}`);
} else {
    const suffix = next.trimEnd().length > 0 ? '\n' : '';
    next = `${next.trimEnd()}${suffix}AI_MODEL=${nextModel}\n`;
}

writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');

console.log(`AI_MODEL switched to '${nextModel}' in ${envPath}`);
console.log('Restart dev server to apply changes.');
