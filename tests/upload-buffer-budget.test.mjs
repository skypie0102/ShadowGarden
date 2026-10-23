import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fixture, adminHeaders } from './helpers.mjs';
import { endpoint, boundedBytes } from '../server/http.js';
import { upload } from '../server/admin.js';
import { epub } from '../scripts/upload-profile-support.mjs';

const MiB = 1024 * 1024;
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
async function setup(t, provider) {
  const env = fixture(); t.after(() => env.DB.sqlite.close());
  Object.assign(env, { B2_APPLICATION_KEY_ID: crypto.randomUUID(), B2_APPLICATION_KEY: 'disposable', B2_BUCKET_ID: 'fixture', B2_BUCKET_NAME: 'fixture' });
  const headers = await adminHeaders(env), objects = new Map(); let calls = 0;
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    calls++;
    const url = new URL(input);
    if (url.pathname.endsWith('b2_authorize_account')) return Response.json({ authorizationToken: 'fixture', apiInfo: { storageApi: {
      apiUrl: 'https://api.unit.backblazeb2.com', downloadUrl: 'https://download.unit.backblazeb2.com', allowed: { buckets: [{ id: 'fixture', name: 'fixture' }] }
    } } });
    if (url.pathname.endsWith('b2_get_upload_url')) return Response.json({ uploadUrl: 'https://pod-000.backblaze.com/upload', authorizationToken: 'fixture' });
    if (url.pathname === '/upload') {
      const key = decodeURIComponent(options.headers['x-bz-file-name']), bytes = new Uint8Array(options.body);
      assert.equal(createHash('sha1').update(bytes).digest('hex'), options.headers['x-bz-content-sha1']);
      const response = await provider?.(key, bytes);
      if (response) return response;
      objects.set(key, bytes); return Response.json({ fileId: 'fixture-file' });
    }
    assert.equal(options.method, 'HEAD'); return new Response(null, { status: 404 });
  });
  const request = (key, bytes, options = {}) => new Request(`https://garden.test/admin-api/upload?key=shadow-garden/books/${key}.epub`, {
    method: 'POST', headers: { ...headers, ...(options.declared ? { 'content-length': String(bytes.byteLength) } : {}), ...options.headers },
    body: options.body || bytes, signal: options.signal, duplex: 'half'
  });
  const post = request => endpoint(upload)({ env, request });
  const held = (key, signal) => {
    const gate = deferred(), began = deferred(); let cancelled = false;
    const body = new ReadableStream({
      async pull(controller) {
        began.resolve(); await gate.promise;
        if (!cancelled) { controller.enqueue(epub(1024)); controller.close(); }
      },
      cancel() { cancelled = true; gate.resolve(); }
    }, { highWaterMark: 0 });
    const result = post(request(key, epub(1024), { body, signal }));
    return { result, began: began.promise, release: gate.resolve, cancelled: () => cancelled };
  };
  const count = table => env.DB.sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
  return { env, request, post, held, count, objects, providerCalls: () => calls };
}

