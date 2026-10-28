import { test, expect } from '@playwright/test';

test.setTimeout(60000);

const id = 'reading-journey-browser';
const volumes = [1, 2, 3].map(number => ({
  number, bookId: `bk_${String(number).padStart(22, 'A')}`, file: `bk_${String(number).padStart(22, 'A')}`,
  title: number === 1 ? 'A long first volume title that must leave its reading action and state legible on a narrow screen' : `Technical volume ${number}`,
  added: '2026-10-26T00:00:00Z', date: '2026-08-19', size: 5000000
}));

async function installCatalog(page, adult, items = volumes) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  for (const scope of [false, true]) await page.route(
    `**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [{ id, title: 'Reading journey fixture', nsfw: adult,
      author: 'Disposable author', volumes: items },
    { id: 'empty-journey-shelf', title: 'An empty shelf', nsfw: adult, volumes: [] }] : [] } })
  );
  return errors;
}

async function libraryAction(page, adult, label, index) {
  await page.goto(adult ? '/nsfw' : '/');
  const action = page.locator('#continuePanel a[data-volume-action]');
  await expect(action).toHaveText(label);
  await expect(action).toHaveAttribute('data-book-id', volumes[index].file);
  const recent = page.locator(`#recentVolumes [data-book-id="${volumes[index].file}"]`);
  await expect(recent).toBeVisible();
  await expect(recent).toHaveAccessibleName(`${label} ${volumes[index].title} — Reading journey fixture`);
}

async function seriesAction(page, adult, label, index) {
  await page.goto(`/series?id=${id}&scope=${adult ? 'adult' : 'main'}`);
  const action = page.locator('.series-actions [data-volume-action]');
  await expect(action).toHaveText(label);
  await expect(action).toHaveAttribute('data-book-id', volumes[index].file);
  const card = page.locator('.volume-card').nth(index);
  await expect(card.locator('a.read')).toHaveText({ 'Start reading': 'Read', 'Read next volume': 'Read', 'Continue reading': 'Continue', 'Read again': 'Read Again' }[label]);
  await expect(card.locator('.volume-cover-link')).toHaveAccessibleName(`${label} ${volumes[index].title}`);
  await expect(card.locator('.volume-cover-link')).toHaveAccessibleDescription({ 'Start reading': 'Unread', 'Read next volume': 'Unread', 'Continue reading': 'In progress', 'Read again': '✓ Finished' }[label]);
  return card;
}

