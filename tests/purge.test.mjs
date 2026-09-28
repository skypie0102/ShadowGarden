import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {maintenance,upload} from '../server/admin.js';
import {loadState,saveState} from '../server/state.js';
import {digest,now} from '../server/security.js';

const call=(fn,ctx)=>endpoint(fn)(ctx);
const key='shadow-garden/books/purge-fixture.epub';
const empty=()=>({main:[],adult:[],books:{},trash:[]});
async function setup(t,{cover=false}={}) {
  const env=fixture(),headers=await adminHeaders(env);t.after(()=>env.DB.sqlite.close());
  const series=(await loadState(env)).document.adult[0];series.volumes=series.volumes.slice(0,1);
  for(const item of [series,...series.volumes]){delete item.cover;delete item.coverThumb;}
  const doc=empty();doc.books[series.volumes[0].bookId]=key;
  if(cover)series.cover='/media/shadow-garden/covers/fixture.png';
  doc.trash.push({id:'selected',type:'series',seriesId:series.id,scope:'adult',series});
  const write=value=>env.DB.sqlite.prepare('UPDATE library_state SET document=? WHERE id=1').run(JSON.stringify(value));write(doc);
  const post=(payload,extra={})=>call(maintenance,context(env,'/admin-api/maintenance','POST',payload,{...headers,'if-match':String(env.DB.sqlite.prepare('SELECT revision FROM library_state').get().revision),...extra}));
  return {env,headers,doc,write,post};
}
function provider(t,env,n=1) {
  Object.assign(env,{B2_APPLICATION_KEY_ID:crypto.randomUUID(),B2_APPLICATION_KEY:'fixture-key',B2_BUCKET_ID:'bucket',B2_BUCKET_NAME:'garden'});
  const state={files:Array.from({length:n},(_,i)=>({fileName:key,fileId:`v${i}`,bucketId:'bucket',action:['upload','hide','start'][i%3]})),deleted:[],requests:[],beforeDelete:null};
  t.mock.method(globalThis,'fetch',async(input,options={})=>{
    const url=new URL(input);
    if(url.pathname.endsWith('b2_authorize_account'))return Response.json({apiUrl:'https://api.test.backblazeb2.com',downloadUrl:'https://download.test.backblazeb2.com',authorizationToken:'fixture'});
    if(options.method==='HEAD')return new Response(null,{status:404});
    const payload=JSON.parse(options.body);state.requests.push({path:url.pathname,payload});
    if(url.pathname.endsWith('b2_list_file_versions')){
      const files=state.files.filter(f=>f.fileName.startsWith(payload.prefix)).sort((a,b)=>a.fileName.localeCompare(b.fileName));
      return Response.json({files:files.slice(0,payload.maxFileCount),nextFileName:files[payload.maxFileCount]?.fileName||null});
    }
    if(url.pathname.endsWith('b2_delete_file_version')){
      if(state.beforeDelete){const result=await state.beforeDelete(payload);if(result)return result;}
      state.deleted.push(payload);const i=state.files.findIndex(f=>f.fileId===payload.fileId&&f.fileName===payload.fileName);
      if(i<0)return Response.json({code:'file_not_present'},{status:400});
      state.files.splice(i,1);return Response.json(payload);
    }
    throw new Error('Unexpected provider operation');
  });return state;
}
async function saveSnapshot(env,doc,{id=crypto.randomUUID(),date='2020-01-01',sha256}={}) {
  const text=JSON.stringify(doc);await env.DB.prepare('INSERT INTO snapshots(id,reason,created_at,document,sha256) VALUES(?,?,?,?,?)').bind(id,'fixture',date,text,sha256??await digest(text)).run();return id;
}

