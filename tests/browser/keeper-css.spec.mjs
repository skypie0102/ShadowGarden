import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { installKeeper, series, openVolume, draft } from './keeper-volume-fixture.mjs';
import { createReaderEpub } from './reader-production-fixture.mjs';

test.setTimeout(180000);
const baseline = JSON.parse(readFileSync(new URL('./fixtures/keeper-css-2.18.11.json', import.meta.url)));
const sha = value => createHash('sha256').update(value).digest('hex');
for (const file of baseline.files) {
  if (sha(file.css) !== file.sha256 || /url\s*\(|@import\b/i.test(file.css))
    throw Error('The dated CSS comparison fixture is damaged or needs URL rebasing.');
}
const candidate = baseline.files.map(file => ({ path: file.path,
  css: readFileSync(new URL('../../public' + file.path, import.meta.url), 'utf8') }));
const properties = ['display', 'position', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'box-sizing', 'color', 'background-color', 'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-radius', 'margin', 'padding', 'gap', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'align-items', 'align-self', 'justify-content',
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-align', 'white-space',
  'overflow-x', 'overflow-y', 'box-shadow', 'opacity', 'visibility', 'transform', 'outline', 'z-index'];

async function prepare(page) {
  await page.addInitScript(() => {
    window.keeperCssReveal = Promise.resolve();
    window.addEventListener('pagereveal', event => {
      window.keeperCssReveal = event.viewTransition?.finished.catch(() => {}) || Promise.resolve();
    });
  });
  await page.route('**/data/version.json*', route => route.fulfill({ json: {
    name: 'Shadow Garden', version: '2.18.11', releaseVersion: '2.18.11',
    commit: '34eade0f2712442144eaaec49b8a088c74c35f07', shortCommit: '34eade0', branch: 'main'
  } }));
  const f = await installKeeper(page, undefined, { ok: true, revision: 5,
    main: [series('a')], adult: [series('b')], counts: { series: 2, volumes: 4 } });
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.management?.revision)).toBe(5);
  // Compare settled frames. Animation contracts remain covered by the normal
  // integration suite and the ordered CSS syntax comparison.
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
  return f;
}

async function replaceStyles(page, files) {
  await page.evaluate(files => {
    for (const file of files) {
      const current = [...document.querySelectorAll('link[rel="stylesheet"],style[data-css-comparison]')]
        .find(node => node.dataset.cssComparison === file.path ||
          (node.tagName === 'LINK' && new URL(node.href).pathname === file.path));
      if (!current) throw Error('Missing active comparison stylesheet: ' + file.path);
      const style = document.createElement('style'); style.dataset.cssComparison = file.path;
      style.textContent = file.css; current.replaceWith(style);
    }
  }, files);
}

async function capture(page) {
  // Scrolling a row beneath the last click can change :hover on the next style
  // recalculation. Keep pointer state identical in every comparison frame.
  await page.mouse.move(0, 0);
  const styles = await page.evaluate(async properties => {
    await window.keeperCssReveal;
    await document.fonts.ready;
    await Promise.allSettled([...document.images].filter(image => image.getClientRects().length)
      .map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const computed = (element, pseudo) => {
      const css = getComputedStyle(element, pseudo);
      return Object.fromEntries(properties.map(property => [property, css.getPropertyValue(property)]));
    };
    const elements = [document.body, ...document.body.querySelectorAll('*')]
      .filter(element => element.getBoundingClientRect().width && element.getBoundingClientRect().height)
      .map((element, index) => {
        const box = element.getBoundingClientRect();
        return { index, tag: element.tagName, id: element.id,
          box: [box.x, box.y, box.width, box.height].map(value => Math.round(value * 1000) / 1000),
          scroll: [element.scrollLeft, element.scrollTop], style: computed(element),
          before: { content: getComputedStyle(element, '::before').content, style: computed(element, '::before') },
          after: { content: getComputedStyle(element, '::after').content, style: computed(element, '::after') } };
      });
    const identity = element => element ? { tag: element.tagName, id: element.id } : null;
    return { viewport: [innerWidth, innerHeight], scroll: [scrollX, scrollY],
      interaction: { focused: identity(document.activeElement), hovered: [...document.querySelectorAll(':hover')].map(identity) },
      elements };
  }, properties);
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
  // Use the browser's public PNG decoder/Canvas API, as in reader color tests.
  // Compare decoded pixels rather than relying on PNG compression metadata.
  const pixels = await page.evaluate(async bytes => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const digest = await crypto.subtle.digest('SHA-256', data);
      return { width: canvas.width, height: canvas.height,
        rgbaSha256: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('') };
    } finally { URL.revokeObjectURL(url); }
  }, Array.from(png));
  return { styles, png, pixels, styleSha256: sha(JSON.stringify(styles)) };
}

