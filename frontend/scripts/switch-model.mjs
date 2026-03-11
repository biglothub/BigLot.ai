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
const managedKeys = ['AI_MODEL', 'NORMAL_AI_MODEL', 'AGENT_AI_MODEL'];

let next = current;

for (const key of managedKeys) {
    if (new RegExp(`^\\s*${key}\\s*=.*$`, 'm').test(next)) {
        next = next.replace(new RegExp(`^\\s*${key}\\s*=.*$`, 'm'), `${key}=${nextModel}`);
    } else {
        const suffix = next.trimEnd().length > 0 ? '\n' : '';
        next = `${next.trimEnd()}${suffix}${key}=${nextModel}\n`;
    }
}

writeFileSync(envPath, next.endsWith('\n') ? next : `${next}\n`, 'utf8');

console.log(`Updated ${managedKeys.join(', ')} to '${nextModel}' in ${envPath}`);
console.log('Adjust NORMAL_AI_MODEL or AGENT_AI_MODEL manually afterwards if you want different chat/agent models.');
console.log('Restart dev server to apply changes.');
