import { test, expect } from '@playwright/test';
import { createReaderEpub, createReaderZip, readerTitle } from './reader-production-fixture.mjs';
import { installKeeper, series } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);
const empty = () => ({ ok: true, revision: 5, main: [], adult: [], counts: { series: 0, volumes: 0 } });
const catalog = title => ({ ...empty(), main: [{ id: 'selection-fixture', title,
  volumes: [{ bookId: 'selection-book', title, number: 1 }] }], counts: { series: 1, volumes: 1 } });
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

async function publication(name, title) {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({ chapterCount: 2, paragraphCount: 2 }));
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('book.opf', (await zip.file('book.opf').async('string')).replace(readerTitle, title));
  return { name: name + '.epub', mimeType: 'application/epub+zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
}

async function prepare(page, heldName = '', seed = empty()) {
  const writeAttempts = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path.startsWith('/admin-api/') && path !== '/admin-api/status')
      writeAttempts.push(path);
  });
  // Pause only delivery of a real inspector result before the engine captures
  // its service. Application scripts, ZIP/XML parsing and hashing stay intact.
  await page.route('**/assets/js/admin-batch.js*', async route => {
    await page.evaluate(heldName => {
      const service = window.ShadowGardenKeeper.epubInspection, inspect = service.inspect;
      let release; const held = new Promise(resolve => { release = resolve; });
      const probe = window.queueInspection = { started: [], ready: [], completed: [], release };
      service.inspect = async file => {
        probe.started.push(file.name);
        const result = await inspect(file); probe.ready.push(file.name);
        if (file.name === heldName) await held;
        probe.completed.push(file.name); return result;
      };
    }, heldName);
    await route.continue();
  });
  const f = await installKeeper(page, undefined, seed);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.management?.revision)).toBe(5);
  await page.evaluate(() => {
    const client = window.ShadowGardenKeeper.client, request = client.request.bind(client);
    window.queueLibrarySettled = [];
    client.request = (path, options, internal) => {
      const result = request(path, options, internal);
      if (path !== '/admin-api/library' || options?.method !== 'GET') return result;
      return result.then(value => { window.queueLibrarySettled.push('success'); return value; },
        error => { window.queueLibrarySettled.push('failure'); throw error; });
    };
  });
  await page.locator('#openNewBooks').click();
  return { ...f, writeAttempts };
}
async function choose(page, ...files) { await page.locator('#epubFile').setInputFiles(files); }
async function ready(page, count) {
  await expect.poll(() => page.evaluate(() => {
    const q = window.ShadowGardenKeeper.state.batch;
    return !q.preparing && q.items.every(item => item.metaReady) ? q.items.length : -1;
  })).toBe(count);
}
async function release(page, name) {
  await page.evaluate(() => window.queueInspection.release());
  await expect.poll(() => page.evaluate(name => window.queueInspection.completed.includes(name), name)).toBe(true);
}
function assertNoWrites(f) { expect(f.writes).toEqual([]); expect(f.writeAttempts).toEqual([]); expect(f.errors).toEqual([]); }

const targetedCatalog = () => ({ ...empty(), main: [series('a')], adult: [series('b')], counts: { series: 2, volumes: 4 } });
async function changeTarget(page, id = 'b') {
  await page.locator('#closeAddBooks').click();
  await page.locator(`[data-manager-add="${id}"]`).click();
  await expect(page.locator('#seriesInput')).toHaveValue('Series ' + id);
}

test('changing target cancels old inspection and immediately prepares a fresh targeted EPUB', async ({ page }) => {
  const f = await prepare(page, 'old.epub', targetedCatalog());
  await choose(page, await publication('old', 'Old selection'), await publication('abandoned', 'Abandoned selection'));
  await expect.poll(() => page.evaluate(() => window.queueInspection.ready)).toEqual(['old.epub']);
  await changeTarget(page); await choose(page, await publication('fresh', 'Fresh selection')); await ready(page, 1);
  await release(page, 'old.epub');
  expect(await page.evaluate(() => window.queueInspection.started)).toEqual(['old.epub', 'fresh.epub']);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.map(i => i.file.name))).toEqual(['fresh.epub']);
  await expect(page.locator('#seriesInput')).toHaveValue('Series b'); await expect(page.locator('#adultInput')).toBeChecked();
  await expect(page.locator('#uploadButton')).toBeEnabled(); assertNoWrites(f);
});

