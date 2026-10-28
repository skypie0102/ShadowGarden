import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isVersionOnly, planChecks, planEvent } from '../scripts/plan-ci.mjs';

test('docs keep a successful lightweight gate without browsers or publication', () => {
  const plan = planChecks(['README.md', 'docs/evidence.json']);
  assert.equal(plan.mode, 'docs');
  assert.equal(plan.deploy, false);
  assert.deepEqual(plan.matrix.include, []);
});

test('Android changes skip website checks and publication, including when accompanied by docs', () => {
  for (const paths of [
    ['android/app/src/main/AndroidManifest.xml'],
    ['.github/workflows/android.yml', 'docs/plans/ANDROID_ROADMAP.md'],
    ['android/gradle/wrapper/gradle-wrapper.jar', 'README.md']
  ]) {
    const plan = planChecks(paths);
    assert.equal(plan.mode, 'android');
    assert.equal(plan.deploy, false);
    assert.equal(plan.profile, false);
    assert.deepEqual(plan.matrix.include, []);
  }
});

test('Android paths do not weaken website checks for mixed changes', () => {
  const focused = planChecks(['android/app/build.gradle.kts', 'public/assets/css/public-artwork.css']);
  assert.equal(focused.mode, 'focused');
  assert.equal(focused.deploy, true);
  assert.equal(focused.matrix.include.length, 5);
  const full = planChecks(['android/app/build.gradle.kts', 'server/books.js']);
  assert.equal(full.mode, 'full');
  assert.equal(full.deploy, true);
  assert.equal(full.matrix.include.length, 15);
});

test('Android and CI selection changes run planner tests without publishing website assets', () => {
  const plan = planChecks(['android/app/build.gradle.kts', '.github/workflows/ci.yml',
    'scripts/plan-ci.mjs', 'tests/ci-plan.test.mjs']);
  assert.equal(plan.mode, 'android');
  assert.equal(plan.test_plan, true);
  assert.equal(plan.deploy, false);
  assert.deepEqual(plan.matrix.include, []);
  const mixed = planChecks(['android/app/build.gradle.kts', 'scripts/plan-ci.mjs', 'server/books.js']);
  assert.equal(mixed.mode, 'full');
  assert.equal(mixed.deploy, true);
  assert.equal(planChecks(['.github/workflows/ci.yml']).mode, 'full');
  assert.equal(planChecks(['android/app/build.gradle.kts', 'scripts/build.mjs']).mode, 'full');
});

