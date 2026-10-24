import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const properties = [
  'display',
  'position',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-sizing',
  'color',
  'background-color',
  'background-image',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'margin',
  'padding',
  'gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'align-items',
  'align-self',
  'justify-content',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'white-space',
  'overflow-x',
  'overflow-y',
  'box-shadow',
  'opacity',
  'visibility',
  'transform',
  'outline',
  'z-index',
];

export async function prepareCssComparison(page) {
  await page.addInitScript(() => {
    window.keeperCssReveal = Promise.resolve();
    window.addEventListener('pagereveal', (event) => {
      window.keeperCssReveal = event.viewTransition?.finished.catch(() => {}) || Promise.resolve();
    });
  });
}
export async function settleCssComparison(page) {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
}
export function createCssComparison(baseline) {
  for (const file of baseline.files) {
    if (sha(file.css) !== file.sha256 || /@import\b/i.test(file.css))
      throw Error('Damaged or imported CSS fixture');
    for (const match of file.css.matchAll(/url\(\s*["']?([^"')]+)/g))
      if (!match[1].startsWith('data:') && !match[1].startsWith('/') && !/^https?:/.test(match[1]))
        throw Error('CSS URL needs rebasing');
  }
  const candidate = baseline.files.map((file) => ({
    path: file.path,
    css: readFileSync(new URL('../../public' + file.path, import.meta.url), 'utf8'),
  }));
  async function replaceStyles(page, files) {
    await page.evaluate((files) => {
      for (const file of files) {
        const current = [
          ...document.querySelectorAll('link[rel="stylesheet"],style[data-css-comparison]'),
        ].find(
          (node) =>
            node.dataset.cssComparison === file.path ||
            (node.tagName === 'LINK' && new URL(node.href).pathname === file.path),
        );
        if (!current) continue;
        const style = document.createElement('style');
        style.dataset.cssComparison = file.path;
        style.textContent = file.css;
        current.replaceWith(style);
      }
    }, files);
  }

  async function capture(page) {
    // Scrolling a row beneath the last click can change :hover on the next style
    // recalculation. Keep pointer state identical in every comparison frame.
    await page.mouse.move(0, 0);
    const styles = await page.evaluate(async (properties) => {
      await window.keeperCssReveal;
      await document.fonts.ready;
      await Promise.allSettled(
        [...document.images]
          .filter((image) => image.getClientRects().length)
          .map((image) => image.decode()),
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const computed = (element, pseudo) => {
        const css = getComputedStyle(element, pseudo);
        return Object.fromEntries(
          properties.map((property) => [property, css.getPropertyValue(property)]),
        );
      };
      const elements = [document.body, ...document.body.querySelectorAll('*')]
        .filter(
          (element) =>
            element.getBoundingClientRect().width && element.getBoundingClientRect().height,
        )
        .map((element, index) => {
          const box = element.getBoundingClientRect();
          return {
            index,
            tag: element.tagName,
            id: element.id,
            box: [box.x, box.y, box.width, box.height].map(
              (value) => Math.round(value * 1000) / 1000,
            ),
            scroll: [element.scrollLeft, element.scrollTop],
            style: computed(element),
            before: {
              content: getComputedStyle(element, '::before').content,
              style: computed(element, '::before'),
            },
            after: {
              content: getComputedStyle(element, '::after').content,
              style: computed(element, '::after'),
            },
          };
        });
      const identity = (element) => (element ? { tag: element.tagName, id: element.id } : null);
      return {
        viewport: [innerWidth, innerHeight],
        scroll: [scrollX, scrollY],
        interaction: {
          focused: identity(document.activeElement),
          hovered: [...document.querySelectorAll(':hover')].map(identity),
        },
        elements,
      };
    }, properties);
    const png = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
    // Use the browser's public PNG decoder/Canvas API, as in reader color tests.
    // Compare decoded pixels rather than relying on PNG compression metadata.
    const pixels = await page.evaluate(async (bytes) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const digest = await crypto.subtle.digest('SHA-256', data);
        return {
          width: canvas.width,
          height: canvas.height,
          rgbaSha256: [...new Uint8Array(digest)]
            .map((value) => value.toString(16).padStart(2, '0'))
            .join(''),
        };
      } finally {
        URL.revokeObjectURL(url);
      }
    }, Array.from(png));
    return { styles, png, pixels, styleSha256: sha(JSON.stringify(styles)) };
  }

  return async function compare(page, label) {
    // Garden Pass and the Upload report can add stylesheets after navigation.
    // Compare loaded CSS in every frame rather than racing a pending link.
    await page.waitForFunction(() =>
      [...document.querySelectorAll('link[rel="stylesheet"]')].every(link => link.sheet)
    );
    const activePaths = await page.evaluate(() =>
      [...document.querySelectorAll('link[rel="stylesheet"],style[data-css-comparison]')].map(
        (n) => n.dataset.cssComparison || new URL(n.href).pathname,
      ),
    );
    const activeFiles = baseline.files.filter((f) => activePaths.includes(f.path));
    expect(activeFiles.length, label + ': active comparison stylesheets').toBeGreaterThan(0);
    const served = await capture(page);
    await replaceStyles(page, baseline.files);
    const before = await capture(page);
    await replaceStyles(page, candidate);
    const after = await capture(page);
    await test.info().attach(label + '-baseline', { body: before.png, contentType: 'image/png' });
    await test.info().attach(label + '-candidate', { body: after.png, contentType: 'image/png' });
    await test.info().attach(label + '-comparison', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify(
          {
            baselineSource: baseline.base,
            label,
            activePaths: activeFiles.map((f) => f.path),
            served: { pixels: served.pixels, styleSha256: served.styleSha256 },
            baseline: { pixels: before.pixels, styleSha256: before.styleSha256 },
            candidate: { pixels: after.pixels, styleSha256: after.styleSha256 },
            renderedElements: after.styles.elements.length,
          },
          null,
          2,
        ),
      ),
    });
    expect(after.styles, label + ': served/reinserted candidate cascade').toEqual(served.styles);
    expect(after.pixels, label + ': served/reinserted candidate pixels').toEqual(served.pixels);
    expect(after.styles, label + ': baseline/candidate computed styles and geometry').toEqual(
      before.styles,
    );
    expect(after.pixels, label + ': baseline/candidate pixels').toEqual(before.pixels);
  };
}
