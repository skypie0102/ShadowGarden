import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {upload,catalog,maintenance,backup,abuse,statusEndpoint} from '../server/admin.js';
import {validateEpub} from '../server/epub.js';
import {loadState} from '../server/state.js';
import {rateLimit,clientId} from '../server/security.js';

// Minimal stored ZIP fixture. Only technical fixture content; no recovered book text.
function epubFixture(){
  const files=[['mimetype','application/epub+zip'],['META-INF/container.xml','<container/>'],['book.opf','<package/>']];
  const local=[],central=[];let offset=0;
  for(const [name,text] of files){const n=Buffer.from(name),b=Buffer.from(text),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);local.push(h,n,b);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+b.length;}
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
function mockStorage(t,env){
  Object.assign(env,{B2_APPLICATION_KEY_ID:crypto.randomUUID(),B2_APPLICATION_KEY:'test-storage-key',B2_BUCKET_ID:'test-bucket',B2_BUCKET_NAME:'test-bucket'});
  const objects=new Map();
  t.mock.method(globalThis,'fetch',async(input,options={})=>{
    const url=new URL(input);
    if(url.pathname.endsWith('b2_authorize_account'))return Response.json({apiUrl:'https://api.unit.backblazeb2.com',downloadUrl:'https://download.unit.backblazeb2.com',authorizationToken:'test-auth',allowed:{bucketId:'test-bucket'}});
    if(url.pathname.endsWith('b2_get_upload_url'))return Response.json({uploadUrl:'https://upload.unit.backblazeb2.com/upload',authorizationToken:'test-upload-auth'});
    if(url.pathname==='/upload'){const key=decodeURIComponent(options.headers['x-bz-file-name']);objects.set(key,new Uint8Array(options.body));return Response.json({fileId:'test-file-id'});}
    const key=decodeURIComponent(url.pathname.replace('/file/test-bucket/','')),bytes=objects.get(key);
    return bytes?new Response(options.method==='HEAD'?null:bytes,{headers:{'content-length':String(bytes.length)}}):new Response(null,{status:404});
  });return objects;
}
test('EPUB structural checks reject disguised and malformed archives',()=>{
  const bytes=epubFixture();assert.equal(validateEpub(bytes).entries,3);
  assert.throws(()=>validateEpub(Buffer.from('PK\x03\x04not an epub')));
  const corrupt=Buffer.from(bytes);corrupt.writeUInt32LE(0xffffffff,corrupt.length-6);assert.throws(()=>validateEpub(corrupt));
  const mime=Buffer.from(bytes);mime[38]=0;assert.throws(()=>validateEpub(mime));
});
test('upload, catalog insert and replacement preserve identity and old bytes',async(t)=>{
  const env=fixture(),headers=await adminHeaders(env),objects=mockStorage(t,env),key='shadow-garden/books/first.epub';
  const bytes=epubFixture();
  const uploadCtx=k=>({env,request:new Request(`https://garden.test/admin-api/upload?key=${k}`,{method:'POST',headers:{...headers,'content-type':'application/epub+zip'},body:bytes})});
  assert.equal((await endpoint(upload)(uploadCtx(key))).status,200);
  assert.equal((await endpoint(upload)(uploadCtx(key))).status,409);
  const payload={series:'Test Series',title:'Test Volume',number:1,epubKey:key,adult:false,size:999999};
  const add=await endpoint(catalog)(context(env,'/admin-api/catalog','POST',payload,headers));assert.equal(add.status,200);const added=await add.json();
  const first=(await loadState(env)).document.main[0].volumes[0];assert.equal(first.size,bytes.length);
  assert.equal((await endpoint(catalog)(context(env,'/admin-api/catalog','POST',payload,headers))).status,409);
  const nextKey='shadow-garden/books/replacement.epub';assert.equal((await endpoint(upload)(uploadCtx(nextKey))).status,200);
  const replaced=await endpoint(catalog)(context(env,'/admin-api/catalog','POST',{...payload,epubKey:nextKey,duplicatePolicy:'replace',replaceTargetFile:`/media/${key}`},headers));
  assert.equal(replaced.status,200);assert.equal((await replaced.json()).bookId,added.bookId);
  const row=await loadState(env);assert.equal(row.document.books[added.bookId],nextKey);assert.ok(objects.has(key));
  const snapshot=env.DB.sqlite.prepare("SELECT document FROM snapshots WHERE reason='replace-volume'").get();assert.equal(JSON.parse(snapshot.document).books[added.bookId],key);
});
test('missing objects cannot be cataloged and unsupported media cannot be uploaded',async(t)=>{
  const env=fixture(),headers=await adminHeaders(env);mockStorage(t,env);
  const result=await endpoint(catalog)(context(env,'/admin-api/catalog','POST',{series:'Missing',title:'Missing',number:1,epubKey:'shadow-garden/books/missing.epub'},headers));assert.equal(result.status,400);assert.equal((await loadState(env)).document.main.length,0);
  const response=await endpoint(upload)({env,request:new Request('https://garden.test/admin-api/upload?key=shadow-garden/covers/evil.svg',{method:'POST',headers,body:'<svg/>'})});assert.equal(response.status,400);
});
test('backup deletion affects only selected snapshot; status and object checks retain contract',async(t)=>{
  const env=fixture(),headers=await adminHeaders(env);mockStorage(t,env);
  assert.equal((await endpoint(statusEndpoint)(context(env,'/admin-api/status','POST',undefined,headers))).status,200);
  await endpoint(maintenance)(context(env,'/admin-api/maintenance','POST',{action:'create-backup'},headers));
  const id=env.DB.sqlite.prepare('SELECT id FROM snapshots').get().id;
  assert.equal((await endpoint(backup)(context(env,'/admin-api/backup','POST',{action:'delete',id},headers))).status,200);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) AS n FROM snapshots').get().n,0);
  assert.equal((await loadState(env)).document.adult[0].volumes.length,5);
  const checked=await endpoint(maintenance)(context(env,'/admin-api/maintenance','POST',{action:'check-objects',keys:['shadow-garden/books/missing.epub']},headers));
  assert.equal((await checked.json()).missing.length,1);
});
test('public cooldown release retains the event and never releases admin limits',async()=>{
  const env=fixture(),ctx=context(env,'/human-access'),headers=await adminHeaders(env);
  await rateLimit(ctx,'human',1,600);await assert.rejects(rateLimit(ctx,'human',1,600));
  await rateLimit(ctx,'admin',1,600);await assert.rejects(rateLimit(ctx,'admin',1,600));
  const id=await clientId(ctx),response=await endpoint(abuse)(context(env,'/admin-api/abuse','POST',{action:'release',clientId:id},headers));assert.equal(response.status,200);
  const events=(await response.json()).events;assert.ok(events.find(e=>e.kind==='public_cooldown').releasedAt);assert.equal(events.find(e=>e.kind==='admin_cooldown').releasedAt,null);
  assert.ok(env.DB.sqlite.prepare('SELECT * FROM rate_limits WHERE id=?').get('admin:'+id));
});
