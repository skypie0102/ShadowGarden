import { test, expect } from '@playwright/test';

test.setTimeout(90000);
const series = id => ({ id, title: `Series ${id}`, author: 'Disposable fixture', genres: [], tags: [],
  translationStatus: 'Ongoing', translations: [{ name: `Translator ${id}`, url: 'https://example.test/credit', coverage: 'All' }],
  volumes: [1, 2].map(number => ({ bookId: `${id}-${number}`, number, title: `Book ${id}-${number}`, translations: [{ name: `Volume translator ${id}` }] })) });
const initial = () => ({ ok: true, revision: 5, main: [series('a'), series('b')], adult: [], counts: { series: 2, volumes: 4 } });
function changed(catalog, payload) {
  const result = structuredClone(catalog); result.revision++;
  const item = result.main.find(item => item.id === payload.id);
  if (payload.action === 'delete-series') result.main = result.main.filter(other => other !== item);
  else if (payload.action === 'delete-volume') {
    item.volumes.splice(payload.volumeIndex, 1);
    if (!item.volumes.length) result.main = result.main.filter(other => other !== item);
  }
  else if (payload.action === 'update-volume') item.volumes[payload.volumeIndex].title = payload.title;
  else if (payload.action === 'update-series') Object.assign(item, payload);
  else if (payload.target === 'volume') item.volumes[payload.volumeIndex].translations = payload.translations;
  return result;
}
async function installKeeper(page, handle) {
  const f = { catalog: initial(), writes: [], alerts: [], errors: [], reads: 0 };
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
    f.catalog = changed(f.catalog, payload); return route.fulfill({ json: f.catalog });
  });
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 60000 }).toBe(true);
  await expect(page.locator('#seriesSaveState')).toHaveCount(1);
  await page.locator('#adminToken').fill('disposable-volume-key'); await page.locator('#unlockButton').click();
  await page.getByRole('button', { name: 'Complete disposable volume check', exact: true }).click();
  await expect(page.locator('[data-manager-open]')).toHaveCount(2);
  await page.evaluate(() => {
    const client = window.ShadowGardenKeeper.client, request = client.request.bind(client);
    client.request = (path, options, internal) => {
      const result = request(path, options, internal);
      if (options?.method === 'POST' && ['/admin-api/library', '/admin-api/translations'].includes(path)) window.volumeWriteSettled = result.then(() => true, () => false);
      return result;
    };
  });
  return f;
}
async function openVolume(page, id = 'a') {
  await page.locator(`[data-manager-open="${id}"]`).click();
  const card = page.locator('#manageVolumes [data-volume-index="0"]');
  await card.locator('[data-volume-toggle]').click();
  await expect(card.locator('[data-save-volume-translation]')).toBeVisible();
  return card;
}
async function draft(page) {
  await page.locator('#manageTitle').fill('Unpublished series title');
  await page.locator('#manageTranslationStatus').selectOption('Partial');
  await page.locator('#manageTranslations [data-t-name]').first().fill('Unpublished translator');
  await expect(page.locator('#saveSeries')).toBeEnabled();
}
async function expectDraft(page) {
  await expect(page.locator('#manageTitle')).toHaveValue('Unpublished series title');
  await expect(page.locator('#manageTranslationStatus')).toHaveValue('Partial');
  await expect(page.locator('#manageTranslations [data-t-name]').first()).toHaveValue('Unpublished translator');
  await expect(page.locator('#saveSeries')).toBeEnabled();
}
for (const action of ['volume-save', 'volume-trash', 'series-trash', 'translation']) for (const outcome of ['success', 'failure']) test(`a late ${action} ${outcome} preserves the next editor`, async ({ page }) => {
  let release, started;
  const held = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
  const f = await installKeeper(page, async (route, payload, state) => {
    started(); await held;
    if (outcome === 'failure') await route.fulfill({ status: 503, json: { error: 'Obsolete volume operation failed' } });
    else { state.catalog = changed(state.catalog, payload); await route.fulfill({ json: state.catalog }); }
    return true;
  });
  const card = await openVolume(page);
  await (action === 'series-trash' ? page.locator('#deleteSeries') : card.locator({ 'volume-save': '[data-volume-save]', 'volume-trash': '[data-volume-delete]', translation: '[data-save-volume-translation]' }[action])).click();
  await began; await page.locator('#seriesEditorForm .dialog-close[value="cancel"]').click();
  await page.locator('[data-manager-open="b"]').click(); await draft(page);
  await expect(page.locator('#deleteSeries')).toBeEnabled();
  release(); await page.evaluate(() => window.volumeWriteSettled);
  await expect(page.locator('#seriesEditor')).toHaveAttribute('open'); await expectDraft(page);
  await expect(page.locator('#deleteSeries')).toBeEnabled();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.activeSeriesId)).toBe('b');
  expect(f.writes).toHaveLength(1); expect(f.writes[0].payload.id).toBe('a');
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});
test('a volume save preserves both series drafts and the next volume edit, then saves with the advanced revision', async ({ page }) => {
  let release, started;
  const held = new Promise(resolve => { release = resolve; }), began = new Promise(resolve => { started = resolve; });
  const f = await installKeeper(page, async (route, payload, state) => {
    if (payload.action !== 'update-volume') return false;
    started(); await held; state.catalog = changed(state.catalog, payload); await route.fulfill({ json: state.catalog }); return true;
  });
  const card = await openVolume(page); await draft(page);
  await card.locator('[data-v-title]').fill('Saved volume title'); await card.locator('[data-volume-save]').click(); await began;
  await card.locator('[data-v-title]').fill('Next volume edit'); release(); await page.evaluate(() => window.volumeWriteSettled);
  await expectDraft(page); await expect(card.locator('[data-v-title]')).toHaveValue('Next volume edit');
  await expect(card.locator('.volume-summary-copy strong')).toHaveText('Saved volume title');
  await expect(card.locator('[data-volume-save]')).toBeEnabled(); await page.locator('#saveSeries').click();
  await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open'); expect(f.writes).toHaveLength(2);
  expect(f.writes[1]).toMatchObject({ revision: '6', payload: { action: 'update-series', id: 'a', title: 'Unpublished series title', translationStatus: 'Partial', translations: [{ name: 'Unpublished translator', url: 'https://example.test/credit', coverage: 'All' }] } });
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});
test('translation retry and catalog refresh preserve a series draft and its next save revision', async ({ page }) => {
  let first = true;
  const f = await installKeeper(page, async (route, payload) => {
    if (payload.target !== 'volume' || !first) return false;
    first = false; await route.fulfill({ status: 503, json: { error: 'Disposable override failure' } }); return true;
  });
  const card = await openVolume(page); await draft(page);
  await card.locator('[data-volume-translations] [data-t-name]').fill('Saved override');
  const button = card.locator('[data-save-volume-translation]'); await button.click();
  await expect.poll(() => f.alerts.length).toBe(1); await expect(button).toBeEnabled(); await expectDraft(page);
  const reads = f.reads; await button.click(); await page.evaluate(() => window.volumeWriteSettled);
  await expect(page.locator('.admin-toast').last()).toContainText('translation override saved'); await expectDraft(page);
  expect(f.reads).toBe(reads);
  await page.evaluate(() => window.ShadowGardenKeeper.workflows.get('library').instance.refresh()); await expectDraft(page);
  await page.locator('#saveSeries').click(); await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open');
  expect(f.writes).toHaveLength(3); expect(f.writes[1].payload).toMatchObject({ id: 'a', target: 'volume', volumeIndex: 0, translations: [{ name: 'Saved override', url: '', coverage: '' }] });
  expect(f.writes[2]).toMatchObject({ revision: '6', payload: { action: 'update-series', id: 'a', title: 'Unpublished series title', translationStatus: 'Partial' } });
  expect(f.alerts).toEqual(['Disposable override failure']); expect(f.errors).toEqual([]);
});
test('volume removal preserves series drafts, rebuilds indices and closes the editor after the last volume', async ({ page }) => {
  const f = await installKeeper(page); const card = await openVolume(page); await draft(page);
  await card.locator('[data-volume-delete]').click();
  await expect(page.locator('#manageVolumes .manage-volume')).toHaveCount(1); await expectDraft(page);
  await expect(page.locator('#manageVolumes [data-volume-index="0"] .volume-summary-copy strong')).toHaveText('Book a-2');
  await page.locator('#saveSeries').click(); await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open');
  const last = await openVolume(page); await last.locator('[data-volume-delete]').click();
  await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open'); await expect(page.locator('[data-manager-open]')).toHaveCount(1);
  expect(f.writes.map(write => [write.payload.action, write.payload.id, write.payload.volumeIndex, write.revision])).toEqual([
    ['delete-volume', 'a', 0, '5'], ['update-series', 'a', undefined, '6'], ['delete-volume', 'a', 0, '7']
  ]);
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});