async function compare(page, label) {
  const served = await capture(page);
  await replaceStyles(page, baseline.files); const before = await capture(page);
  await replaceStyles(page, candidate); const after = await capture(page);
  await test.info().attach(label + '-baseline', { body: before.png, contentType: 'image/png' });
  await test.info().attach(label + '-candidate', { body: after.png, contentType: 'image/png' });
  await test.info().attach(label + '-comparison', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
    baselineSource: baseline.base, label, served: { pixels: served.pixels, styleSha256: served.styleSha256 },
    baseline: { pixels: before.pixels, styleSha256: before.styleSha256 },
    candidate: { pixels: after.pixels, styleSha256: after.styleSha256 }, renderedElements: after.styles.elements.length
  }, null, 2)) });
  expect(after.styles, label + ': served/reinserted candidate cascade').toEqual(served.styles);
  expect(after.pixels, label + ': served/reinserted candidate pixels').toEqual(served.pixels);
  expect(after.styles, label + ': baseline/candidate computed styles and geometry').toEqual(before.styles);
  expect(after.pixels, label + ': baseline/candidate pixels').toEqual(before.pixels);
}

async function selectBook(page) {
  await page.locator('#epubFile').setInputFiles([{ name: 'css-comparison.epub', mimeType: 'application/epub+zip',
    buffer: await createReaderEpub({ chapterCount: 2, paragraphCount: 2 }) }]);
  await expect.poll(() => page.evaluate(() => {
    const q = window.ShadowGardenKeeper.state.batch;
    return !q.preparing && q.items.length === 1 && q.items[0].metaReady;
  })).toBe(true);
  await expect(page.locator('#metadataCard')).toBeVisible();
}
function noWrites(f) { expect(f.writes).toEqual([]); expect(f.errors).toEqual([]); }

test('Keeper dashboard and lock screen preserve baseline pixels and cascade', async ({ page }) => {
  const f = await prepare(page); await compare(page, 'dashboard');
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('session').instance.lock());
  await expect(page.locator('#lockedView')).toBeVisible(); await compare(page, 'locked'); noWrites(f);
});

test('the expanded series and translation editor preserves baseline pixels and cascade', async ({ page }) => {
  const f = await prepare(page), card = await openVolume(page, 'a'); await draft(page);
  await card.scrollIntoViewIfNeeded(); await compare(page, 'series-editor');
  await expect(page.locator('#saveSeries')).toBeEnabled(); noWrites(f);
});

test('Upload, preflight and the main/adult toggle preserve baseline pixels and cascade', async ({ page }) => {
  const f = await prepare(page); await page.locator('#openNewBooks').click(); await selectBook(page);
  await expect(page.locator('#adultInput')).toHaveCSS('position', 'absolute');
  await expect(page.locator('#adultInput')).toHaveCSS('opacity', '0');
  await expect(page.locator('#adultInput')).toHaveCSS('width', '1px');
  await compare(page, 'upload-main');
  await page.locator('label').filter({ has: page.locator('#adultInput') }).click();
  await expect(page.locator('#adultInput')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.ShadowGardenKeeper.state.batch.items[0].adult)).toBe(true);
  await compare(page, 'upload-adult'); noWrites(f);
});

test('targeted Adult Upload preserves baseline pixels and responsive cascade', async ({ page }) => {
  const f = await prepare(page); await page.locator('[data-manager-add="b"]').click(); await selectBook(page);
  await expect(page.locator('#addSeriesTarget')).toContainText('18+ / Adult Library');
  const initial = page.viewportSize();
  for (const width of [...new Set([initial.width, 349, 600, 761])]) {
    await page.setViewportSize({ width, height: initial.height }); await compare(page, 'target-adult-' + width);
    await expect(page.locator('#adultInput')).toBeChecked();
    await expect(page.locator('#seriesInput')).toHaveAttribute('readonly', '');
  }
  noWrites(f);
});