test('Android-only newer commits do not suppress an already checked website deployment', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const pathspecLine = workflow.match(/git diff --quiet HEAD origin\/main -- ([^\n]+); then/);
  assert.ok(pathspecLine, 'production guard must compare the checked and current source');
  const pathspecs = pathspecLine[1].match(/'[^']+'|\S+/g).map(value => value.replace(/^'|'$/g, ''));
  const directory = mkdtempSync(join(tmpdir(), 'shadowgarden-deploy-guard-'));
  const git = (args, options = {}) => execFileSync('git', args, { cwd: directory, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
  try {
    git(['init', '-q']);
    git(['config', 'user.email', 'fixture@example.invalid']);
    git(['config', 'user.name', 'CI fixture']);
    mkdirSync(join(directory, 'android'), { recursive: true });
    mkdirSync(join(directory, 'server'), { recursive: true });
    writeFileSync(join(directory, 'android', 'app.txt'), 'one');
    writeFileSync(join(directory, 'server', 'app.js'), 'one');
    git(['add', '.']); git(['commit', '-qm', 'checked website']);
    const checked = git(['rev-parse', 'HEAD']);
    writeFileSync(join(directory, 'android', 'app.txt'), 'two');
    git(['add', '.']); git(['commit', '-qm', 'android']);
    assert.doesNotThrow(() => git(['diff', '--quiet', checked, 'HEAD', '--', ...pathspecs]));
    writeFileSync(join(directory, 'server', 'app.js'), 'two');
    git(['add', '.']); git(['commit', '-qm', 'website']);
    assert.throws(() => git(['diff', '--quiet', checked, 'HEAD', '--', ...pathspecs]), { status: 1 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('cover styles plus their regression tests and release bump run public checks in every profile', () => {
  const plan = planChecks(['public/assets/css/public-artwork.css', 'public/assets/css/public-components.css',
    'tests/browser/library-discovery.spec.mjs', 'package.json', 'package-lock.json', 'docs/release.md'],
  { versionOnly: ['package.json', 'package-lock.json'] });
  assert.equal(plan.mode, 'focused');
  assert.equal(plan.deploy, true);
  assert.equal(plan.profile, false);
  assert.equal(plan.matrix.include.length, 5);
  const selected = new RegExp(plan.pattern);
  for (const name of ['library-discovery', 'series-layout', 'css-readability', 'persistence', 'library-version'])
    assert.ok(selected.test(`tests/browser/${name}.spec.mjs`));
  assert.ok(!selected.test('tests/browser/reader-speech.spec.mjs'));
  assert.ok(!selected.test('tests/browser/library-discoveryXspecXmjs'));
});

test('static artwork also checks Keeper banners and Reader image focus', () => {
  const plan = planChecks(['public/assets/icons/favicon.svg']);
  assert.equal(plan.mode, 'focused');
  assert.match('tests/browser/keeper-banner.spec.mjs', new RegExp(plan.pattern));
  assert.match('tests/browser/reader-image-focus.spec.mjs', new RegExp(plan.pattern));
});

test('code, shared styles, fixtures, dependencies, workflow and unknown paths retain the full suite', () => {
  for (const path of ['server/state.js', 'functions/tts.js', 'public/assets/js/library.js',
    'public/assets/js/reader/speech.js', 'public/assets/css/reading-status.css', 'public/assets/css/site.css',
    'public/index.html', 'package.json', 'package-lock.json', '.github/workflows/ci.yml',
    'scripts/plan-ci.mjs', 'tests/browser/fixture.mjs', 'tests/browser/reader-speech.spec.mjs',
    'public/assets/vendor/image.svg', 'new-config.json']) {
    const plan = planChecks(['public/assets/css/public-artwork.css', path]);
    assert.equal(plan.mode, 'full', path);
    assert.equal(plan.pattern, '.*');
    assert.equal(plan.matrix.include.length, 15);
  }
});

test('full matrix covers each project and shard once without parallelizing the shared local database', () => {
  const { matrix } = planChecks(['server/state.js']);
  const projects = new Set(matrix.include.map(row => row.project));
  assert.equal(projects.size, 5);
  for (const project of projects) {
    assert.deepEqual(matrix.include.filter(row => row.project === project).map(row => row.shard), [1, 2, 3]);
    assert.ok(matrix.include.filter(row => row.project === project).every(row => row.shards === 3));
  }
});

test('version comparison accepts release-only metadata and rejects toolchain or malformed changes', () => {
  const before = { version: '2.27.0', scripts: { check: 'npm test' }, devDependencies: { wrangler: '4.151.1' } };
  const after = { ...before, version: '2.27.1' };
  assert.ok(isVersionOnly('package.json', JSON.stringify(before), JSON.stringify(after)));
  assert.ok(!isVersionOnly('package.json', JSON.stringify(before), JSON.stringify({ ...after, scripts: {} })));
  assert.ok(!isVersionOnly('package.json', JSON.stringify(before), JSON.stringify({ ...after, devDependencies: {} })));
  assert.ok(!isVersionOnly('package.json', JSON.stringify(before), '{}'));
  assert.ok(!isVersionOnly('package.json', 'invalid', JSON.stringify(after)));
  const lock = { version: '2.27.0', lockfileVersion: 3, packages: { '': { version: '2.27.0' },
    'node_modules/tool': { version: '1.0.0', integrity: 'sha512-original' } } };
  const next = structuredClone(lock); next.version = next.packages[''].version = '2.27.1';
  assert.ok(isVersionOnly('package-lock.json', JSON.stringify(lock), JSON.stringify(next)));
  next.packages['node_modules/tool'].integrity = 'sha512-changed';
  assert.ok(!isVersionOnly('package-lock.json', JSON.stringify(lock), JSON.stringify(next)));
});

test('manual, scheduled, absent base and empty comparisons fail closed to full checks', () => {
  for (const name of ['workflow_dispatch', 'schedule', 'push', 'pull_request'])
    assert.equal(planEvent(name, {}).mode, 'full');
  assert.equal(planEvent('push', { before: '0'.repeat(40) }).mode, 'full');
  assert.equal(planChecks([]).mode, 'full');
  assert.equal(planChecks(['docs/release.md'], { forceFull: true }).mode, 'full');
});

test('library startup profiling runs once for affected runtime changes, not presentation changes', () => {
  assert.equal(planChecks(['public/assets/js/library-renderers.js']).profile, true);
  assert.equal(planChecks(['public/assets/js/domain/storage.js']).profile, true);
  assert.equal(planChecks(['public/assets/js/reader/speech.js']).profile, false);
  assert.equal(planChecks(['public/assets/css/public-components.css']).profile, false);
});

test('real git diffs include deletions, both sides of renames and version metadata', () => {
  const directory = mkdtempSync(join(tmpdir(), 'shadowgarden-ci-'));
  const original = process.cwd();
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(['init', '-q']);
    git(['config', 'user.email', 'fixture@example.invalid']);
    git(['config', 'user.name', 'CI fixture']);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0' }));
    writeFileSync(join(directory, 'runtime.js'), 'export const value = 1;');
    git(['add', '.']); git(['commit', '-qm', 'base']);
    const base = git(['rev-parse', 'HEAD']);
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.1' }));
    git(['add', '.']); git(['commit', '-qm', 'version']);
    process.chdir(directory);
    assert.equal(planEvent('push', { before: base }, 'HEAD').mode, 'focused');
    git(['mv', 'runtime.js', 'README.md']); git(['commit', '-qm', 'move runtime']);
    assert.equal(planEvent('pull_request', { pull_request: { base: { sha: base } } }, 'HEAD').mode, 'full');
    git(['rm', 'package.json']); git(['commit', '-qm', 'delete manifest']);
    assert.equal(planEvent('push', { before: base }, 'HEAD').mode, 'full');
  } finally {
    process.chdir(original);
    rmSync(directory, { recursive: true, force: true });
  }
});
