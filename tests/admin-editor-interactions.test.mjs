import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/assets/js/admin/editor-interactions.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

class Element {
  value = ''; disabled = false; dataset = {}; open = false; textContent = ''; tagName = 'INPUT';
  listeners = new Map();
  classList = { toggle() {}, add() {}, remove() {} };
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  emit(type, extra = {}) { const event = { target: this, preventDefault() {}, stopImmediatePropagation() {}, ...extra }; for (const callback of this.listeners.get(type) || []) callback(event); }
  closest() { return null; }
  getClientRects() { return [1]; }
  contains() { return false; }
  setAttribute() {}
}

async function fixture() {
  const nodes = new Map(), observers = [], timers = new Map(); let timerId = 0, confirmations = 0;
  const node = id => { if (!nodes.has(id)) { const e = new Element(); e.id = id.slice(1); nodes.set(id, e); } return nodes.get(id); };
  const dialog = node('#seriesEditor'), form = node('#seriesEditorForm'), save = node('#saveSeries');
  const fields = [node('#manageTitle'), node('#manageAuthor')]; fields[0].value = 'Original title';
  const close = new Element(); form.querySelector = () => close; form.querySelectorAll = () => fields;
  node('#seriesSaveState');
  const document = new Element(); document.querySelector = id => nodes.get(id) || null; document.contains = () => true;
  document.activeElement = null;
  const events = new EventTarget(), window = new Element(); window.ShadowGardenKeeperReady = true;
  window.ShadowGardenKeeper = { events, state: {}, util: { $: document.querySelector, $$: selector => selector === 'dialog' ? [dialog] : [], arr: value => value || [], esc: String } };
  runInNewContext(source, { window, document, Event, queueMicrotask, HTMLElement: Element,
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe(target, options) { observers.push({ target, options, callback: this.callback }); } },
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => {}, confirm: () => { confirmations++; return false; }, console: { warn() {} }
  });
  await settle();
  const opening = async () => { dialog.open = true; observers.filter(o => o.target === dialog).forEach(o => o.callback([])); await settle(); };
  const flushTimers = async () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); await settle(); };
  const edit = async value => { fields[0].value = value; form.emit('input', { target: fields[0] }); await settle(); };
  return { node, dialog, form, save, fields, events, opening, edit, flushTimers, close, confirmations: () => confirmations };
}

test('an immediate series edit is dirty before any timer can capture it as the baseline', async () => {
  const f = await fixture(); await f.opening(); await f.edit('Quick edit'); await f.flushTimers();
  assert.equal(f.save.disabled, false); assert.equal(f.save.dataset.dirty, '1');
});
test('an immediate edit still requires discard confirmation when closing', async () => {
  const f = await fixture(); await f.opening(); await f.edit('Quick edit'); f.close.emit('click');
  assert.equal(f.confirmations(), 1);
});
test('unchanged fields disable Save and reverting a later edit restores that state', async () => {
  const f = await fixture(); await f.opening(); await f.flushTimers(); assert.equal(f.save.disabled, true);
  await f.edit('Later edit'); assert.equal(f.save.disabled, false);
  await f.edit('Original title'); assert.equal(f.save.disabled, true);
});
test('banner changes are excluded from the series form dirty state', async () => {
  const f = await fixture(); await f.opening(); await f.flushTimers();
  f.form.emit('change', { target: { id: 'manageBanner' } }); await settle();
  assert.equal(f.save.disabled, true);
});
test('a failed current save returns the form from Saving to Unsaved changes', async () => {
  const f = await fixture(); await f.opening(); await f.flushTimers(); await f.edit('Changed');
  f.save.emit('click'); f.events.dispatchEvent(new Event('series:save-failed')); await settle();
  assert.equal(f.node('#seriesSaveState').textContent, 'Unsaved changes'); assert.equal(f.save.disabled, false);
});
