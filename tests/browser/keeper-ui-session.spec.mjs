import { test, expect } from '@playwright/test';
import { createReaderEpub } from './reader-production-fixture.mjs';

test.setTimeout(90000);
const series = id => ({ id, title: `Series ${id}`, author: 'Disposable fixture', genres: [], tags: [],
  translationStatus: 'Ongoing', translations: [{ name: 'Fixture translator', url: 'https://example.test/credit', coverage: 'All' }], volumes: [] });
const catalog = { ok: true, revision: 5, main: [series('a'), series('b')], adult: [], counts: { series: 2, volumes: 0 } };

async function installKeeper(page, handle) {
  const errors = [], alerts = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'confirm') await dialog.accept();
    else { alerts.push(dialog.message()); await dialog.dismiss(); }
  });
  await page.addInitScript(() => {
    let button;
    window.turnstile = { render(host, options) {
      button = document.createElement('button'); button.textContent = 'Complete disposable Keeper check';
      button.onclick = () => options.callback('disposable-check'); host.appendChild(button); return 'fixture-widget';
    }, remove() { button?.remove(); }, reset() {} };
  });
  await page.route('**/admin-access', route => route.fulfill({ json: route.request().method() === 'GET' ? { siteKey: 'fixture-key' } : { ok: true } }));
  await page.route('**/admin-api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/admin-api/status') return route.fulfill({ json: { ok: true, authorized: true, revision: 5, catalogReadable: true } });
    if (path === '/admin-api/library' && request.method() === 'GET') return route.fulfill({ json: catalog });
    if (path === '/admin-api/series-banner') return route.fulfill({ json: { id: new URL(request.url()).searchParams.get('id'), revision: 5, choices: [] } });
    if (handle) return handle(route, path);
    return route.fulfill({ status: 500, json: { error: 'Unexpected disposable request' } });
  });
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 60000 }).toBe(true);
  await expect(page.locator('#seriesSaveState')).toHaveCount(1);
  await unlock(page);
  await expect(page.locator('[data-manager-open]')).toHaveCount(2);
  return { errors, alerts };
}
async function unlock(page) {
  await page.locator('#adminToken').fill('disposable-ui-session-key');
  await page.locator('#unlockButton').click();
  await page.getByRole('button', { name: 'Complete disposable Keeper check', exact: true }).click();
  await expect(page.locator('#dashboardView')).toBeVisible();
}

test('an immediate edit stays dirty and a failed save returns to a retryable form', async ({ page }) => {
  const writes = [];
  const f = await installKeeper(page, async route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill(writes.length === 1 ? { status: 503, json: { error: 'Disposable save failure' } } : { json: { ...catalog, revision: 6 } });
  });
  // Freeze wall-clock callbacks before opening. A first edit must not depend on
  // waiting 80 ms; the composed form's microtasks still run normally.
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.locator('[data-manager-open="a"]').click();
  await expect(page.locator('#saveSeries')).toBeDisabled();
  await page.locator('#manageTitle').fill('Quickly edited title');
  await expect(page.locator('#saveSeries')).toBeEnabled();
  await page.locator('#saveSeries').click();
  await expect(page.locator('#seriesSaveState')).toHaveText('Unsaved changes');
  await expect(page.locator('#saveSeries')).toBeEnabled();
  await page.locator('#saveSeries').click();
  await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toMatchObject({ id: 'a', title: 'Quickly edited title', translationStatus: 'Ongoing', translations: series('a').translations });
  expect(f.alerts).toEqual(['Disposable save failure']); expect(f.errors).toEqual([]);
});

for (const outcome of ['success', 'failure']) test(`a late series save ${outcome} leaves the next editor intact`, async ({ page }) => {
  let release, started;
  const held = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
  const f = await installKeeper(page, async route => {
    started(); await held;
    return route.fulfill(outcome === 'success' ? { json: { ...catalog, revision: 6 } } : { status: 503, json: { error: 'Obsolete series save failed' } });
  });
  await page.evaluate(() => {
    const client = window.ShadowGardenKeeper.client, request = client.request.bind(client);
    client.request = (path, options, internal) => {
      const result = request(path, options, internal);
      if (path === '/admin-api/library' && options?.method === 'POST') window.seriesSaveSettled = result.then(() => true, () => false);
      return result;
    };
  });
  await page.locator('[data-manager-open="a"]').click();
  await page.locator('#manageTitle').fill('Saved A'); await expect(page.locator('#saveSeries')).toBeEnabled();
  await page.locator('#saveSeries').click(); await began;
  await page.locator('#seriesEditorForm .dialog-close[value="cancel"]').click();
  await page.locator('[data-manager-open="b"]').click();
  await page.locator('#manageTitle').fill('Unsaved B');
  release(); await page.evaluate(() => window.seriesSaveSettled);
  await expect(page.locator('#seriesEditor')).toHaveAttribute('open');
  await expect(page.locator('#manageTitle')).toHaveValue('Unsaved B');
  await expect(page.locator('#saveSeries')).toBeEnabled();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.activeSeriesId)).toBe('b');
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});

for (const stage of ['wake', 'cover']) test(`lock/reopen during ${stage} preparation stops old writes and permits an explicit retry`, async ({ page }) => {
  const writes = [], catalogs = [];
  const f = await installKeeper(page, async (route, path) => {
    if (path === '/admin-api/upload') { writes.push(path); return route.fulfill({ json: { ok: true } }); }
    if (path === '/admin-api/catalog') {
      writes.push(path); catalogs.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true, revision: 6 + catalogs.length, seriesId: 'fixture' } });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected disposable request' } });
  });
  await page.evaluate(stage => {
    let release, first = true; const held = new Promise(resolve => { release = resolve; });
    window.releaseUploadPreparation = release;
    if (stage === 'wake') Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
      if (first) { first = false; window.preparationStarted = true; await held; }
      return { release: async () => {} };
    } } });
    else {
      const optimize = window.optimizedCoverSet;
      window.optimizedCoverSet = async blob => {
        if (first) { first = false; window.preparationStarted = true; await held; }
        return optimize(blob);
      };
    }
  }, stage);
  await page.locator('#openNewBooks').click();
  const epub = await createReaderEpub({ chapterCount: 2, paragraphCount: 2 });
  await page.locator('#epubFile').setInputFiles([{ name: 'first.epub', mimeType: 'application/epub+zip', buffer: epub }]);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.metaReady)).toBe(true);
  await page.locator('#uploadButton').click();
  await expect.poll(() => page.evaluate(() => Boolean(window.preparationStarted))).toBe(true);
  const before = writes.length;
  // Exercise the actual session owner; the lock control is inert behind the
  // upload modal, while rejection/expiry can lock Keeper during preparation.
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('session').instance.lock());
  await expect(page.locator('#lockedView')).toBeVisible();
  await unlock(page);
  await page.evaluate(() => window.releaseUploadPreparation());
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.running)).toBe(false);
  expect(writes).toHaveLength(before); expect(catalogs).toEqual([]);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].status)).toBe('failed');
  await page.locator('#openNewBooks').click();
  await page.getByRole('button', { name: 'Review upload queue', exact: true }).click();
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(catalogs.map(item => item.originalFilename)).toEqual(['first.epub']);
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});
