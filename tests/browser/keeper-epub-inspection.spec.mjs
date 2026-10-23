import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createReaderEpub, createReaderZip, readerTitle } from './reader-production-fixture.mjs';
import { installKeeper } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);

async function publication(mode) {
  const zip = await createReaderZip();
  await zip.loadAsync(await createReaderEpub({ chapterCount: 5, paragraphCount: 2 }));
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  if (mode === 'encoded') {
    const oldChapter = await zip.file('chapter0.xhtml').async('string');
    const oldCover = await zip.file('art.svg').async('string');
    zip.file('Images/cover#art.svg', oldCover); zip.remove('art.svg');
    zip.file('Text#part/本文#0.xhtml', oldChapter
      .replaceAll('src="art.svg"', 'src="../Images/cover%23art.svg"')
      .replaceAll('href="chapter4.xhtml#target-4"', 'href="../chapter4.xhtml#target-4"'));
    zip.remove('chapter0.xhtml');
    for (const path of ['cover.xhtml', 'chapter1.xhtml', 'chapter2.xhtml', 'chapter3.xhtml', 'chapter4.xhtml'])
      zip.file(path, (await zip.file(path).async('string')).replaceAll('src="art.svg"', 'src="Images/cover%23art.svg"'));
    const href = 'Text%23part/%E6%9C%AC%E6%96%87%230.xhtml';
    zip.file('book.opf', (await zip.file('book.opf').async('string'))
      .replaceAll('href="chapter0.xhtml"', `href="${href}"`).replaceAll('href="art.svg"', 'href="Images/cover%23art.svg"'));
    zip.file('nav.xhtml', (await zip.file('nav.xhtml').async('string')).replaceAll('href="chapter0.xhtml"', `href="${href}"`));
  } else if (mode === 'ordinary') {
    for (const path of ['cover.xhtml', ...Array.from({ length: 5 }, (_, i) => `chapter${i}.xhtml`)])
      zip.file(path, (await zip.file(path).async('string'))
        .replaceAll('src="art.svg"', 'src="./art.svg?edition=1#illustration"')
        .replaceAll('href="chapter4.xhtml#target-4"', 'href="./chapter4.xhtml?edition=1#target-4"'));
  } else if (mode === 'missing') zip.remove('chapter0.xhtml');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function select(page, mode) {
  const f = await installKeeper(page, undefined, { ok: true, revision: 5, main: [], adult: [], counts: { series: 0, volumes: 0 } });
  await page.locator('#openNewBooks').click();
  const epub = await publication(mode);
  await page.locator('#epubFile').setInputFiles([{ name: `${mode}-inspection.epub`, mimeType: 'application/epub+zip', buffer: epub }]);
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0]?.validation?.status || 'pending')).not.toBe('pending');
  return { ...f, epub };
}

for (const mode of ['encoded', 'ordinary']) test(`${mode} EPUB paths pass real local inspection without false missing-resource errors`, async ({ page }) => {
  const f = await select(page, mode);
  const result = await page.evaluate(() => {
    const item = window.ShadowGardenKeeper.state.batch.items[0];
    return { title: item.title, sha256: item.sha256, validation: item.validation, coverBytes: item.coverBlob?.size || 0 };
  });
  expect(result.title).toBe(readerTitle); expect(result.validation.status).toBe('pass');
  expect(result.validation.fatal).toEqual([]); expect(result.validation.warnings).toEqual([]);
  expect(result.validation.stats.brokenRefs).toBe(0); expect(result.validation.checks.cover).toBe('pass');
  expect(result.coverBytes).toBeGreaterThan(0);
  expect(result.sha256).toBe(createHash('sha256').update(f.epub).digest('hex'));
  await expect(page.locator('#uploadButton')).toBeEnabled();
  await expect(page.locator('[data-import-preflight-report]')).toContainText('No validation warnings or blocked files.');
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});

test('a genuinely missing spine resource stays blocked by real local inspection', async ({ page }) => {
  const f = await select(page, 'missing');
  const result = await page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].validation);
  expect(result.status).toBe('fail');
  expect(result.fatal.some(issue => issue.message === 'Spine document is missing or invalid')).toBe(true);
  await expect(page.locator('#uploadButton')).toBeDisabled();
  await expect(page.locator('[data-import-preflight-report]')).toContainText('Spine document is missing or invalid');
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});
