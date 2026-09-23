import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const original = JSON.parse(await readFile('public/data/version.json', 'utf8'));
let commit = process.env.CF_PAGES_COMMIT_SHA || '';
try { commit ||= execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
const version = { ...original, version: pkg.version, releaseVersion: pkg.version,
  commit, shortCommit: commit.slice(0,7), branch: process.env.CF_PAGES_BRANCH || 'reconstruction',
  builtAt: new Date().toISOString(), recoveredFromCommit: original.commit, reconstructed: true };
await writeFile('dist/data/version.json', JSON.stringify(version, null, 2) + '\n');
console.log('Built public assets into dist/. Pages Functions stay in functions/.');
