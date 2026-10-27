import { test, expect } from '@playwright/test';

test.setTimeout(60000);
const id = 'reading-progress-browser', book = 'bk_A2yCOKedG1g4xXTJJhbEzA';
const progressKey = `sg-progress:${book}`, bookmarksKey = `sg-bookmarks:${book}`;
const longChapter = 'Chapter Twelve — ' + 'A long chapter heading that retains its useful context on a narrow screen. '.repeat(2) +
  'AnUnbrokenChapterHeadingForWrapping'.repeat(3) + ' <img src=x onerror="window.chapterInjected=true">';

async function setup(page, adult) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  for (const scope of [false, true]) await page.route(
    `**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [
      { id, nsfw: adult, title: 'Saved reading context', author: 'Disposable author', volumes: [
        { number: 1, file: book, bookId: book, title: 'A saved volume with a long chapter title', added: '2026-10-26T00:00:00Z' }
      ] }, { id: 'empty-progress-shelf', nsfw: adult, title: 'Empty shelf', volumes: [] }
    ] : [] } })
  );
  await page.goto(adult ? '/nsfw' : '/');
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'false');
  return errors;
}

async function noOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function fullText(locator) {
  // Keep the assertion tied to settled geometry after responsive layout updates.
  await expect(async () => {
    const clipped = await locator.evaluate(element => element.scrollHeight > element.clientHeight + 1 ||
      element.scrollWidth > element.clientWidth + 1);
    expect(clipped).toBe(false);
  }).toPass({ timeout: 5000 });
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} retains full page-only saved context without changing storage or inventing percentages`, async ({ page }, info) => {
    const errors = await setup(page, adult);
    const saved = JSON.stringify({ page: 12, totalPages: 200, chapter: longChapter });
    const bookmarks = JSON.stringify([{ cfi: 'saved-reading-progress-bookmark' }]);
    await page.evaluate(({ progressKey, bookmarksKey, saved, bookmarks }) => {
      localStorage.setItem(progressKey, saved); localStorage.setItem(bookmarksKey, bookmarks);
    }, { progressKey, bookmarksKey, saved, bookmarks });
    await page.reload();
    const expected = `Saved page 12 of 200 · ${longChapter}`;
    const banner = page.locator('#continuePanel');
    const recent = page.locator(`#recentVolumes [data-book-id="${book}"]`);
    await expect(banner.locator('.continue-eyebrow')).toHaveText('Continue reading');
    await expect(banner.locator('a')).toHaveText('Continue reading');
    await expect(banner.locator('.continue-context')).toContainText(expected);
    await expect(banner.locator('.continue-context')).not.toContainText('0%');
    await expect(recent.locator('.recent-volume-progress')).toHaveText(expected);
    await expect(recent).toHaveAccessibleDescription(expected);
    await expect(recent.locator('.recent-volume-badge')).toHaveText('CONTINUE');
    await expect(page.locator('#catalogGrid .cover-reading-progress')).toHaveCount(0);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 }); await noOverflow(page);
      await fullText(banner.locator('.continue-context'));
      await fullText(recent.locator('.recent-volume-progress'));
      await info.attach(`saved-library-${width}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    }
    await page.goto(`/series?id=${id}&scope=${adult ? 'adult' : 'main'}`);
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveText('Continue reading');
    await expect(page.locator('.series-reading-context')).toHaveText(`Volume 1 · ${expected}`);
    const meta = page.locator('.volume-card .volume-meta');
    await expect(meta).toHaveText(expected);
    await expect(page.locator('.volume-card .cover-reading-progress')).toHaveCount(0);
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 850 }); await noOverflow(page);
      await fullText(meta);
      await info.attach(`saved-series-${width}`, { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    }
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.chapterInjected)).toBeUndefined();
    expect(await page.evaluate(key => localStorage.getItem(key), progressKey)).toBe(saved);
    expect(await page.evaluate(key => localStorage.getItem(key), bookmarksKey)).toBe(bookmarks);
    expect(errors).toEqual([]);
  });

  test(`${adult ? 'Adult' : 'Main'} refreshes the same saved context after real cross-tab progress updates`, async ({ page, context }) => {
    await setup(page, adult);
    const writer = await context.newPage();
    try {
      await writer.goto('/404.html');
      const write = progress => writer.evaluate(({ key, progress }) => localStorage.setItem(key, JSON.stringify(progress)), { key: progressKey, progress });
      await write({ page: 12, totalPages: 100, percentage: 0.42, chapter: 'Chapter Three', updatedAt: 10 });
      const banner = page.locator('#continuePanel .continue-context');
      await expect(banner).toContainText('42% complete · Saved page 12 of 100 · Chapter Three');
      const recent = page.locator(`#recentVolumes [data-book-id="${book}"]`);
      await expect(recent).toHaveAccessibleDescription('42% complete · Saved page 12 of 100 · Chapter Three');
      await write({ page: 18, totalPages: 100, percentage: null, chapter: 'Chapter Four', updatedAt: 20 });
      await expect(banner).toContainText('Saved page 18 of 100 · Chapter Four');
      await expect(banner).not.toContainText('0%');
      await expect(recent.locator('.recent-volume-badge')).toHaveText('CONTINUE');
      await expect(page.locator('#catalogGrid .cover-reading-progress')).toHaveCount(0);
      await page.goto(`/series?id=${id}&scope=${adult ? 'adult' : 'main'}`);
      await expect(page.locator('.series-reading-context')).toContainText('Saved page 18 of 100 · Chapter Four');
      const final = { page: 24, totalPages: 100, percentage: 0.64, chapter: 'Chapter Five', updatedAt: 30 };
      await write(final);
      await expect(page.locator('.series-reading-context')).toContainText('64% complete · Saved page 24 of 100 · Chapter Five');
      await expect(page.locator('.volume-meta')).toHaveText('64% complete · Saved page 24 of 100 · Chapter Five');
      expect(JSON.parse(await page.evaluate(key => localStorage.getItem(key), progressKey))).toEqual(final);
    } finally { await writer.close(); }
  });
}
