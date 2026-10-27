import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
// Returning browsers may retain an older sheet under the legacy version URL.
// Give every changed Series stylesheet its own URL, including future releases.
const seriesCss = await readFile('dist/assets/css/series-extra.css');
const seriesCssVersion = createHash('sha256').update(seriesCss).digest('hex').slice(0, 12);
const seriesHtml = await readFile('dist/series.html', 'utf8');
const seriesStylesheet = /(href="\/assets\/css\/series-extra\.css)(?:\?[^\"]*)?"/;
if (!seriesStylesheet.test(seriesHtml)) throw Error('Series stylesheet link is missing.');
const versionedSeries = seriesHtml.replace(seriesStylesheet, `$1?v=${seriesCssVersion}"`);
await writeFile('dist/series.html', versionedSeries);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const original = JSON.parse(await readFile('public/data/version.json', 'utf8'));
let commit = process.env.CF_PAGES_COMMIT_SHA || '';
try { commit ||= execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
let branch = process.env.CF_PAGES_BRANCH || '';
try { branch ||= execFileSync('git', ['branch', '--show-current'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
const version = { ...original, version: pkg.version, releaseVersion: pkg.version,
  commit, shortCommit: commit.slice(0,7), branch: branch || 'unknown',
  builtAt: new Date().toISOString(), recoveredFromCommit: original.commit };
await writeFile('dist/data/version.json', JSON.stringify(version, null, 2) + '\n');
console.log('Built public assets into dist/. Pages Functions stay in functions/.');
