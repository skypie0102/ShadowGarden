import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,context,adminHeaders} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {digest} from '../server/security.js';
import {loadState} from '../server/state.js';
import {media} from '../server/books.js';
import {maintenance,readiness,statusEndpoint,backup} from '../server/admin.js';

const call=(fn,ctx)=>endpoint(fn)(ctx);
const empty=()=>({main:[],adult:[],books:{},trash:[]});
async function snapshot(env,document,{id=crypto.randomUUID(),sha256,date='2026-09-27T00:00:00.000Z'}={}) {
  const serialized=JSON.stringify(document);
  await env.DB.prepare('INSERT INTO snapshots(id,reason,created_at,document,sha256) VALUES(?,?,?,?,?)')
    .bind(id,'recovery-fixture',date,serialized,sha256??await digest(serialized)).run();
  return id;
}
const readReport=(env,headers)=>call(readiness,context(env,'/admin-api/recovery-readiness','GET',undefined,headers)).then(r=>r.json());
function provider(t,env,objects) {
  Object.assign(env,{B2_APPLICATION_KEY_ID:crypto.randomUUID(),B2_APPLICATION_KEY:'fixture-key',B2_BUCKET_ID:'fixture-bucket',B2_BUCKET_NAME:'garden'});
  const seen=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(String(url).includes('b2_authorize_account'))return Response.json({apiUrl:'https://api.example.backblazeb2.com',downloadUrl:'https://download.example.backblazeb2.com',authorizationToken:'fixture-provider-token'});
    assert.equal(options.method,'HEAD');
    const key=new URL(url).pathname.slice('/file/garden/'.length);seen.push(key);
    return new Response(null,{status:objects.has(key)?200:404});
  });
  return seen;
}

test('checksummed but malformed snapshots stay visible and cannot corrupt a restore',async()=>{
  const env=fixture(),headers=await adminHeaders(env),before=await loadState(env);
  const id=await snapshot(env,{});
  const response=await call(maintenance,context(env,'/admin-api/maintenance','GET',undefined,headers));
  assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.backups[0].restorable,false);assert.equal(data.backups[0].integrity.status,'damaged');assert.equal(data.backups[0].counts,null);
  const restored=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id},headers));
  assert.equal(restored.status,409);assert.equal((await restored.json()).code,'backup_damaged');
  assert.deepEqual(await loadState(env),before);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM snapshots').get().n,1);
  const report=await readReport(env,headers);assert.equal(report.summary.damaged,1);assert.equal(report.summary.verified,0);assert.equal(report.readiness.status,'not-ready');
});

test('invalid nested records, identities, media paths and trash are rejected before restore',async()=>{
  const env=fixture(),headers=await adminHeaders(env),original=await loadState(env);
  const changes=[
    doc=>{doc.adult[0].volumes=null;},
    doc=>{doc.adult[0].cover={path:'bad'};},
    doc=>{doc.adult[0].volumes.push(structuredClone(doc.adult[0].volumes[0]));},
    doc=>{doc.main.push(structuredClone(doc.adult[0]));},
    doc=>{doc.books[doc.adult[0].volumes[0].bookId]='shadow-garden/books/../secret.epub';},
    doc=>{doc.books[doc.adult[0].volumes[0].bookId]='shadow-garden/books/one.epub';doc.books[doc.adult[0].volumes[1].bookId]='shadow-garden/books/one.epub';},
    doc=>{doc.trash.push({id:'broken-trash',type:'volume',scope:'adult',seriesId:doc.adult[0].id,series:doc.adult[0]});}
  ];
  for(const change of changes){
    const doc=structuredClone(original.document);change(doc);const id=await snapshot(env,doc);
    const result=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id},headers));
    assert.equal(result.status,409);assert.equal((await result.json()).code,'backup_damaged');
  }
  assert.deepEqual(await loadState(env),original);
});

