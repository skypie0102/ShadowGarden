import { expect } from '@playwright/test';
export const series = id => ({ id, title: `Series ${id}`, author: 'Disposable fixture', genres: [], tags: [],
  translationStatus: 'Ongoing', translations: [{ name: `Translator ${id}`, url: 'https://example.test/credit', coverage: 'All' }],
  volumes: [1, 2].map(number => ({ bookId: `${id}-${number}`, number, title: `Book ${id}-${number}`, translations: [{ name: `Volume translator ${id}` }] })) });
export const initial = () => ({ ok: true, revision: 5, main: [series('a'), series('b')], adult: [], counts: { series: 2, volumes: 4 } });
export function changed(catalog, payload) {
  const result = structuredClone(catalog); result.revision++;
  const scope = result.main.some(item => item.id === payload.id) ? 'main' : 'adult';
  const item = result[scope].find(item => item.id === payload.id);
  if (payload.action === 'delete-series') result[scope] = result[scope].filter(other => other !== item);
  else if (payload.action === 'delete-volume') {
    item.volumes.splice(payload.volumeIndex, 1);
    if (!item.volumes.length) result[scope] = result[scope].filter(other => other !== item);
  }
  else if (payload.action === 'update-volume') Object.assign(item.volumes[payload.volumeIndex], {
    title: payload.title, number: Number(payload.number), date: payload.date,
    publisher: payload.publisher, description: payload.description
  });
  else if (payload.action === 'update-series') Object.assign(item, payload);
  else if (payload.target === 'volume') item.volumes[payload.volumeIndex].translations = payload.translations;
  return result;
}
export async function installKeeper(page, handle, catalog = initial()) {
  const f = { catalog: structuredClone(catalog), writes: [], alerts: [], errors: [], reads: 0 };
  page.on('pageerror', error => f.errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'confirm') await dialog.accept();
    else { f.alerts.push(dialog.message()); await dialog.dismiss(); }
  });
  await page.addInitScript(() => {
    let button;
    window.turnstile = { render(host, options) {
      button = document.createElement('button'); button.textContent = 'Complete disposable volume check';
      button.onclick = () => options.callback('disposable-check'); host.appendChild(button); return 'fixture-widget';
    }, remove() { button?.remove(); }, reset() {} };
  });
  await page.route('**/admin-access', route => route.fulfill({ json: route.request().method() === 'GET' ? { siteKey: 'fixture-key' } : { ok: true } }));
  await page.route('**/admin-api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === '/admin-api/status') return route.fulfill({ json: { ok: true, authorized: true, revision: 5, catalogReadable: true } });
    if (path === '/admin-api/library' && request.method() === 'GET') { f.reads++; return route.fulfill({ json: f.catalog }); }
    if (path === '/admin-api/series-banner') return route.fulfill({ json: { id: new URL(request.url()).searchParams.get('id'), revision: f.catalog.revision, choices: [] } });
    if (request.method() !== 'POST' || !['/admin-api/library', '/admin-api/translations'].includes(path)) return route.fulfill({ status: 500, json: { error: 'Unexpected disposable request' } });
    const payload = request.postDataJSON(); f.writes.push({ path, payload, revision: request.headers()['if-match'] });
    if (handle && await handle(route, payload, f)) return;
    if (request.headers()['if-match'] !== String(f.catalog.revision))
      return route.fulfill({ status: 409, json: { error: 'The catalog changed. Reload before saving.' } });
    f.catalog = changed(f.catalog, payload); return route.fulfill({ json: f.catalog });
  });
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 60000 }).toBe(true);
  await expect(page.locator('#seriesSaveState')).toHaveCount(1);
  await page.locator('#adminToken').fill('disposable-volume-key'); await page.locator('#unlockButton').click();
  await page.getByRole('button', { name: 'Complete disposable volume check', exact: true }).click();
  await expect(page.locator('[data-manager-open]')).toHaveCount(catalog.main.length + catalog.adult.length);
  await page.evaluate(() => {
    const client = window.ShadowGardenKeeper.client, request = client.request.bind(client);
    window.volumeWritesSettled = [];
    client.request = (path, options, internal) => {
      const result = request(path, options, internal);
      if (options?.method === 'POST' && ['/admin-api/library', '/admin-api/translations'].includes(path)) {
        window.volumeWriteSettled = result.then(() => true, () => false);
        window.volumeWritesSettled.push(window.volumeWriteSettled);
      }
      return result;
    };
  });
  return f;
}
export async function openVolume(page, id = 'a') {
  await page.locator(`[data-manager-open="${id}"]`).click();
  const card = page.locator('#manageVolumes [data-volume-index="0"]');
  await card.locator('[data-volume-toggle]').click();
  await expect(card.locator('[data-save-volume-translation]')).toBeVisible();
  return card;
}
export async function draft(page) {
  await page.locator('#manageTitle').fill('Unpublished series title');
  await page.locator('#manageTranslationStatus').selectOption('Partial');
  await page.locator('#manageTranslations [data-t-name]').first().fill('Unpublished translator');
  await expect(page.locator('#saveSeries')).toBeEnabled();
}
export async function expectDraft(page) {
  await expect(page.locator('#manageTitle')).toHaveValue('Unpublished series title');
  await expect(page.locator('#manageTranslationStatus')).toHaveValue('Partial');
  await expect(page.locator('#manageTranslations [data-t-name]').first()).toHaveValue('Unpublished translator');
  await expect(page.locator('#saveSeries')).toBeEnabled();
}
