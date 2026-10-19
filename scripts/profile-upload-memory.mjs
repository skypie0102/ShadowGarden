// Local workerd measurement; all provider calls are intercepted and D1 is ephemeral.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {crc32} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {ADMIN_COOKIE,signed} from '../server/security.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const ref=process.argv[2]||'working-tree';
const output=process.argv[3];
const MiB=1024*1024;
const source=async path=>ref==='working-tree'?readFile(new URL(path,`file://${root}`),'utf8'):execFileSync('git',['show',`${ref}:${path}`],{cwd:root,encoding:'utf8'});

// A stored ZIP containing only generated technical content. No real books.
function epub(size){
  const entries=[['mimetype',Buffer.from('application/epub+zip')],['META-INF/container.xml',Buffer.from('<container/>')],['book.opf',Buffer.from('<package/>')],['padding.bin',Buffer.alloc(0)]];
  const overhead=entries.reduce((n,[name,bytes])=>n+76+2*Buffer.byteLength(name)+bytes.length,22);
  entries[3][1]=Buffer.alloc(size-overhead,97);
  const local=[],central=[];let offset=0;
  for(const [name,bytes] of entries){
    const filename=Buffer.from(name),header=Buffer.alloc(30),directory=Buffer.alloc(46);
    const checksum=crc32(bytes);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(checksum,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(filename.length,26);
    directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(20,4);directory.writeUInt16LE(20,6);directory.writeUInt32LE(checksum,16);directory.writeUInt32LE(bytes.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(filename.length,28);directory.writeUInt32LE(offset,42);
    local.push(header,filename,bytes);central.push(directory,filename);offset+=30+filename.length+bytes.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

async function inspector(mf){
  const base=await mf.getInspectorURL();base.protocol='http:';
  const targets=await (await fetch(new URL('/json/list',base))).json();
  const target=targets.find(t=>t.id==='core:user:upload-profile');assert.ok(target,'Upload worker inspector target');
  const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let sequence=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  ws.onmessage=({data})=>{const message=JSON.parse(data),call=pending.get(message.id);if(call){pending.delete(message.id);message.error?call.reject(new Error(JSON.stringify(message.error))):call.resolve(message.result)}};
  return {
    call(method){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method}));})},
    async close(){const closed=new Promise(resolve=>ws.addEventListener('close',resolve,{once:true}));ws.close();await closed;}
  };
}

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
      .replace('return collected;',"await globalThis.__sgMemory('buffered'); return collected;");
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
