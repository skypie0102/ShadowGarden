import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// This owner's v2.18.12 CSS is syntax-equivalent to the v2.19.0 layout.
const previousCss = JSON.parse(readFileSync(new URL('./fixtures/stylesheets-2.18.12.json', import.meta.url)))
  .files.find(file => file.path === '/assets/css/series-extra.css').css;
const candidateCss = readFileSync(new URL('../../public/assets/css/series-extra.css', import.meta.url), 'utf8');

const bookId = 'bk_A2yCOKedG1g4xXTJJhbEzA';
const cover = '/test/series-layout-cover.svg';
const item = {
  id: 'series-layout', title: 'The Garden Chronicle', author: 'Sample Author (著者)', year: 2026,
  status: 'Ongoing', translations: [{ name: 'Sample translator' }],
  genres: ['Action', 'Fantasy'], tags: ['School Life', 'Supernatural', 'Ongoing'],
  description: 'A disposable series synopsis. The volume list should follow the compact series header.',
  cover, volumes: [{ bookId, file: bookId, number: 1, title: 'Volume 1', cover }]
};

async function openSeries(page, adult, overrides = {}) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('sg-adult-ack', '1'));
  await page.route(`**${cover}`, route => route.fulfill({ contentType: 'image/svg+xml', body:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#30263e"/><path d="M0 220 200 60V300H0Z" fill="#655378"/><text x="100" y="130" fill="#f0e9f5" font-size="23" text-anchor="middle">The Garden</text><text x="100" y="160" fill="#f0e9f5" font-size="18" text-anchor="middle">Volume 1</text></svg>' }));
  for (const scope of [false, true]) await page.route(
    `**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [{ ...item, ...overrides, nsfw: adult }] : [] } })
  );
  await page.goto(`/series?id=${item.id}&scope=${adult ? 'adult' : 'main'}`);
  await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.series-info h1')).toHaveText(overrides.title || item.title);
  await page.locator('.series-cover').evaluateAll(images => Promise.all(images.map(img => img.decode())));
  return errors;
}

async function layout(page) {
  return page.evaluate(async () => {
    // Viewport updates can acknowledge before media queries and balanced text
    // finish their next layout frame, especially with mobile device emulation.
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = selector => {
      const { x, y, width, height, right, bottom } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    return {
      hero: rect('.series-hero-inner'), cover: rect('.series-cover, .series-cover-fallback'),
      heading: rect('.series-heading'), actions: rect('.series-actions'), tags: rect('.tag-row'),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      controls: [...document.querySelectorAll('.series-actions > *')].map(el => {
        const { x, right, height } = el.getBoundingClientRect(); return { x, right, height };
      })
    };
  });
}

async function previousLayout(page, inspect) {
  await page.evaluate(css => {
    const current = document.querySelector('link[href*="/series-extra.css"], style[data-series-layout-css]');
    const style = document.createElement('style');
    style.dataset.seriesLayoutCss = 'true'; style.textContent = css;
    current.replaceWith(style);
  }, previousCss);
  try { return await inspect(); }
  finally {
    // Re-enabling a disabled link can apply its rules on a later frame. Restore
    // the exact served candidate text in the same slot before reading geometry.
    await page.evaluate(css => {
      document.querySelector('style[data-series-layout-css]').textContent = css;
    }, candidateCss);
  }
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} series uses the space beneath the mobile cover`, async ({ page }, info) => {
    const errors = await openSeries(page, adult);
    await page.setViewportSize({ width: 393, height: 850 });
    await previousLayout(page, async () => {
      const before = await layout(page);
      expect(before.actions.x).toBeGreaterThan(before.cover.right);
      await info.attach('previous-mobile-series', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    });
    for (const width of [393, 349, 461, 720, 721, 980, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      const boxes = await layout(page);
      expect(boxes.overflow).toBe(false);
      expect(boxes.cover.x).toBeLessThan(boxes.heading.x);
      for (const control of boxes.controls) {
        expect(control.x).toBeGreaterThanOrEqual(boxes.hero.x - 1);
        expect(control.right).toBeLessThanOrEqual(boxes.hero.right + 1);
        expect(control.height).toBeGreaterThanOrEqual(42);
      }
      if (width <= 720) {
        // The reported defect leaves these controls trapped beside the cover.
        expect(Math.abs(boxes.actions.x - boxes.cover.x)).toBeLessThan(1);
        expect(Math.abs(boxes.tags.x - boxes.cover.x)).toBeLessThan(1);
        expect(Math.abs(boxes.actions.width - boxes.hero.width)).toBeLessThan(1);
        const gap = boxes.actions.y - Math.max(boxes.cover.bottom, boxes.heading.bottom);
        expect(gap).toBeGreaterThanOrEqual(12);
        expect(gap).toBeLessThanOrEqual(20);
        expect(boxes.tags.y - boxes.actions.bottom).toBeGreaterThanOrEqual(12);
        expect(boxes.tags.y - boxes.actions.bottom).toBeLessThanOrEqual(20);
        expect(boxes.controls.every(control => control.height >= 44)).toBe(true);
      } else {
        expect(Math.abs(boxes.actions.x - boxes.heading.x)).toBeLessThan(1);
        expect(Math.abs(boxes.tags.x - boxes.heading.x)).toBeLessThan(1);
        const previous = await previousLayout(page, () => layout(page));
        // Moving controls is a mobile-only change; desktop geometry stays put.
        for (const key of ['cover', 'heading', 'actions', 'tags', 'hero']) {
          for (const dimension of ['x', 'y', 'width', 'height']) {
            expect(Math.abs(previous[key][dimension] - boxes[key][dimension])).toBeLessThan(1);
          }
        }
      }
      if ([393, 720, 1280].includes(width)) await info.attach(`series-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    }
    await page.setViewportSize({ width: 393, height: 850 });
    await page.locator('#pinButton').focus();
    await expect(page.locator('#pinButton')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#pinButton')).toContainText('Pinned');
    // Re-rendering the hero for a saved preference retains the same compact layout.
    expect(Math.abs((await layout(page)).actions.x - (await layout(page)).cover.x)).toBeLessThan(1);
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-book-id', bookId);
    await expect(page.locator('.tag-row a').first()).toHaveAttribute('href', `${adult ? '/nsfw.html' : '/'}?genre=Action`);
    expect(errors).toEqual([]);
  });
}

test('long metadata, missing cover and optional audio action fit a narrow series header', async ({ page }, info) => {
  const errors = await openSeries(page, false, {
    title: 'An unusually long series title that still needs a readable reading action on a narrow screen',
    author: 'AnAuthorNameWithoutAnyBreaksToCheckNarrowLayouts', cover: '',
    audioAlignedUrl: 'https://example.test/audio',
    volumes: [{ bookId, file: bookId, number: 1, title: 'Volume 1' }]
  });
  for (const width of [320, 393, 720]) {
    await page.setViewportSize({ width, height: 850 });
    const boxes = await layout(page);
    expect(boxes.overflow).toBe(false);
    // The full title is already the page heading; its cover placeholder must
    // retain the book's proportions rather than growing to fit a second copy.
    expect(Math.abs(boxes.cover.height - boxes.cover.width * 1.5)).toBeLessThan(1);
    expect(Math.abs(boxes.actions.x - boxes.hero.x)).toBeLessThan(1);
    expect(boxes.actions.y).toBeGreaterThanOrEqual(Math.max(boxes.cover.bottom, boxes.heading.bottom));
    expect(boxes.controls.every(control => control.x >= boxes.hero.x - 1 && control.right <= boxes.hero.right + 1)).toBe(true);
  }
  await expect(page.getByRole('link', { name: 'Audio EPUBs' })).toBeVisible();
  await info.attach('long-title-no-cover', {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
  });
  expect(errors).toEqual([]);
});
