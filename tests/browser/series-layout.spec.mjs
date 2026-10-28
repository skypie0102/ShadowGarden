import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Exact served v2.19.1 owner: reproduces the reported gap below short metadata.
const previousCss = readFileSync(new URL('./fixtures/series-extra-2.19.1.css', import.meta.url), 'utf8');
if (createHash('sha256').update(previousCss).digest('hex') !== 'ff107b173c1d673b3f1d7fd9f428ae0f67a556198014ce15250995a540f00b62') {
  throw Error('Damaged v2.19.1 Series layout control.');
}
const candidateCss = readFileSync(new URL('../../public/assets/css/series-extra.css', import.meta.url), 'utf8');
const staleVolumeCss = readFileSync(new URL('./fixtures/series-extra-2.28.1.css', import.meta.url), 'utf8');
if (createHash('sha256').update(staleVolumeCss).digest('hex') !== '5979baf913c68193a2148f5a4ef627e01041d67118293607d46ff61b775949d6') throw Error('Damaged v2.28.1 Series cache control.');
const volumeCssVersion = createHash('sha256').update(candidateCss).digest('hex').slice(0, 12);

const bookId = 'bk_A2yCOKedG1g4xXTJJhbEzA';
const cover = '/test/series-layout-cover.svg';
const item = {
  id: 'series-layout', title: 'The Villainess Malfoy', author: 'Gosokdoru', year: 2026,
  status: 'Ongoing', translations: [],
  genres: ['Fantasy', 'Gender Bender', 'Romance'], tags: ['Fanfic', 'Magic', 'Ongoing'],
  description: 'A disposable series synopsis. The volume list should follow the compact series header.',
  cover, volumes: [{ bookId, file: bookId, number: 1, title: 'Volume 1', cover }]
};

async function openSeries(page, adult, overrides = {}, reducedMotion = 'reduce') {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion });
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

async function previousLayout(page, inspect, css = previousCss) {
  await page.evaluate(css => {
    const current = document.querySelector('link[href*="/series-extra.css"], style[data-series-layout-css]');
    const style = document.createElement('style');
    style.dataset.seriesLayoutCss = 'true'; style.textContent = css;
    current.replaceWith(style);
  }, css);
  try { return await inspect(); }
  finally {
    // Re-enabling a disabled link can apply its rules on a later frame. Restore
    // the exact served candidate text in the same slot before reading geometry.
    await page.evaluate(css => {
      document.querySelector('style[data-series-layout-css]').textContent = css;
    }, candidateCss);
  }
}

function expectActionsBesideCover(boxes) {
  expect(Math.abs(boxes.actions.x - boxes.heading.x)).toBeLessThan(1);
  expect(boxes.actions.x).toBeGreaterThanOrEqual(boxes.cover.right + 16);
  expect(boxes.actions.y - boxes.heading.bottom).toBeGreaterThanOrEqual(17);
  expect(boxes.actions.y - boxes.heading.bottom).toBeLessThanOrEqual(20);
  expect(boxes.tags.y).toBeGreaterThanOrEqual(Math.max(boxes.cover.bottom, boxes.actions.bottom) + 17);
  expect(Math.abs(boxes.tags.x - boxes.cover.x)).toBeLessThan(1);
  for (const control of boxes.controls) {
    expect(control.x).toBeGreaterThanOrEqual(boxes.actions.x - 1);
    expect(control.right).toBeLessThanOrEqual(boxes.actions.right + 1);
  }
}

