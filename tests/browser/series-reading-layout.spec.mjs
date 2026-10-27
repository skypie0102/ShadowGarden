import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureStateFile } from './fixture.mjs';

test.setTimeout(60000);
const id = 'series-reading-layout';
const volumes = Array.from({ length: 8 }, (_, index) => ({
  number: index + 1, file: `bk_${String(index + 1).padStart(22, 'B')}`,
  title: index === 6 ? 'A long volume title that must leave room for reading context and actions' : `The Garden, Volume ${index + 1}`
}));
const description = ('A journey through a garden with a complete synopsis that remains available to readers.\n\n').repeat(18) +
  '<img src=x onerror="window.synopsisInjected=true"> The final sentence must remain available.';

async function open(page, adult, overrides = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  for (const scope of [false, true]) await page.route(
    `**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [{
      id, title: 'A reading journey', author: 'Disposable author', description, volumes, ...overrides, nsfw: adult
    }] : [] } })
  );
  await page.goto(`/series?id=${id}&scope=${adult ? 'adult' : 'main'}`);
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
  return errors;
}

async function unclipped(locator) {
  await expect(async () => expect(await locator.evaluate(element =>
    element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1
  )).toBe(true)).toPass({ timeout: 5000 });
}

for (const adult of [false, true]) {
  const scope = adult ? 'Adult' : 'Main';
  test(`${scope} synopsis expands with the keyboard and adapts without losing text or its open state`, async ({ page, context }, info) => {
    const errors = await open(page, adult);
    const toggle = page.locator('#synopsisToggle'), synopsis = page.locator('#seriesSynopsis');
    await expect(toggle).toHaveAttribute('aria-controls', 'seriesSynopsis');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(synopsis).toHaveText(description);
    await expect.poll(() => synopsis.evaluate(element => element.clientHeight < element.scrollHeight)).toBe(true);
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveText('Show less');
    await expect(toggle).toBeFocused(); await unclipped(synopsis);
    const writer = await context.newPage();
    try {
      await writer.goto('/404.html');
      await writer.evaluate(book => localStorage.setItem(`sg-progress:${book}`, JSON.stringify({ page: 12, updatedAt: 20 })), volumes[6].file);
      await expect(page.locator('.series-reading-context')).toContainText('Volume 7 · Saved page 12');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await unclipped(synopsis);
    } finally { await writer.close(); }
    await toggle.focus(); await page.keyboard.press('Space');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.synopsisInjected)).toBeUndefined();
    await info.attach('synopsis-preview', { body: await page.locator('.series-synopsis').screenshot(), contentType: 'image/png' });
    // A short synopsis needs a preview only while its narrow layout exceeds six lines.
    const short = 'A small garden invites a reader to begin a journey. '.repeat(7);
    await page.setViewportSize({ width: 320, height: 850 });
    await open(page, adult, { description: short });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 1280, height: 850 });
    await expect(toggle).toBeHidden(); await unclipped(synopsis);
    await expect(synopsis).toHaveText(short);
    await page.setViewportSize({ width: 320, height: 850 });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
  });

  test(`${scope} volume navigation reaches the saved volume in catalog order with secondary downloads`, async ({ page }, info) => {
    await page.addInitScript(book => {
      localStorage.setItem(`sg-progress:${book}`, JSON.stringify({ page: 12, percentage: 0.42, updatedAt: 20 }));
      localStorage.setItem(`sg-bookmarks:${book}`, '[{"cfi":"keep-this-bookmark"}]');
    }, volumes[6].file);
    const errors = await open(page, adult);
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const card = page.locator('#series-volume-6');
    expect(await page.locator('.volume-card').evaluateAll(cards => cards.map(card => Number(card.dataset.volumeIndex)))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      const browse = page.getByRole('link', { name: 'Browse volumes', exact: true });
      await browse.focus(); await page.keyboard.press('Enter');
      await expect(page.locator('#seriesVolumes')).toBeFocused();
      const find = page.getByRole('link', { name: 'Find Volume 7 in the volume list' });
      await find.focus(); await page.keyboard.press('Enter');
      await expect(card).toBeFocused(); await expect(card).toBeInViewport();
      await page.keyboard.press('Tab'); await expect(card.locator('.volume-cover-link')).toBeFocused();
      await page.keyboard.press('Tab'); await expect(card.locator('a.read')).toBeFocused();
      await expect(card.locator('a.read')).toHaveText('Continue reading');
      const download = card.locator('a.download');
      await expect(download).toHaveAccessibleName(`Download EPUB: ${volumes[6].title}`);
      await page.keyboard.press('Tab'); await expect(download).toBeFocused();
      await unclipped(card.locator('.volume-title')); await unclipped(card.locator('.volume-meta'));
      await expect(async () => {
        const readBox = await card.locator('a.read').boundingBox(), downloadBox = await download.boundingBox();
        const cardBox = await card.boundingBox(), metaBox = await card.locator('.volume-meta').boundingBox();
        expect(readBox.height).toBeGreaterThanOrEqual(44);
        expect(downloadBox.height).toBeGreaterThanOrEqual(44);
        expect(readBox.y).toBeGreaterThanOrEqual(metaBox.y + metaBox.height - 1);
        expect(downloadBox.y).toBeGreaterThanOrEqual(readBox.y + readBox.height);
        expect(downloadBox.y + downloadBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }).toPass({ timeout: 5000 });
      await expect(download).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      if (width !== 768) await info.attach(`volume-list-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    }
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
    expect(errors).toEqual([]);
  });

  test(`${scope} missing EPUBs have no dead actions and available downloads retain ticket authorization and saved state`, async ({ page }) => {
    const items = [ { number: 1, title: 'Missing EPUB' }, volumes[1] ];
    let tickets = 0;
    // Browser-initiated downloads bypass page.route in Chromium. Serve harmless
    // fixture bytes from this test run's disposable Pages directory instead.
    const { project } = JSON.parse(await readFile(fixtureStateFile, 'utf8'));
    await mkdir(join(project, 'dist/test'), { recursive: true });
    await writeFile(join(project, 'dist/test/series-flow.epub'), 'Disposable download fixture');
    await page.route('**/book-access', route => {
      expect(route.request().postDataJSON()).toEqual({ bookId: volumes[1].file }); tickets++;
      return route.fulfill({ json: { bookId: volumes[1].file, url: '/test/series-flow.epub?sig=fixture', expiresAt: Math.floor(Date.now() / 1000) + 300 } });
    });
    const errors = await open(page, adult, { volumes: items, description: 'A short synopsis stays fully visible.' });
    await expect(page.locator('#synopsisToggle')).toBeHidden();
    await expect(page.locator('#seriesSynopsis')).toHaveText('A short synopsis stays fully visible.');
    const missing = page.locator('#series-volume-0');
    await expect(missing.locator('a')).toHaveCount(0);
    await expect(missing).toContainText('EPUB unavailable');
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-book-id', volumes[1].file);
    await page.evaluate(book => {
      localStorage.setItem(`sg-progress:${book}`, '{"page":12,"percentage":0.42}');
      localStorage.setItem(`sg-bookmarks:${book}`, '[{"cfi":"keep-this-bookmark"}]');
    }, volumes[1].file);
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    const download = page.locator('#series-volume-1 a.download');
    const downloaded = page.waitForEvent('download');
    await download.click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe('series-flow.epub');
    expect(await file.failure()).toBeNull();
    expect(await readFile(await file.path(), 'utf8')).toBe('Disposable download fixture');
    await expect(download).toHaveText('Download EPUB');
    expect(tickets).toBe(1);
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
    await open(page, adult, { volumes: [], description: '' });
    await expect(page.locator('.series-empty')).toHaveText('No volumes have been added yet.');
    await expect(page.locator('.series-synopsis')).toHaveCount(0);
    await expect(page.locator('.series-actions [data-volume-action], .series-list-context a')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
