import { test, expect } from '@playwright/test';
import { createReaderEpub, createReaderZip, readerTitle } from './reader-production-fixture.mjs';

test.setTimeout(90000);

test('removing a duplicate partner preserves explicit Skip and uploads only the ready EPUB', async ({ page }) => {
  const errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  // Every admin API call uses a disposable response; no production credentials or writes.
  await page.route('**/admin-api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/admin-api/status') return route.fulfill({ json: { ok: true, authorized: true, revision: 5, catalogReadable: true } });
    if (path === '/admin-api/library') return route.fulfill({ json: { ok: true, revision: 5, main: [], adult: [], counts: { series: 0, volumes: 0 } } });
    if (path === '/admin-api/upload') return route.fulfill({ json: { ok: true } });
    if (path === '/admin-api/catalog') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true, revision: 6 + writes.length, seriesId: 'ready-queue-fixture' } });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected disposable request' } });
  });
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 60000 }).toBe(true);
  await page.locator('#adminToken').fill('disposable-upload-key');
  await page.evaluate(async () => {
    const keeper = window.ShadowGardenKeeper;
    await keeper.client.verifySession();
    keeper.client.markUnlocked(); keeper.state.unlocked = true;
    document.querySelector('#lockedView').classList.add('hidden');
    document.querySelector('#dashboardView').classList.remove('hidden');
    keeper.events.dispatchEvent(new Event('session:unlocked'));
  });
  await page.locator('#openNewBooks').click();

  const duplicate = await createReaderEpub({ chapterCount: 2, paragraphCount: 2 });
  const ready = await createReaderZip();
  await ready.loadAsync(duplicate);
  ready.file('book.opf', (await ready.file('book.opf').async('string')).replace(readerTitle, 'Ready queue fixture'));
  await page.locator('#epubFile').setInputFiles([
    { name: 'skipped.epub', mimeType: 'application/epub+zip', buffer: duplicate },
    { name: 'removed.epub', mimeType: 'application/epub+zip', buffer: duplicate },
    { name: 'ready.epub', mimeType: 'application/epub+zip', buffer: await ready.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) }
  ]);
  await expect(page.locator('#batchList .batch-item')).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items.every(item => item.metaReady))).toBe(true);
  await expect(page.locator('#uploadButton')).toHaveText('Upload 1 Book');
  const ids = await page.evaluate(() => Object.fromEntries(window.ShadowGardenKeeper.state.batch.items.map(item => [item.file.name, item.id])));
  const skipped = page.locator(`[data-batch-id="${ids['skipped.epub']}"]`);
  const action = skipped.locator('[data-batch-action]');
  // Choose Skip explicitly rather than relying on the automatic duplicate default.
  await action.selectOption('separate');
  await action.selectOption('skip');
  await expect.poll(() => page.evaluate(id => window.ShadowGardenKeeper.state.batch.items.find(item => item.id === id).userChoseSkip, ids['skipped.epub'])).toBe(true);
  await page.locator(`[data-batch-id="${ids['removed.epub']}"]`).getByRole('button', { name: 'Remove EPUB from upload queue' }).click();
  await expect(page.locator('#batchList .batch-item')).toHaveCount(2);
  await expect.poll(() => page.evaluate(id => window.ShadowGardenKeeper.state.batch.items.find(item => item.id === id).action, ids['skipped.epub'])).toBe('skip');
  await expect(page.locator('#batchSummary')).toContainText('2 selected · 1 upload');
  await expect(page.locator('#uploadReviewSummary')).toContainText('1 skipped');
  await expect(page.locator('#uploadButton')).toHaveText('Upload 1 Book');
  await page.locator('#uploadButton').click();
  await expect(page.locator('#uploadWorkflowStage')).toContainText('1 book was uploaded successfully');
  expect(writes.map(write => write.originalFilename)).toEqual(['ready.epub']);
  expect(errors).toEqual([]);
});
