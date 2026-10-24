import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createCssComparison, prepareCssComparison, settleCssComparison } from './css-comparison.mjs';
import { installKeeper, series, openVolume, draft } from './keeper-volume-fixture.mjs';
import { createReaderEpub } from './reader-production-fixture.mjs';

test.setTimeout(180000);
const baseline = JSON.parse(readFileSync(new URL('./fixtures/stylesheets-2.18.12.json', import.meta.url)));
const compare = createCssComparison(baseline);
async function stableVersion(page) {
  await prepareCssComparison(page);
  await page.route('**/data/version.json*', route => route.fulfill({ json: {
    name: 'Shadow Garden', version: '2.18.12', releaseVersion: '2.18.12',
    commit: baseline.base, shortCommit: baseline.base.slice(0, 7), branch: 'main'
  } }));
}
async function keeper(page) {
  await stableVersion(page);
  const f = await installKeeper(page, undefined, { ok: true, revision: 5,
    main: [series('a')], adult: [series('b')], counts: { series: 2, volumes: 4 } });
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.management?.revision)).toBe(5);
  await settleCssComparison(page); return f;
}
const noWrites = f => { expect(f.writes).toEqual([]); expect(f.errors).toEqual([]); };

test('remaining Keeper dashboard, maintenance/history and authentication styles preserve pixels and cascade', async ({ page }) => {
  const f = await keeper(page); await compare(page, 'keeper-dashboard');
  await page.route('**/admin-api/maintenance', route => route.fulfill({ json: {
    ok: true, revision: 5, catalog: { readable: true },
    health: { status: 'healthy', counts: { series: 2, volumes: 4 }, metrics: {}, issues: [], objectKeys: [], optimizationCandidates: [] },
    taxonomy: { readable: true, totalSeries: 2, affectedSeries: 0, preview: [] }, trash: [], purgeJobs: [],
    backups: [{ id: 'css-snapshot', reason: 'Disposable snapshot', createdAt: '2026-10-19T00:00:00.000Z',
      counts: { mainSeries: 1, adultSeries: 1, volumes: 4 }, restorable: true, integrity: { status: 'valid' } }],
    history: { total: 1, pageSize: 10, nextCursor: null }
  } }));
  await page.locator('#openMaintenance').click(); await expect(page.locator('#backupList .maintenance-item')).toHaveCount(1);
  await compare(page, 'keeper-maintenance'); await page.locator('#closeMaintenance').click();
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('session').instance.lock());
  await expect(page.locator('#lockedView')).toBeVisible(); await compare(page, 'keeper-authentication'); noWrites(f);
});

test('remaining Keeper preflight, batch and report styles preserve main/adult and narrow states', async ({ page }) => {
  const f = await keeper(page); await page.locator('#openNewBooks').click();
  await page.locator('#epubFile').setInputFiles({ name: 'stylesheet-review.epub', mimeType: 'application/epub+zip',
    buffer: await createReaderEpub({ chapterCount: 2, paragraphCount: 2 }) });
  await expect.poll(() => page.evaluate(() => { const q = window.ShadowGardenKeeper.state.batch;
    return !q.preparing && q.items.length === 1 && q.items[0].metaReady; })).toBe(true);
  await compare(page, 'keeper-preflight-main');
  await page.locator('label').filter({ has: page.locator('#adultInput') }).click();
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].adult)).toBe(true);
  await compare(page, 'keeper-preflight-adult');
  await page.setViewportSize({ width: 349, height: page.viewportSize().height }); await compare(page, 'keeper-preflight-349'); noWrites(f);
});

test('remaining Series Editor styles preserve expanded volume and translation drafts', async ({ page }) => {
  const f = await keeper(page), card = await openVolume(page, 'a'); await draft(page);
  await card.scrollIntoViewIfNeeded(); await compare(page, 'keeper-series-draft');
  await expect(page.locator('#saveSeries')).toBeEnabled(); noWrites(f);
});

for (const adult of [false, true]) test(`shared/public CSS preserves ${adult ? 'Adult' : 'Main'} library, navigation, series and Garden Pass`, async ({ page }) => {
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() !== 'GET') writes.push(request.url()); });
  await stableVersion(page);
  await page.addInitScript(() => {
    localStorage.setItem('sg-adult-ack', '1');
    window.turnstile = { render: () => 'disposable-css-widget', remove() {}, reset() {} };
  });
  const item = { id: 'css-public', title: 'Stylesheet technical fixture', author: 'Disposable author',
    description: 'A stable technical catalog for stylesheet comparison.', status: 'Ongoing', genres: ['Fantasy'], tags: ['Technical'],
    volumes: [{ bookId: 'bk_A2yCOKedG1g4xXTJJhbEzA', number: 1, title: 'Technical volume', description: 'Disposable volume description.' }] };
  for (const scope of [false, true]) await page.route(`**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [item] : [] } }));
  const loadLibrary = async () => {
    await page.goto(adult ? '/nsfw' : '/'); await expect(page.locator('#catalogGrid .series-card')).toHaveCount(1);
    await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'false'); await settleCssComparison(page);
  };
  const viewport = page.viewportSize();
  for (const width of [...new Set([viewport.width, 349, 761])]) {
    // A fresh document per width avoids WebKit's observed native-select computed
    // display inconsistency after crossing the collapsed-filter breakpoint.
    // Each served/baseline/restored comparison still keeps exactly one DOM.
    await page.setViewportSize({ width, height: viewport.height }); await loadLibrary();
    await compare(page, `${adult ? 'adult' : 'main'}-library-${width}`);
  }
  await page.setViewportSize(viewport); await loadLibrary(); await page.locator('.brand-mark').click();
  await expect(page.locator('.brand-mark')).toHaveAttribute('aria-expanded', 'true'); await compare(page, `${adult ? 'adult' : 'main'}-navigation`);
  await page.goto(`/series?id=css-public&scope=${adult ? 'adult' : 'main'}`);
  await expect(page.locator('#seriesRoot h1')).toHaveText(item.title); await settleCssComparison(page);
  await compare(page, `${adult ? 'adult' : 'main'}-series`);
  await page.evaluate(() => { window.cssGate = window.ShadowGardenBookAccess.ensureHumanAccess({ siteKey: 'disposable-key' }).catch(error => error.message); });
  const gate = page.getByRole('dialog', { name: 'Pass the Garden Gate' }); await expect(gate).toBeVisible();
  await compare(page, `${adult ? 'adult' : 'main'}-garden-pass`);
  await gate.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(errors).toEqual([]); expect(writes).toEqual([]);
});
