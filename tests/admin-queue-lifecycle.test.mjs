import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const sources = ['admin-batch.js', 'admin-upload-workflow.js', 'admin/upload-safety.js', 'admin/upload-events.js']
  .map(path => readFileSync(new URL('../public/assets/js/' + path, import.meta.url), 'utf8'));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const pause = () => new Promise(resolve => setImmediate(resolve));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 2)); }
  assert.fail('The disposable queue did not settle');
}
const file = name => ({ name: name + '.epub', size: 100, lastModified: 1 });
const catalog = title => ({ main: [{ id: title, title, volumes: [{ title, number: 1 }] }], adult: [], revision: 5 });
const metadata = value => ({ title: value.name, series: value.name, number: 1, year: '', author: '',
  description: '', genres: [], tags: [], sha256: value.name, translations: [],
  validation: { status: 'pass', checks: {}, stats: {}, fatal: [], warnings: [] } });

function fixture({ inspect = async value => metadata(value), library = async () => catalog('remote'), withShell = false, confirmTarget = true } = {}) {
  const nodes = new Map(), labels = [], requests = [], inspections = [], confirmations = [];
  class Element {
    value = ''; textContent = ''; innerHTML = ''; dataset = {}; disabled = false; checked = false;
    listeners = new Map(); classes = new Set();
    classList = { add: (...names) => names.forEach(n => this.classes.add(n)),
      remove: (...names) => names.forEach(n => this.classes.delete(n)), contains: n => this.classes.has(n),
      toggle: (n, force) => { const add = force ?? !this.classes.has(n); add ? this.classes.add(n) : this.classes.delete(n); return add; } };
    set id(value) { this._id = value; nodes.set('#' + value, this); } get id() { return this._id; }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
    querySelector() { return null; } querySelectorAll() { return []; } closest() { return null; }
    setAttribute() {} removeAttribute() {} before() {} appendChild() {} remove() {}
    open = false;
    showModal() { this.open = true; }
    close() { this.open = false; for (const callback of this.listeners.get('close') || []) callback(); }
    contains() { return false; } getClientRects() { return []; } focus() {}
  }
  const node = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  const events = new EventTarget(), state = { unlocked: true, management: null };
  let shell;
  const keeper = { state, events, util: { $: node, arr: v => v || [], slug: String },
    client: { isAuthorized: () => state.unlocked }, ui: { toast() {} }, workflows: new Map(),
    registerWorkflow(name, initialize) { assert.equal(name, 'shell'); shell = initialize(); }, epubInspection: {
    inspect: value => { inspections.push(value.name); return inspect(value); },
    failed: (message, detail) => ({ status: 'fail', checks: {}, stats: {}, fatal: [{ message, detail }], warnings: [] })
  } };
  const context = { state, window: { ShadowGardenKeeper: keeper }, $: node,
    document: { querySelector: node, createElement: () => new Element(), getElementById: id => node('#' + id), activeElement: null },
    HTMLElement: Element, getComputedStyle: () => ({ visibility: 'visible' }), requestAnimationFrame: queueMicrotask,
    navigator: {}, Event, CustomEvent, DOMException, queueMicrotask, clearTimeout, URL,
    // Settle only the engine's deliberate zero-delay yield deterministically.
    setTimeout: (callback, delay, ...args) => delay === 0
      ? (queueMicrotask(() => callback(...args)), 0) : setTimeout(callback, delay, ...args),
    CSS: { escape: String }, arr: v => v || [], esc: String, fmtSize: String, slug: String,
    confirm: message => { confirmations.push(message); return confirmTarget; },
    api: async (path, options) => { requests.push({ path, method: options.method }); return options.method === 'GET' ? library() : { seriesId: 'remote' }; },
    uploadObject: async () => requests.push({ path: 'epub', method: 'POST' }),
    hash8: async () => 'fixturehash', setUploadState: label => { state.uploadStatus = { label }; labels.push(label); },
    setStatus: title => { node('#statusTitle').textContent = title; },
    setFileState: label => { node('#fileState').textContent = label; }, console: { error() {}, warn() {} }
  };
  for (const source of sources) runInNewContext(source, context);
  if (withShell) runInNewContext(readFileSync(new URL('../public/assets/js/admin/shell.js', import.meta.url), 'utf8'), context);
  async function dispatch(selector, type, event = {}) {
    for (const callback of node(selector).listeners.get(type) || []) await callback(event);
    await pause();
  }
  const choose = async (...files) => { node('#epubFile').files = files; await dispatch('#epubFile', 'change', { currentTarget: node('#epubFile') }); };
  const clear = () => dispatch('#batchClear', 'click');
  const lock = () => { state.unlocked = false; events.dispatchEvent(new Event('session:locked')); state.unlocked = true; };
  const settled = async () => { await until(() => state.batch.items.every(i => i.status !== 'checking') && !state.batch.preparing); await pause(); };
  return { state, keeper, node, choose, clear, lock, settled, inspections, requests, labels, dispatch, shell, confirmations };
}

