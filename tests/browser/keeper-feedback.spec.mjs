import { test, expect } from '@playwright/test';
import { createReaderEpub, createReaderZip, readerTitle } from './reader-production-fixture.mjs';
import { installKeeper } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
const empty = () => ({ ok: true, revision: 5, main: [], adult: [], counts: { series: 0, volumes: 0 } });
const bookId = 'bk_A2yCOKedG1g4xXTJJhbEzA';
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

async function publication(name, title) {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({ chapterCount: 2, paragraphCount: 2 }));
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('book.opf', (await zip.file('book.opf').async('string')).replace(readerTitle, title));
  return { name: name + '.epub', mimeType: 'application/epub+zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) };
}
async function choose(page, ...files) {
  await page.locator('#epubFile').setInputFiles(files);
  await expect(page.locator('#batchList .batch-item')).toHaveCount(files.length);
  await expect.poll(() => page.evaluate(() => {
    const q = window.ShadowGardenKeeper.state.batch;
    return !q.preparing && q.items.every(item => item.status !== 'checking');
  })).toBe(true);
}
async function queueIds(page) {
  return page.evaluate(() => Object.fromEntries(window.ShadowGardenKeeper.state.batch.items.map(item => [item.file.name, item.id])));
}
function row(page, id) { return page.locator(`[data-batch-id="${id}"]`); }
function result(page, id) { return page.locator(`#uploadWorkflowStage [data-upload-file="${id}"]`); }
async function fit(page) {
  expect(await page.locator('#addBooksDialog').evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1)).toBe(true);
}
async function completionLayout(page) {
  const stage = page.locator('#uploadWorkflowStage');
  await expect(stage.locator('h2')).toBeInViewport();
  await expect(stage.locator('#workflowNextBatch')).toBeInViewport();
  expect(await stage.evaluate(stage => {
    const actions = stage.querySelector('.upload-state-actions').getBoundingClientRect();
    const results = stage.querySelector('.upload-file-results').getBoundingClientRect();
    return actions.bottom <= results.top + 1;
  })).toBe(true);
}
async function mockUploads(page, handle = async () => null) {
  const writes = [], uploads = [];
  await page.route('**/admin-api/upload**', route => {
    uploads.push(route.request().url()); return route.fulfill({ json: { ok: true } });
  });
  await page.route('**/admin-api/catalog', async route => {
    const payload = route.request().postDataJSON(); writes.push(payload);
    if (await handle(route, payload, writes)) return;
    return route.fulfill({ json: { ok: true, revision: 5 + writes.length,
      seriesId: payload.targetSeriesId || `${payload.adult ? 'adult-' : ''}${slug(payload.series)}`, bookId } });
  });
  return { writes, uploads };
}