for (const declared of [false, true]) test(`overlapping ${declared ? 'declared' : 'unknown'} large upload is retryable before reading, reservation or provider access`, async t => {
  const f = await setup(t), first = f.held('first'); await first.began;
  const bytes = epub(declared ? 15 * MiB : 1024); let pulls = 0, cancelled = false;
  try {
    const body = new ReadableStream({ pull(controller) { pulls++; controller.enqueue(bytes); controller.close(); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
    const busy = await f.post(f.request('busy', bytes, { declared, body }));
    assert.equal(busy.status, 503); assert.equal((await busy.json()).code, 'upload_busy');
    assert.equal(busy.headers.get('retry-after'), '5');
    assert.equal(pulls, 0); assert.equal(cancelled, true);
    assert.equal(f.providerCalls(), 0); assert.equal(f.count('media_uploads'), 0); assert.equal(f.count('media_upload_activity'), 0);
  } finally { first.release(); assert.equal((await first.result).status, 200); }
  const retry = await f.post(f.request('busy', bytes, { declared }));
  assert.equal(retry.status, 200); assert.ok(Buffer.from(f.objects.get('shadow-garden/books/busy.epub')).equals(bytes));
  assert.equal(f.count('media_uploads'), 2); assert.equal(f.count('media_upload_activity'), 0);
});

test('smaller uploads share the exact budget and hold capacity through provider completion', async t => {
  const providerHeld = deferred(), providerBegan = deferred();
  const f = await setup(t, async key => {
    if (key.endsWith('/within.epub')) { providerBegan.resolve(); await providerHeld.promise; }
  });
  const first = f.held('unknown'); await first.began;
  try {
    const smaller = f.post(f.request('within', epub(14 * MiB), { declared: true })); await providerBegan.promise;
    try {
      const busy = await f.post(f.request('later', epub(1024), { declared: true }));
      assert.equal(busy.status, 503); assert.equal((await busy.json()).code, 'upload_busy');
    } finally { providerHeld.resolve(); assert.equal((await smaller).status, 200); }
    assert.equal((await f.post(f.request('later', epub(1024), { declared: true }))).status, 200);
  } finally { providerHeld.resolve(); first.release(); assert.equal((await first.result).status, 200); }
  assert.equal(f.count('media_uploads'), 3); assert.equal(f.count('media_upload_activity'), 0);
});

test('oversized and unauthorized requests keep their original errors while capacity is occupied', async t => {
  const f = await setup(t), first = f.held('first'); await first.began;
  try {
    const oversized = await f.post(f.request('oversized', epub(1024), { headers: { 'content-length': String(50 * MiB + 1) } }));
    assert.equal(oversized.status, 413); assert.equal((await oversized.json()).code, 'body_too_large');
    assert.equal((await f.post(f.request('unauthorized', epub(1024), { headers: { authorization: 'Bearer wrong' } }))).status, 401);
    assert.equal(f.providerCalls(), 0); assert.equal(f.count('media_uploads'), 0);
  } finally { first.release(); await first.result; }
});

test('interrupted input cancels reading and releases upload capacity', async t => {
  const f = await setup(t), controller = new AbortController(), first = f.held('interrupted', controller.signal);
  await first.began; controller.abort(new DOMException('Fixture interrupted', 'AbortError')); first.release();
  const response = await first.result;
  assert.equal(response.status, 408); assert.equal((await response.json()).code, 'upload_interrupted');
  assert.equal(first.cancelled(), true); assert.equal(f.providerCalls(), 0); assert.equal(f.count('media_uploads'), 0);
  assert.equal((await f.post(f.request('retry', epub(1024)))).status, 200);
});

test('the upload input deadline cancels a stalled reader and releases capacity', async t => {
  const original = AbortSignal.timeout, controller = new AbortController(); let intercept = true, deadlines = 0;
  t.mock.method(AbortSignal, 'timeout', ms => {
    if (ms === 180000 && intercept) { deadlines++; return controller.signal; }
    return original(ms);
  });
  const f = await setup(t), first = f.held('stalled'); await first.began;
  controller.abort(new DOMException('Fixture deadline', 'TimeoutError')); first.release();
  const response = await first.result;
  assert.equal(response.status, 408); assert.equal((await response.json()).code, 'upload_timeout');
  assert.equal(deadlines, 1); assert.equal(first.cancelled(), true); assert.equal(f.providerCalls(), 0); assert.equal(f.count('media_uploads'), 0);
  intercept = false; assert.equal((await f.post(f.request('retry', epub(1024)))).status, 200);
});

test('invalid media releases the buffer without reserving its key', async t => {
  const f = await setup(t);
  assert.equal((await f.post(f.request('invalid', Uint8Array.of(1, 2, 3)))).status, 415);
  assert.equal(f.count('media_uploads'), 0); assert.equal(f.providerCalls(), 0);
  assert.equal((await f.post(f.request('valid', epub(1024)))).status, 200);
});

test('provider failure releases capacity and activity while retaining the immutable reservation', async t => {
  const f = await setup(t, key => key.endsWith('/failed.epub') ? new Response(null, { status: 500 }) : undefined);
  const response = await f.post(f.request('failed', epub(1024)));
  assert.equal(response.status, 502); assert.equal(f.count('media_uploads'), 1); assert.equal(f.count('media_upload_activity'), 0);
  assert.equal((await f.post(f.request('retry', epub(1024)))).status, 200);
  assert.equal(f.count('media_uploads'), 2); assert.equal(f.count('media_upload_activity'), 0);
});

test('unknown-length chunks are copied before their producer reuses the backing array', async () => {
  const shared = new Uint8Array(3); let part = 0;
  const body = new ReadableStream({ pull(controller) {
    if (part === 2) { controller.close(); return; }
    shared.set(part++ ? [4, 5, 6] : [1, 2, 3]); controller.enqueue(shared);
  } }, { highWaterMark: 0 });
  const bytes = await boundedBytes(new Request('https://fixture.test', { method: 'POST', body, duplex: 'half' }), 6);
  assert.deepEqual(bytes, Uint8Array.of(1, 2, 3, 4, 5, 6));
  assert.equal(bytes.buffer.resizable, false); assert.equal(bytes.buffer.byteLength, 6);
});

test('an aborted bounded reader preserves its reason even when cancellation rejects', async () => {
  const abort = new AbortController(), reason = new Error('Fixture abort'); let close, cancelled = false;
  const body = new ReadableStream({ start(controller) { close = () => controller.close(); }, cancel() { cancelled = true; throw Error('Cleanup failure'); } });
  const request = new Request('https://fixture.test', { method: 'POST', body, signal: abort.signal, duplex: 'half' });
  const result = boundedBytes(request, 10); abort.abort(reason); if (!cancelled) close();
  await assert.rejects(result, error => error === reason); assert.equal(request.body.locked, false);
});

for (const declared of [false, true]) test(`${declared ? 'length mismatch' : 'overflow'} keeps its HTTP error when input cancellation rejects`, async () => {
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(Uint8Array.of(1, 2, 3)); },
    cancel() { throw Error('Fixture cleanup failure'); }
  }, { highWaterMark: 0 });
  const request = new Request('https://fixture.test', { method: 'POST',
    headers: declared ? {'content-length':'2'} : {}, body, duplex: 'half' });
  await assert.rejects(boundedBytes(request, declared ? 5 : 2), error =>
    error.status === (declared ? 400 : 413) && error.code === (declared ? 'invalid_body_length' : 'body_too_large'));
  assert.equal(request.body.locked, false);
});