const target = { id: 'adult-target', title: 'Target series', scope: 'adult', author: 'Target author' };

test('changing target before the first inspection cancels the queued selection', async () => {
  const f = fixture({ withShell: true }); f.shell.openNewBooks();
  f.node('#epubFile').files = [file('abandoned')];
  for (const callback of f.node('#epubFile').listeners.get('change')) callback({ currentTarget: f.node('#epubFile') });
  assert.equal(f.state.batch.items.length, 0); assert.equal(f.state.batch.preparing, true);
  f.shell.openNewBooks(target); await f.choose(file('fresh')); await f.settled();
  assert.deepEqual(f.inspections, ['fresh.epub']); assert.equal(f.state.batch.items.length, 1);
});

test('changing Upload target cancels held inspection and lets a new selection proceed immediately', async () => {
  const held = deferred(), old = file('old'), f = fixture({ withShell: true, inspect: value => value === old ? held.promise : Promise.resolve(metadata(value)) });
  f.shell.openNewBooks(); await f.choose(old, file('abandoned')); await until(() => f.inspections.length === 1);
  f.shell.openNewBooks(target); await f.choose(file('fresh'));
  await until(() => f.inspections.includes('fresh.epub')); await f.settled();
  held.resolve(metadata(old)); await pause();
  assert.deepEqual(Array.from(f.state.batch.items, i => i.file.name), ['fresh.epub']);
  assert.deepEqual(f.inspections, ['old.epub', 'fresh.epub']);
  assert.equal(f.node('#seriesInput').value, target.title); assert.equal(f.node('#adultInput').checked, true);
  assert.equal(f.node('#uploadButton').disabled, false);
});

for (const outcome of ['success', 'failure']) test(`changing target discards an old catalog ${outcome} while a new lookup is pending`, async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const f = fixture({ withShell: true, library: () => ++reads === 1 ? old.promise : fresh.promise });
  f.shell.openNewBooks(); await f.choose(file('old')); await until(() => f.state.batch.items[0]?.metaReady);
  f.shell.openNewBooks(target); await f.choose(file('fresh')); await until(() => reads === 2 && f.state.batch.items[0]?.metaReady);
  if (outcome === 'success') old.resolve(catalog('obsolete')); else old.reject(Error('Obsolete target lookup'));
  await pause(); assert.equal(f.state.batch.library, null); assert.equal(f.state.management, null);
  assert.equal(f.node('#uploadButton').disabled, true);
  fresh.resolve(catalog('fresh')); await f.settled(); assert.equal(f.state.batch.library.main[0].title, 'fresh');
});

test('declining a target change keeps its pending selection and original target', async () => {
  const held = deferred(), value = file('retained'), f = fixture({ withShell: true, confirmTarget: false, inspect: () => held.promise });
  f.shell.openNewBooks(target); await f.choose(value); await until(() => f.inspections.length === 1);
  f.shell.openNewBooks(); assert.equal(f.state.addBookTarget, target);
  held.resolve(metadata(value)); await f.settled(); assert.equal(f.state.batch.items.length, 1);
  assert.equal(f.state.batch.items[0].series, target.title); assert.equal(f.confirmations.length, 1);
});

test('reopening the same target retains its pending selection without confirmation', async () => {
  const held = deferred(), value = file('retained'), f = fixture({ withShell: true, inspect: () => held.promise });
  f.shell.openNewBooks(target); await f.choose(value); await until(() => f.inspections.length === 1);
  f.shell.closeNewBooks(); f.shell.openNewBooks(target);
  held.resolve(metadata(value)); await f.settled(); assert.equal(f.state.batch.items.length, 1);
  assert.equal(f.confirmations.length, 0);
});

