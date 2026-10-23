import { test, expect } from '@playwright/test';
import { installKeeper, openVolume, changed, draft, expectDraft } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);

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
