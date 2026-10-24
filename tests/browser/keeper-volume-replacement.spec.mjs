import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { installKeeper, initial, openVolume, draft, expectDraft } from './keeper-volume-fixture.mjs';
import { createReaderEpub } from './reader-production-fixture.mjs';

test.setTimeout(90000);
const epub = () => createReaderEpub({ chapterCount: 2, paragraphCount: 2 });
const file = buffer => ({ name: 'replacement.epub', mimeType: 'application/epub+zip', buffer });
const held = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

async function prepare(page, { adult = false, onUpload, onCommit } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const catalog = initial();
  Object.assign(catalog.main[0].volumes[0], { size: 100, date: '2026-10-01', publisher: 'Keep publisher', description: 'Keep description' });
  if (adult) { catalog.adult = [catalog.main.shift()]; }
  const uploads = [];
  const f = await installKeeper(page, async (route, payload, state) => {
    if (payload.action !== 'replace-volume-file') return false;
    if (onCommit && await onCommit(route, payload, state)) return true;
    if (route.request().headers()['if-match'] !== String(state.catalog.revision)) {
      await route.fulfill({ status: 409, json: { error: 'The catalog changed. Reload before saving.' } }); return true;
    }
    state.catalog = structuredClone(state.catalog); state.catalog.revision++;
    const series = [...state.catalog.main, ...state.catalog.adult].find(s => s.id === payload.id);
    const volume = series.volumes.find(v => v.bookId === payload.bookId);
    Object.assign(volume, { size: payload.size, sha256: payload.sha256, originalFilename: payload.originalFilename, file: '/media/' + payload.epubKey });
    await route.fulfill({ json: state.catalog }); return true;
  }, catalog);
  await page.route('**/admin-api/upload?*', async route => {
    uploads.push({ key: new URL(route.request().url()).searchParams.get('key'), bytes: route.request().postDataBuffer() });
    if (onUpload && await onUpload(route)) return;
    await route.fulfill({ json: { ok: true } });
  });
  await page.evaluate(() => {
    const client = window.ShadowGardenKeeper.client, upload = client.uploadObject.bind(client);
    client.uploadObject = (...args) => {
      const pending = upload(...args);
      window.replacementUploadSettled = pending.then(() => true, () => false);
      return pending;
    };
  });
  return { ...f, f, uploads };
}
async function choose(page, card, value) {
  const picker = page.waitForEvent('filechooser');
  await card.locator('[data-volume-replace]').click();
  await (await picker).setFiles(value);
}