test('closing a targeted queue retains its owner so switching to general Upload clears it', async () => {
  const f = fixture({ withShell: true }); f.shell.openNewBooks(target); await f.choose(file('targeted')); await f.settled();
  f.shell.closeNewBooks(); f.shell.openNewBooks();
  assert.equal(f.confirmations.length, 1); assert.equal(f.state.batch.items.length, 0);
  assert.equal(f.state.addBookTarget, null); assert.equal(f.node('#adultInput').disabled, false);
});

test('an active upload rejects target changes and keeps its queue owner', async () => {
  const f = fixture({ withShell: true }); f.shell.openNewBooks(target); f.state.batch.running = true;
  f.shell.openNewBooks(); assert.equal(f.state.addBookTarget, target); assert.equal(f.confirmations.length, 0);
});

test('clearing during inspection discards the result and the rest of that file selection', async () => {
  const held = deferred(), first = file('first'), f = fixture({ inspect: async value => value === first ? held.promise : metadata(value) });
  await f.choose(first, file('abandoned')); await until(() => f.inspections.length === 1);
  await f.clear(); held.resolve(metadata(first)); await pause();
  assert.equal(f.state.batch.items.length, 0); assert.deepEqual(f.inspections, ['first.epub']);
  assert.equal(f.node('#fileState').textContent, 'WAITING'); assert.equal(f.state.batch.activeId, null);
});

test('an obsolete inspection error cannot replace a cleared queue status', async () => {
  const held = deferred(), f = fixture({ inspect: () => held.promise });
  await f.choose(file('discard')); await until(() => f.inspections.length === 1);
  await f.clear(); held.reject(Error('Obsolete local failure')); await pause();
  assert.equal(f.node('#fileState').textContent, 'WAITING'); assert.equal(f.state.batch.items.length, 0);
});

test('removing the inspected entry leaves it detached when inspection completes', async () => {
  const held = deferred(), f = fixture({ inspect: () => held.promise });
  const value = file('removed'); await f.choose(value); await until(() => f.inspections.length === 1);
  const removed = f.state.batch.items[0];
  await f.dispatch('#batchList', 'click', { target: { closest: selector => selector === '[data-batch-remove]' ? { dataset: { batchRemove: removed.id } } : null }, preventDefault() {}, stopPropagation() {} });
  held.resolve(metadata(value)); await f.settled();
  assert.equal(removed.metaReady, false); assert.equal(f.state.batch.items.length, 0);
  assert.equal(f.state.batch.activeId, null); assert.equal(f.node('#fileState').textContent, 'WAITING');
});

test('overlapping file selections run inspection serially in selection order', async () => {
  const held = deferred(), first = file('first'), f = fixture({ inspect: value => value === first ? held.promise : Promise.resolve(metadata(value)) });
  await f.choose(first, file('second')); await until(() => f.inspections.length === 1);
  await f.choose(file('third')); await pause(); assert.deepEqual(f.inspections, ['first.epub']);
  held.resolve(metadata(first)); await until(() => f.inspections.length === 3); await f.settled();
  assert.deepEqual(f.inspections, ['first.epub', 'second.epub', 'third.epub']);
});

test('a repeated file in overlapping selections is inspected only once', async () => {
  const held = deferred(), value = file('same'), f = fixture({ inspect: () => held.promise });
  await f.choose(value); await until(() => f.inspections.length === 1); await f.choose(value);
  held.resolve(metadata(value)); await f.settled();
  assert.equal(f.state.batch.items.length, 1); assert.equal(f.inspections.length, 1);
});

test('the composed Upload button waits for duplicate lookup after local inspection', async () => {
  const held = deferred(), f = fixture({ library: () => held.promise });
  await f.choose(file('book')); await until(() => f.state.batch.items[0]?.metaReady); await pause();
  assert.equal(f.node('#uploadButton').disabled, true);
  held.resolve(catalog('remote')); await f.settled(); assert.equal(f.node('#uploadButton').disabled, false);
});

test('an early synthetic upload click cannot submit before duplicate lookup settles', async () => {
  const held = deferred(), f = fixture({ library: () => held.promise });
  await f.choose(file('book')); await until(() => f.state.batch.items[0]?.metaReady);
  await f.dispatch('#uploadButton', 'click'); assert.equal(f.requests.some(r => r.method === 'POST'), false);
  held.resolve(catalog('remote')); await f.settled();
});

