import { test, expect } from '@playwright/test';

const book = number => `bk_${String(number).padStart(22, 'A')}`;
const items = Array.from({ length: 3 }, (_, index) => ({
  id: `discovery-${index}`, title: `Technical library ${index + 1}`, author: `Author ${index + 1}`,
  year: 2026, genres: ['Fantasy'], tags: ['Technical'],
  volumes: [0, 1].map(volume => ({
    bookId: book(index * 2 + volume), file: book(index * 2 + volume), number: volume + 1,
    title: volume ? 'The next technical volume' : 'A long technical volume title for checking the reading banner on a narrow screen',
    added: '2026-10-24T00:00:00Z'
  }))
}));

async function library(page, adult, series = items) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  for (const scope of [false, true]) {
    await page.route(`**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
      route => route.fulfill({ json: { series: scope === adult ? series : [] } }));
  }
  await page.goto(adult ? '/nsfw' : '/');
  await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#catalogGrid .series-card')).toHaveCount(series.length);
  return errors;
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function filterContentsFit(page) {
  const clipped = await page.locator('#filterToggle').evaluate(button => {
    const box = button.getBoundingClientRect();
    return [...button.children].filter(child => child.getClientRects().length).filter(child => {
      const bounds = child.getBoundingClientRect();
      return bounds.left < box.left || bounds.right > box.right;
    }).map(child => child.className);
  });
  expect(clipped).toEqual([]);
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} discovery keeps filters and selected chips usable on narrow screens`, async ({ page }, info) => {
    const errors = await library(page, adult);
    await expect(page.locator('#recentSection')).toBeVisible();
    await expect(page.locator('#continuePanel .continue-eyebrow')).toHaveText('Reading suggestion');
    const original = await page.locator('#continuePanel a').getAttribute('data-series-id');
    await page.getByRole('button', { name: 'Show another reading suggestion' }).click();
    await expect(page.locator('#continuePanel a')).not.toHaveAttribute('data-series-id', original);
    await info.attach('desktop-or-device-library', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });

    // Check actual resize, not only a fresh entry at the collapsed breakpoint.
    await page.setViewportSize({ width: 349, height: 850 });
    const toggle = page.locator('#filterToggle');
    await expect(toggle).toHaveAccessibleName('Filters');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect((await toggle.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await filterContentsFit(page);
    await page.locator('#searchInput').fill('technical');
    await expect(page.locator('.filter-toggle-count')).toHaveText('1');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#authorSelect').selectOption('Author 1');
    await expect(page.locator('.filter-toggle-count')).toHaveText('2');
    await expect(page.locator('#catalogGrid .series-card')).toHaveCount(1);
    await toggle.click();
    await expect(page.locator('#authorSelect')).toBeHidden();
    await filterContentsFit(page);
    await info.attach('active-filters', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    const author = page.locator('#activeTags [data-clear-filter="author"]');
    await expect(author).toBeVisible();
    await author.click();
    await expect(page.locator('.filter-toggle-count')).toHaveText('1');
    await page.locator('#activeTags [data-clear-filter="query"]').click();
    await expect(page.locator('.filter-toggle-count')).toBeHidden();
    await expect(page.locator('#catalogGrid .series-card')).toHaveCount(3);
    await noOverflow(page);
    await info.attach('narrow-library', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });

    await page.setViewportSize({ width: 761, height: 850 });
    await expect(toggle).toBeHidden();
    await expect(page.locator('#authorSelect')).toBeVisible();
    await noOverflow(page);
    await info.attach('tablet-library', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    expect(errors).toEqual([]);
  });

  test(`${adult ? 'Adult' : 'Main'} single-series and empty catalogs avoid redundant discovery controls`, async ({ page }) => {
    const errors = await library(page, adult, [items[0]]);
    await expect(page.locator('#recentSection')).toBeHidden();
    await expect(page.locator('#continuePanel a')).toHaveText('Start reading');
    await expect(page.locator('[data-another-suggestion]')).toHaveCount(0);
    await page.route(`**/media/shadow-garden/data/${adult ? 'adult-catalog' : 'catalog'}.json`,
      route => route.fulfill({ json: { series: [] } }));
    await page.reload();
    await expect(page.locator('#catalogGrid')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('#continuePanel')).toBeHidden();
    await expect(page.locator('#recentSection')).toBeHidden();
    await expect(page.locator('#emptyState')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('banner distinguishes saved progress, next volume and read-again confirmation', async ({ page }, info) => {
  await page.addInitScript(({ identity }) => {
    localStorage.setItem(`sg-progress:${identity}`, JSON.stringify({ percentage: 0.42, page: 12, updatedAt: Date.now() }));
  }, { identity: book(0) });
  const errors = await library(page, false, [items[0]]);
  const panel = page.locator('#continuePanel');
  await expect(panel.locator('.continue-eyebrow')).toHaveText('Continue reading');
  await expect(panel.locator('.continue-context')).toContainText('42% complete');
  await expect(panel.locator('a')).toHaveText('Continue reading');
  await page.setViewportSize({ width: 349, height: 850 });
  await noOverflow(page);
  const bounds = await panel.boundingBox(), action = await panel.locator('a').boundingBox();
  expect(action.x + action.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  await info.attach('saved-progress-banner', { body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png' });

  await page.evaluate(async ({ series, identity }) => {
    const { readingState } = await import('/assets/js/domain/index.js');
    readingState.setVolumeFinished(series, { bookId: identity, file: identity, number: 1 }, true, 0);
  }, { series: items[0].id, identity: book(0) });
  await expect(panel.locator('.continue-eyebrow')).toHaveText('Next in series');
  await expect(panel.locator('a')).toHaveText('Read next volume');
  await expect(panel.locator('a')).toHaveAttribute('data-book-id', book(1));
  await page.evaluate(async ({ series, identity }) => {
    const { readingState } = await import('/assets/js/domain/index.js');
    readingState.setVolumeFinished(series, { bookId: identity, file: identity, number: 2 }, true, 1);
  }, { series: items[0].id, identity: book(1) });
  await expect(panel.locator('a')).toHaveText('Read again');
  await panel.locator('a').click();
  const dialog = page.locator('#readAgainDialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep My Place' }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(identity => JSON.parse(localStorage.getItem(`sg-progress:${identity}`)).percentage, book(0))).toBe(0.42);
  expect(errors).toEqual([]);
});
