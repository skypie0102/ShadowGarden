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

function fixture(items, { running = false, showRows = false, library = null, target = null } = {}) {
  const nodes = new Map(), created = [], navigations = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const queue = { items, running, activeId: null, objectUrl: '', library };
  const state = { batch: queue, addBookTarget: target };
  const events = new EventTarget();
  const blocks = items.map(() => new Element());
  if (showRows) {
    const articles = items.map((item, index) => {
      const article = new Element(); article.dataset.batchId = item.id;
      article.querySelector = selector => selector === '.batch-duplicate' ? blocks[index] : null;
      return article;
    });
    node('#batchList').querySelectorAll = () => articles;
  }
  runInNewContext(source, {
    state, window: { ShadowGardenKeeper: { state, events } },
    document: { querySelector: node, createElement: () => { const element = new Element(); created.push(element); return element; } },
    slug: value => String(value).toLowerCase(), CSS: { escape: value => value },
    Event, CustomEvent, queueMicrotask, URL, console, location: { assign: value => navigations.push(value) }
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
  return { queue, node, remove, blocks, navigations, stage: () => created.find(element => element.id === 'uploadWorkflowStage'),
    async uploadState(label) {
      state.uploadStatus = { label }; events.dispatchEvent(new Event('upload:state'));
      await new Promise(resolve => setImmediate(resolve));
    } };

}

for (const action of ['skip', 'new']) test(`a nonduplicate ${action} entry keeps its user queue-action control visible`, () => {
  const f = fixture([item('review', { action, userChoseSkip: action === 'skip' })], { showRows: true });
  assert.equal(f.blocks[0].hidden, false);
  assert.match(f.blocks[0].innerHTML, /Queue action/);
  assert.match(f.blocks[0].innerHTML, /value="new"/);
  assert.match(f.blocks[0].innerHTML, /value="skip"/);
});

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

for (const adult of [false, true]) test(`queue guidance uses the ${adult ? 'Adult' : 'Main'} destination and actual series identifier`, () => {
  const entry = item('incoming', { series: 'existing', number: 2, adult });
  const f = fixture([entry], { showRows: true, library: { main: adult ? [] : [{ id: 'existing' }], adult: adult ? [{ id: 'adult-existing' }] : [] } });
  assert.match(f.blocks[0].innerHTML, adult ? /Adult Library/ : /Main Library/);
  assert.match(f.blocks[0].innerHTML, /existing · Volume 2 · Existing series/);
  assert.match(f.blocks[0].innerHTML, /aria-describedby="batch-action-help-incoming"/);
});

test('a targeted destination wins over stale imported metadata, including custom series ids', () => {
  const f = fixture([item('incoming', { series: 'stale', adult: false })], {
    showRows: true, target: { id: 'custom-id', title: '<Real & target>', scope: 'adult' }
  });
  assert.match(f.blocks[0].innerHTML, /Adult Library · &lt;Real &amp; target&gt; · Volume 1 · Existing series/);
  assert.doesNotMatch(f.blocks[0].innerHTML, /Main Library|stale|<Real/);
});

for (const [action, copy] of [['skip', /Nothing will be uploaded or replaced/], ['replace', /EPUB and metadata.*book identity and reading links/], ['separate', /separate volume entry.*existing matched volume unchanged/]]) {
  test(`duplicate ${action} guidance describes its consequence`, () => {
    const f = fixture([item('incoming', { action, duplicate: { series: { title: 'existing' }, volume: { title: 'Old volume' }, scope: 'main', reasons: ['same volume 1'] } })], { showRows: true });
    assert.match(f.blocks[0].innerHTML, copy);
  });
}

test('successful uploads retain skipped and structurally invalid files, including their original objects', async () => {
  const uploaded = item('uploaded'), skipped = item('skipped', { action: 'skip', userChoseSkip: true });
  const blocked = item('blocked', { action: 'skip', validation: { status: 'fail' }, metaReady: false });
  const f = fixture([uploaded, skipped, blocked]);
  await f.uploadState('UPLOADING');
  uploaded.status = 'done'; uploaded.result = { seriesId: 'uploaded-series' };
  await f.uploadState('COMPLETE');
  assert.deepEqual(f.queue.items, [skipped, blocked]);
  assert.equal(f.queue.items[0], skipped); assert.equal(f.queue.items[1], blocked);
  assert.match(f.stage().innerHTML, /1 book was uploaded successfully/);
  assert.match(f.stage().innerHTML, /2 files remain in the queue/);
  assert.match(f.stage().innerHTML, /data-outcome="skipped"/);
  assert.match(f.stage().innerHTML, /data-outcome="blocked"/);
  assert.doesNotMatch(f.stage().innerHTML, /queue has been cleared/);
});

test('partial results retain completed identities and distinguish an upload failure from invalid content', async () => {
  const uploaded = item('uploaded'), failed = item('failed');
  const f = fixture([uploaded, failed]); await f.uploadState('UPLOADING');
  uploaded.status = 'done'; uploaded.result = { seriesId: 'uploaded-series' };
  failed.status = 'failed'; failed.error = '<Temporary & provider failure>';
  await f.uploadState('COMPLETE WITH ERRORS');
  assert.deepEqual(f.queue.items, [uploaded, failed]);
  assert.match(f.stage().innerHTML, /1 uploaded · 1 failed/);
  assert.match(f.stage().innerHTML, /Upload failed · Retry available/);
  assert.match(f.stage().innerHTML, /&lt;Temporary &amp; provider failure&gt;/);
  assert.match(f.stage().innerHTML, /Uploaded files will not be sent again/);
  assert.doesNotMatch(f.stage().innerHTML, /Invalid EPUB|<Temporary/);
});


test('completion opens the targeted Adult series when only a non-active imported file succeeds', async () => {
  const skipped = item('skipped', { action: 'skip', userChoseSkip: true });
  const incoming = item('non-active', { series: 'Imported title', adult: false });
  const f = fixture([skipped, incoming], { target: { id: 'custom-rose', title: 'Actual destination', scope: 'adult' } });
  const opener = new Element();
  f.stage().querySelector = selector => selector === '#workflowOpenSeries' ? opener : null;
  await f.uploadState('UPLOADING'); incoming.status = 'done'; incoming.result = { seriesId: 'custom-rose' };
  await f.uploadState('COMPLETE');
  for (const click of opener.listeners.get('click')) click();
  assert.deepEqual(f.navigations, ['/series.html?id=custom-rose&scope=adult']);
  assert.deepEqual(f.queue.items, [skipped]);
});