test('Keeper can inspect and restore a damaged live catalog while preserving its exact safety copy',async()=>{
  const env=fixture(),headers=await adminHeaders(env),original=await loadState(env),id=await snapshot(env,original.document);
  const damaged='{"main": null, "adult": [], "books": {}, "trash": []}';
  env.DB.sqlite.prepare('UPDATE library_state SET document = ? WHERE id = 1').run(damaged);
  const status=await call(statusEndpoint,context(env,'/admin-api/status','POST',{},headers));assert.equal(status.status,200);assert.equal((await status.json()).catalogReadable,false);
  const response=await call(maintenance,context(env,'/admin-api/maintenance','GET',undefined,headers));assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.catalog.readable,false);assert.equal(data.health.status,'attention');assert.equal(data.backups[0].restorable,true);
  const report=await readReport(env,headers);assert.equal(report.readiness.status,'recovery-required');assert.ok(report.live.entries.every(entry=>!entry.readable));
  const publicResponse=await call(media,context(env,'/media/shadow-garden/data/adult-catalog.json'));assert.equal(publicResponse.status,503);assert.equal((await publicResponse.json()).code,'catalog_damaged');
  assert.equal((await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'create-backup'},headers))).status,503);
  assert.equal((await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id},{...headers,'if-match':'99'}))).status,409);
  assert.equal(env.DB.sqlite.prepare('SELECT document FROM library_state').get().document,damaged);
  const restored=await call(maintenance,context(env,'/admin-api/maintenance','POST',{action:'restore-backup',id},{...headers,'if-match':'0'}));assert.equal(restored.status,200);
  assert.deepEqual((await loadState(env)).document,original.document);assert.equal((await loadState(env)).revision,1);
  const safety=env.DB.sqlite.prepare("SELECT * FROM snapshots WHERE reason = 'before-restore-backup'").get();assert.equal(safety.document,damaged);assert.equal(safety.sha256,await digest(damaged));
  const result=await restored.json();assert.equal(result.catalog.readable,true);assert.equal(result.backups.find(item=>item.id===safety.id).restorable,false);
});

test('deleting a damaged snapshot removes only that selected snapshot',async()=>{
  const env=fixture(),headers=await adminHeaders(env),before=await loadState(env);
  const good=await snapshot(env,before.document),bad=await snapshot(env,{}, {sha256:'wrong'});
  const removed=await call(backup,context(env,'/admin-api/backup','POST',{action:'delete',id:bad},headers));assert.equal(removed.status,200);
  assert.deepEqual(env.DB.sqlite.prepare('SELECT id FROM snapshots').all().map(row=>row.id),[good]);assert.deepEqual(await loadState(env),before);
  assert.equal((await call(backup,context(env,'/admin-api/backup','POST',{action:'delete',id:bad},headers))).status,404);
});

test('readiness verifies recovered static covers and checks protected EPUBs only in B2',async(t)=>{
  const env=fixture(),headers=await adminHeaders(env),doc=(await loadState(env)).document;
  doc.adult[0].volumes=doc.adult[0].volumes.slice(0,1);
  const key='shadow-garden/books/recovery-fixture.epub';doc.books[doc.adult[0].volumes[0].bookId]=key;
  const seen=provider(t,env,new Set([key])),assets=[];
  env.ASSETS.fetch=async request=>{assets.push(new URL(request.url).pathname);assert.equal(request.method,'HEAD');return new Response(null,{headers:{'content-type':'image/webp'}});};
  await snapshot(env,doc);
  const report=await readReport(env,headers);assert.equal(report.readiness.status,'ready');assert.equal(report.readiness.anchor.objectCount,3);
  assert.deepEqual(seen,[key]);assert.equal(assets.length,2);assert.ok(assets.every(path=>path.startsWith('/media/shadow-garden/covers/')));
  env.ASSETS.fetch=async()=>new Response(null,{headers:{'content-type':'text/html'}});
  assert.equal((await readReport(env,headers)).readiness.status,'not-ready');
  delete env.B2_APPLICATION_KEY;
  env.ASSETS.fetch=async()=>new Response(null,{headers:{'content-type':'image/webp'}});
  const unavailable=await readReport(env,headers);assert.equal(unavailable.readiness.anchor,null);assert.equal(unavailable.readiness.uncertainSnapshots,1);
});