for (const fail of [false, true]) test(`changing target ignores old catalog ${fail ? 'failure' : 'success'} while a new lookup is pending`, async ({ page }) => {
  const f = await prepare(page, '', targetedCatalog()), old = deferred(), fresh = deferred(); let reads = 0;
  await page.evaluate(() => window.ShadowGardenKeeper.uploadQueue.reset());
  await page.route('**/admin-api/library', async route => {
    const first = ++reads === 1; await (first ? old.promise : fresh.promise);
    await route.fulfill({ status: first && fail ? 503 : 200, json: first && fail ? { error: 'Obsolete target lookup' } : catalog(first ? 'Obsolete catalog' : 'Fresh catalog') });
  });
  await choose(page, await publication('old', 'Old selection'));
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.metaReady)).toBe(true);
  await changeTarget(page); await choose(page, await publication('fresh', 'Fresh selection'));
  await expect.poll(() => reads).toBe(2);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.metaReady)).toBe(true);
  old.resolve(); await expect.poll(() => page.evaluate(() => window.queueLibrarySettled.length)).toBe(1);
  await expect(page.locator('#uploadButton')).toBeDisabled();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.library)).toBeNull();
  fresh.resolve(); await ready(page, 1);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.library.main[0].title)).toBe('Fresh catalog');
  await expect(page.locator('#seriesInput')).toHaveValue('Series b'); assertNoWrites(f);
});

test('closing and reopening a targeted queue retains ownership until a confirmed context change', async ({ page }) => {
  const f = await prepare(page, 'retained.epub', targetedCatalog());
  await changeTarget(page); await choose(page, await publication('retained', 'Retained selection'));
  await expect.poll(() => page.evaluate(() => window.queueInspection.ready)).toEqual(['retained.epub']);
  await page.locator('#closeAddBooks').click(); await page.locator('[data-manager-add="b"]').click();
  await release(page, 'retained.epub'); await ready(page, 1);
  await expect(page.locator('#seriesInput')).toHaveValue('Series b'); await expect(page.locator('#adultInput')).toBeChecked();
  await page.locator('#closeAddBooks').click();
  page.removeAllListeners('dialog'); page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#openNewBooks').click(); await expect(page.locator('#addBooksDialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.length)).toBe(1);
  page.once('dialog', dialog => dialog.accept()); await page.locator('#openNewBooks').click();
  await expect(page.locator('#batchList .batch-item')).toHaveCount(0); await expect(page.locator('#adultInput')).toBeEnabled();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.addBookTarget)).toBeNull(); assertNoWrites(f);
});

test('Clear discards a held inspection and its remaining files while a fresh queue can proceed', async ({ page }) => {
  const f = await prepare(page, 'old.epub');
  await choose(page, await publication('old', 'Old selection'), await publication('abandoned', 'Abandoned selection'));
  await expect.poll(() => page.evaluate(() => window.queueInspection.ready)).toEqual(['old.epub']);
  await page.locator('#batchClear').click();
  await expect(page.locator('#batchList .batch-item')).toHaveCount(0);
  await expect(page.locator('#fileState')).toHaveText('WAITING');
  await choose(page, await publication('fresh', 'Fresh selection')); await ready(page, 1);
  await release(page, 'old.epub');
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.map(i => i.file.name))).toEqual(['fresh.epub']);
  expect(await page.evaluate(() => window.queueInspection.started)).toEqual(['old.epub', 'fresh.epub']);
  await expect(page.locator('#titleInput')).toHaveValue('Fresh selection'); await assertNoWrites(f);
});

test('Add more waits behind an earlier selection and keeps inspection serial', async ({ page }) => {
  const f = await prepare(page, 'first.epub');
  await choose(page, await publication('first', 'First selection'), await publication('second', 'Second selection'));
  await expect.poll(() => page.evaluate(() => window.queueInspection.ready)).toEqual(['first.epub']);
  await choose(page, await publication('third', 'Third selection'));
  expect(await page.evaluate(() => window.queueInspection.started)).toEqual(['first.epub']);
  await expect(page.locator('#uploadButton')).toBeDisabled();
  await release(page, 'first.epub'); await ready(page, 3);
  expect(await page.evaluate(() => window.queueInspection.started)).toEqual(['first.epub', 'second.epub', 'third.epub']);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.map(i => i.file.name))).toEqual(['first.epub', 'second.epub', 'third.epub']);
  await expect(page.locator('#uploadButton')).toBeEnabled(); await assertNoWrites(f);
});