async function coverBadges(page) {
  await expect(page.locator('.volume-title-row .volume-state-pill, .finished-volume-badge')).toHaveCount(0);
  for (const card of await page.locator('.volume-card').all()) {
    const badge = card.locator('.volume-cover > .volume-state-pill');
    await expect(badge).toHaveCount(1);
    await expect(async () => {
      const box = await badge.evaluate(badge => {
        const b = badge.getBoundingClientRect(), c = badge.parentElement.getBoundingClientRect();
        return { top: b.top - c.top, right: c.right - b.right, left: b.left - c.left, bottom: c.bottom - b.bottom, clipped: badge.scrollWidth > badge.clientWidth + 1 };
      });
      expect(box.top).toBeGreaterThanOrEqual(5); expect(box.top).toBeLessThanOrEqual(8);
      expect(box.right).toBeGreaterThanOrEqual(5); expect(box.right).toBeLessThanOrEqual(8);
      expect(box.left).toBeGreaterThanOrEqual(0); expect(box.bottom).toBeGreaterThanOrEqual(0);
      expect(box.clipped).toBe(false);
      // Reflow must keep the title, metadata and actions below one another.
      // Offscreen size containment can retain sizes from the previous view.
      const details = await card.evaluate(card => {
        const title = card.querySelector('.volume-title').getBoundingClientRect();
        const row = card.querySelector('.volume-title-row').getBoundingClientRect();
        const meta = card.querySelector('.volume-meta').getBoundingClientRect();
        const actions = card.querySelector('.volume-actions').getBoundingClientRect();
        const cover = card.querySelector('.volume-cover-link').getBoundingClientRect();
        return { titleHeight: title.height, titleOverflow: title.bottom - row.bottom,
          metaGap: meta.top - title.bottom, actionGap: actions.top - meta.bottom,
          cardOverflow: Math.max(cover.bottom, actions.bottom) - card.getBoundingClientRect().bottom };
      });
      expect(details.titleHeight).toBeGreaterThan(0);
      expect(details.titleOverflow).toBeLessThanOrEqual(1);
      expect(details.metaGap).toBeGreaterThanOrEqual(-1);
      expect(details.actionGap).toBeGreaterThanOrEqual(-1);
      expect(details.cardOverflow).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 5000 });
  }
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} keeps reading actions and explicit volume states consistent through completion`, async ({ page }, info) => {
    const errors = await installCatalog(page, adult);
    await libraryAction(page, adult, 'Start reading', 0);
    await seriesAction(page, adult, 'Start reading', 0);
    await expect(page.locator('.volume-state-pill')).toHaveText(['Unread', 'Unread', 'Unread']);
    await expect(page.locator('.volume-order')).toHaveText(['Volume 1 of 3', 'Volume 2 of 3', 'Volume 3 of 3']);
    for (const view of ['grid', 'list']) {
      await page.locator(`[data-series-view="${view}"]`).click();
      await expect(page.locator('.volume-state-pill')).toHaveText(['Unread', 'Unread', 'Unread']);
      await expect(page.locator('.volume-meta')).toHaveText(Array(3).fill('2026-08-19 · 4.8 MB'));
      await coverBadges(page);
    }
    await page.locator('[data-series-view="grid"]').click();
    await page.evaluate(book => {
      localStorage.setItem(`sg-progress:${book}`, JSON.stringify({ percentage: 0.42, page: 12, updatedAt: 20 }));
      localStorage.setItem(`sg-bookmarks:${book}`, JSON.stringify([{ cfi: 'saved-fixture-bookmark' }]));
    }, volumes[0].file);
    await libraryAction(page, adult, 'Continue reading', 0);
    await expect(page.locator('.continue-context')).toContainText('42% complete');
    let card = await seriesAction(page, adult, 'Continue reading', 0);
    await expect(card.locator('.volume-state-pill')).toHaveText('In progress');
    await expect(card.locator('.volume-meta')).toContainText('42% complete');
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const action of await page.locator('.volume-actions a.read').all()) {
        const box = await action.boundingBox(), parent = await action.locator('..').boundingBox();
        expect(box.height).toBeGreaterThan(0);
        expect(box.right ?? box.x + box.width).toBeLessThanOrEqual(parent.x + parent.width + 1);
      }
      for (const view of ['grid', 'list']) {
        await page.locator(`[data-series-view="${view}"]`).click();
        await coverBadges(page);
        if (width === 320 && view === 'list') await info.attach('progress-list-320', {
          body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
        });
      }
      await page.locator('[data-series-view="grid"]').click();
      if (width !== 768) await info.attach(`progress-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    }
    await page.evaluate(async ({ id, volumes }) => {
      const { readingState } = await import('/assets/js/domain/index.js');
      readingState.setVolumeFinished(id, volumes[0], true, 0);
    }, { id, volumes });
    await libraryAction(page, adult, 'Read next volume', 1);
    card = await seriesAction(page, adult, 'Read next volume', 1);
    await expect(card.locator('.volume-state-pill')).toHaveText('Unread');
    await expect(card.locator('.volume-order')).toHaveText('Volume 2 of 3 · Up next');
    await page.evaluate(async ({ id, volumes }) => {
      const { readingState } = await import('/assets/js/domain/index.js');
      for (const [index, volume] of volumes.entries()) readingState.setVolumeFinished(id, volume, true, index);
    }, { id, volumes });
    await libraryAction(page, adult, 'Read again', 0);
    card = await seriesAction(page, adult, 'Read again', 0);
    await expect(page.locator('.volume-state-pill')).toHaveText(['✓ Finished', '✓ Finished', '✓ Finished']);
    await page.setViewportSize({ width: 320, height: 850 });
    for (const view of ['grid', 'list']) {
      await page.locator(`[data-series-view="${view}"]`).click();
      await expect(page.locator('.volume-state-pill')).toHaveText(['✓ Finished', '✓ Finished', '✓ Finished']);
      await expect(page.locator('.volume-meta')).toHaveText(Array(3).fill('2026-08-19 · 4.8 MB'));
      await coverBadges(page);
      if (view === 'list') await info.attach('finished-list-320', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    }
    await page.locator('[data-series-view="grid"]').click();
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await coverBadges(page);
    await card.locator('a.read').click();
    const dialog = page.locator('#readAgainDialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep My Place' }).focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
    const badge = card.locator('.volume-state-pill'); await badge.scrollIntoViewIfNeeded();
    const badgeBox = await badge.boundingBox(), x = badgeBox.x + badgeBox.width / 2, y = badgeBox.y + badgeBox.height / 2;
    if (info.project.use.hasTouch) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep My Place' }).click();
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before);
    await page.reload();
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveText('Read again');
    expect(errors).toEqual([]);
  });

  test(`${adult ? 'Adult' : 'Main'} recommendations agree after an out-of-order Finished mark`, async ({ page }) => {
    await installCatalog(page, adult, volumes.map((volume, index) => index === 2 ? { ...volume, number: 7 } : volume));
    await page.addInitScript(book => localStorage.setItem('sg-finished-books', JSON.stringify({ [book]: 30 })), volumes[1].file);
    await libraryAction(page, adult, 'Read next volume', 2);
    const card = await seriesAction(page, adult, 'Read next volume', 2);
    await expect(card.locator('.volume-order')).toHaveText('Volume 7 · 3 of 3 · Up next');
    await expect(page.locator('.volume-card').first().locator('a.read')).toHaveText('Read');
  });
}
