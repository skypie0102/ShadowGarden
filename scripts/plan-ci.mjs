import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';

const profiles = [
  ['desktop-chromium', 'chromium'], ['mobile-chromium', 'chromium'],
  ['desktop-firefox', 'firefox'], ['desktop-webkit', 'webkit'], ['mobile-webkit', 'webkit']
];
const publicStyles = new Set([
  'library-layout', 'library-features', 'library-motion',
  'public-components', 'public-artwork', 'series-extra', 'series-motion'
].map(name => `public/assets/css/${name}.css`));
const publicSpecs = [
  'library-discovery', 'library-readiness', 'library-version', 'public-startup',
  'series-layout', 'css-readability', 'website-foundation', 'persistence', 'reconstruction'
].map(name => `${name}.spec.mjs`);
const artworkSpecs = [...publicSpecs, 'keeper-banner.spec.mjs', 'reader-image-focus.spec.mjs'];
const isDocumentation = path => path === 'README.md' || path.startsWith('docs/');
const isArtwork = path => /^public\/assets\/(?:icons|images|img)\/.+\.(?:svg|png|jpe?g|webp|gif|avif|ico)$/.test(path);
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Release bumps accompany presentation changes. Any dependency, script, engine,
// integrity or other manifest change must still select the full suite.
export function isVersionOnly(path, before, after) {
  if (!['package.json', 'package-lock.json'].includes(path)) return false;
  try {
    const oldValue = JSON.parse(before), newValue = JSON.parse(after);
    for (const value of [oldValue, newValue]) {
      if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(value.version)) return false;
      delete value.version;
      if (path === 'package-lock.json') {
        if (!value.packages?.[''] || typeof value.packages[''].version !== 'string') return false;
        delete value.packages[''].version;
      }
    }
    return isDeepStrictEqual(oldValue, newValue);
  } catch {
    return false;
  }
}

export function planChecks(paths, { forceFull = false, versionOnly = [] } = {}) {
  const changed = [...new Set(paths)];
  const application = changed.filter(path => !isDocumentation(path));
  let mode = forceFull || !changed.length ? 'full' : application.length ? 'focused' : 'docs';
  const specs = new Set();
  const versionPaths = new Set(versionOnly);
  for (const path of application) {
    if (versionPaths.has(path) && ['package.json', 'package-lock.json'].includes(path)) {
      specs.add('library-version.spec.mjs');
    } else if (publicStyles.has(path)) {
      publicSpecs.forEach(spec => specs.add(spec));
    } else if (isArtwork(path)) {
      artworkSpecs.forEach(spec => specs.add(spec));
    } else if (!path.startsWith('tests/browser/')) {
      mode = 'full';
    }
  }
  // A changed spec can accompany its presentation owner. Fixtures, helpers,
  // config and unrelated specs conservatively select every browser test.
  for (const path of application.filter(path => path.startsWith('tests/browser/'))) {
    if (!specs.has(path.slice('tests/browser/'.length))) mode = 'full';
  }
  if (mode === 'focused' && !specs.size) mode = 'full';
  const shards = mode === 'full' ? 3 : 1;
  const include = mode === 'docs' ? [] : profiles.flatMap(([project, engine]) =>
    Array.from({ length: shards }, (_, index) => ({ project, engine, shard: index + 1, shards })));
  return {
    mode,
    deploy: forceFull || application.length > 0,
    profile: mode === 'full' && application.some(path =>
      /^public\/assets\/js\/(?:library|domain\/|nav|site-|data-source)/.test(path) ||
      ['public/index.html', 'public/nsfw.html', 'package.json', 'package-lock.json'].includes(path)),
    pattern: mode === 'focused' ? `tests/browser/(${[...specs].sort().map(escapeRegex).join('|')})$` : '.*',
    matrix: { include }
  };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'] });
}

export function planEvent(eventName, event, head = process.env.GITHUB_SHA || 'HEAD') {
  // Manual and scheduled runs are explicit full-regression backstops. A missing
  // base (first push, rewritten history) also fails closed to the full suite.
  const forceFull = ['workflow_dispatch', 'schedule'].includes(eventName);
  const base = eventName === 'pull_request' ? event.pull_request?.base?.sha : event.before;
  if (forceFull || !base || /^0+$/.test(base)) return planChecks([], { forceFull: true });
  try {
    // PRs use the merge checkout: base..merge includes exactly the proposed tree.
    // --no-renames includes both sides of a move, preventing a renamed JS file
    // from being misclassified as an image or documentation-only change.
    const paths = git(['diff', '--no-renames', '--name-only', '-z', base, head]).split('\0').filter(Boolean);
    const versionOnly = paths.filter(path => {
      if (!['package.json', 'package-lock.json'].includes(path)) return false;
      try { return isVersionOnly(path, git(['show', `${base}:${path}`]), git(['show', `${head}:${path}`])); }
      catch { return false; }
    });
    return planChecks(paths, { versionOnly });
  } catch {
    console.warn('Change comparison unavailable; running full regression checks.');
    return planChecks([], { forceFull: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const plan = planEvent(process.env.GITHUB_EVENT_NAME, event);
  const outputs = Object.entries(plan).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}\n`).join('');
  appendFileSync(process.env.GITHUB_OUTPUT, outputs);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `### Check selection\n\nScope: **${plan.mode}**. Browser jobs: **${plan.matrix.include.length}**.\n\n` +
    (plan.mode === 'focused' ? `Selected files: \`${plan.pattern}\`\n` :
      plan.mode === 'docs' ? 'Documentation only; browser checks and publication are skipped.\n' :
        'All tests across all five profiles, split into three isolated shards per profile.\n'));
  console.log(`CI scope: ${plan.mode}; browser jobs: ${plan.matrix.include.length}`);
}