test('readiness counts every uninspected snapshot and accepts an empty snapshot without storage',async()=>{
  const env=fixture(),headers=await adminHeaders(env);
  for(let i=0;i<201;i++)await snapshot(env,empty(),{date:new Date(Date.UTC(2026,8,27,0,0,i)).toISOString()});
  const report=await readReport(env,headers);assert.equal(report.readiness.status,'ready');assert.equal(report.readiness.anchor.objectCount,0);
  assert.equal(report.summary.total,201);assert.equal(report.summary.verified,1);assert.equal(report.readiness.uncertainSnapshots,200);
  env.DB.sqlite.prepare("UPDATE library_state SET document = '{}' WHERE id = 1").run();
  const damaged=await readReport(env,headers);assert.equal(damaged.readiness.status,'recovery-required');assert.ok(damaged.readiness.anchor);
});

test('snapshots cannot be object-complete while recoverable trash lacks mappings or media',async(t)=>{
  const env=fixture(),headers=await adminHeaders(env),series=(await loadState(env)).document.adult[0];
  series.volumes=series.volumes.slice(0,1);
  const doc=empty();doc.trash=[{id:'trash-fixture',scope:'adult',type:'series',seriesId:series.id,series}];
  const id=await snapshot(env,doc),seen=provider(t,env,new Set());
  let report=await readReport(env,headers);assert.equal(report.readiness.anchor,null);assert.equal(report.readiness.staleSnapshots,1);assert.deepEqual(seen,[]);
  const key='shadow-garden/books/trash-fixture.epub';doc.books[series.volumes[0].bookId]=key;
  env.DB.sqlite.prepare('DELETE FROM snapshots WHERE id = ?').run(id);await snapshot(env,doc);
  env.ASSETS.fetch=async()=>new Response(null,{headers:{'content-type':'image/webp'}});
  report=await readReport(env,headers);assert.equal(report.readiness.anchor,null);assert.equal(report.readiness.staleSnapshots,1);assert.deepEqual(seen,[key]);
});

test('recovery POST restores the chosen checksummed snapshot with an exact safety backup',async()=>{
  const {recovery}=await import('../server/admin.js');
  const env=fixture(),headers=await adminHeaders(env),original=await loadState(env);
  await snapshot(env,original.document);env.DB.sqlite.prepare("UPDATE library_state SET document='{}'").run();
  const report=await readReport(env,headers),candidate=report.readiness.candidate;
  assert.equal(candidate.mediaStatus,'incomplete');assert.equal(report.revision,0);assert.equal(report.readiness.anchor,null);
  const response=await call(recovery,context(env,'/admin-api/recovery','POST',{action:'restore-snapshot',id:candidate.id,sha256:candidate.sha256},{...headers,'if-match':String(report.revision)}));
  assert.equal(response.status,200);assert.equal((await response.json()).recovery.restored,true);
  assert.deepEqual((await loadState(env)).document,original.document);
  const safety=env.DB.sqlite.prepare("SELECT document,sha256 FROM snapshots WHERE reason='before-recovery'").get();assert.equal(safety.document,'{}');assert.equal(safety.sha256,await digest('{}'));
});

test('recovery rejects stale revisions, changed checksums, damaged snapshots and unauthorized requests',async()=>{
  const {recovery}=await import('../server/admin.js');
  const env=fixture(),headers=await adminHeaders(env),before=await loadState(env),id=await snapshot(env,before.document);
  const sha256=await digest(JSON.stringify(before.document)),payload={action:'restore-snapshot',id,sha256};
  const post=(data=payload,extra={})=>call(recovery,context(env,'/admin-api/recovery','POST',data,{...headers,'if-match':'0',...extra}));
  for(const [data,extra,status] of [[payload,{'if-match':''},428],[payload,{'if-match':'9'},409],[{...payload,sha256:'0'.repeat(64)},{},409],[{...payload,sha256:'invalid'},{},400],[payload,{authorization:''},401],[payload,{origin:'https://other.test'},403]])assert.equal((await post(data,extra)).status,status);
  const damaged=await snapshot(env,{});assert.equal((await post({...payload,id:damaged,sha256:await digest('{}')})).status,409);
  assert.deepEqual(await loadState(env),before);assert.equal(env.DB.sqlite.prepare('SELECT count(*) n FROM snapshots').get().n,2);
});
