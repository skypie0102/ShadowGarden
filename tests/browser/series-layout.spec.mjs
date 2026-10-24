import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Exact served v2.19.1 owner: reproduces the reported gap below short metadata.
const previousCss = readFileSync(new URL('./fixtures/series-extra-2.19.1.css', import.meta.url), 'utf8');
if (createHash('sha256').update(previousCss).digest('hex') !== 'ff107b173c1d673b3f1d7fd9f428ae0f67a556198014ce15250995a540f00b62') {
  throw Error('Damaged v2.19.1 Series layout control.');
}
const candidateCss = readFileSync(new URL('../../public/assets/css/series-extra.css', import.meta.url), 'utf8');

const bookId = 'bk_A2yCOKedG1g4xXTJJhbEzA';
const cover = '/test/series-layout-cover.svg';
const item = {
  id: 'series-layout', title: 'The Villainess Malfoy', author: 'Gosokdoru', year: 2026,
  status: 'Ongoing', translations: [],
  genres: ['Fantasy', 'Gender Bender', 'Romance'], tags: ['Fanfic', 'Magic', 'Ongoing'],
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
    const headingRange = document.createRange();
    headingRange.selectNodeContents(document.querySelector('.series-heading h1'));
    return {
      hero: rect('.series-hero-inner'), cover: rect('.series-cover, .series-cover-fallback'),
      heading: rect('.series-heading'), actions: rect('.series-actions'), tags: rect('.tag-row'),
      metadata: rect(document.querySelector('.series-translator-summary') ? '.series-translator-summary' : '.series-byline'),
      headingTextX: headingRange.getClientRects()[0].x,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      controls: [...document.querySelectorAll('.series-actions > *')].map(el => {
        const { x, y, right, bottom, height } = el.getBoundingClientRect(); return { x, y, right, bottom, height };
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
    const errors = await openSeries(page, adult, adult ? {
      title: 'Adolescent Adam', author: 'Sakaki Kasa (さかき傘)',
      translations: [{ name: 'js06' }]
    } : {});
    await page.setViewportSize({ width: 393, height: 850 });
    await previousLayout(page, async () => {
      const before = await layout(page);
      expect(before.controls[0].y - before.metadata.bottom).toBeGreaterThan(30);
      await info.attach('previous-mobile-series', {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    });
    for (const width of [393, 349, 461, 720, 721, 980, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      const boxes = await layout(page);
      expect(boxes.overflow).toBe(false);
      for (const control of boxes.controls) {
        expect(control.x).toBeGreaterThanOrEqual(boxes.hero.x - 1);
        expect(control.right).toBeLessThanOrEqual(boxes.hero.right + 1);
        expect(control.height).toBeGreaterThanOrEqual(42);
      }
      if (width <= 720) {
        // Controls must follow the metadata, even when it is shorter than the cover.
        const gap = boxes.controls[0].y - boxes.metadata.bottom;
        expect(gap).toBeGreaterThanOrEqual(8);
        expect(gap).toBeLessThanOrEqual(20);
        expect(boxes.headingTextX).toBeGreaterThanOrEqual(boxes.cover.right + 16);
        expect(Math.abs(boxes.tags.x - boxes.cover.x)).toBeLessThan(1);
        expect(boxes.tags.y).toBeGreaterThanOrEqual(Math.max(boxes.cover.bottom, ...boxes.controls.map(c => c.bottom)));
        expect(boxes.tags.y - Math.max(boxes.cover.bottom, ...boxes.controls.map(c => c.bottom))).toBeLessThanOrEqual(24);
        expect(boxes.controls.every(control => control.height >= 44)).toBe(true);
      } else {
        expect(boxes.cover.x).toBeLessThan(boxes.heading.x);
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
    const pinnedLayout = await layout(page);
    expect(pinnedLayout.controls[0].y - pinnedLayout.metadata.bottom).toBeLessThanOrEqual(20);
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-book-id', bookId);
    await expect(page.locator('.tag-row a').first()).toHaveAttribute('href', `${adult ? '/nsfw.html' : '/'}?genre=Fantasy`);
    await page.evaluate(identity => localStorage.setItem(`sg-progress:${identity}`,
      JSON.stringify({ percentage: 0.42, page: 12, updatedAt: Date.now() })), bookId);
    await page.reload();
    await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-volume-state', 'in_progress');
    const savedLayout = await layout(page);
    expect(savedLayout.controls[0].y - savedLayout.metadata.bottom).toBeLessThanOrEqual(20);
    expect(savedLayout.overflow).toBe(false);
    await info.attach('saved-progress-series', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
    });
    expect(errors).toEqual([]);
  });
}

test('long metadata, missing cover and optional audio action fit a narrow series header', async ({ page }, info) => {
  const errors = await openSeries(page, false, {
    title: 'An unusually long series title that still needs a readable reading action on a narrow screen',
    author: 'AnAuthorNameWithoutAnyBreaksToCheckNarrowLayouts', cover: '',
    translations: [{ name: 'A fan translator with a longer credit' }],
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
    expect(boxes.controls[0].y - boxes.metadata.bottom).toBeLessThanOrEqual(20);
    expect(boxes.controls[0].y).toBeGreaterThanOrEqual(boxes.metadata.bottom);
    expect(boxes.controls.every(control => control.x >= boxes.hero.x - 1 && control.right <= boxes.hero.right + 1)).toBe(true);
  }
  await expect(page.getByRole('link', { name: 'Audio EPUBs' })).toBeVisible();
  await info.attach('long-title-no-cover', {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
  });
  expect(errors).toEqual([]);
});