for (const outcome of ['success', 'failure']) test(`an old duplicate lookup ${outcome} cannot replace or unlock a fresh queue`, async ({ page }) => {
  const f = await prepare(page), old = deferred(), fresh = deferred(); let reads = 0;
  await page.route('**/admin-api/library', async route => {
    const index = ++reads; await (index === 1 ? old.promise : fresh.promise);
    return route.fulfill(index === 1 && outcome === 'failure'
      ? { status: 503, json: { error: 'Obsolete disposable lookup' } }
      : { json: catalog(index === 1 ? 'Obsolete catalog' : 'Fresh catalog') });
  });
  // Model the empty snapshot created by queue reset; all API data is disposable.
  await page.evaluate(() => { const k = window.ShadowGardenKeeper; k.state.batch.library = null; k.state.management = null; });
  await choose(page, await publication('old', 'Old selection'));
  await expect.poll(() => reads).toBe(1);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.metaReady)).toBe(true);
  await expect(page.locator('#uploadButton')).toBeDisabled(); await page.locator('#batchClear').click();
  await choose(page, await publication('fresh', 'Fresh selection')); await expect.poll(() => reads).toBe(2);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.metaReady)).toBe(true);
  old.resolve();
  await expect.poll(() => page.evaluate(() => window.queueLibrarySettled.length)).toBe(1);
  await expect(page.locator('#uploadButton')).toBeDisabled();
  expect(await page.evaluate(() => ({ library: window.ShadowGardenKeeper.state.batch.library,
    management: window.ShadowGardenKeeper.state.management }))).toEqual({ library: null, management: null });
  fresh.resolve(); await ready(page, 1);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.library.main[0].title)).toBe('Fresh catalog');
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.management.main[0].title)).toBe('Fresh catalog');
  await expect(page.locator('#uploadButton')).toBeEnabled(); await assertNoWrites(f);
});

test('a failed duplicate lookup retries on the next selection and restores duplicate decisions', async ({ page }) => {
  const f = await prepare(page); let reads = 0;
  await page.route('**/admin-api/library', route => route.fulfill(++reads === 1
    ? { status: 503, json: { error: 'Disposable catalog outage' } } : { json: catalog('Recovered selection') }));
  await page.evaluate(() => { window.ShadowGardenKeeper.state.batch.library = null; });
  await choose(page, await publication('first', 'First selection')); await ready(page, 1);
  expect(reads).toBe(1);
  await choose(page, await publication('recovered', 'Recovered selection')); await ready(page, 2);
  expect(reads).toBe(2);
  const result = await page.evaluate(() => { const item = window.ShadowGardenKeeper.state.batch.items.find(i => i.file.name === 'recovered.epub');
    return { action: item.action, matchedTitle: item.duplicate?.series?.title }; });
  expect(result).toEqual({ action: 'skip', matchedTitle: 'Recovered selection' }); await assertNoWrites(f);
});

test('locking during inspection preserves ready entries and rejects the old selection after reopening', async ({ page }) => {
  const f = await prepare(page, 'waiting.epub');
  await choose(page, await publication('ready', 'Ready selection')); await ready(page, 1);
  await choose(page, await publication('waiting', 'Waiting selection'), await publication('abandoned', 'Abandoned selection'));
  await expect.poll(() => page.evaluate(() => window.queueInspection.ready.includes('waiting.epub'))).toBe(true);
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('session').instance.lock());
  await expect(page.locator('#lockedView')).toBeVisible();
  await page.locator('#adminToken').fill('disposable-volume-key'); await page.locator('#unlockButton').click();
  await page.getByRole('button', { name: 'Complete disposable volume check', exact: true }).click();
  await expect(page.locator('#dashboardView')).toBeVisible(); await page.locator('#openNewBooks').click();
  await choose(page, await publication('fresh', 'Fresh selection')); await ready(page, 2);
  await release(page, 'waiting.epub');
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.map(i => i.file.name))).toEqual(['ready.epub', 'fresh.epub']);
  expect(await page.evaluate(() => window.queueInspection.started.includes('abandoned.epub'))).toBe(false); await assertNoWrites(f);
});
