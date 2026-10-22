import { test, expect } from '@playwright/test';

test.setTimeout(90000);
const choices = id => [1, 2].map(number => ({ bookId: `${id}-${number}`, number, title: `${id} volume ${number}` }));
const series = id => ({ id, title: `Series ${id}`, author: 'Disposable fixture', genres: [], tags: [], volumes: choices(id) });

async function installKeeper(page, bannerRequest) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/admin-api/**', route => route.fulfill({ status: 500, json: { error: 'Unexpected disposable request' } }));
  await page.route('**/admin-api/status', route => route.fulfill({ json: { ok: true, authorized: true, revision: 5, catalogReadable: true } }));
  await page.route('**/admin-api/library', route => route.fulfill({ json: { ok: true, revision: 5, main: [series('a'), series('b')], adult: [], counts: { series: 2, volumes: 4 } } }));
  await page.route('**/admin-api/series-banner*', bannerRequest);
  await page.goto('/admin');
  await expect.poll(() => page.evaluate(() => Boolean(window.ShadowGardenKeeperReady)), { timeout: 60000 }).toBe(true);
  await page.locator('#adminToken').fill('disposable-banner-key');
  await page.evaluate(async () => {
    const keeper = window.ShadowGardenKeeper;
    await keeper.client.verifySession();
    keeper.client.markUnlocked(); keeper.state.unlocked = true;
    // Retain a settlement barrier for the held request; it does not change API results.
    const request = keeper.client.request.bind(keeper.client);
    keeper.client.request = (path, options, internal) => {
      const result = request(path, options, internal);
      if (path === '/admin-api/series-banner' && options?.method === 'POST') {
        window.bannerWriteSettled = result.then(() => true, () => false);
      }
      return result;
    };
    document.querySelector('#lockedView').classList.add('hidden');
    document.querySelector('#dashboardView').classList.remove('hidden');
    keeper.events.dispatchEvent(new Event('session:unlocked'));
  });
  await expect(page.locator('[data-manager-open]')).toHaveCount(2);
  return errors;
}

for (const outcome of ['success', 'failure']) {
  test(`a late banner ${outcome} cannot overwrite or retarget another series editor`, async ({ page }) => {
    let release, start;
    const held = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { start = resolve; });
    const writes = [];
    const errors = await installKeeper(page, async route => {
      if (route.request().method() === 'GET') {
        const id = new URL(route.request().url()).searchParams.get('id');
        return route.fulfill({ json: { id, revision: 5, choices: choices(id), current: `${id}-1` } });
      }
      const payload = route.request().postDataJSON();
      writes.push(payload);
      if (writes.length === 1) {
        start(); await held;
        return route.fulfill({ status: outcome === 'success' ? 200 : 503, json: outcome === 'success'
          ? { ok: true, revision: 6, id: payload.id, current: payload.bannerBookId }
          : { error: 'Older banner save failed' } });
      }
      return route.fulfill({ json: { ok: true, revision: 7, id: payload.id, current: payload.bannerBookId } });
    });
    await page.locator('[data-manager-open="a"]').click();
    const select = page.locator('#manageBanner');
    await expect(select).toBeEnabled(); await expect(select).toHaveValue('a-1');
    await select.selectOption('a-2'); await started;
    await page.locator('#seriesEditorForm .dialog-close[value="cancel"]').click();
    await page.locator('[data-manager-open="b"]').click();
    await expect(select).toBeEnabled(); await expect(select).toHaveValue('b-1');
    const currentStatus = await page.locator('#manageBannerState').textContent();
    release(); await page.evaluate(() => window.bannerWriteSettled);
    await expect(select).toHaveValue('b-1');
    await expect(page.locator('#manageBannerState')).toHaveText(currentStatus);
    await expect(select).toBeEnabled();
    await select.selectOption('');
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[0]).toMatchObject({ id: 'a', bannerBookId: 'a-2' });
    expect(writes[1]).toMatchObject({ id: 'b', bannerBookId: '' });
    await expect(page.locator('#manageBannerState')).toHaveText('Random banner restored. A volume cover will be chosen when the Series page opens.');
    expect(errors).toEqual([]);
  });
}
