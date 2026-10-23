// Two real upload handlers in one local workerd isolate; no live storage or D1.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { ADMIN_COOKIE, signed } from '../server/security.js';
import { epub, inspector } from './upload-profile-support.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const ref = process.argv[2] || 'working-tree', output = process.argv[3];
const MiB = 1024 * 1024, bytes = epub(50 * MiB);
const source = path => ref === 'working-tree'
  ? readFile(new URL(path, `file://${root}`), 'utf8')
  : execFileSync('git', ['show', `${ref}:${path}`], { cwd: root, encoding: 'utf8' });
const bundle = await build({
  stdin: { resolveDir: root, contents: `
    import {upload} from './server/admin.js';
    import {endpoint} from './server/http.js';
    globalThis.__sgMemory=async(phase,id,status='')=>{
      await (await fetch('https://profile.invalid/?'+new URLSearchParams({phase,id,status}))).text();
    };
    export default {async fetch(request,env){
      await globalThis.__sgMemory('start',request.url);
      const response=await endpoint(upload)({request,env});
      await globalThis.__sgMemory('complete',request.url,String(response.status));
      return response;
    }};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [{
    name: 'profile-source', setup(build) {
      build.onLoad({ filter: /\/server\/.*\.js$/ }, async ({ path }) => {
        let contents = await source(path.slice(root.length));
        if (path.endsWith('/http.js')) contents = contents
          .replace('return bytes;', "await globalThis.__sgMemory('buffered',request.url); return bytes;")
          .replace('return collected;', "await globalThis.__sgMemory('buffered',request.url); return collected;")
          .replace('return new Uint8Array(buffer.transferToFixedLength());',
            "const collected=new Uint8Array(buffer.transferToFixedLength()); await globalThis.__sgMemory('buffered',request.url); return collected;");
        return { contents, loader: 'js' };
      });
    }
  }]
});

const results = [];
for (const {knownLengths, sizesMiB} of [
  {knownLengths:[true,true], sizesMiB:[50,50]},
  {knownLengths:[false,false], sizesMiB:[50,50]},
  {knownLengths:[false,true], sizesMiB:[50,14]}
]) {
  const inputs=sizesMiB.map(size=>size===50?bytes:epub(size*MiB));
  const hashes=inputs.map(input=>createHash('sha1').update(input).digest('hex'));
  const knownLength=knownLengths.every(Boolean)?true:knownLengths.every(value=>!value)?false:null;
  const samples = [], buffered = new Set(), completed = new Set(), received = [];
  let cdp, release, providerCalls = 0;
  const held = new Promise(resolve => { release = resolve; });
  const timer = setTimeout(release, 30_000);
  const sample = async phase => samples.push({ phase, ...await cdp.call('Runtime.getHeapUsage') });
  const env = { ADMIN_TOKEN: 'overlap-disposable-token', SESSION_SECRET: 'overlap-disposable-session-secret',
    B2_APPLICATION_KEY_ID: 'overlap-key', B2_APPLICATION_KEY: 'disposable', B2_BUCKET_ID: 'fixture', B2_BUCKET_NAME: 'fixture' };
  const mf = new Miniflare(convertV4MiniflareOptions({
    name: 'upload-profile', modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-09-23', inspectorPort: 0, bindings: env, d1Databases: ['DB'],
    outboundService: async request => {
      const url = new URL(request.url);
      if (url.hostname === 'profile.invalid') {
        const phase = url.searchParams.get('phase'), id = url.searchParams.get('id');
        if (phase === 'buffered') buffered.add(id);
        if (phase === 'complete') completed.add(id);
        await sample(phase);
        if (buffered.size + completed.size >= 2) release();
        if (phase === 'buffered') await held;
        return new Response('ok');
      }
      providerCalls++;
      if (url.pathname.endsWith('b2_authorize_account')) return Response.json({ authorizationToken: 'fixture', apiInfo: { storageApi: {
        apiUrl: 'https://api.unit.backblazeb2.com', downloadUrl: 'https://download.unit.backblazeb2.com',
        allowed: { buckets: [{ id: 'fixture', name: 'fixture' }] }
      } } });
      if (url.pathname.startsWith('/file/')) return new Response(null, { status: 404 });
      if (url.pathname.endsWith('b2_get_upload_url')) return Response.json({ uploadUrl: 'https://pod-000.backblaze.com/upload', authorizationToken: 'fixture' });
      if (url.pathname === '/upload') {
        await sample('provider-start');
        const index=Number(decodeURIComponent(request.headers.get('x-bz-file-name')).match(/overlap-(\d)\.epub$/)[1]);
        const expectedHash=hashes[index];
        assert.equal(request.headers.get('x-bz-content-sha1'), expectedHash);
        let size = 0; const hash = createHash('sha1');
        for await (const chunk of request.body) { size += chunk.length; hash.update(chunk); }
        assert.equal(size, inputs[index].length); assert.equal(hash.digest('hex'), expectedHash); received.push(size);
        await sample('provider-drained'); return Response.json({ fileId: 'disposable' });
      }
      throw Error('Unexpected disposable provider request');
    }
  }));
  try {
    await mf.ready; cdp = await inspector(mf);
    const db = await mf.getD1Database('DB');
    for (const name of (await readdir(new URL('../migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort())
      await db.exec((await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).replace(/--[^\n]*/g, '').replace(/\n/g, ' '));
    const sid = 'overlap-session'; await db.prepare('INSERT INTO admin_sessions(id,expires_at) VALUES(?,?)').bind(sid, Math.floor(Date.now()/1000)+3600).run();
    const cookie = `${ADMIN_COOKIE}=${await signed(env, 'admin', { sid }, 3600)}`;
    const responses = await Promise.all([0, 1].map(async index => {
      let offset = 0; const input=inputs[index];
      const body = new ReadableStream({ pull(controller) {
        if (offset === input.length) { controller.close(); return; }
        const next = Math.min(offset + 64 * 1024, input.length); controller.enqueue(input.subarray(offset, next)); offset = next;
      } });
      const response = await mf.dispatchFetch(`https://garden.test/admin-api/upload?key=shadow-garden/books/overlap-${index}.epub`, {
        method: 'POST', headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, cookie, origin: 'https://garden.test',
          'content-type': 'application/epub+zip', ...(knownLengths[index] ? { 'content-length': String(input.length) } : {}) }, body, duplex: 'half'
      });
      return { status: response.status, result: await response.json() };
    }));
    assert.ok(responses.some(response => response.status === 200));
    for (const response of responses) assert.ok(response.status === 200 || response.status === 503, JSON.stringify(response));
    const successful = responses.filter(response => response.status === 200).length;
    assert.equal(received.length, successful);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM media_uploads').first()).n, successful);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM media_upload_activity').first()).n, 0);
    const row = { knownLength, knownLengths, sizesMiB, statuses: responses.map(response => response.status), received, providerCalls, buffered: buffered.size,
      peakBackingMiB: Math.max(...samples.map(sample => sample.backingStorageSize))/MiB, samples };
    results.push(row); console.log(JSON.stringify({ ref, ...row, samples: undefined }));
  } finally { clearTimeout(timer); release(); if (cdp) await cdp.close(); await mf.dispose(); }
}
if (output) await writeFile(output, JSON.stringify({ ref, httpSourceSha256: createHash('sha256').update(await source('server/http.js')).digest('hex'),
  node: process.version, workerd: JSON.parse(await readFile(new URL('../node_modules/workerd/package.json', import.meta.url), 'utf8')).version,
  compatibilityDate: '2026-09-23', chunkBytes: 64*1024, overlap: 2, primaryFileMiB: 50, results }, null, 2)+'\n');
