import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/assets/js/admin-upload-workflow.js', import.meta.url), 'utf8');

class Element {
  value = '';
  textContent = '';
  innerHTML = '';
  disabled = false;
  dataset = {};
  listeners = new Map();
  classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute() {}
  before() {}
  appendChild() {}
}

const item = (id, extra = {}) => ({
  id, file: { name: `${id}.epub`, size: 100 }, title: id, series: id, number: 1,
  metaReady: true, status: 'queued', validation: { status: 'pass' }, action: 'new', ...extra
});

function fixture(items, { running = false } = {}) {
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const queue = { items, running, activeId: null, objectUrl: '' };
  const state = { batch: queue };
  const events = new EventTarget();
  runInNewContext(source, {
    state, window: { ShadowGardenKeeper: { state, events } },
    document: { querySelector: node, createElement: () => new Element() },
    slug: value => String(value).toLowerCase(), CSS: { escape: value => value },
    Event, CustomEvent, queueMicrotask, URL, console
  });
  const remove = async id => {
    const button = { dataset: { batchRemove: id } };
    const event = {
      target: { closest: selector => selector === '[data-batch-remove]' ? button : null },
      preventDefault() {}, stopPropagation() {}
    };
    for (const listener of node('#batchList').listeners.get('click') || []) listener(event);
    await new Promise(resolve => setImmediate(resolve));
  };
  return { queue, node, remove };
}

test('removing another EPUB preserves an explicit Skip and keeps upload disabled', async () => {
  const skipped = item('skipped', { action: 'skip', userChoseSkip: true });
  const f = fixture([skipped, item('removed')]);
  await f.remove('removed');
  assert.equal(skipped.action, 'skip');
  assert.equal(f.node('#uploadButton').disabled, true);
  assert.match(f.node('#batchSummary').textContent, /1 selected · 0 upload/);
});

test('an explicit duplicate Skip survives removal of the matching queued EPUB', async () => {
  const skipped = item('skipped', { action: 'skip', userChoseSkip: true, duplicate: { batch: true } });
  const f = fixture([skipped, item('removed', { series: 'skipped', title: 'skipped' })]);
  await f.remove('removed');
  assert.equal(skipped.duplicate, null);
  assert.equal(skipped.action, 'skip');
  assert.equal(f.node('#uploadButton').disabled, true);
});

test('removing an EPUB does not count an explicit Skip among other ready uploads', async () => {
  const skipped = item('skipped', { action: 'skip', userChoseSkip: true });
  const f = fixture([skipped, item('ready'), item('removed')]);
  await f.remove('removed');
  assert.equal(skipped.action, 'skip');
  assert.match(f.node('#batchSummary').textContent, /2 selected · 1 upload/);
  assert.equal(f.node('#uploadButton').textContent, 'Upload 1 Book');
});

test('an automatic duplicate Skip becomes uploadable after its matching EPUB is removed', async () => {
  const skipped = item('skipped', { action: 'skip', duplicate: { batch: true } });
  const f = fixture([skipped, item('removed', { series: 'skipped', title: 'skipped' })]);
  await f.remove('removed');
  assert.equal(skipped.duplicate, null);
  assert.equal(skipped.action, 'new');
  assert.equal(f.node('#uploadButton').disabled, false);
});

for (const failure of ['validation', 'upload']) {
  test(`removing another EPUB retains the ${failure} failure's Skip`, async () => {
    const skipped = item('skipped', { action: 'skip', ...(failure === 'validation'
      ? { validation: { status: 'fail' } } : { status: 'failed' }) });
    const f = fixture([skipped, item('removed')]);
    await f.remove('removed');
    assert.equal(skipped.action, 'skip');
    assert.equal(f.node('#uploadButton').disabled, true);
  });
}

test('the queue cannot remove an EPUB during an active upload', async () => {
  const f = fixture([item('retained')], { running: true });
  await f.remove('retained');
  assert.equal(f.queue.items.length, 1);
});
