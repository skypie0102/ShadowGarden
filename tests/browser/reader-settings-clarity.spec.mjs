import { test, expect } from '@playwright/test';
import { installReaderFixture, createReaderZip, readerBookId, readerSeriesId, readerTitle } from './reader-production-fixture.mjs';

test.setTimeout(90000);
const settingsKey = 'sg-reader-settings';
const defaults = { theme: 'garden', font: 'default', alignment: 'default', fontSize: 100, lineHeight: 1.6, width: 760, flow: 'paginated', swipeTurns: true };

async function settingsPublication() {
  const zip = await createReaderZip(), sections = [0, 1, 2, 3, 4];
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('book.opf', `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">settings-prose-fixture</dc:identifier><dc:title>${readerTitle}</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-27T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/>${sections.map(i => `<item id="c${i}" href="chapter${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${sections.map(i => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  zip.file('nav.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>${sections.map(i => `<li><a href="chapter${i}.xhtml">Chapter ${i}</a></li>`).join('')}</ol></nav></body></html>`);
  for (const i of sections) zip.file(`chapter${i}.xhtml`, `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${i}</title></head><body><h1 id="target-${i}">Chapter ${i}</h1>${Array.from({ length: 8 }, (_, p) => `<p id="passage-${i}-${p}">Chapter ${i}, passage ${p}. Original prose checks the saved reading section while typography and reading mode change. These settings apply to this browser's books without clearing bookmarks or separate choices.</p>`).join('')}</body></html>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function open(page, adult, saved = defaults) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // These cases exercise settings rather than external font delivery.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await installReaderFixture(page, { flow: saved.flow, publication: await settingsPublication() });
  await page.addInitScript(({ saved, settingsKey }) => {
    localStorage.setItem('sg-adult-ack', '1');
    if (sessionStorage.getItem('settings-fixture-seeded')) return;
    sessionStorage.setItem('settings-fixture-seeded', '1');
    localStorage.setItem(settingsKey, JSON.stringify(saved));
    localStorage.setItem('sg-reader-speech-settings', '{"voice":"en-US-BrianMultilingualNeural","speed":1.5,"follow":false}');
    localStorage.setItem('sg-finished-books', '{"unrelated-finished-volume":123}');
  }, { saved, settingsKey });
  const id = adult ? 'adult-reader-settings-fixture' : readerSeriesId;
  for (const scope of [false, true]) await page.route(
    `**/media/shadow-garden/data/${scope ? 'adult-catalog' : 'catalog'}.json`,
    route => route.fulfill({ json: { series: scope === adult ? [{ id, title: readerTitle, nsfw: adult,
      volumes: [{ file: readerBookId, bookId: readerBookId, number: 1, title: readerTitle }] }] : [] } })
  );
  await page.goto(`/reader.html?book=${readerBookId}&series=${id}&scope=${adult ? 'adult' : 'main'}`);
  await expect(page.locator('#readerLoading')).toBeHidden({ timeout: 60000 });
  await expect(page.locator('body')).toHaveClass(adult ? /adult-reader/ : /reader-theme-/);
  return errors;
}

async function settings(page) {
  await page.locator('#settingsToggle').focus(); await page.locator('#settingsToggle').click();
  await expect(page.locator('#settingsDrawer')).toHaveAttribute('aria-hidden', 'false');
  return page.locator('#settingsDrawer');
}

async function fit(drawer) {
  await expect(async () => expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)).toPass({ timeout: 5000 });
}

async function settledFlow(page, flow) {
  // Settings update before the asynchronous rendition replacement is complete.
  // Check location and reload only after the requested mode has settled.
  await expect.poll(() => page.evaluate(async flow => {
    const bootstrap = document.querySelector('script[type="module"][src*="/reader-bootstrap.js"]').src;
    const reader = (await import(bootstrap)).readerRuntime.current;
    return Boolean(reader?.state.rendition && !reader.state.switchingFlow && reader.state.renderedFlow === flow);
  }, flow), { timeout: 45000 }).toBe(true);
}

async function visibleReadingTarget(page) {
  // Reflow can show adjacent chapters or move a heading above the viewport.
  // Check visible text in the saved section rather than the chapter label.
  await expect.poll(() => page.evaluate(() => {
    const viewport = document.getElementById('viewer').getBoundingClientRect();
    return [...document.querySelectorAll('#viewer iframe')].some(frame => {
      const targets = frame.contentDocument?.querySelectorAll('#target-2, [id^="passage-2-"]') || [];
      return [...targets].some(target => {
        const box = target.getBoundingClientRect(), outer = frame.getBoundingClientRect();
        const left = Math.max(outer.left + box.left, viewport.left), right = Math.min(outer.left + box.right, viewport.right);
        const top = Math.max(outer.top + box.top, viewport.top), bottom = Math.min(outer.top + box.bottom, viewport.bottom);
        if (right <= left || bottom <= top) return false;
        return document.elementFromPoint((left + right) / 2, (top + bottom) / 2) === frame;
      });
    });
  }), { timeout: 15000 }).toBe(true);
}

for (const adult of [false, true]) {
  const scope = adult ? 'Adult' : 'Main';
  test(`${scope} groups current settings and explains immediate changes and device defaults across themes`, async ({ page }, info) => {
    const errors = await open(page, adult);
    const drawer = await settings(page);
    await info.attach('settings-before-review', { body: await page.screenshot(), contentType: 'image/png' });
    await expect(drawer.locator('fieldset legend')).toHaveText(['Reading mode', 'Typography', 'Layout', 'Appearance']);
    await expect(drawer.getByRole('group', { name: 'Typography', exact: true }).getByRole('combobox', { name: 'Typeface', exact: true })).toHaveValue('default');
    await expect(drawer.locator('.reader-settings-intro')).toContainText('apply immediately');
    await expect(drawer.locator('.reader-settings-intro')).toContainText('all books in this browser');
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 850 }); await fit(drawer);
      const flow = await page.evaluate(async () => (await import('/assets/js/reader/settings.js')).readerDefaults().flow);
      await expect(drawer.locator('#resetReaderDescription')).toContainText(flow === 'paginated' ? 'Pages' : 'Continuous scroll');
      await drawer.evaluate(element => { element.scrollTop = 0; });
      if (width !== 768) await info.attach(`settings-top-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
      const reset = drawer.getByRole('button', { name: 'Reset reader settings' });
      await reset.scrollIntoViewIfNeeded();
      await expect(reset).toHaveAttribute('aria-describedby', 'resetReaderDescription');
      await expect(reset).toHaveAccessibleDescription(/reading position, bookmarks and Read aloud choices are kept/);
      expect((await reset.boundingBox()).height).toBeGreaterThanOrEqual(44);
      if (width !== 768) await info.attach(`settings-reset-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    for (const theme of ['paper', 'night', 'black', 'garden']) {
      await drawer.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
      await expect(page.locator('body')).toHaveClass(new RegExp(`reader-theme-${theme}`)); await fit(drawer);
      if (theme === 'paper') await info.attach('settings-paper', { body: await page.screenshot(), contentType: 'image/png' });
    }
    await drawer.getByRole('button', { name: 'Close reading settings' }).focus(); await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#settingsToggle')).toBeFocused();
    expect(errors).toEqual([]);
  });

  test(`${scope} explains flow-specific controls and retains their choices across changes and reload`, async ({ page }) => {
    const errors = await open(page, adult, { ...defaults, flow: 'scrolled-doc', swipeTurns: false });
    const drawer = await settings(page), swipe = drawer.locator('#swipeTurnsToggle');
    await expect(swipe).toBeDisabled(); await expect(swipe).not.toBeChecked();
    await expect(drawer.locator('#textWidthSetting')).toBeVisible();
    await expect(drawer.locator('#widthRange')).toHaveAccessibleDescription(/prose.*illustrations/i);
    await expect(drawer.getByRole('slider', { name: 'Font size', exact: true })).toHaveValue('100');
    await expect(drawer.getByRole('slider', { name: 'Line height', exact: true })).toHaveValue('1.6');
    await drawer.locator('#fontSizeRange').fill('125');
    await drawer.locator('#lineHeightRange').fill('1.8');
    await drawer.locator('#widthRange').fill('900');
    await expect(drawer.locator('#fontSizeValue')).toHaveText('125%');
    await expect(drawer.locator('#fontSizeRange')).toHaveAttribute('aria-valuetext', '125 percent');
    await expect(drawer.locator('#lineHeightRange')).toHaveAttribute('aria-valuetext', '1.8 times text size');
    await expect(drawer.locator('#widthRange')).toHaveAttribute('aria-valuetext', '900 pixels');
    await drawer.locator('#flowSelect').selectOption('paginated');
    await settledFlow(page, 'paginated');
    await expect(page.locator('body')).toHaveClass(/reader-flow-paginated/);
    await expect(drawer.locator('#textWidthSetting')).toBeHidden(); await expect(swipe).toBeEnabled();
    await expect(swipe).not.toBeChecked();
    await swipe.check();
    await drawer.locator('#flowSelect').selectOption('scrolled-doc');
    await settledFlow(page, 'scrolled-doc');
    await expect(swipe).toBeDisabled(); await expect(swipe).toBeChecked();
    await expect(drawer.locator('#widthRange')).toHaveValue('900');
    await page.reload(); await expect(page.locator('#readerLoading')).toBeHidden({ timeout: 60000 });
    await settings(page);
    await expect(drawer.locator('#fontSizeRange')).toHaveValue('125');
    await expect(drawer.locator('#lineHeightRange')).toHaveValue('1.8');
    await expect(drawer.locator('#widthRange')).toHaveValue('900');
    await expect(swipe).toBeDisabled(); await expect(swipe).toBeChecked();
    expect(errors).toEqual([]);
  });

  test(`${scope} reset matches its explanation and retains its reading section and separate saved choices`, async ({ page }, info) => {
    const mobile = info.project.name.startsWith('mobile');
    const errors = await open(page, adult, { ...defaults, flow: mobile ? 'paginated' : 'scrolled-doc', theme: 'paper', font: 'inter', alignment: 'right', fontSize: 125, lineHeight: 1.8, width: 900, swipeTurns: false });
    await page.locator('#tocToggle').focus(); await page.locator('#tocToggle').click();
    await page.locator('#tocPanel [data-href="chapter2.xhtml"]').click();
    await visibleReadingTarget(page);
    await expect(page.locator('#viewer')).not.toHaveAttribute('aria-busy', 'true');
    await page.locator('#bookmarkButton').focus(); await page.locator('#bookmarkButton').click();
    await expect(page.locator('#bookmarkButton')).toHaveAttribute('aria-pressed', 'true');
    const protectedState = () => page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('sg-bookmarks:') || ['sg-finished-books', 'sg-reader-speech-settings'].includes(key))));
    const before = await protectedState();
    const drawer = await settings(page);
    const deviceDefaults = await page.evaluate(async () => (await import('/assets/js/reader/settings.js')).readerDefaults());
    await expect(drawer.locator('#resetReaderDescription')).toContainText(deviceDefaults.flow === 'paginated' ? 'Pages' : 'Continuous scroll');
    await drawer.locator('#resetReader').scrollIntoViewIfNeeded();
    await drawer.locator('#resetReader').focus(); await expect(drawer.locator('#resetReader')).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), settingsKey)).toEqual(deviceDefaults);
    await settledFlow(page, deviceDefaults.flow);
    await expect(drawer.locator('#themeSelect')).toHaveValue('garden');
    await expect(drawer.locator('#fontSizeValue')).toHaveText('100%');
    await expect(drawer.locator('#alignmentSelect')).toHaveValue('default');
    await drawer.getByRole('button', { name: 'Close reading settings' }).click();
    await visibleReadingTarget(page);
    await expect.poll(() => page.evaluate(book => Boolean(JSON.parse(localStorage.getItem(`sg-progress:${book}`))?.cfi), readerBookId)).toBe(true);
    expect(await protectedState()).toEqual(before);
    await page.reload(); await expect(page.locator('#readerLoading')).toBeHidden({ timeout: 60000 });
    await visibleReadingTarget(page);
    expect(await protectedState()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