test('purge removes selected metadata and all exact-key versions without touching neighbouring objects',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env,3);
  storage.files.push({fileName:key+'.neighbour.epub',fileId:'neighbour',bucketId:'bucket',action:'upload'});
  const response=await post({action:'purge-trash',ids:['selected']});assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.purge.complete,true);assert.equal(result.purge.deleted,1);assert.equal(result.trash.length,0);
  assert.deepEqual((await loadState(env)).document,empty());assert.equal(result.revision,1);
  assert.equal(storage.deleted.length,3);assert.ok(storage.deleted.every(p=>p.fileName===key&&!('bypassGovernance' in p)));
  assert.deepEqual(storage.files.map(f=>f.fileId),['neighbour']);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM snapshots').get().n,0);
  assert.ok(env.DB.sqlite.prepare('SELECT deleted_at FROM media_retirements').get().deleted_at);
});

test('cleanup batches versions and survives repeated continuation requests',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env,8);
  let response=await post({action:'purge-trash',ids:[]});assert.equal(response.status,202);let result=await response.json();assert.equal(result.purge.pending,1);assert.equal(storage.deleted.length,5);
  const payload={action:'continue-purge',jobId:result.purge.id};response=await post(payload);assert.equal(response.status,200);result=await response.json();assert.equal(result.purge.complete,true);assert.equal(storage.deleted.length,8);
  assert.equal((await post(payload)).status,200);assert.equal(storage.deleted.length,8);assert.equal((await loadState(env)).revision,1);
});

test('all retained snapshots protect media including old history and damaged records',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env);
  const old=await saveSnapshot(env,{privateMap:{old:key}},{sha256:'damaged'});
  for(let i=0;i<201;i++)await saveSnapshot(env,empty(),{date:`2026-${String(i).padStart(3,'0')}`});
  let result=await (await post({action:'purge-trash',ids:[]})).json();assert.equal(result.purge.retained,1);assert.equal(storage.requests.length,0);
  assert.equal(result.backups.some(b=>b.id===old),false);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM snapshots').get().n,202);
  env.DB.sqlite.prepare('DELETE FROM snapshots WHERE id=?').run(old);
  result=await (await post({action:'continue-purge',jobId:result.purge.id})).json();assert.equal(result.purge.complete,true);assert.equal(storage.deleted.length,1);
});

test('live references and unselected Trash keep shared media and private mappings',async t=>{
  const {env,doc,write,post}=await setup(t),storage=provider(t,env);
  doc.adult.push(structuredClone(doc.trash[0].series));doc.trash.push({...structuredClone(doc.trash[0]),id:'keep'});write(doc);
  const result=await (await post({action:'purge-trash',ids:['selected']})).json();assert.equal(result.purge.retained,1);assert.deepEqual(result.trash.map(t=>t.id),['keep']);
  const current=(await loadState(env)).document;assert.equal(current.books[doc.adult[0].volumes[0].bookId],key);assert.equal(storage.requests.length,0);
});

test('bundled covers remain available while the private book is deleted',async t=>{
  const {env,post}=await setup(t,{cover:true}),storage=provider(t,env);
  env.ASSETS.fetch=async()=>new Response(null,{headers:{'content-type':'image/png'}});
  const result=await (await post({action:'purge-trash',ids:[]})).json();assert.equal(result.purge.deleted,1);assert.equal(result.purge.staticAssets,1);assert.equal(result.purge.complete,true);assert.equal(storage.deleted.length,1);
});

test('provider failures and Object Lock remain retryable without a false success or retention bypass',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env,3);
  storage.beforeDelete=p=>p.fileId==='v1'?Response.json({code:'access_denied'},{status:401}):null;
  const response=await post({action:'purge-trash',ids:[]});assert.equal(response.status,202);let result=await response.json();assert.equal(result.purge.failed,1);assert.match(result.purge.issues[0].detail,/retention|hold/);assert.equal(result.purge.deleted,0);assert.equal(storage.deleted.length,1);
  storage.beforeDelete=null;result=await (await post({action:'continue-purge',jobId:result.purge.id})).json();assert.equal(result.purge.complete,true);assert.equal(storage.deleted.length,3);assert.ok(storage.deleted.every(p=>!('bypassGovernance' in p)));
});

