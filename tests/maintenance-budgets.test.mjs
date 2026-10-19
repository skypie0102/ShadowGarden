import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {digest} from '../server/security.js';
import {loadState} from '../server/state.js';
import {maintenance,readiness,backup} from '../server/admin.js';

const call=(fn,ctx)=>endpoint(fn)(ctx);
const empty=()=>({main:[],adult:[],books:{},trash:[]});
async function addSnapshot(env,doc,{id=crypto.randomUUID(),date='2026-10-19T00:00:00.000Z',checksum}={}){
  const document=JSON.stringify(doc);
  env.DB.sqlite.prepare('INSERT INTO snapshots(id,reason,created_at,document,sha256) VALUES(?,?,?,?,?)').run(id,'budget-fixture',date,document,checksum??await digest(document));
  return id;
}
function observeSnapshotReads(env){
  const prepare=env.DB.prepare,metrics={largestDocumentBatch:0,largestDocumentBytes:0,documentRows:0,documentBytes:0};
  env.DB.prepare=(sql)=>{
    const observe=value=>{
      if(!/\bFROM snapshots\b/i.test(sql))return value;
      const rows=Array.isArray(value?.results)?value.results:value?[value]:[];
      const documents=rows.filter(row=>typeof row.document==='string'),bytes=documents.reduce((sum,row)=>sum+Buffer.byteLength(row.document),0);
      metrics.largestDocumentBatch=Math.max(metrics.largestDocumentBatch,documents.length);metrics.largestDocumentBytes=Math.max(metrics.largestDocumentBytes,bytes);
      metrics.documentRows+=documents.length;metrics.documentBytes+=bytes;return value;
    };
    const wrap=statement=>({bind:(...args)=>wrap(statement.bind(...args)),all:async()=>observe(await statement.all()),first:async()=>observe(await statement.first()),run:()=>statement.run()});
    return wrap(prepare(sql));
  };
  return metrics;
}

test('large history reads one full snapshot at a time and returns a bounded first page',async t=>{
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env),doc=(await loadState(env)).document;
  doc.adult[0].description='s'.repeat(10000);for(const volume of doc.adult[0].volumes)volume.description='v'.repeat(10000);
  const document=JSON.stringify(doc),sha256=await digest(document),insert=env.DB.sqlite.prepare('INSERT INTO snapshots VALUES(?,?,?,?,?)');
  for(let i=0;i<205;i++)insert.run(`large-${String(i).padStart(3,'0')}`,'large-history-fixture',new Date(Date.UTC(2026,9,19,0,0,i)).toISOString(),document,sha256);
  const metrics=observeSnapshotReads(env),response=await call(maintenance,context(env,'/admin-api/maintenance','GET',undefined,headers));
  assert.equal(response.status,200);t.diagnostic(JSON.stringify({fixtureRows:205,snapshotBytes:Buffer.byteLength(document),...metrics}));
  assert.ok(metrics.largestDocumentBatch<=1,'Do not return an array of full snapshot documents from D1');
  const data=await response.json();assert.equal(data.backups.length,10);assert.equal(data.history.total,205);assert.equal(data.history.pageSize,10);assert.ok(data.history.nextCursor);assert.equal(metrics.documentRows,10);
});

