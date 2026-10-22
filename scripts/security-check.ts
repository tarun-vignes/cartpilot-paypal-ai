import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const skip = new Set(['node_modules', '.git', 'artifacts', 'coverage']);
const configuredSecrets = ['GEMINI_API_KEY', 'PAYPAL_CLIENT_SECRET']
  .map((name) => process.env[name])
  .filter((value): value is string => !!value && value.length > 12);
let count = 0;
const failures: string[] = [];
function scan(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    // Real configuration is deliberately ignored by Git and is not a public asset.
    if (entry.name.startsWith('.env') && entry.name !== '.env.example')
      continue;
    if (statSync(path).size > 5_000_000) continue;
    const text = readFileSync(path, 'utf8');
    count++;
    if (
      configuredSecrets.some((secret) => text.includes(secret)) ||
      /AIza[0-9A-Za-z_-]{30,}/.test(text) ||
      /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text)
    )
      failures.push(relative(root, path));
  }
}
scan(root);
const ignore = readFileSync('.gitignore', 'utf8');
if (!ignore.includes('.env*') || !ignore.includes('!.env.example'))
  throw new Error('Environment ignore rules are missing.');
if (failures.length)
  throw new Error(
    `Possible secret in publishable files: ${failures.join(', ')}. Values are intentionally not printed.`,
  );
console.log(
  `PASS: ${count} source/build files scanned; no configured server secret values or obvious key material found. Real .env files are ignored. This bounded check is not a comprehensive secret scanner.`,
);
