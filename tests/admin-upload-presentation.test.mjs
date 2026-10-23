import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = name => readFileSync(new URL(`../public/assets/js/${name}`, import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const esc = value => String(value ?? '').replace(/[&<>"']/g,
  char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const item = extra => ({ id: 'incoming', title: 'Original title', series: 'Fixture series', number: 2,
  file: { name: 'Fixture Volume 2.epub', size: 1000 }, metaReady: true, status: 'queued',
  action: 'new', validation: { status: 'pass' }, ...extra });

async function reportFixture(items) {
  const events = new EventTarget(), q = { items }, listeners = new Map(); let current = null, writes = 0;
  const report = html => ({ html,
    replaceWith(next) { current = next; writes++; },
    remove() { current = null; writes++; }
  });
  const review = { dataset: {}, isConnected: true, addEventListener() {},
    querySelector: () => current, appendChild(next) { current = next; writes++; } };
  const nodes = new Map([['#batchList', {}], ['#preflightCard', {}], ['#uploadCard', {}], ['#uploadReviewSummary', review]]);
  const document = {
    head: { appendChild() {} }, querySelector: selector => nodes.get(selector) || null,
    addEventListener(name, callback) { listeners.set(name, callback); },
    createElement(name) {
      if (name !== 'template') return {};
      return { set innerHTML(html) { this.content = { firstElementChild: report(html) }; } };
    }
  };
  runInNewContext(source('admin/upload-preflight-report.js'), {
    window: { ShadowGardenKeeperReady: true, ShadowGardenKeeper: { events, state: { batch: q }, util: { arr: v => Array.isArray(v) ? v : [], esc } } },
    document, queueMicrotask, console
  });
  await settle();
  return { q, html: () => current?.html || '', node: () => current, writes: () => writes,
    async refresh() { events.dispatchEvent(new Event('upload:review-rendered')); await settle(); } };
}

test('the aggregate report follows a warning item title edit, including escaped text', async () => {
  const entry = item({ validation: { status: 'warning', warnings: [{ message: 'Missing cover image' }] } });
  const f = await reportFixture([entry]); assert.match(f.html(), /Original title/);
  entry.title = '<Revised & reviewed>'; await f.refresh();
  assert.match(f.html(), /&lt;Revised &amp; reviewed&gt;/); assert.doesNotMatch(f.html(), /Original title|<Revised/);
});

test('a changed upload failure replaces the obsolete report error', async () => {
  const entry = item({ status: 'failed', error: 'First provider failure' });
  const f = await reportFixture([entry]); entry.error = 'Uploads are busy. Try again shortly.'; await f.refresh();
  assert.match(f.html(), /Uploads are busy/); assert.doesNotMatch(f.html(), /First provider failure/);
});

test('a similar-volume label refreshes even when its reasons stay the same', async () => {
  const entry = item({ similarVolume: { batch: false, series: { title: 'Old series' }, volume: { title: 'Old volume' }, reasons: ['adjacent volume 1'] } });
  const f = await reportFixture([entry]);
  entry.similarVolume.series.title = 'Updated series'; entry.similarVolume.volume.title = 'Updated volume'; await f.refresh();
  assert.match(f.html(), /Updated series · Updated volume/); assert.doesNotMatch(f.html(), /Old series|Old volume/);
});

test('report readiness follows metadata availability without requiring another status change', async () => {
  const entry = item({ metaReady: false }); const f = await reportFixture([entry]); assert.match(f.html(), /0 ready/);
  entry.metaReady = true; await f.refresh(); assert.match(f.html(), /1 ready/);
});

test('unchanged visible report content retains its DOM node', async () => {
  const entry = item(); const f = await reportFixture([entry]), before = f.node(), writes = f.writes();
  entry.author = 'Not displayed by the report'; await f.refresh(); await f.refresh();
  assert.equal(f.node(), before); assert.equal(f.writes(), writes);
});

test('validation detail changes and duplicate decisions keep their existing report behavior', async () => {
  const entry = item({ validation: { status: 'fail', fatal: [{ message: 'Invalid resource', detail: 'Old detail' }] } });
  const f = await reportFixture([entry]); entry.validation.fatal[0].detail = 'New detail'; await f.refresh();
  assert.match(f.html(), /New detail/); assert.doesNotMatch(f.html(), /Old detail/);
  entry.validation = { status: 'pass' }; entry.duplicate = { batch: true }; entry.action = 'skip'; await f.refresh();
  assert.match(f.html(), /Duplicate is currently set to Skip/);
  entry.action = 'separate'; await f.refresh(); assert.doesNotMatch(f.html(), /Duplicate is currently set to Skip/);
});

test('clearing and repopulating the queue removes and recreates its report', async () => {
  const entry = item(); const f = await reportFixture([entry]), before = f.node();
  f.q.items = []; await f.refresh(); assert.equal(f.node(), null);
  f.q.items = [entry]; await f.refresh(); assert.ok(f.node()); assert.notEqual(f.node(), before);
});

class Element {
  value = ''; textContent = ''; disabled = false; hidden = false; dataset = {}; listeners = new Map(); children = [];
  classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ''; }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
  querySelector() { return null; } querySelectorAll() { return []; }
  appendChild(child) { child.parent = this; this.children.push(child); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute() {} before() {}
}
async function similarFixture({ adult = false, remoteAdult = false } = {}) {
  const events = new EventTarget(), nodes = new Map();
  const node = name => { if (!nodes.has(name)) nodes.set(name, new Element()); return nodes.get(name); };
  const incoming = item({ title: 'Fixture Volume 2', adult });
  const existing = { id: 'fixture-series', title: 'Fixture series', volumes: [{ number: 1, title: 'Fixture Volume 1', size: 1000 }] };
  const state = { batch: { items: [incoming], running: false, activeId: null }, management: { main: remoteAdult ? [] : [existing], adult: remoteAdult ? [existing] : [] } };
  const card = new Element(), block = new Element(), badges = new Element(); card.dataset.batchId = incoming.id;
  block.querySelector = () => null;
  card.querySelector = selector => selector === '.batch-duplicate' ? block : selector === '.batch-badges' ? badges
    : selector === '[data-similar-volume-badge]' ? badges.children.find(child => child.dataset.similarVolumeBadge) || null
    : selector === '[data-similar-volume-warning]' ? block.children.find(child => child.dataset.similarVolumeWarning) || null : null;
  node('#batchList').querySelector = () => card;
  node('#batchList').querySelectorAll = () => [card];
  const slug = value => String(value || '').toLowerCase().replace(/\s+/g, '-');
  const context = { state, window: { ShadowGardenKeeper: { state, events, util: { arr: v => Array.isArray(v) ? v : [], slug } } },
    document: { querySelector: node, addEventListener() {}, createElement: () => new Element() },
    slug, CSS: { escape: value => value }, queueMicrotask, Event, CustomEvent, URL, console };
  // Match the real composition order: similarity helper, then stateful Upload view.
  runInNewContext(source('admin/upload-similar-volume.js'), context);
  runInNewContext(source('admin-upload-workflow.js'), context);
  await settle();
  return { incoming, existing, state, node, card,
    async render() { events.dispatchEvent(new Event('upload:queue-rendered')); await settle(); },
    async libraryChanged() { events.dispatchEvent(new Event('library:changed')); await settle(); } };
}

test('similar-volume guidance survives the real Upload view rebuilding its action row', async () => {
  const f = await similarFixture(); await f.render();
  assert.match(f.card.querySelector('[data-similar-volume-warning]')?.textContent || '', /Possible similar volume/);
  assert.equal(f.incoming.action, 'new'); assert.equal(f.node('#uploadButton').disabled, false);
});

test('the similar-volume count survives the real Upload view rebuilding its summary', async () => {
  const f = await similarFixture(); await f.render(); assert.match(f.node('#batchSummary').textContent, /1 similar warning$/);
});

test('similar-volume guidance clears after an unrelated metadata edit', async () => {
  const f = await similarFixture(); f.incoming.series = 'Unrelated series'; await f.render();
  assert.equal(f.incoming.similarVolume, null); assert.equal(f.card.querySelector('[data-similar-volume-badge]'), null);
  assert.equal(f.card.querySelector('[data-similar-volume-warning]'), null); assert.doesNotMatch(f.node('#batchSummary').textContent, /similar warning/);
});

test('similar-volume comparisons retain the current library scope boundary', async () => {
  const f = await similarFixture({ adult: true }); await f.render(); assert.equal(f.incoming.similarVolume, null);
});

test('a catalog refresh updates the similar-volume warning without changing queue actions', async () => {
  const f = await similarFixture(); f.existing.title = 'Renamed fixture series'; await f.libraryChanged();
  assert.match(f.card.querySelector('[data-similar-volume-warning]')?.textContent || '', /Renamed fixture series/);
  assert.equal(f.incoming.action, 'new');
});
