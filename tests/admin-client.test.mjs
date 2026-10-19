import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {library,maintenance,seriesBanner,statusEndpoint} from '../server/admin.js';
import {loadState} from '../server/state.js';

const core=readFileSync(new URL('../public/assets/js/admin/core.js',import.meta.url),'utf8');
async function editorFixture(t) {
  const env=fixture(),headers=await adminHeaders(env);
  t.after(()=>env.DB.sqlite.close());
  const routes={'/admin-api/library':library,'/admin-api/maintenance':maintenance,'/admin-api/series-banner':seriesBanner,'/admin-api/status':statusEndpoint};
  const call=(path,options={})=>endpoint(routes[new URL(path,'https://garden.test').pathname])(context(env,path,options.method||'GET',options.body,{...headers,...Object.fromEntries(new Headers(options.headers))}));
  const window={};
  runInNewContext(core,{window,document:{querySelector:selector=>selector==='#adminToken'?{value:env.ADMIN_TOKEN}:null},
    Headers,AbortController,EventTarget,CustomEvent,crypto,btoa,setTimeout,clearTimeout,fetch:call});
  const {client,state}=window.ShadowGardenKeeper;
  client.markUnlocked();state.management=await client.request('/admin-api/library');
  const id=state.management.adult[0].id;
  client.beginEdit(id,state.management.revision);
  const post=(path,payload,extra={})=>client.request(path,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(payload)});
  return {env,client,state,id,post,call};
}

test('background admin reads cannot let an open stale form edit the wrong volume',async t=>{
  const {env,client,id,post,call}=await editorFixture(t);
  assert.equal((await call('/admin-api/library',{method:'POST',body:JSON.stringify({action:'delete-volume',id,volumeIndex:0}),headers:{'content-type':'application/json','if-match':'0'}})).status,200);
  await client.request(`/admin-api/series-banner?id=${id}`);
  await client.request('/admin-api/maintenance');
  await client.verifySession();
  await assert.rejects(post('/admin-api/library',{action:'update-volume',id,volumeIndex:0,title:'Stale edit'}),/catalog changed/i);
  const row=await loadState(env);
  assert.equal(row.revision,1);assert.equal(row.document.adult[0].volumes.length,4);
  assert.notEqual(row.document.adult[0].volumes[0].title,'Stale edit');
});

test('a successful edit advances its form revision for subsequent edits',async t=>{
  const {env,state,id,post}=await editorFixture(t);
  await post('/admin-api/series-banner',{id,bannerBookId:state.management.adult[0].volumes[0].bookId});
  await post('/admin-api/library',{action:'update-volume',id,volumeIndex:0,title:'Valid edit'});
  assert.equal((await loadState(env)).revision,2);
  assert.equal(state.management.revision,2);
});

test('explicit caller preconditions are preserved instead of silently replaced',async t=>{
  const {env,client,state,id,post}=await editorFixture(t);
  await post('/admin-api/series-banner',{id,bannerBookId:state.management.adult[0].volumes[0].bookId});
  await client.request('/admin-api/library');
  await assert.rejects(post('/admin-api/library',{action:'delete-series',id},{'if-match':'0'}),/catalog changed/i);
  assert.equal((await loadState(env)).document.adult.length,1);
});

function isolatedClient(fetch){
  const window={};
  runInNewContext(core,{window,document:{querySelector:selector=>selector==='#adminToken'?{value:'audit-test-token'}:null},
    Headers,AbortController,DOMException,EventTarget,CustomEvent,crypto,btoa,setTimeout,clearTimeout,fetch});
  const client=window.ShadowGardenKeeper.client;client.markUnlocked();return client;
}

test('locking rejects a late successful request before it can update Keeper state',async()=>{
  let finish,signal;
  const client=isolatedClient((_path,options)=>{signal=options.signal;return new Promise(resolve=>{finish=resolve})});
  const request=client.request('/admin-api/library');
  client.markLocked();
  // Even a transport/provider that ignores abort cannot authorize a late result.
  finish(Response.json({ok:true,revision:99,main:[{id:'obsolete'}]}));
  await assert.rejects(request,error=>error.name==='AbortError');
  assert.equal(signal.aborted,true);
});

test('successful HTML or malformed JSON cannot masquerade as an empty Keeper response',async()=>{
  const client=isolatedClient(async()=>new Response('<html>upstream error</html>',{headers:{'content-type':'text/html'}}));
  await assert.rejects(client.request('/admin-api/library'),/invalid.*response/i);
});

for(const firstFails of [false,true])test(`cover retry uses a new immutable key after ${firstFails?'a failed reserved upload':'an earlier successful upload'}`,async t=>{
  const {upload}=await import('../server/admin.js');
  const env=fixture(),headers=await adminHeaders(env),objects=new Set(),attempts=[];
  t.after(()=>env.DB.sqlite.close());
  Object.assign(env,{B2_APPLICATION_KEY_ID:crypto.randomUUID(),B2_APPLICATION_KEY:'audit-storage-key',B2_BUCKET_ID:'audit-bucket',B2_BUCKET_NAME:'audit-bucket'});
  t.mock.method(globalThis,'fetch',async(input,options={})=>{
    const url=new URL(input);
    if(url.pathname.endsWith('b2_authorize_account'))return Response.json({authorizationToken:'fixture-auth',apiInfo:{storageApi:{apiUrl:'https://api.audit.backblazeb2.com',downloadUrl:'https://download.audit.backblazeb2.com',allowed:{buckets:[{id:'audit-bucket',name:'audit-bucket'}]}}}});
    if(url.pathname.endsWith('b2_get_upload_url'))return Response.json({uploadUrl:'https://pod-audit.backblaze.com/upload',authorizationToken:'fixture-upload'});
    if(url.pathname==='/upload'){
      const key=decodeURIComponent(options.headers['x-bz-file-name']);attempts.push(key);
      if(firstFails&&attempts.length===1)return new Response(null,{status:503});
      objects.add(key);return Response.json({fileId:'fixture-file'});
    }
    const key=decodeURIComponent(url.pathname.replace('/file/audit-bucket/',''));
    return new Response(null,{status:objects.has(key)?200:404});
  });
  const client=isolatedClient((path,options)=>endpoint(upload)({env,request:new Request('https://garden.test'+path,{...options,headers:{...headers,...Object.fromEntries(new Headers(options.headers)),authorization:headers.authorization}})}));
  const bytes=new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'});
  const key='shadow-garden/covers/audit-1-detail.png';
  if(firstFails)await assert.rejects(client.uploadObject(key,bytes),/upload failed/i);
  else await client.uploadObject(key,bytes);
  const result=await client.uploadObject(key,bytes);
  assert.equal(result.ok,true);assert.equal(attempts.length,2);assert.notEqual(attempts[0],attempts[1]);
  assert.equal(client.rewriteCoverKeys({coverKey:key}).coverKey,result.key);
});