for (const outcome of ['success', 'failure']) test(`a late old lookup ${outcome} cannot replace the new queue catalog or unlock it`, async () => {
  const old = deferred(), fresh = deferred(); let reads = 0;
  const f = fixture({ library: () => ++reads === 1 ? old.promise : fresh.promise });
  await f.choose(file('old')); await until(() => f.state.batch.items[0]?.metaReady);
  await f.clear(); await f.choose(file('fresh')); await until(() => reads === 2 && f.state.batch.items[0]?.metaReady);
  if (outcome === 'success') old.resolve(catalog('obsolete')); else old.reject(Error('Obsolete lookup'));
  await pause();
  assert.equal(f.state.batch.library, null); assert.equal(f.state.management, null);
  assert.equal(f.node('#uploadButton').disabled, true);
  fresh.resolve(catalog('fresh')); await f.settled();
  assert.equal(f.state.batch.library.main[0].title, 'fresh'); assert.equal(f.state.management.main[0].title, 'fresh');
});

test('a newer Library refresh wins over an older in-flight duplicate lookup', async () => {
  const held = deferred(), f = fixture({ library: () => held.promise });
  await f.choose(file('book')); await until(() => f.state.batch.items[0]?.metaReady);
  const newer = catalog('newer'); f.state.management = newer; f.keeper.events.dispatchEvent(new Event('library:changed'));
  held.resolve(catalog('obsolete')); await f.settled();
  assert.equal(f.state.management, newer); assert.equal(f.state.batch.library.main[0].title, 'newer');
});

test('a failed duplicate lookup is retried by the next selection instead of caching an empty catalog', async () => {
  let reads = 0; const f = fixture({ library: async () => { if (++reads === 1) throw Error('Disposable outage'); return catalog('fresh.epub'); } });
  await f.choose(file('first')); await f.settled(); await f.choose(file('fresh')); await f.settled();
  assert.equal(reads, 2); assert.equal(f.state.batch.library.main[0].title, 'fresh.epub');
  const item = f.state.batch.items.find(i => i.file.name === 'fresh.epub'); assert.equal(item.action, 'skip');
  assert.equal(item.duplicate.series.title, 'fresh.epub');
});

test('locking and reopening cancels unfinished inspection while preserving ready queue entries', async () => {
  const held = deferred(), waiting = file('waiting'), f = fixture({ inspect: value => value === waiting ? held.promise : Promise.resolve(metadata(value)) });
  await f.choose(file('ready')); await f.settled(); const ready = f.state.batch.items[0];
  await f.choose(waiting, file('abandoned')); await until(() => f.inspections.includes('waiting.epub'));
  f.lock(); await f.choose(file('fresh')); await until(() => f.inspections.includes('fresh.epub')); await f.settled();
  const title = f.node('#filePickerTitle').textContent; held.resolve(metadata(waiting)); await pause();
  assert.deepEqual(Array.from(f.state.batch.items, i => i.file.name), ['ready.epub', 'fresh.epub']);
  assert.equal(f.state.batch.items[0], ready); assert.equal(f.node('#filePickerTitle').textContent, title);
  assert.equal(f.inspections.includes('abandoned.epub'), false);
});

test('file selection cannot change the queue while an upload is active', async () => {
  const f = fixture(); f.state.batch.running = true; await f.choose(file('unexpected')); await pause();
  assert.equal(f.inspections.length, 0); assert.equal(f.state.batch.items.length, 0); assert.equal(f.requests.length, 0);
});

test('an ordinary batch still becomes editable and uploadable after inspection', async () => {
  const f = fixture(); await f.choose(file('ordinary')); await f.settled();
  assert.equal(f.state.batch.items[0].metaReady, true); assert.equal(f.node('#titleInput').value, 'ordinary.epub');
  assert.equal(f.node('#uploadButton').disabled, false); assert.equal(f.state.batch.items[0].action, 'new');
});

test('non-EPUB selection retains explicit feedback without inspecting or loading the catalog', async () => {
  const f = fixture(); await f.choose({ ...file('image'), name: 'image.png' });
  assert.equal(f.node('#fileState').textContent, 'NO EPUB'); assert.equal(f.inspections.length, 0); assert.equal(f.requests.length, 0);
});
