import { test, expect } from '@playwright/test';
import { createReaderEpub, createReaderZip, readerTitle } from './reader-production-fixture.mjs';
import { installKeeper } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);

async function prepare(page) {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({ chapterCount: 2, paragraphCount: 2 }));
  zip.file('book.opf', (await zip.file('book.opf').async('string')).replace(readerTitle, 'Fixture story Volume 2'));
  const epub = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const catalog = { ok: true, revision: 5, main: [{ id: 'fixture-story', title: 'Fixture story', author: 'Disposable fixture',
    genres: [], tags: [], volumes: [{ bookId: 'bk_A2yCOKedG1g4xXTJJhbEzA', number: 1,
      title: 'Fixture story Volume 1', originalFilename: 'Fixture story Volume 1.epub', size: epub.length }] }],
    adult: [], counts: { series: 1, volumes: 1 } };
  const f = await installKeeper(page, undefined, catalog);
  await expect(page.locator('#uploadReviewSummary')).toHaveCount(1);
  await page.locator('#openNewBooks').click();
  await page.locator('#epubFile').setInputFiles([{ name: 'Fixture story Volume 2.epub', mimeType: 'application/epub+zip', buffer: epub }]);
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeper.state.batch.items[0]?.metaReady))).toBe(true);
  await expect(page.locator('#titleInput')).toHaveValue('Fixture story Volume 2');
  await expect(page.locator('#volumeInput')).toHaveValue('2');
  return { ...f, report: page.locator('[data-import-preflight-report]'), card: page.locator('#batchList .batch-item') };
}

test('similar-volume guidance survives queue edits and clears when the match or scope changes', async ({ page }) => {
  const f = await prepare(page);
  const note = f.card.locator('[data-similar-volume-warning]');
  await expect(note).toContainText('Possible similar volume: Fixture story · Fixture story Volume 1');
  await expect(page.locator('#batchSummary')).toContainText('1 similar warning');
  await expect(f.report).toContainText('Possible similar volume: Fixture story · Fixture story Volume 1');
  await page.locator('#authorInput').fill('Reviewed author');
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].author)).toBe('Reviewed author');
  await expect(note).toContainText('Upload remains allowed');
  await expect(page.locator('#batchSummary')).toContainText('1 similar warning');
  await expect(page.locator('#uploadButton')).toBeEnabled();
  await page.locator('#seriesInput').fill('Unrelated series');
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].series)).toBe('Unrelated series');
  await expect(note).toHaveCount(0);
  await expect(f.report).not.toContainText('Possible similar volume');
  await page.locator('#seriesInput').fill('Fixture story');
  await expect(note).toContainText('Possible similar volume');
  await expect(f.report).toContainText('Possible similar volume');
  await page.locator('label').filter({ has: page.locator('#adultInput') }).click();
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].adult)).toBe(true);
  await expect(note).toHaveCount(0);
  await expect(f.report).not.toContainText('Possible similar volume');
  await expect(page.locator('#batchSummary')).not.toContainText('similar warning');
  await expect(page.locator('#uploadButton')).toBeEnabled();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].action)).toBe('new');
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});

test('a real catalog refresh updates the aggregate similar-volume label when its reasons are unchanged', async ({ page }) => {
  const f = await prepare(page);
  await expect(f.report).toContainText('Possible similar volume: Fixture story · Fixture story Volume 1');
  const reasons = await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].similarVolume.reasons);
  f.catalog.main[0].title = 'Renamed fixture story';
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('library').instance.refresh());
  await expect(f.card.locator('[data-similar-volume-warning]')).toContainText('Renamed fixture story');
  await expect(f.report).toContainText('Possible similar volume: Renamed fixture story · Fixture story Volume 1');
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].similarVolume.reasons)).toEqual(reasons);
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});

test('an unchanged aggregate report preserves its Review control and keyboard focus on catalog refresh', async ({ page }) => {
  const f = await prepare(page);
  await expect(f.report).toContainText('Possible similar volume');
  await f.report.getByRole('button', { name: 'Review', exact: true }).focus();
  await page.evaluate(() => { window.savedUploadReport = document.querySelector('[data-import-preflight-report]'); });
  f.catalog.main[0].author = 'Changed outside the report';
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('library').instance.refresh());
  expect(await page.evaluate(() => window.savedUploadReport === document.querySelector('[data-import-preflight-report]'))).toBe(true);
  await expect(f.report.getByRole('button', { name: 'Review', exact: true })).toBeFocused();
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});
