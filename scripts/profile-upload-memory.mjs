// Local workerd measurement; all provider calls are intercepted and D1 is ephemeral.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {ADMIN_COOKIE,signed} from '../server/security.js';
import {epub,inspector} from './upload-profile-support.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const ref=process.argv[2]||'working-tree';
const output=process.argv[3];
const MiB=1024*1024;
const source=async path=>ref==='working-tree'?readFile(new URL(path,`file://${root}`),'utf8'):execFileSync('git',['show',`${ref}:${path}`],{cwd:root,encoding:'utf8'});

const bundle=await build({stdin:{contents:`
  import {upload} from './server/admin.js';
  import {endpoint} from './server/http.js';
  globalThis.__sgMemory=async phase=>{const response=await fetch('https://profile.invalid/'+phase);await response.text()};
  export default {async fetch(request,env){await globalThis.__sgMemory('start');const response=await endpoint(upload)({request,env});await globalThis.__sgMemory('complete');return response;}};
`,resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',plugins:[{
  name:'profile-source',setup(build){build.onLoad({filter:/\/server\/.*\.js$/},async({path})=>{
    let contents=await source(path.slice(root.length));
    // Checkpoint code exists only in this disposable bundle, never in application source.
    if(path.endsWith('/http.js'))contents=contents
      .replace('const bytes = new Uint8Array(size);',"await globalThis.__sgMemory('collected'); const bytes = new Uint8Array(size);")
      .replace('const collected = new Uint8Array(size);',"await globalThis.__sgMemory('collected'); const collected = new Uint8Array(size);")
      .replace('return bytes;',"await globalThis.__sgMemory('buffered'); return bytes;")
      .replace('return collected;',"await globalThis.__sgMemory('buffered'); return collected;")
      .replace('return new Uint8Array(buffer.transferToFixedLength());',"const collected=new Uint8Array(buffer.transferToFixedLength()); await globalThis.__sgMemory('buffered'); return collected;");
    return {contents,loader:'js'};
  })}
}]});

const results=[];
for(const size of [1,10,50,50+1/MiB])for(const knownLength of [true,false]){
  const bytes=epub(size*MiB),expectedHash=createHash('sha1').update(bytes).digest('hex');
  const rejected=size>50,samples=[];let cdp,received=0,providerCalls=0;
  const sample=async phase=>{const usage=await cdp.call('Runtime.getHeapUsage');samples.push({phase,...usage});};
  const env={ADMIN_TOKEN:'upload-profile-disposable-token',SESSION_SECRET:'upload-profile-disposable-session-secret',B2_APPLICATION_KEY_ID:'upload-profile-key',B2_APPLICATION_KEY:'disposable-key',B2_BUCKET_ID:'fixture',B2_BUCKET_NAME:'fixture'};
  const mf=new Miniflare(convertV4MiniflareOptions({
    name:'upload-profile',modules:true,script:bundle.outputFiles[0].text,compatibilityDate:'2026-09-23',inspectorPort:0,
    bindings:env,d1Databases:['DB'],outboundService:async request=>{
      const url=new URL(request.url);
      if(url.hostname==='profile.invalid'){await sample(url.pathname.slice(1));return new Response('ok')}
      providerCalls++;
      if(url.pathname.endsWith('b2_authorize_account'))return Response.json({authorizationToken:'fixture',apiInfo:{storageApi:{apiUrl:'https://api.unit.backblazeb2.com',downloadUrl:'https://download.unit.backblazeb2.com',allowed:{buckets:[{id:'fixture',name:'fixture'}]}}}});
      if(url.pathname.startsWith('/file/')){assert.equal(request.method,'HEAD');return new Response(null,{status:404})}
      if(url.pathname.endsWith('b2_get_upload_url'))return Response.json({uploadUrl:'https://pod-000.backblaze.com/upload',authorizationToken:'fixture'});
      if(url.pathname==='/upload'){
        await sample('provider-start');
        assert.equal(request.headers.get('x-bz-content-sha1'),expectedHash);
        const hash=createHash('sha1');for await(const chunk of request.body){received+=chunk.length;hash.update(chunk)}
        assert.equal(hash.digest('hex'),expectedHash);assert.equal(received,bytes.length);
        await sample('provider-drained');return Response.json({fileId:'disposable-profile-file'});
      }
      throw new Error(`Unexpected outbound call: ${url.hostname}${url.pathname}`);
    }
  }));
  try{
    await mf.ready;cdp=await inspector(mf);
    const db=await mf.getD1Database('DB');
    for(const name of (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
      const sql=await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8');
      await db.exec(sql.replace(/--[^\n]*/g,'').replace(/\n/g,' '));
    }
    const sid='upload-profile-session';await db.prepare('INSERT INTO admin_sessions(id,expires_at) VALUES(?,?)').bind(sid,Math.floor(Date.now()/1000)+3600).run();
    let offset=0;
    const body=new ReadableStream({pull(controller){if(offset===bytes.length){controller.close();return}const next=Math.min(offset+64*1024,bytes.length);controller.enqueue(bytes.subarray(offset,next));offset=next;}});
    const response=await mf.dispatchFetch('https://garden.test/admin-api/upload?key=shadow-garden/books/profile.epub',{
      method:'POST',headers:{authorization:`Bearer ${env.ADMIN_TOKEN}`,cookie:`${ADMIN_COOKIE}=${await signed(env,'admin',{sid},3600)}`,origin:'https://garden.test','content-type':'application/epub+zip',...(knownLength?{'content-length':String(bytes.length)}:{})},body,duplex:'half'
    });
    const result=await response.json();assert.equal(response.status,rejected?413:200,JSON.stringify(result));
    if(rejected){assert.equal(result.code,'body_too_large');assert.equal(providerCalls,0);assert.equal(received,0)}
    else assert.equal(result.size,bytes.length);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM media_uploads').first()).n,rejected?0:1);
    assert.equal((await db.prepare('SELECT count(*) AS n FROM media_upload_activity').first()).n,0);
    const row={sizeMiB:size,knownLength,status:response.status,received,providerCalls,samples};results.push(row);
    console.log(JSON.stringify({ref,sizeMiB:size,knownLength,status:response.status,peakBackingMiB:Math.max(...samples.map(s=>s.backingStorageSize))/MiB,peakHeapMiB:Math.max(...samples.map(s=>s.usedSize))/MiB}));
  }finally{if(cdp)await cdp.close();await mf.dispose()}
}
const report={ref,httpSourceSha256:createHash('sha256').update(await source('server/http.js')).digest('hex'),node:process.version,compatibilityDate:'2026-09-23',workerd:JSON.parse(await readFile(new URL('../node_modules/workerd/package.json',import.meta.url),'utf8')).version,chunkBytes:64*1024,results};
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
