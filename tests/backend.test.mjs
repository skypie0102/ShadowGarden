import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {adminAccess,humanAccess,signed,verified,HUMAN_COOKIE,rateLimit,digest} from '../server/security.js';
import {bookAccess,media,bookIdForKey} from '../server/books.js';
import {loadState,saveState,publicCatalog} from '../server/state.js';
import {library,maintenance,seriesBanner,translationUpdate,readiness,statusEndpoint,abuse,backup,catalog,upload,recovery} from '../server/admin.js';
import {objectKey,getObject} from '../server/storage.js';
const call=(fn,ctx)=>endpoint(fn)(ctx);

test('static fallback preserves all recovered volumes and never fabricates mappings',async()=>{
  const row=await loadState({});assert.equal(row.document.adult[0].volumes.length,5);assert.deepEqual(row.document.books,{});
  const env=fixture();delete env.DB;
  const response=await call(media,context(env,'/media/shadow-garden/data/adult-catalog.json'));
  assert.equal(response.status,200);assert.equal((await response.json()).series[0].volumes.length,5);
});
test('admin routes require both bearer token and revocable session',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  assert.equal((await call(library,context(env,'/admin-api/library'))).status,401);
  assert.equal((await call(library,context(env,'/admin-api/library','GET',undefined,{authorization:headers.authorization}))).status,401);
  assert.equal((await call(library,context(env,'/admin-api/library','GET',undefined,headers))).status,200);
  await call(adminAccess,context(env,'/admin-access','DELETE',undefined,headers));
  assert.equal((await call(library,context(env,'/admin-api/library','GET',undefined,headers))).status,401);
});
test('cross-origin and unsupported methods are rejected before mutation',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  assert.equal((await call(library,context(env,'/admin-api/library','POST',{action:'delete-series',id:'adult-adolescent-adam'},{...headers,origin:'https://evil.test'}))).status,403);
  assert.equal((await call(library,context(env,'/admin-api/library','DELETE',undefined,headers))).status,405);
  assert.equal((await loadState(env)).revision,0);
});
test('signed sessions reject tampering, expiry, wrong purpose and rotation',async()=>{
  const env=fixture(),token=await signed(env,'human',{},30);
  assert.ok(await verified(env,token,'human'));
  assert.equal(await verified(env,token+'x','human'),null);
  assert.equal(await verified(env,token,'admin'),null);
  assert.equal(await verified(env,await signed(env,'human',{},-1),'human'),null);
  assert.equal(await verified({...env,SESSION_SECRET:'rotated'.repeat(10)},token,'human'),null);
});
test('Turnstile validates action and hostname; arbitrary tokens cannot unlock',async(t)=>{
  const env=fixture();let result={success:true,action:'wrong_action',hostname:'garden.test'};
  t.mock.method(globalThis,'fetch',async()=>Response.json(result));
  assert.equal((await call(adminAccess,context(env,'/admin-access','POST',{adminToken:env.ADMIN_TOKEN,turnstileToken:'token'}))).status,403);
  result={success:true,action:'admin_access',hostname:'other.test'};
  assert.equal((await call(adminAccess,context(env,'/admin-access','POST',{adminToken:env.ADMIN_TOKEN,turnstileToken:'token'}))).status,403);
  result={success:true,action:'admin_access',hostname:'garden.test'};
  const response=await call(adminAccess,context(env,'/admin-access','POST',{adminToken:env.ADMIN_TOKEN,turnstileToken:'token'}));
  assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);
  result={success:false};assert.equal((await call(humanAccess,context(env,'/human-access','POST',{token:'invalid'}))).status,403);
});
test('missing security configuration fails closed',async()=>{
  const env=fixture();delete env.TURNSTILE_SECRET_KEY;
  assert.equal((await call(adminAccess,context(env,'/admin-access'))).status,503);
  delete env.BOOK_SIGNING_SECRET;
  assert.equal((await call(bookAccess,context(env,'/book-access','POST',{bookId:'bk_A2yCOKedG1g4xXTJJhbEzA'}))).status,503);
});
test('rate limits persist and report pseudonymous cooldowns',async()=>{
  const env=fixture(),ctx=context(env,'/admin-access');
  await rateLimit(ctx,'admin',2,600);await rateLimit(ctx,'admin',2,600);
  await assert.rejects(rateLimit(ctx,'admin',2,600),e=>e.status===429);
  const events=env.DB.sqlite.prepare('SELECT * FROM security_events').all();assert.equal(events.length,1);assert.match(events[0].client_id,/^[A-Za-z0-9_-]{43}$/);
});
test('catalog edits create checksummed backups and reject stale writers atomically',async()=>{
  const env=fixture(),a=await loadState(env),b=await loadState(env);
  const next=structuredClone(a.document);next.adult[0].title='Edited';await saveState(env,a,next,'edit');
  await assert.rejects(saveState(env,b,b.document,'stale'),e=>e.status===409);
  const snapshots=env.DB.sqlite.prepare('SELECT * FROM snapshots').all();assert.equal(snapshots.length,1);
  assert.equal(await digest(snapshots[0].document),snapshots[0].sha256);
  assert.equal((await loadState(env)).document.adult[0].title,'Edited');
});
test('series and volume edits, banner contract, translations and safe links',async()=>{
  const env=fixture(),headers=await adminHeaders(env),id='adult-adolescent-adam';
  const post=(fn,path,body)=>call(fn,context(env,path,'POST',body,headers));
  assert.equal((await post(library,'/admin-api/library',{action:'update-series',id,audioAlignedUrl:'javascript:alert(1)'})).status,400);
  assert.equal((await post(library,'/admin-api/library',{action:'update-series',id,title:'Edited',status:'completed'})).status,200);
  assert.equal((await post(library,'/admin-api/library',{action:'update-volume',id,volumeIndex:0,title:'First',number:1})).status,200);
  const bookId=(await loadState(env)).document.adult[0].volumes[0].bookId;
  assert.equal((await post(seriesBanner,'/admin-api/series-banner',{id,bannerBookId:bookId})).status,200);
  const banner=await (await call(seriesBanner,context(env,`/admin-api/series-banner?id=${id}`,'GET',undefined,headers))).json();assert.equal(banner.current,bookId);
  assert.equal((await post(translationUpdate,'/admin-api/translations',{id,target:'volume',volumeIndex:0,translations:[{name:'Translator',url:'javascript:bad'}]})).status,200);
  assert.equal((await loadState(env)).document.adult[0].volumes[0].translations[0].url,undefined);
});
test('trash restoration and snapshot restoration preserve recovered data',async()=>{
  const env=fixture(),headers=await adminHeaders(env),id='adult-adolescent-adam';
  await call(library,context(env,'/admin-api/library','POST',{action:'delete-series',id},headers));
  const deleted=await loadState(env);assert.equal(deleted.document.adult.length,0);assert.equal(deleted.document.trash.length,1);
  const restored=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-trash',id:deleted.document.trash[0].id},headers));assert.equal(restored.status,200);
  assert.equal((await loadState(env)).document.adult[0].volumes.length,5);
  const original=env.DB.sqlite.prepare("SELECT id FROM snapshots WHERE reason='delete-series'").get();
  const response=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id:original.id},headers));assert.equal(response.status,200);
});
test('catalog checksum corruption prevents restore and missing media prevents READY',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'create-backup'},headers));
  const id=env.DB.sqlite.prepare('SELECT id FROM snapshots').get().id;
  env.DB.sqlite.prepare('UPDATE snapshots SET sha256 = ? WHERE id = ?').run('bad',id);
  assert.equal((await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id},headers))).status,409);
  const report=await (await call(readiness,context(env,'/admin-api/recovery-readiness','GET',undefined,headers))).json();
  assert.equal(report.readiness.status,'not-ready');assert.equal(report.summary.damaged,1);
});
test('unknown recovery mutation and irreversible purge report unavailable',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  assert.equal((await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'purge-trash',ids:[]},headers))).status,501);
  assert.equal((await call(recovery,context(env,'/admin-api/recovery','POST',{},headers))).status,501);
  assert.equal((await loadState(env)).revision,0);
});
test('book IDs match the recovered client derivation and reject traversal',async()=>{
  const key='shadow-garden/books/test/volume.epub',id=await bookIdForKey(key);
  const full=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`shadow-garden-book-id-v1\n/media/${key}`));
  assert.equal(id,'bk_'+Buffer.from(full).subarray(0,16).toString('base64url'));
  for(const key of ['../secrets','shadow-garden/books/../x.epub','shadow-garden/books/%2e%2e/x.epub','shadow-garden/covers/a.svg','shadow-garden/data/private.json'])assert.throws(()=>objectKey(key));
});
test('missing private mapping is explicit and protected bytes never fall back to static assets',async()=>{
  const env=fixture(),bookId='bk_A2yCOKedG1g4xXTJJhbEzA';let assetsCalled=false;
  env.ASSETS.fetch=async()=>{assetsCalled=true;return new Response('secret');};
  assert.equal((await call(bookAccess,context(env,'/book-access','POST',{bookId}))).status,428);
  const human=await signed(env,'human',{},3600);
  const result=await call(bookAccess,context(env,'/book-access','POST',{bookId},{cookie:`${HUMAN_COOKIE}=${human}`}));assert.equal((await result.json()).code,'book_mapping_missing');
  assert.equal((await call(media,context(env,'/media/shadow-garden/books/missing.epub'))).status,404);assert.equal(assetsCalled,false);
});
test('book tickets are bound to exact active objects and support reader cookie fetches',async(t)=>{
  const env=fixture(),key='shadow-garden/books/test.epub',row=await loadState(env),bookId=row.document.adult[0].volumes[0].bookId;
  row.document.books[bookId]=key;await saveState(env,row,row.document,'restore-mapping');
  const human=await signed(env,'human',{},3600);
  const response=await call(bookAccess,context(env,'/book-access','POST',{bookId},{cookie:`${HUMAN_COOKIE}=${human}`}));assert.equal(response.status,200);
  const ticket=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
  Object.assign(env,{B2_APPLICATION_KEY_ID:'test-id',B2_APPLICATION_KEY:'test-key',B2_BUCKET_ID:'test-bucket',B2_BUCKET_NAME:'garden'});
  t.mock.method(globalThis,'fetch',async(url,options)=>String(url).includes('b2_authorize_account')?Response.json({apiUrl:'https://api.example.backblazeb2.com',downloadUrl:'https://download.example.backblazeb2.com',authorizationToken:'private-provider-token'}):new Response(options.method==='HEAD'?null:'epub-bytes',{headers:{'content-type':'application/epub+zip','x-bz-private':'secret'}}));
  const bytes=await call(media,context(env,'/media/'+key,'GET',undefined,{cookie}));assert.equal(bytes.status,200);assert.equal(await bytes.text(),'epub-bytes');assert.equal(bytes.headers.get('x-bz-private'),null);assert.equal(bytes.headers.get('cache-control'),'private, no-store');
  assert.equal((await call(media,context(env,ticket.url))).status,200);
  assert.equal((await call(media,context(env,'/media/'+key))).status,403);
  assert.equal((await call(media,context(env,ticket.url+'broken'))).status,403);
  const updated=await loadState(env);updated.document.adult[0].volumes.shift();await saveState(env,updated,updated.document,'delete');
  assert.equal((await call(media,context(env,ticket.url))).status,404);
});
test('public catalog strips all private coordinates while admin retains them',async()=>{
  const row=await loadState(fixture());row.document.adult[0].volumes[0].file='/private';row.document.adult[0].volumes[0].sha256='hash';
  const text=JSON.stringify(publicCatalog(row,true));assert.ok(!text.includes('/private'));assert.ok(!text.includes('sha256'));assert.ok(text.includes('bk_'));
});
test('malformed, oversized and stale payloads fail without editing state',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  assert.equal((await call(library,context(env,'/admin-api/library','POST','{bad',headers))).status,400);
  assert.equal((await call(library,context(env,'/admin-api/library','POST',{}, {...headers,'content-length':'999999999'}))).status,413);
  assert.equal((await call(library,context(env,'/admin-api/library','POST',{action:'delete-series',id:'adult-adolescent-adam'}, {...headers,'if-match':'99'}))).status,409);
  assert.equal((await loadState(env)).revision,0);
});
