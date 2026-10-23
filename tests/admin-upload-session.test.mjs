import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/assets/js/admin-batch.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
class Element {
  value = ''; dataset = {}; textContent = ''; innerHTML = ''; disabled = false;
  listeners = new Map(); classList = { add() {}, remove() {}, toggle() {} };
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  closest() { return null; } setAttribute() {} querySelectorAll() { return []; }
}
function fixture({ wake, cover } = {}) {
  const nodes = new Map(), node = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  const events = new EventTarget(), state = { unlocked: true }, requests = [], labels = [];
  const keeper = { state, events, epubInspection: {} };
  runInNewContext(source, { window: { ShadowGardenKeeper: keeper }, state, $: node,
    document: { createElement: () => new Element(), getElementById: id => node('#' + id) },
    navigator: { wakeLock: { request: () => wake?.promise } }, Event, DOMException, queueMicrotask, setTimeout, clearTimeout,
    arr: value => value || [], esc: String, fmtSize: () => '', slug: value => value, URL,
    hash8: async () => 'fixturehash', optimizedCoverSet: () => cover?.promise,
    uploadObject: async key => { requests.push(key.endsWith('.epub') ? 'epub' : 'cover'); },
    api: async path => { requests.push(path); return { seriesId: 'fixture' }; },
    setUploadState: label => labels.push(label), setStatus() {}, setFileState() {}, console: { error() {} }
  });
  state.batch.items.push(...[1, 2].map(number => ({ id: String(number), file: { name: `book${number}.epub`, size: 10 },
    title: 'Book', series: 'Fixture', number, sha256: 'fixturehash', metaReady: true,
    validation: { status: 'pass' }, status: 'queued', action: 'new', ...(cover ? { coverBlob: {}, coverExt: '.png' } : {}) })));
  const lockAndReopen = () => { state.unlocked = false; events.dispatchEvent(new Event('session:locked')); state.unlocked = true; };
  return { state, requests, labels, lockAndReopen, start: () => node('#uploadButton').listeners.get('click')() };
}
for (const stage of ['wake', 'cover']) test(`locking and reopening during ${stage} preparation stops the old batch before its next request`, async () => {
  const held = deferred(), f = fixture({ [stage]: held });
  const uploading = f.start(); await settle();
  const before = [...f.requests];
  f.lockAndReopen(); held.resolve(stage === 'cover' ? { detail: { type: 'image/png' }, thumb: null } : undefined);
  await uploading;
  assert.deepEqual(f.requests, before);
  assert.equal(f.state.batch.running, false);
  assert.equal(f.state.batch.items.every(item => item.status === 'failed'), true);
  assert.match(f.labels.at(-1), /ERRORS/);
});
test('an uninterrupted batch still uploads EPUB and catalog serially for both items', async () => {
  const f = fixture(); await f.start();
  assert.deepEqual(f.requests, ['epub', '/admin-api/catalog', 'epub', '/admin-api/catalog']);
  assert.equal(f.state.batch.items.every(item => item.status === 'done'), true);
});
