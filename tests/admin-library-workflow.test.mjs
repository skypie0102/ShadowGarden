import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/assets/js/admin/library-workflow.js', import.meta.url), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

class Element extends EventTarget {
  value = '';
  textContent = '';
  innerHTML = '';
  disabled = false;
  dataset = {};
  tagName = 'INPUT';
  open = false;
  children = [];
  classList = { add() {}, remove() {}, toggle() {} };
  closest() { return null; }
  replaceChildren() { this.children = []; }
  append(child) { this.children.push(child); }
  removeAttribute(name) { delete this[name]; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}

function fixture({ getBanner } = {}) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  node('#manageStatus').tagName = 'SELECT';
  const choices = id => [1, 2].map(number => ({ bookId: `${id}-${number}`, number, title: `${id} ${number}` }));
  const main = ['a', 'b'].map(id => ({ id, title: `Series ${id}`, volumes: choices(id) }));
  const writes = [], pending = [], messages = [];
  let initialize;
  const keeper = {
    util: { $: node, $$: () => [], arr: value => Array.isArray(value) ? value : [], esc: value => String(value ?? ''), fmtSize: () => '', normalizeSeriesStatus: () => 'Ongoing' },
    state: { management: { main, adult: [], revision: 5 }, manageQuery: '', manageScope: 'all' },
    events: new EventTarget(), workflows: new Map(), ui: { toast: message => messages.push(message) },
    registerWorkflow(name, factory) { assert.equal(name, 'library'); initialize = factory; },
    client: {
      beginEdit() {}, isAuthorized: () => true,
      request(path, options = {}) {
        if (options.method === 'POST') {
          const payload = JSON.parse(options.body);
          writes.push(payload);
          const request = deferred(); pending.push(request); return request.promise;
        }
        const id = new URL(path, 'https://fixture.test').searchParams.get('id');
        return getBanner?.(id) ?? Promise.resolve({ id, choices: choices(id), current: `${id}-1` });
      }
    }
  };
  const window = { ShadowGardenKeeper: keeper };
  runInNewContext(source, { window, document: { createElement: () => new Element() }, Event, CustomEvent, queueMicrotask, console, alert: message => messages.push(message), confirm: () => true });
  initialize();
  const open = async id => { await window.openSeriesEditor(id); await settle(); };
  const save = value => { node('#manageBanner').value = value; node('#manageBanner').dispatchEvent(new Event('change')); };
  return { node, keeper, open, save, writes, pending, messages, choices, main };
}

for (const outcome of ['success', 'failure']) for (const nextId of ['a', 'b']) {
  test(`a late series save ${outcome} cannot change the ${nextId === 'a' ? 'reopened' : 'different'} editor`, async () => {
    const f = fixture();
    await f.open('a');
    f.node('#saveSeries').dispatchEvent(new Event('click'));
    assert.equal(f.writes[0].id, 'a');
    f.node('#seriesEditor').close();
    await f.open(nextId);
    f.node('#manageTitle').value = 'New unsaved edit';
    f.node('#saveSeries').disabled = true; // Another save now owns this shared control.
    const management = f.keeper.state.management;
    if (outcome === 'success') f.pending[0].resolve({ main: f.main, adult: [], revision: 6 });
    else f.pending[0].reject(new Error('Obsolete save failed'));
    await settle();
    assert.equal(f.node('#seriesEditor').open, true);
    assert.equal(f.keeper.state.activeSeriesId, nextId);
    assert.equal(f.node('#manageTitle').value, 'New unsaved edit');
    assert.equal(f.node('#saveSeries').disabled, true);
    assert.equal(f.keeper.state.management, management);
    assert.deepEqual(f.messages, []);
  });
}

for (const outcome of ['success', 'failure']) test(`the active series save still handles ${outcome}`, async () => {
  const f = fixture();
  await f.open('a');
  f.node('#saveSeries').dispatchEvent(new Event('click'));
  if (outcome === 'success') f.pending[0].resolve({ main: f.main, adult: [], revision: 6 });
  else f.pending[0].reject(new Error('Current save failed'));
  await settle();
  assert.equal(f.node('#seriesEditor').open, outcome === 'failure');
  assert.equal(f.messages.length, 1);
  assert.match(f.messages[0], outcome === 'success' ? /Saved/ : /Current save failed/);
  if (outcome === 'failure') assert.equal(f.node('#saveSeries').disabled, false);
});

for (const outcome of ['success', 'failure']) {
  for (const nextId of ['b', 'a']) {
    test(`a late banner ${outcome} cannot change ${nextId === 'a' ? 'a reopened editor for the same series' : 'another series editor'}`, async () => {
      const f = fixture();
      await f.open('a');
      f.save('a-2');
      assert.equal(f.writes[0].id, 'a');
      f.node('#seriesEditor').close();
      await f.open(nextId);
      const currentStatus = f.node('#manageBannerState').textContent;
      if (outcome === 'success') f.pending[0].resolve({ id: 'a' });
      else f.pending[0].reject(new Error('Older banner save failed'));
      await settle();
      assert.equal(f.node('#manageBanner').value, `${nextId}-1`);
      assert.equal(f.node('#manageBannerState').textContent, currentStatus);
      assert.equal(f.node('#manageBanner').disabled, false);
      f.save('');
      assert.equal(f.writes[1].id, nextId);
      assert.equal(f.writes[1].bannerBookId, '');
      f.pending[1].resolve({ id: nextId });
      await settle();
    });
  }
}

test('a locked editor ignores the old banner rejection after a new editor opens', async () => {
  const f = fixture();
  await f.open('a'); f.save('a-2');
  f.node('#seriesEditor').close();
  f.keeper.events.dispatchEvent(new Event('session:locked'));
  f.keeper.state.management = { main: [{ id: 'b', title: 'Series b', volumes: f.choices('b') }], adult: [], revision: 6 };
  await f.open('b');
  const currentStatus = f.node('#manageBannerState').textContent;
  f.pending[0].reject(new DOMException('Keeper locked', 'AbortError'));
  await settle();
  assert.equal(f.node('#manageBanner').value, 'b-1');
  assert.equal(f.node('#manageBannerState').textContent, currentStatus);
});

test('a late successful banner save cannot retarget the next series banner write', async () => {
  const f = fixture();
  await f.open('a'); f.save('a-2');
  f.node('#seriesEditor').close(); await f.open('b');
  f.pending[0].resolve({ id: 'a' }); await settle();
  f.save('');
  assert.equal(f.writes[1].id, 'b');
  f.pending[1].resolve({ id: 'b' }); await settle();
});

test('a late banner choice read cannot replace the current editor choices', async () => {
  const old = deferred();
  const f = fixture({ getBanner: id => id === 'a' ? old.promise : undefined });
  await f.open('a'); f.node('#seriesEditor').close(); await f.open('b');
  old.resolve({ id: 'a', current: 'a-1', choices: f.choices('a') });
  await settle();
  assert.equal(f.node('#manageBanner').value, 'b-1');
  assert.deepEqual(f.node('#manageBanner').children.map(option => option.value), ['', 'b-1', 'b-2']);
});