for(const stage of ['authorization','media','assets'])test(`readiness ends at its overall deadline during stalled ${stage}, rejects late success and aborts transport`,{timeout:5000},async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env),doc=(await loadState(env)).document;
  doc.adult[0].volumes=doc.adult[0].volumes.slice(0,1);
  const key='shadow-garden/books/readiness-budget.epub';doc.books[doc.adult[0].volumes[0].bookId]=key;await addSnapshot(env,doc);
  Object.assign(env,{B2_APPLICATION_KEY_ID:crypto.randomUUID(),B2_APPLICATION_KEY:'fixture-key',B2_BUCKET_ID:'fixture-bucket',B2_BUCKET_NAME:'garden'});
  let start,release,stalledSignal,completed=false,discardedBodies=0;
  const started=new Promise(resolve=>{start=resolve}),blocked=new Promise(resolve=>{release=resolve});
  const stall=async(signal,response)=>{const cancel=response.body.cancel.bind(response.body);t.mock.method(response.body,'cancel',(...args)=>{discardedBodies++;return cancel(...args)});stalledSignal=signal;start();await blocked;return response};
  env.ASSETS.fetch=async request=>stage==='assets'?stall(request.signal,new Response('late cover body',{headers:{'content-type':'image/webp'}})):new Response(null,{headers:{'content-type':'image/webp'}});
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(String(url).includes('b2_authorize_account')){
      const response=Response.json({authorizationToken:'fixture-provider-token',apiInfo:{storageApi:{apiUrl:'https://api.fixture.backblazeb2.com',downloadUrl:'https://download.fixture.backblazeb2.com',allowed:{buckets:[{id:'fixture-bucket',name:'garden'}]}}}});
      return stage==='authorization'?stall(options.signal,response):response;
    }
    return stage==='media'?stall(options.signal,new Response('late media body',{status:200})):new Response(null,{status:200});
  });
  const task=call(readiness,context(env,'/admin-api/recovery-readiness','GET',undefined,headers)).then(response=>{completed=true;return response});
  await started;t.mock.timers.tick(20000);await tick();const completedAtDeadline=completed,abortedAtDeadline=stalledSignal?.aborted;
  release();const response=await task,report=await response.json();await tick();
  assert.equal(completedAtDeadline,true,'A provider that ignores abort must not keep the readiness response pending');
  assert.equal(abortedAtDeadline,true);assert.equal(response.status,200);assert.equal(report.readiness.status,'not-ready');assert.equal(report.readiness.anchor,null);
  assert.equal(report.readiness.budget.exhausted,true);assert.equal(report.readiness.uncertainSnapshots,1);assert.equal(report.readiness.candidate.mediaStatus,'unverified');
  assert.equal(discardedBodies,1);assert.equal(report.readiness.budget.limitMs,20000);
});

test('history cursor preserves tied-date ordering through concurrent insert and cursor-row deletion',async t=>{
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env);
  for(let i=0;i<25;i++)await addSnapshot(env,empty(),{id:`tied-${String(i).padStart(2,'0')}`});
  const page=async cursor=>{
    const response=await call(backup,context(env,'/admin-api/backup'+(cursor?'?cursor='+encodeURIComponent(cursor):''),'GET',undefined,headers));
    assert.equal(response.status,200);return response.json();
  };
  const first=await page();assert.deepEqual(first.backups.map(x=>x.id),Array.from({length:10},(_,i)=>`tied-${24-i}`));assert.equal(first.history.total,25);
  env.DB.sqlite.prepare('DELETE FROM snapshots WHERE id=?').run(first.backups.at(-1).id);
  await addSnapshot(env,empty(),{id:'newer',date:'2027-01-01T00:00:00.000Z'});
  const second=await page(first.history.nextCursor),third=await page(second.history.nextCursor);
  const ids=[...first.backups,...second.backups,...third.backups].map(x=>x.id);
  assert.equal(new Set(ids).size,25);assert.equal(ids.length,25);assert.equal(ids.includes('newer'),false);assert.equal(third.backups.length,5);assert.equal(third.history.nextCursor,null);
  assert.equal((await page()).backups[0].id,'newer');
  env.DB.sqlite.prepare("DELETE FROM snapshots WHERE id!='newer'").run();
  const depleted=await page(first.history.nextCursor);assert.deepEqual(depleted.backups,[]);assert.equal(depleted.history.total,1);assert.equal(depleted.history.nextCursor,null);
});

test('older pages preserve damaged-snapshot visibility and revalidate restore without writes',async t=>{
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env),before=await loadState(env);
  for(let i=0;i<12;i++)await addSnapshot(env,i?empty():{}, {id:`older-${String(i).padStart(2,'0')}`});
  const first=await (await call(backup,context(env,'/admin-api/backup','GET',undefined,headers))).json();
  const second=await (await call(backup,context(env,'/admin-api/backup?cursor='+encodeURIComponent(first.history.nextCursor),'GET',undefined,headers))).json();
  const bad=second.backups.find(x=>x.id==='older-00');assert.equal(bad.restorable,false);assert.equal(bad.integrity.status,'damaged');assert.equal(bad.counts,null);
  const restored=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id:bad.id},headers));assert.equal(restored.status,409);
  assert.deepEqual(await loadState(env),before);assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) n FROM snapshots').get().n,12);
});

