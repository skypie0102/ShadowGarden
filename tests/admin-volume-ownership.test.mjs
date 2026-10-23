import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const sources = ['library-workflow', 'translation-workflow'].map(name =>
  readFileSync(new URL(`../public/assets/js/admin/${name}.js`, import.meta.url), 'utf8'));
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
class Element extends EventTarget {
  value = ''; textContent = ''; disabled = false; dataset = {}; tagName = 'INPUT'; open = false;
  children = []; selectors = new Map(); ancestors = new Map(); _html = '';
  classList = { add() {}, remove() {}, toggle() {} };
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  querySelector(selector) { return this.selectors.get(selector) || null; }
  querySelectorAll(selector) { return selector === '.manage-volume' ? this.children : []; }
  closest(selector) { return this.ancestors.get(selector) || null; }
  contains(child) { return this.children.includes(child); }
  append(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  removeAttribute(name) { delete this[name]; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}
function click(root, target) {
  const event = new Event('click'); Object.defineProperty(event, 'target', { value: target });
  root.dispatchEvent(event);
}
async function fixture() {
  const nodes = new Map(), workflows = new Map(), events = new EventTarget();
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  node('#manageStatus').tagName = 'SELECT';
  node('#saveSeries').textContent = 'Save series'; node('#deleteSeries').textContent = 'Move series to Trash';
  const main = ['a', 'b'].map(id => ({ id, title: `Series ${id}`, translationStatus: 'Ongoing',
    translations: [{ name: `Translator ${id}` }], volumes: [1, 2].map(number => ({ bookId: `${id}-${number}`, number, title: `Book ${id}-${number}` })) }));
  const requests = [], pending = [], messages = [], notifications = [];
  for (const name of ['library:changed', 'library:invalidate', 'trash:changed']) events.addEventListener(name, () => notifications.push(name));
  const keeper = { util: { $: node, $$: () => [], arr: value => Array.isArray(value) ? value : [], esc: value => String(value ?? ''), fmtSize: () => '', normalizeSeriesStatus: () => 'Ongoing' },
    state: { management: { main, adult: [], revision: 5 }, manageQuery: '', manageScope: 'all' }, events, workflows,
    ui: { toast: message => messages.push(message) }, registerWorkflow(name, factory) { workflows.set(name, { factory }); },
    client: { beginEdit() {}, isAuthorized: () => true, request(path, options = {}) {
      if (options.method === 'POST') { requests.push({ path, payload: JSON.parse(options.body) }); const held = deferred(); pending.push(held); return held.promise; }
      const id = new URL(path, 'https://fixture.test').searchParams.get('id');
      return Promise.resolve({ id, choices: [], revision: 5 });
    } }
  };
  const window = { ShadowGardenKeeper: keeper };
  const context = { window, document: { createElement: () => new Element() }, Event, CustomEvent, queueMicrotask,
    MutationObserver: class { observe() {} }, console, alert: message => messages.push(message), confirm: () => true };
  for (const source of sources) runInNewContext(source, context);
  for (const entry of workflows.values()) entry.instance = entry.factory();
  const open = async id => { await window.openSeriesEditor(id); workflows.get('translations').instance.sync(); await settle(); };
  const card = (index = 0) => {
    const result = new Element(); result.dataset.volumeIndex = String(index);
    for (const selector of ['[data-v-title]', '[data-v-number]', '[data-v-date]', '[data-v-publisher]', '[data-v-description]', '.volume-summary-copy strong', '.volume-summary-copy span', '.volume-number']) result.selectors.set(selector, new Element());
    result.querySelector('[data-v-title]').value = 'Edited volume'; result.querySelector('[data-v-number]').value = '1';
    for (const [selector, label] of [['[data-volume-save]', 'Save volume'], ['[data-volume-delete]', 'Move to Trash'], ['[data-save-volume-translation]', 'Save translation override']]) {
      const button = new Element(); button.textContent = label; button.ancestors.set(selector, button); button.ancestors.set('.manage-volume', result); result.selectors.set(selector, button);
    }
    const editor = new Element(); editor.selectors.set('[data-volume-translation-editor]', new Element()); result.selectors.set('.manage-volume-editor', editor);
    const credits = new Element(); result.selectors.set('[data-volume-translations]', credits);
    node('#manageVolumes').append(result); return result;
  };
  const start = (action, target = card()) => {
    if (action === 'series-trash') node('#deleteSeries').dispatchEvent(new Event('click'));
    else click(node('#manageVolumes'), target.querySelector({ 'volume-save': '[data-volume-save]', 'volume-trash': '[data-volume-delete]', translation: '[data-save-volume-translation]' }[action]));
    return target;
  };
  const result = (revision = 6) => ({ main, adult: [], revision });
  return { node, keeper, open, card, start, result, requests, pending, messages, notifications, window };
}

for (const action of ['volume-save', 'volume-trash', 'series-trash', 'translation']) {
  for (const outcome of ['success', 'failure']) for (const next of ['a', 'b']) test(`${action}: late ${outcome} leaves ${next === 'a' ? 'the reopened' : 'a different'} editor intact`, async () => {
    const f = await fixture(); await f.open('a'); const oldCard = f.start(action);
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].payload.id, 'a');
    f.node('#seriesEditor').close(); await f.open(next);
    f.node('#manageTitle').value = 'Unpublished title'; f.node('#manageTranslationStatus').value = 'Partial'; f.node('#manageTranslations').innerHTML = 'Unpublished credits';
    f.node('#deleteSeries').textContent = 'New operation owns this control'; f.node('#deleteSeries').disabled = true;
    const management = f.keeper.state.management; f.notifications.length = 0;
    if (outcome === 'success') f.pending[0].resolve(f.result()); else f.pending[0].reject(new Error('Obsolete operation failed'));
    await settle();
    assert.equal(f.node('#seriesEditor').open, true); assert.equal(f.keeper.state.activeSeriesId, next);
    assert.equal(f.node('#manageTitle').value, 'Unpublished title'); assert.equal(f.node('#manageTranslationStatus').value, 'Partial');
    assert.equal(f.node('#manageTranslations').innerHTML, 'Unpublished credits'); assert.equal(f.keeper.state.management, management);
    assert.equal(f.node('#deleteSeries').textContent, 'New operation owns this control'); assert.equal(f.node('#deleteSeries').disabled, true);
    assert.deepEqual(f.messages, []); assert.deepEqual(f.notifications, []);
    if (action !== 'series-trash') assert.equal(oldCard.querySelector({ 'volume-save': '[data-volume-save]', 'volume-trash': '[data-volume-delete]', translation: '[data-save-volume-translation]' }[action]).disabled, true);
  });
}
for (const action of ['volume-save', 'volume-trash', 'series-trash', 'translation']) for (const outcome of ['success', 'failure']) test(`${action}: the current editor still handles ${outcome}`, async () => {
  const f = await fixture(); await f.open('a'); const card = f.start(action);
  if (outcome === 'success') f.pending[0].resolve(f.result()); else f.pending[0].reject(new Error('Current operation failed'));
  await settle();
  if (outcome === 'failure') { assert.deepEqual(f.messages, ['Current operation failed']); assert.equal(f.node('#seriesEditor').open, true); }
  else {
    assert.equal(f.keeper.state.management.revision, 6);
    assert.equal(f.node('#seriesEditor').open, action !== 'series-trash');
    if (action.includes('trash')) assert.ok(f.notifications.includes('trash:changed'));
    if (action === 'translation') assert.match(f.messages[0], /translation override saved/);
  }
  if (action === 'volume-save' || action === 'translation') assert.equal(card.querySelector(action === 'volume-save' ? '[data-volume-save]' : '[data-save-volume-translation]').disabled, false);
});
for (const action of ['volume-save', 'volume-trash', 'translation']) test(`${action}: completing it preserves unsaved series metadata and credits`, async () => {
  const f = await fixture(); await f.open('a');
  f.node('#manageTitle').value = 'Unpublished title'; f.node('#manageTranslationStatus').value = 'Partial'; f.node('#manageTranslations').innerHTML = 'Unpublished credits';
  f.start(action); f.pending[0].resolve(f.result()); await settle();
  assert.equal(f.node('#manageTitle').value, 'Unpublished title'); assert.equal(f.node('#manageTranslationStatus').value, 'Partial'); assert.equal(f.node('#manageTranslations').innerHTML, 'Unpublished credits');
});
for (const action of ['volume-save', 'volume-trash', 'series-trash', 'translation']) test(`${action}: repeated activation cannot duplicate a pending write`, async () => {
  const f = await fixture(); await f.open('a'); const card = f.start(action); f.start(action, card);
  assert.equal(f.requests.length, 1); f.pending[0].resolve(f.result()); await settle();
});
test('a catalog refresh preserves the current translation draft but reopening reloads saved credits', async () => {
  const f = await fixture(); await f.open('a');
  f.node('#manageTranslationStatus').value = 'Partial'; f.node('#manageTranslations').innerHTML = 'Unpublished credits';
  f.window.updateManagement(f.result()); await settle();
  assert.equal(f.node('#manageTranslationStatus').value, 'Partial'); assert.equal(f.node('#manageTranslations').innerHTML, 'Unpublished credits');
  f.node('#seriesEditor').close(); await f.open('a');
  assert.equal(f.node('#manageTranslationStatus').value, 'Ongoing'); assert.match(f.node('#manageTranslations').innerHTML, /Translator a/);
});
for (const action of ['volume-save', 'volume-trash', 'translation']) for (const outcome of ['success', 'failure']) test(`${action}: a detached volume card ignores its ${outcome}`, async () => {
  const f = await fixture(); await f.open('a'); const card = f.start(action);
  f.node('#manageVolumes').innerHTML = 'A newer volume list'; f.notifications.length = 0;
  const management = f.keeper.state.management;
  if (outcome === 'success') f.pending[0].resolve(f.result()); else f.pending[0].reject(new Error('Detached operation failed'));
  await settle(); assert.equal(f.keeper.state.management, management); assert.equal(f.node('#manageVolumes').innerHTML, 'A newer volume list');
  assert.deepEqual(f.notifications, []); assert.deepEqual(f.messages, []);
  assert.equal(card.querySelector({ 'volume-save': '[data-volume-save]', 'volume-trash': '[data-volume-delete]', translation: '[data-save-volume-translation]' }[action]).disabled, true);
});
test('reopening a series resets the Trash control without waiting for the old request', async () => {
  const f = await fixture(); await f.open('a'); f.start('series-trash');
  f.node('#seriesEditor').close(); await f.open('b');
  assert.equal(f.node('#deleteSeries').disabled, false); assert.equal(f.node('#deleteSeries').textContent, 'Move series to Trash');
  f.pending[0].resolve(f.result()); await settle();
});
test('a current volume save preserves edits made to that volume while the request was pending', async () => {
  const f = await fixture(); await f.open('a'); const card = f.start('volume-save');
  card.querySelector('[data-v-title]').value = 'Another edit after Save';
  f.pending[0].resolve(f.result()); await settle();
  assert.equal(f.node('#manageVolumes').contains(card), true); assert.equal(card.querySelector('[data-v-title]').value, 'Another edit after Save');
});
test('removing the last volume still closes the removed series editor', async () => {
  const f = await fixture(); await f.open('a'); f.start('volume-trash');
  const result = f.result(); result.main = result.main.filter(series => series.id !== 'a');
  f.pending[0].resolve(result); await settle();
  assert.equal(f.node('#seriesEditor').open, false); assert.equal(f.keeper.state.activeSeriesId, null);
  assert.ok(f.notifications.includes('trash:changed'));
});
