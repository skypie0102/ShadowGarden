import { test, expect } from '@playwright/test';

test.setTimeout(60000);

const id = 'reading-journey-browser';
const volumes = [1, 2, 3].map(number => ({
  number, bookId: `bk_${String(number).padStart(22, 'A')}`, file: `bk_${String(number).padStart(22, 'A')}`,
  title: number === 1 ? 'A long first volume title that must leave its reading action and state legible on a narrow screen' : `Technical volume ${number}`,
  added: '2026-10-26T00:00:00Z'
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
  return card;
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} keeps reading actions and explicit volume states consistent through completion`, async ({ page }, info) => {
    const errors = await installCatalog(page, adult);
    await libraryAction(page, adult, 'Start reading', 0);
    await seriesAction(page, adult, 'Start reading', 0);
    await expect(page.locator('.volume-state-pill')).toHaveText(['Unread', 'Unread', 'Unread']);
    await expect(page.locator('.volume-order')).toHaveText(['Volume 1 of 3', 'Volume 2 of 3', 'Volume 3 of 3']);
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
      if (width === 320) {
        // Reading-status.css loads after Series styles. Its shared flex row
        // must not squeeze a long title beside the wider In progress badge.
        const title = await card.locator('.volume-title').boundingBox();
        const state = await card.locator('.volume-state-pill').boundingBox();
        expect(state.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
      }
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
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
    await card.locator('a.read').click();
    const dialog = page.locator('#readAgainDialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Keep My Place' }).focus();
    await page.keyboard.press('Enter');
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