test('stale, unauthenticated, cross-origin and changed selections cannot enqueue deletion',async t=>{
  const {env,headers,post}=await setup(t),storage=provider(t,env);
  for(const [ids,extra,status] of [[['selected'],{'if-match':'99'},409],[['selected'],{'if-match':''},428],[['missing'],{},409],[['selected','selected'],{},400],[['selected'],{authorization:''},401],[['selected'],{origin:'https://elsewhere.test'},403]])assert.equal((await post({action:'purge-trash',ids},extra)).status,status);
  assert.equal((await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'continue-purge',jobId:'absent'},headers))).status,404);
  assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM purge_jobs').get().n,0);assert.equal((await loadState(env)).revision,0);assert.equal(storage.requests.length,0);
});

test('active uploads defer cleanup and retired media cannot be adopted during deletion',async t=>{
  const {env,doc,post}=await setup(t),storage=provider(t,env);
  env.DB.sqlite.prepare('INSERT INTO media_upload_activity VALUES(?,?,?)').run(key,'active',now()+90);
  let result=await (await post({action:'purge-trash',ids:[]})).json();assert.equal(result.purge.retained,1);assert.equal(storage.deleted.length,0);
  env.DB.sqlite.prepare('UPDATE media_upload_activity SET expires_at=0').run();
  storage.beforeDelete=async()=>{
    const row=await loadState(env);await assert.rejects(saveState(env,row,doc,'adopt-retired'),/media_retired/);
    assert.throws(()=>env.DB.sqlite.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?)').run('racing','fixture','2026',JSON.stringify(doc),'hash'),/media_retired/);
    assert.throws(()=>env.DB.sqlite.prepare('UPDATE library_state SET document=?').run(JSON.stringify(doc)),/media_retired/);
    assert.throws(()=>env.DB.sqlite.prepare('INSERT INTO media_uploads(object_key,created_at) VALUES(?,?)').run(key,'2026'),/media_retired/);
  };
  result=await (await post({action:'continue-purge',jobId:result.purge.id})).json();assert.equal(result.purge.complete,true);assert.deepEqual((await loadState(env)).document,empty());assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM snapshots').get().n,0);
});

test('missing B2 configuration leaves a durable failed job and deleted keys reject later uploads',async t=>{
  const {env,headers,post}=await setup(t,{cover:true});
  let response=await post({action:'purge-trash',ids:[]});assert.equal(response.status,202);let result=await response.json();assert.equal(result.purge.failed,2);
  provider(t,env,0);result=await (await post({action:'continue-purge',jobId:result.purge.id})).json();assert.equal(result.purge.complete,true);
  const responseUpload=await call(upload,{env,request:new Request('https://garden.test/admin-api/upload?key=shadow-garden/covers/fixture.png',{method:'POST',headers,body:new Uint8Array([137,80,78,71])})});
  assert.equal(responseUpload.status,409);assert.equal((await responseUpload.json()).code,'media_retired');
});

test('cleanup time limits preserve pending versions for the next request',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env,2);let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  storage.beforeDelete=()=>{clock+=21000;};
  let result=await (await post({action:'purge-trash',ids:[]})).json();assert.equal(result.purge.pending,1);assert.equal(result.purge.failed,0);assert.equal(storage.deleted.length,1);
  storage.beforeDelete=null;result=await (await post({action:'continue-purge',jobId:result.purge.id})).json();assert.equal(result.purge.complete,true);assert.equal(storage.deleted.length,2);
});

test('a claimed cleanup job waits for its lease and resumes after an interrupted worker',async t=>{
  const {env,post}=await setup(t),storage=provider(t,env,6);
  let result=await (await post({action:'purge-trash',ids:[]})).json();const jobId=result.purge.id;
  env.DB.sqlite.prepare('UPDATE purge_jobs SET lease_token=?,lease_until=? WHERE id=?').run('other-worker',now()+90,jobId);
  result=await (await post({action:'continue-purge',jobId})).json();assert.equal(result.purge.running,true);assert.equal(storage.deleted.length,5);
  env.DB.sqlite.prepare('UPDATE purge_jobs SET lease_until=0 WHERE id=?').run(jobId);
  result=await (await post({action:'continue-purge',jobId})).json();assert.equal(result.purge.complete,true);assert.equal(result.purge.running,false);assert.equal(storage.deleted.length,6);
});