test('history validates cursors and preserves admin authorization and method checks',async t=>{
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env);
  const invalid=['not base64','a'.repeat(2049),Buffer.from('{}').toString('base64url'),Buffer.from('["date",3]').toString('base64url')];
  for(const cursor of invalid){
    const response=await call(backup,context(env,'/admin-api/backup?cursor='+encodeURIComponent(cursor),'GET',undefined,headers));assert.equal(response.status,400);assert.equal((await response.json()).code,'invalid_history_cursor');
  }
  assert.equal((await call(backup,context(env,'/admin-api/backup','GET'))).status,401);
  assert.equal((await call(backup,context(env,'/admin-api/backup','GET',undefined,{...headers,origin:'https://other.test'}))).status,403);
  assert.equal((await call(backup,context(env,'/admin-api/backup','PUT',{},headers))).status,405);
  const result=await (await call(backup,context(env,'/admin-api/backup','GET',undefined,headers))).json();assert.deepEqual(result.backups,[]);assert.equal(result.history.total,0);assert.equal(result.history.nextCursor,null);
});

test('caller cancellation stops readiness before a late Assets result can become an anchor',{timeout:5000},async t=>{
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env),doc=(await loadState(env)).document;
  doc.adult[0].volumes=doc.adult[0].volumes.slice(0,1);doc.books[doc.adult[0].volumes[0].bookId]='shadow-garden/books/cancellation-fixture.epub';await addSnapshot(env,doc);
  let start,release,transportSignal,completed=false;const started=new Promise(resolve=>{start=resolve}),blocked=new Promise(resolve=>{release=resolve});
  env.ASSETS.fetch=async request=>{transportSignal=request.signal;start();await blocked;return new Response(null,{headers:{'content-type':'image/webp'}})};
  const controller=new AbortController(),ctx=context(env,'/admin-api/recovery-readiness','GET',undefined,headers);ctx.request=new Request(ctx.request,{signal:controller.signal});
  const task=call(readiness,ctx).then(response=>{completed=true;return response});await started;controller.abort();await tick();const completedBeforeRelease=completed;
  release();const response=await task;assert.equal(completedBeforeRelease,true);assert.equal(transportSignal.aborted,true);assert.equal(response.status,408);assert.equal((await response.json()).code,'readiness_cancelled');
});

for(const stage of ['authentication','snapshot metadata'])test(`readiness deadline bounds stalled ${stage} before a report is available`,{timeout:5000},async t=>{
  t.mock.timers.enable({apis:['Date','setTimeout'],now:Date.now()});
  const env=fixture();t.after(()=>env.DB.sqlite.close());const headers=await adminHeaders(env),prepare=env.DB.prepare;
  let start,release,completed=false;const started=new Promise(resolve=>{start=resolve}),blocked=new Promise(resolve=>{release=resolve});
  env.DB.prepare=sql=>{
    const statement=prepare(sql),matches=stage==='authentication'?/FROM admin_sessions/.test(sql):/retained_count/.test(sql);
    if(!matches)return statement;
    const wrap=current=>({bind:(...args)=>wrap(current.bind(...args)),first:async()=>{start();await blocked;return current.first()},all:async()=>{start();await blocked;return current.all()}});
    return wrap(statement);
  };
  const task=call(readiness,context(env,'/admin-api/recovery-readiness','GET',undefined,headers)).then(response=>{completed=true;return response});await started;t.mock.timers.tick(20000);await tick();const completedAtDeadline=completed;
  release();const response=await task;assert.equal(completedAtDeadline,true);assert.equal(response.status,408);assert.equal((await response.json()).code,'readiness_timeout');
});
