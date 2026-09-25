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
