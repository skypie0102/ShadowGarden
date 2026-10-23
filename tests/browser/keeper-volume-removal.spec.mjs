import { test, expect } from '@playwright/test';
import { installKeeper, initial, openVolume, draft, expectDraft } from './keeper-volume-fixture.mjs';

test.setTimeout(90000);
const cardFor = (page, number) => page.locator('#manageVolumes .manage-volume').filter({
  has: page.getByText(`Book a-${number}`, { exact: true })
});
async function expand(card) {
  if (await card.locator('.manage-volume-editor').isHidden())
    await card.locator('[data-volume-toggle]').click();
  await expect(card.locator('[data-save-volume-translation]')).toBeVisible();
}
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

for (const removed of [0, 1, 2]) test(`removing volume ${removed + 1} retains sibling drafts, focus and correct write indices`, async ({ page }) => {
  const held = deferred(), started = deferred(), catalog = initial();
  catalog.main[0].volumes.push({
    bookId: 'a-3', number: 3, title: 'Book a-3', translations: [{ name: 'Volume translator a' }]
  });
  const f = await installKeeper(page, async (route, payload) => {
    if (payload.action !== 'delete-volume') return false;
    started.resolve(); await held.promise; return false;
  }, catalog);
  await openVolume(page); await draft(page);
  const survivors = [1, 2, 3].filter(number => number !== removed + 1);
  for (const number of survivors) {
    const card = cardFor(page, number); await expand(card);
    await card.locator('[data-v-title]').fill(`Draft title ${number}`);
    await card.locator('[data-v-number]').fill(String(number + 0.25));
    await card.locator('[data-v-date]').fill('2026-10-23');
    await card.locator('[data-v-publisher]').fill(`Draft publisher ${number}`);
    await card.locator('[data-v-description]').fill(`Draft description ${number}\nSecond line`);
    await card.locator('[data-volume-translations] [data-t-name]').fill(`Draft translator ${number}`);
    await card.locator('[data-volume-translations] [data-t-url]').fill(`https://example.test/volume/${number}`);
    await card.locator('[data-volume-translations] [data-t-coverage]').fill('First half');
    await card.locator('[data-add-volume-translation]').click();
  }
  await page.evaluate(() => {
    window.originalVolumeCards = [...document.querySelectorAll('#manageVolumes .manage-volume')];
  });
  const target = cardFor(page, removed + 1); await expand(target);
  await target.locator('[data-volume-delete]').click(); await started.promise;
  const focused = cardFor(page, survivors[0]).locator('[data-v-description]');
  await focused.fill('Typed while removal was pending\nKeep this selection');
  await focused.evaluate(node => { node.focus(); node.setSelectionRange(2, 8); });
  held.resolve(); await page.evaluate(() => window.volumeWriteSettled);
  await expect(page.locator('#manageVolumes .manage-volume')).toHaveCount(2);
  await expect(page.locator('#manageVolumeLabel')).toHaveText('2 volumes');
  await expectDraft(page); await expect(focused).toBeFocused();
  expect(await focused.evaluate(node => [node.selectionStart, node.selectionEnd])).toEqual([2, 8]);
  expect(await page.evaluate(removedIndex => {
    const expected = window.originalVolumeCards.filter((card, index) => index !== removedIndex);
    return [...document.querySelectorAll('#manageVolumes .manage-volume')].every((card, index) => card === expected[index]);
  }, removed)).toBe(true);
  for (const [index, number] of survivors.entries()) {
    const card = cardFor(page, number);
    await expect(card).toHaveAttribute('data-volume-index', String(index));
    await expect(card.locator('.manage-volume-editor')).toBeVisible();
    await expect(card.locator('[data-v-title]')).toHaveValue(`Draft title ${number}`);
    await expect(card.locator('[data-v-number]')).toHaveValue(String(number + 0.25));
    await expect(card.locator('[data-v-date]')).toHaveValue('2026-10-23');
    await expect(card.locator('[data-v-publisher]')).toHaveValue(`Draft publisher ${number}`);
    await expect(card.locator('[data-v-description]')).toHaveValue(index === 0
      ? 'Typed while removal was pending\nKeep this selection' : `Draft description ${number}\nSecond line`);
    await expect(card.locator('[data-volume-translations] [data-translation-row]')).toHaveCount(2);
    await expect(card.locator('[data-volume-translations] [data-t-name]').first()).toHaveValue(`Draft translator ${number}`);
    await expect(card.locator('[data-volume-translations] [data-t-url]').first()).toHaveValue(`https://example.test/volume/${number}`);
    await expect(card.locator('[data-volume-translations] [data-t-coverage]').first()).toHaveValue('First half');
    await expect(card.locator('[data-volume-translations] [data-t-name]').last()).toHaveValue('');
  }
  const first = page.locator('#manageVolumes [data-volume-index="0"]');
  await first.locator('[data-volume-save]').click();
  await expect(first.locator('.volume-summary-copy strong')).toHaveText(`Draft title ${survivors[0]}`);
  await first.locator('[data-save-volume-translation]').click();
  await expect(page.locator('.admin-toast').last()).toContainText('translation override saved');
  await expectDraft(page); await page.locator('#saveSeries').click();
  await expect(page.locator('#seriesEditor')).not.toHaveAttribute('open');
  expect(f.writes.map(write => [write.payload.action || write.payload.target, write.payload.volumeIndex, write.revision])).toEqual([
    ['delete-volume', removed, '5'], ['update-volume', 0, '6'], ['volume', 0, '7'], ['update-series', undefined, '8']
  ]);
  expect(f.writes[1].payload).toMatchObject({ title: `Draft title ${survivors[0]}`,
    number: String(survivors[0] + 0.25), date: '2026-10-23', publisher: `Draft publisher ${survivors[0]}`,
    description: 'Typed while removal was pending\nKeep this selection' });
  expect(f.catalog.main[0].volumes.map(volume => volume.bookId)).toEqual(survivors.map(number => `a-${number}`));
  expect(f.catalog.main[0].volumes[0].translations).toEqual([{
    name: `Draft translator ${survivors[0]}`, url: `https://example.test/volume/${survivors[0]}`, coverage: 'First half'
  }]);
  expect(f.alerts).toEqual([]); expect(f.errors).toEqual([]);
});