for (const adult of [false, true]) {
  test(`${adult ? 'Adult' : 'Main'} larger cover stays beside details and reading/pinning actions, with tags below`, async ({ page }, info) => {
    const errors = await openSeries(page, adult, adult ? {
      title: 'Adolescent Adam', author: 'Sakaki Kasa (さかき傘)', translations: [{ name: 'js06' }]
    } : {});
    await expect(page.getByRole('link', { name: /Browse volumes|Find Volume/ })).toHaveCount(0);
    await expect(page.locator('#synopsisToggle')).toHaveCount(0);
    for (const width of [320, 393, 461, 720, 721, 980, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      const boxes = await layout(page);
      expect(boxes.overflow).toBe(false);
      expect(boxes.headingTextX).toBeGreaterThanOrEqual(boxes.cover.right + 16);
      expect(Math.abs(boxes.cover.height - boxes.cover.width * 1.5)).toBeLessThan(1);
      for (const control of boxes.controls) {
        expect(control.x).toBeGreaterThanOrEqual(boxes.hero.x - 1);
        expect(control.right).toBeLessThanOrEqual(boxes.hero.right + 1);
        expect(control.height).toBeGreaterThanOrEqual(44);
      }
      if (width <= 720) {
        expect(boxes.cover.width).toBeGreaterThanOrEqual(124);
        expect(boxes.cover.width).toBeLessThanOrEqual(171);
        expectActionsBesideCover(boxes);
        if (width >= 393) expect(boxes.actions.y).toBeLessThan(boxes.cover.bottom);
      }
      if ([320, 393, 720, 1280].includes(width)) await info.attach(`series-${width}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
      });
    }
    await page.setViewportSize({ width: 393, height: 850 });
    const pin = page.locator('#pinButton');
    await expect(pin).toHaveText('');
    const icon = pin.locator('svg');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    const unpinnedColor = await pin.evaluate(button => getComputedStyle(button).color);
    await expect(icon).toHaveCSS('stroke', unpinnedColor);
    await expect(pin).toHaveAccessibleName('Pin to Garden');
    await expect(pin).toHaveAttribute('aria-pressed', 'false');
    const pinBox = await pin.boundingBox();
    expect(pinBox.width).toBe(44);
    expect(pinBox.height).toBeGreaterThanOrEqual(44);
    await pin.focus();
    await expect(pin).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(pin).toHaveText('');
    await expect(pin).toHaveAccessibleName('Unpin from Garden');
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await expect(pin).toHaveClass(/pinned/);
    const accent = adult ? 'rgb(214, 160, 173)' : 'rgb(195, 180, 238)';
    await expect(pin).toHaveCSS('color', accent);
    await expect(icon).toHaveCSS('stroke', accent);
    expect(unpinnedColor).not.toBe(accent);
    // Re-rendering the hero for a saved preference retains the same compact layout.
    const pinnedLayout = await layout(page);
    expectActionsBesideCover(pinnedLayout);
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-book-id', bookId);
    await expect(page.locator('.tag-row a').first()).toHaveAttribute('href', `${adult ? '/nsfw.html' : '/'}?genre=Fantasy`);
    await page.evaluate(identity => localStorage.setItem(`sg-progress:${identity}`,
      JSON.stringify({ percentage: 0.42, page: 12, updatedAt: Date.now() })), bookId);
    await page.reload();
    await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
    await expect(pin).toHaveAccessibleName('Unpin from Garden');
    await expect(pin).toHaveAttribute('aria-pressed', 'true');
    await expect(icon).toHaveCSS('stroke', accent);
    await expect(page.locator('.series-actions [data-volume-action]')).toHaveAttribute('data-volume-state', 'in-progress');
    const savedLayout = await layout(page);
    expectActionsBesideCover(savedLayout);
    expect(savedLayout.overflow).toBe(false);
    await info.attach('saved-progress-series', {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
    });
    await pin.click();
    await expect(pin).toHaveText('');
    await expect(pin).toHaveAccessibleName('Pin to Garden');
    await expect(pin).toHaveAttribute('aria-pressed', 'false');
    await expect(pin).not.toHaveClass(/pinned/);
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
    expectActionsBesideCover(boxes);
    expect(boxes.controls.every(control => control.x >= boxes.hero.x - 1 && control.right <= boxes.hero.right + 1)).toBe(true);
  }
  await expect(page.getByRole('link', { name: 'Audio EPUBs' })).toBeVisible();
  await info.attach('long-title-no-cover', {
    body: await page.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png'
  });
  expect(errors).toEqual([]);
});

const pre80Css = readFileSync(new URL('./fixtures/series-extra-pre-80.css', import.meta.url), 'utf8');
if (createHash('sha256').update(pre80Css).digest('hex') !== '45723b1d0eb74457f5a2d3a08dedc10d5a434d1ded367dc7e8ff581b6040ef59') throw Error('Damaged pre-80 Series layout control.');

for (const adult of [false, true]) test(`${adult ? 'Adult' : 'Main'} volume controls match the exact pre-80 styling and card arrangement`, async ({ page }, info) => {
  await page.setViewportSize({ width: 393, height: 850 });
  let staleRequests = 0;
  let staleScriptRequests = 0;
  for (const url of ['**/assets/js/series.js?v=2.11.0', '**/assets/js/series.js?v=2.28.4', '**/assets/js/series.js?v=2.28.5', '**/assets/js/series.js?v=2.29.2', '**/assets/js/series-renderers.js', '**/assets/js/series-renderers.js?v=2.28.4', '**/assets/js/series-renderers.js?v=2.28.5', '**/assets/js/series-renderers.js?v=2.29.2']) await page.route(url, route => {
    staleScriptRequests++;
    return route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("Stale Series renderer requested");' });
  });
  await page.route('**/assets/css/series-extra.css?v=2.11.0', route => {
    staleRequests++;
    return route.fulfill({ contentType: 'text/css', body: staleVolumeCss });
  });
  const errors = await openSeries(page, adult, { title: 'Adolescent Adam', volumes: [{ ...item.volumes[0], title: 'Adolescent Adam, Volume 1', date: '2026-08-19', size: 5000000 }] }, 'no-preference');
  const card = page.locator('.volume-card'), read = card.locator('a.read'), download = card.locator('a.download');
  await expect(page.locator('link[href*="/series-extra.css"]')).toHaveAttribute('href', `/assets/css/series-extra.css?v=${volumeCssVersion}`);
  expect(staleRequests).toBe(0);
  expect(staleScriptRequests).toBe(0);
  await expect(read).toHaveText('Read');
  const inspect = async () => {
    await card.scrollIntoViewIfNeeded();
    return card.evaluate(async card => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const styles = (element, properties) => Object.fromEntries(properties.map(name => [name, getComputedStyle(element)[name]]));
      const properties = ['display', 'flexGrow', 'flexBasis', 'minHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'fontWeight', 'lineHeight', 'whiteSpace', 'color', 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderTopStyle', 'borderRadius', 'textDecorationLine'];
      return {
        columns: getComputedStyle(card.parentElement).gridTemplateColumns,
        actions: styles(card.querySelector('.volume-actions'), ['display', 'flexWrap', 'alignItems', 'gap', 'paddingTop']),
        buttons: [...card.querySelectorAll('.volume-actions a')].map(element => {
          const box = element.getBoundingClientRect();
          return { text: element.textContent, styles: styles(element, properties), width: box.width, height: box.height };
        })
      };
    });
  };
  for (const width of [320, 393, 576, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const restored = await inspect();
    const original = await previousLayout(page, inspect, pre80Css);
    expect(restored.columns).toBe(original.columns);
    expect(restored.actions).toEqual(original.actions);
    for (const [index, button] of restored.buttons.entries()) {
      expect(button.text).toBe(original.buttons[index].text);
      expect(button.styles).toEqual(original.buttons[index].styles);
      expect(button.width).toBeCloseTo(original.buttons[index].width, 1);
      expect(button.height).toBeCloseTo(original.buttons[index].height, 1);
    }
    await card.scrollIntoViewIfNeeded();
    if ([320, 393, 1280].includes(width)) await info.attach(`restored-pre80-${width}`, { body: await card.screenshot(), contentType: 'image/png' });
  }
  for (const button of [read, download]) {
    await button.focus(); await expect(button).toBeFocused();
  }
  await expect(read).toHaveAttribute('href', new RegExp(`/reader.html\\?book=${bookId}`));
  await expect(download).toHaveAccessibleName('Download EPUB');
  expect(errors).toEqual([]);
});

const oldPreferenceExports = readFileSync(new URL('../../public/assets/js/domain/preferences.js', import.meta.url), 'utf8')
  .replace(/export function (seriesViewKey|seriesView|setSeriesView)\(/g, 'function $1(');
for (const adult of [false, true]) test(`${adult ? 'Adult' : 'Main'} Grid and List retain order, reading state and their own saved choice`, async ({ page, context }, info) => {
  const ownKey = `sg-view:series:${adult ? 'nsfw' : 'main'}`, otherKey = `sg-view:series:${adult ? 'main' : 'nsfw'}`;
  // An older cached shared module lacks the new Series API. The Series page
  // must request its versioned preferences module while keeping Library intact.
  await page.route('**/assets/js/domain/preferences.js', route => route.fulfill({ contentType: 'application/javascript', body: oldPreferenceExports }));
  await page.addInitScript(({ ownKey, otherKey, bookId }) => {
    if (sessionStorage.getItem('series-view-seeded')) return;
    sessionStorage.setItem('series-view-seeded', '1');
    localStorage.setItem('sg-view:main', 'compact'); localStorage.setItem('sg-view:nsfw', 'compact');
    localStorage.setItem(otherKey, 'list');
    localStorage.setItem(`sg-progress:${bookId}`, '{"page":12,"percentage":0.42,"updatedAt":20}');
    localStorage.setItem(`sg-bookmarks:${bookId}`, '[{"cfi":"preserved-bookmark"}]');
  }, { ownKey, otherKey, bookId });
  const volumes = [1, 2, 3].map((number, index) => { const file = index ? `bk_${String(number).padStart(22, 'A')}` : bookId; return { ...item.volumes[0], number, file, bookId: file, title: `Original volume ${number}` }; });
  const errors = await openSeries(page, adult, { volumes, description: 'The full original synopsis remains visible. '.repeat(20) });
  const group = page.getByRole('group', { name: 'Volume view' }), grid = group.getByRole('button', { name: 'Grid', exact: true }), list = group.getByRole('button', { name: 'List', exact: true });
  const protectedRecords = () => page.evaluate(key => Object.fromEntries(Object.entries(localStorage).filter(([name]) => name !== key)), ownKey);
  const before = await protectedRecords();
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  await expect(list).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('link', { name: /Browse volumes|Find Volume/ })).toHaveCount(0);
  await expect(page.locator('#synopsisToggle')).toHaveCount(0);
  await expect(page.locator('.series-description')).toHaveCSS('max-height', 'none');
  expect(await page.evaluate(async () => typeof (await import('/assets/js/domain/index.js')).preferences.seriesView)).toBe('undefined');
  const readHrefs = await page.locator('.volume-actions a.read').evaluateAll(links => links.map(link => link.getAttribute('href')));
  for (const width of [320, 393, 768, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await list.focus(); await page.keyboard.press('Space'); await expect(list).toBeFocused();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.volume-grid')).toHaveClass(/volume-list/);
    expect(await page.locator('.volume-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
    expect(await page.locator('.volume-card').evaluateAll(cards => cards.map(card => Number(card.dataset.volumeIndex)))).toEqual([0, 1, 2]);
    expect(await page.locator('.volume-actions a.read').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(readHrefs);
    await expect(page.locator('.volume-actions a.read').first()).toHaveText('Continue');
    await expect(page.locator('.volume-actions a.read').nth(1)).toHaveText('Read');
    if ([393, 1280].includes(width)) await info.attach(`series-list-${width}`, { body: await page.locator('.volume-grid').screenshot(), contentType: 'image/png' });
    await grid.focus(); await page.keyboard.press('Enter'); await expect(grid).toBeFocused();
    await expect(grid).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.volume-grid')).not.toHaveClass(/volume-list/);
    expect(await page.locator('.volume-grid').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBeGreaterThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(await protectedRecords()).toEqual(before);
  await list.click(); await page.reload(); await expect(page.locator('#seriesRoot')).toHaveAttribute('aria-busy', 'false');
  await expect(list).toHaveAttribute('aria-pressed', 'true');
  const writer = await context.newPage();
  try {
    await writer.goto('/404.html');
    await writer.evaluate(key => localStorage.setItem(key, 'grid'), ownKey);
    await expect(grid).toHaveAttribute('aria-pressed', 'true');
    await writer.evaluate(key => localStorage.setItem(key, 'list'), ownKey);
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await writer.evaluate(book => localStorage.setItem(`sg-progress:${book}`, '{"page":13,"percentage":0.5,"updatedAt":30}'), bookId);
    await expect(page.locator('.series-reading-context')).toContainText('Saved page 13');
    await expect(list).toHaveAttribute('aria-pressed', 'true');
  } finally { await writer.close(); }
  expect(await page.evaluate(key => localStorage.getItem(key), otherKey)).toBe('list');
  expect(await page.evaluate(() => localStorage.getItem('sg-view:main'))).toBe('compact');
  expect(await page.evaluate(() => localStorage.getItem('sg-view:nsfw'))).toBe('compact');
  expect(errors).toEqual([]);
});