for (const adult of [false, true]) test(`${adult ? 'Adult' : 'Main'} target and duplicate decisions describe the actual write and opened destination`, async ({ page }, info) => {
  const scope = adult ? 'adult' : 'main', id = adult ? 'custom-rose-target' : 'existing-garden';
  const catalog = empty(); catalog[scope] = [{ id, title: 'Existing garden', volumes: [{ bookId, file: bookId, number: 1, title: 'Existing garden Volume 1' }] }];
  catalog.counts = { series: 1, volumes: 1 };
  const f = await installKeeper(page, undefined, catalog), writes = await mockUploads(page);
  await page.locator(`[data-manager-add="${id}"]`).click();
  await choose(page, await publication('replacement', 'Existing garden Volume 1'));
  const ids = await queueIds(page), card = row(page, ids['replacement.epub']);
  const action = card.locator('[data-batch-action]'), guidance = card.locator('.batch-action-guidance');
  await expect(guidance).toContainText(`Destination: ${adult ? 'Adult' : 'Main'} Library · Existing garden · Volume 1 · Existing series`);
  await expect(action).toHaveValue('skip');
  await expect(guidance).toContainText('Nothing will be uploaded or replaced');
  await action.selectOption('separate');
  await expect(guidance).toContainText('Keep any existing matched volume unchanged');
  await action.selectOption('replace');
  await expect(guidance).toContainText('EPUB and metadata');
  await expect(action).toHaveAccessibleDescription(/book identity and reading links/);
  await fit(page);
  await info.attach(`duplicate-${scope}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(writes.writes).toHaveLength(1);
  expect(writes.writes[0]).toMatchObject({ adult, series: 'Existing garden', targetSeriesId: id, duplicatePolicy: 'replace', replaceTargetFile: bookId });
  await page.getByRole('button', { name: 'Open uploaded series', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`id=${id}&scope=${scope}`));
  expect(f.errors).toEqual([]);
});

for (const adult of [false, true]) test(`${adult ? 'Adult' : 'Main'} new-series upload retains skipped and invalid files through review and reopening`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const f = await installKeeper(page, undefined, empty()), transport = await mockUploads(page);
  await page.locator('#openNewBooks').click();
  await choose(page, await publication('ready', 'New garden Volume 1'), await publication('skipped', 'New garden Volume 2'),
    { name: 'invalid.epub', mimeType: 'application/epub+zip', buffer: Buffer.from('Disposable invalid EPUB') });
  const ids = await queueIds(page);
  await row(page, ids['skipped.epub']).locator('[data-batch-action]').selectOption('skip');
  await row(page, ids['ready.epub']).locator('[data-batch-edit]').click();
  await page.locator('#seriesInput').fill('New garden');
  if (adult) await page.locator('label').filter({ has: page.locator('#adultInput') }).click();
  await expect(row(page, ids['ready.epub']).locator('.batch-action-guidance')).toContainText(`${adult ? 'Adult' : 'Main'} Library · New garden · Volume 1 · New series`);
  await expect(page.locator('#uploadButton')).toHaveText('Upload 1 Book');
  await page.evaluate(ids => { window.retainedFiles = window.ShadowGardenKeeper.state.batch.items.filter(item => item.id !== ids['ready.epub']); }, ids);
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  await expect(page.locator('#uploadWorkflowStage')).not.toContainText('queue has been cleared');
  await completionLayout(page);
  await expect(result(page, ids['ready.epub'])).toContainText('Uploaded');
  await expect(result(page, ids['skipped.epub'])).toContainText('Skipped · Not uploaded');
  await expect(result(page, ids['invalid.epub'])).toContainText('Blocked · Invalid EPUB');
  expect(transport.writes.map(write => write.originalFilename)).toEqual(['ready.epub']);
  expect(transport.writes[0].adult).toBe(adult);
  expect(await page.evaluate(() => window.retainedFiles.every((item, index) => window.ShadowGardenKeeper.state.batch.items[index] === item))).toBe(true);
  await fit(page);
  await info.attach(`retained-${adult ? 'adult' : 'main'}-320`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Review upload queue', exact: true }).click();
  await expect(page.locator('#metadataCard')).toBeVisible();
  await expect(page.locator('#titleInput')).toHaveValue('New garden Volume 2');
  await expect(row(page, ids['skipped.epub']).locator('[data-batch-action]')).toHaveValue('skip');
  await page.locator('#closeAddBooks').click(); await page.locator('#openNewBooks').click();
  await expect(page.locator('#batchList .batch-item')).toHaveCount(2);
  await expect(row(page, ids['skipped.epub']).locator('[data-batch-action]')).toHaveValue('skip');
  expect(transport.writes).toHaveLength(1); expect(f.errors).toEqual([]);
});

test('per-file results distinguish an upload failure and retry only the failed file', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 850 });
  const f = await installKeeper(page, undefined, empty()), hold = deferred(); let rejected = false;
  const transport = await mockUploads(page, async (route, payload) => {
    if (payload.originalFilename !== 'second.epub' || rejected) return false;
    await hold.promise; rejected = true;
    await route.fulfill({ status: 503, json: { error: 'Temporary disposable upload error' } }); return true;
  });
  await page.locator('#openNewBooks').click();
  await choose(page, await publication('first', 'First garden Volume 1'), await publication('second', 'Second garden Volume 1'));
  const ids = await queueIds(page);
  await page.locator('#uploadButton').click();
  try {
    await expect(result(page, ids['first.epub'])).toHaveAttribute('data-outcome', 'done');
    await expect(result(page, ids['second.epub'])).toContainText('Updating catalog');
    await expect(page.getByRole('progressbar', { name: 'Batch processing progress' })).toHaveAttribute('aria-valuenow', '91');
    await expect(page.locator('#uploadStageCount')).toHaveText('1 uploaded · 0 failed · 1 remaining');
    await info.attach('per-file-uploading-320', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  } finally { hold.resolve(); }
  await expect(result(page, ids['second.epub'])).toContainText('Upload failed · Retry available');
  await expect(result(page, ids['second.epub'])).toContainText('Temporary disposable upload error');
  await expect(result(page, ids['second.epub'])).not.toContainText('Invalid EPUB');
  await completionLayout(page);
  await fit(page);
  await info.attach('partial-upload-320', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Review upload queue', exact: true }).click();
  const report = page.locator('[data-import-preflight-report]');
  await expect(report).toContainText('1 to retry');
  await expect(report).not.toContainText('Upload is blocked');
  await expect(page.locator('#uploadButton')).toHaveText('Upload 1 Book');
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('queue has been cleared');
  expect(transport.writes.map(write => write.originalFilename)).toEqual(['first.epub', 'second.epub', 'second.epub']);
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.length)).toBe(0);
  expect(f.errors).toEqual([]);
});

test('the multi-series chooser and Back retain results and the remaining queue', async ({ page }) => {
  const f = await installKeeper(page, undefined, empty()), transport = await mockUploads(page);
  await page.locator('#openNewBooks').click();
  await choose(page, await publication('one', 'First garden Volume 1'), await publication('two', 'Second garden Volume 1'), await publication('skip', 'Third garden Volume 1'));
  const ids = await queueIds(page);
  await row(page, ids['skip.epub']).locator('[data-batch-action]').selectOption('skip');
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('2 books were uploaded successfully');
  await page.getByRole('button', { name: 'Open uploaded series', exact: true }).click();
  await expect(page.locator('[data-open-uploaded-series]')).toHaveCount(2);
  await expect(page.locator('#workflowChooserNext')).toHaveText('Review upload queue');
  await page.locator('#workflowChooserBack').click();
  await expect(page.locator('#uploadWorkflowStage [data-upload-file]')).toHaveCount(3);
  await expect(result(page, ids['one.epub'])).toContainText('Uploaded');
  await expect(result(page, ids['skip.epub'])).toContainText('Skipped · Not uploaded');
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.map(item => item.file.name))).toEqual(['skip.epub']);
  expect(transport.writes).toHaveLength(2); expect(f.errors).toEqual([]);
});


test('a targeted upload cannot replace a match from the other library', async ({ page }) => {
  const catalog = empty();
  catalog.main = [{ id: 'existing-garden', title: 'Existing garden', volumes: [{ bookId, file: bookId, number: 1, title: 'Existing garden Volume 1' }] }];
  catalog.adult = [{ id: 'custom-rose-target', title: 'Existing garden', volumes: [{ bookId: 'bk_B2yCOKedG1g4xXTJJhbEzB', file: 'bk_B2yCOKedG1g4xXTJJhbEzB', number: 2, title: 'Existing garden Volume 2' }] }];
  catalog.counts = { series: 2, volumes: 2 };
  const f = await installKeeper(page, undefined, catalog), transport = await mockUploads(page);
  await page.locator('[data-manager-add="custom-rose-target"]').click();
  await choose(page, await publication('other-library', 'Existing garden Volume 1'));
  const ids = await queueIds(page), card = row(page, ids['other-library.epub']);
  await expect(card.locator('.batch-duplicate')).toContainText('Main');
  await card.locator('[data-batch-action]').selectOption('replace');
  await expect(card.locator('[data-batch-action]')).toHaveValue('skip');
  expect(f.alerts).toHaveLength(1); expect(f.alerts[0]).toContain('selected series and library');
  expect(transport.writes).toHaveLength(0);
  await expect(card.locator('.batch-action-guidance')).toContainText('Adult Library');
  await card.locator('[data-batch-action]').selectOption('separate');
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(transport.writes).toHaveLength(1);
  expect(transport.writes[0]).toMatchObject({ adult: true, targetSeriesId: 'custom-rose-target', duplicatePolicy: 'separate', replaceTargetFile: '' });
  expect(f.errors).toEqual([]);
});

test('a non-active file opens the selected Adult destination after its queued partner was skipped', async ({ page }) => {
  const catalog = empty();
  catalog.adult = [{ id: 'custom-rose-target', title: 'Existing garden', volumes: [{ bookId, file: bookId, number: 1, title: 'Existing garden Volume 1' }] }];
  catalog.counts = { series: 1, volumes: 1 };
  const f = await installKeeper(page, undefined, catalog), transport = await mockUploads(page);
  await page.locator('[data-manager-add="custom-rose-target"]').click();
  await choose(page, await publication('skipped-target', 'Existing garden Volume 1'), await publication('non-active', 'Imported elsewhere Volume 2'));
  const ids = await queueIds(page);
  await expect(row(page, ids['skipped-target.epub']).locator('[data-batch-action]')).toHaveValue('skip');
  // Imported fields on a non-active row are still different from the actual
  // locked destination applied by the API owner when it sends the request.
  expect(await page.evaluate(id => window.ShadowGardenKeeper.state.batch.items.find(item => item.id === id).adult, ids['non-active.epub'])).toBe(false);
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(transport.writes.map(write => write.originalFilename)).toEqual(['non-active.epub']);
  expect(transport.writes[0]).toMatchObject({ adult: true, series: 'Existing garden', targetSeriesId: 'custom-rose-target' });
  await page.getByRole('button', { name: 'Open uploaded series', exact: true }).click();
  await expect(page).toHaveURL(/id=custom-rose-target&scope=adult/);
  expect(f.errors).toEqual([]);
});