for (const action of ['metadata', 'translation']) test(`a sibling ${action} revision conflict retains its form and retries at the new index`, async ({ page }) => {
  const held = deferred(), started = deferred(); let first = true;
  const f = await installKeeper(page, async (route, payload, state) => {
    const matches = action === 'metadata' ? payload.action === 'update-volume' : payload.target === 'volume';
    if (!matches || !first) return false;
    first = false; started.resolve(); await held.promise;
    expect(route.request().headers()['if-match']).toBe('5'); expect(state.catalog.revision).toBe(6);
    await route.fulfill({ status: 409, json: { error: 'The catalog changed. Reload before saving.' } });
    return true;
  });
  await openVolume(page);
  const sibling = cardFor(page, 2); await expand(sibling);
  await sibling.locator('[data-v-title]').fill('Retained volume draft');
  await sibling.locator('[data-volume-translations] [data-t-name]').fill('Retained translator draft');
  const button = sibling.locator(action === 'metadata' ? '[data-volume-save]' : '[data-save-volume-translation]');
  await button.click(); await started.promise;
  await cardFor(page, 1).locator('[data-volume-delete]').click();
  await expect(page.locator('#manageVolumes .manage-volume')).toHaveCount(1);
  await expect(sibling).toHaveAttribute('data-volume-index', '0'); await expect(button).toBeDisabled();
  await sibling.locator('[data-v-title]').fill('Next edit during the pending request');
  held.resolve(); await page.evaluate(() => window.volumeWritesSettled[0]);
  await expect.poll(() => f.alerts.length).toBe(1); await expect(button).toBeEnabled();
  await expect(sibling.locator('[data-v-title]')).toHaveValue('Next edit during the pending request');
  await expect(sibling.locator('[data-volume-translations] [data-t-name]')).toHaveValue('Retained translator draft');
  await button.click(); await page.evaluate(() => window.volumeWriteSettled);
  await expect(page.locator('#manageVolumes [data-volume-index="0"]').locator(
    action === 'metadata' ? '[data-volume-save]' : '[data-save-volume-translation]'
  )).toBeEnabled();
  expect(f.writes.map(write => [write.payload.volumeIndex, write.revision])).toEqual([[1, '5'], [0, '5'], [0, '6']]);
  expect(f.catalog.main[0].volumes).toHaveLength(1); expect(f.catalog.main[0].volumes[0].bookId).toBe('a-2');
  if (action === 'metadata') expect(f.catalog.main[0].volumes[0].title).toBe('Next edit during the pending request');
  else expect(f.catalog.main[0].volumes[0].translations[0].name).toBe('Retained translator draft');
  expect(f.alerts).toEqual(['The catalog changed. Reload before saving.']); expect(f.errors).toEqual([]);
});

test('failed removal keeps both forms and a successful retry keeps the surviving draft', async ({ page }) => {
  let first = true;
  const f = await installKeeper(page, async (route, payload) => {
    if (payload.action !== 'delete-volume' || !first) return false;
    first = false; await route.fulfill({ status: 503, json: { error: 'Disposable removal failure' } }); return true;
  });
  await openVolume(page);
  const sibling = cardFor(page, 2); await expand(sibling);
  await sibling.locator('[data-v-title]').fill('Draft retained across removal retry');
  await sibling.locator('[data-volume-translations] [data-t-name]').fill('Translator retained across retry');
  const remove = cardFor(page, 1).locator('[data-volume-delete]'); await remove.click();
  await expect.poll(() => f.alerts.length).toBe(1); await expect(remove).toBeEnabled();
  await expect(page.locator('#manageVolumes .manage-volume')).toHaveCount(2);
  await expect(sibling).toHaveAttribute('data-volume-index', '1');
  await expect(sibling.locator('[data-v-title]')).toHaveValue('Draft retained across removal retry');
  await remove.click(); await expect(page.locator('#manageVolumes .manage-volume')).toHaveCount(1);
  await expect(sibling).toHaveAttribute('data-volume-index', '0');
  await expect(sibling.locator('[data-v-title]')).toHaveValue('Draft retained across removal retry');
  await expect(sibling.locator('[data-volume-translations] [data-t-name]')).toHaveValue('Translator retained across retry');
  await sibling.locator('[data-volume-save]').click(); await page.evaluate(() => window.volumeWriteSettled);
  expect(f.writes.map(write => [write.payload.volumeIndex, write.revision])).toEqual([[0, '5'], [0, '5'], [0, '6']]);
  expect(f.catalog.main[0].volumes[0].bookId).toBe('a-2');
  expect(f.alerts).toEqual(['Disposable removal failure']); expect(f.errors).toEqual([]);
});