for (const adult of [false, true]) test(`${adult ? 'Adult' : 'Main'} volume replacement is beside Edit, retains drafts and advances the editor revision`, async ({ page }, info) => {
  const f = await prepare(page, { adult }), card = await openVolume(page);
  await draft(page); await card.locator('[data-v-title]').fill('Unpublished volume title');
  for (const width of [320, 393, 720, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await card.locator('.manage-volume-summary').scrollIntoViewIfNeeded();
    await expect(card.locator('[data-volume-replace]')).toBeInViewport();
    const edit = await card.locator('[data-volume-toggle]').boundingBox(), replace = await card.locator('[data-volume-replace]').boundingBox();
    expect(replace.x).toBeGreaterThanOrEqual(edit.x + edit.width + 4);
    expect(Math.abs(replace.y - edit.y)).toBeLessThan(1);
    expect(replace.height).toBeGreaterThanOrEqual(44); expect(replace.x + replace.width).toBeLessThanOrEqual(width);
    if ([393, 1280].includes(width)) await info.attach(`replacement-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  }
  const bytes = await epub(), original = structuredClone(f.f.catalog[adult ? 'adult' : 'main'][0]);
  await choose(page, card, file(bytes));
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('EPUB replaced: replacement.epub');
  await expectDraft(page); await expect(card.locator('[data-v-title]')).toHaveValue('Unpublished volume title');
  expect(f.uploads).toHaveLength(1); expect(f.uploads[0].bytes.equals(bytes)).toBe(true);
  expect(f.f.writes[0]).toMatchObject({ revision: '5', payload: { action: 'replace-volume-file', id: 'a', bookId: 'a-1', epubKey: f.uploads[0].key, sha256: createHash('sha256').update(bytes).digest('hex'), originalFilename: 'replacement.epub' } });
  const saved = f.f.catalog[adult ? 'adult' : 'main'][0], volume = saved.volumes[0];
  expect({ ...saved, volumes: original.volumes }).toEqual(original);
  expect({ ...volume, size: original.volumes[0].size, sha256: original.volumes[0].sha256, originalFilename: original.volumes[0].originalFilename, file: original.volumes[0].file }).toEqual({ ...original.volumes[0], sha256: undefined, originalFilename: undefined, file: undefined });
  await card.locator('[data-volume-save]').click(); await page.evaluate(() => window.volumeWriteSettled);
  expect(f.f.writes[1].revision).toBe('6');
  expect(f.f.alerts).toEqual([]); expect(f.f.errors).toEqual([]);
});

test('invalid EPUBs and cancelled replacements do not upload or write the catalog', async ({ page }) => {
  const f = await prepare(page), card = await openVolume(page);
  await choose(page, card, { name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('not EPUB') });
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('Choose an EPUB file');
  await choose(page, card, file(Buffer.from('invalid EPUB')));
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('not a readable EPUB');
  page.removeAllListeners('dialog'); page.on('dialog', dialog => dialog.dismiss());
  await choose(page, card, file(await epub()));
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('Replacement cancelled');
  expect(f.uploads).toEqual([]); expect(f.f.writes).toEqual([]); expect(f.f.errors).toEqual([]);
});

for (const phase of ['upload', 'save']) test(`a failed replacement ${phase} can retry the same file with a fresh upload key`, async ({ page }) => {
  let first = true;
  const fail = async route => { if (!first) return false; first = false; await route.fulfill({ status: 503, json: { error: 'Disposable replacement failure' } }); return true; };
  const f = await prepare(page, phase === 'upload' ? { onUpload: fail } : { onCommit: fail }), card = await openVolume(page);
  await draft(page); const bytes = await epub();
  await choose(page, card, file(bytes));
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('Disposable replacement failure');
  await expect(card.locator('[data-volume-replace]')).toBeEnabled(); await expectDraft(page);
  await choose(page, card, file(bytes));
  await expect(card.locator('[data-volume-replacement-status]')).toContainText('EPUB replaced');
  expect(f.uploads).toHaveLength(2); expect(new Set(f.uploads.map(u => u.key)).size).toBe(2);
  expect(f.f.catalog.revision).toBe(6); await expectDraft(page); expect(f.f.errors).toEqual([]);
});

for (const phase of ['upload', 'save']) test(`a late replacement ${phase} response cannot change a different series editor`, async ({ page }) => {
  const gate = held(), began = held();
  const pause = async route => { began.release(); await gate.promise; await route.fulfill({ json: { ok: true } }); return true; };
  const commit = async (route, payload, state) => {
    began.release(); await gate.promise;
    const obsolete = structuredClone(state.catalog); obsolete.revision++;
    obsolete.main[0].title = 'Obsolete replacement result';
    await route.fulfill({ json: obsolete }); return true;
  };
  const f = await prepare(page, phase === 'upload' ? { onUpload: pause } : { onCommit: commit }), card = await openVolume(page);
  await choose(page, card, file(await epub())); await began.promise;
  await page.locator('#seriesEditorForm .dialog-close[value="cancel"]').click();
  await openVolume(page, 'b'); await draft(page);
  gate.release(); await page.evaluate(phase => phase === 'upload' ? window.replacementUploadSettled : window.volumeWriteSettled, phase);
  await expectDraft(page); await expect(page.locator('#manageVolumes [data-volume-replace]').first()).toBeEnabled();
  await expect(page.locator('#manageVolumes [data-volume-replacement-status]').first()).toBeHidden();
  expect(await page.evaluate(() => window.ShadowGardenKeeper.state.management.revision)).toBe(5);
  expect(f.f.writes).toHaveLength(phase === 'upload' ? 0 : 1); expect(f.f.errors).toEqual([]);
});
