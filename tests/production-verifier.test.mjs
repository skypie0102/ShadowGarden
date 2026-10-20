import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {captureProductionBaseline} from '../scripts/production-baseline.mjs';
import {validateProductionBaseline,assertProductionPreserved,verifyProduction,PRODUCTION_ORIGIN} from '../scripts/verify-production.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const now=Date.now(),stamp=new Date(now).toISOString();
const resources={accountId:'a'.repeat(32),projectName:'fixture-project',databaseId:'11111111-1111-1111-1111-111111111111'};
const config={name:resources.projectName,compatibility_date:'2026-09-23',d1_databases:[{binding:'DB',database_id:resources.databaseId}],vars:{B2_BUCKET_NAME:'fixture-bucket'}};
const settings={compatibility_date:config.compatibility_date,compatibility_flags:[],d1_databases:{DB:{id:resources.databaseId}},env_vars:{B2_BUCKET_NAME:{type:'plain_text',value:'fixture-bucket'},SESSION_SECRET:{type:'secret_text'}}};
const source='a'.repeat(40),bookId='bk_'+('b'.repeat(22));
const document=JSON.stringify({main:[{id:'fixture',title:'Fixture',volumes:[{bookId,title:'Volume',number:1,file:'private-coordinate',sha256:'private-checksum'}]}],adult:[],books:{[bookId]:'shadow-garden/books/private.epub'},trash:[]});
const baseline={schemaVersion:1,checkedAt:stamp,projectName:resources.projectName,databaseId:resources.databaseId,deployment:{id:'22222222-2222-2222-2222-222222222222',source,environment:'production',status:'success'},actual:settings,saved:structuredClone(settings),database:{revision:9,updatedAt:stamp,document,documentSha256:sha(document),snapshots:[{id:'snapshot',created_at:stamp,sha256:sha(document),actualSha256:sha(document)}]},databaseWrites:0};

async function fixture(t){
  const distDir=await mkdtemp(join(tmpdir(),'sg-verifier-'));
  t.after(()=>rm(distDir,{recursive:true,force:true}));
  await mkdir(join(distDir,'data'));await mkdir(join(distDir,'assets/js'),{recursive:true});
  const version={version:'2.17.1',releaseVersion:'2.17.1',commit:source,shortCommit:source.slice(0,7),branch:'main'};
  await writeFile(join(distDir,'data/version.json'),JSON.stringify(version));
  await writeFile(join(distDir,'assets/js/changed.js'),'reviewed source\n');
  const catalogs=validateProductionBaseline(baseline,config,{now});
  const responses=new Map([
    ['/data/version.json',()=>Response.json(version)],
    ['/media/shadow-garden/data/catalog.json',()=>Response.json(catalogs.main)],
    ['/media/shadow-garden/data/adult-catalog.json',()=>Response.json(catalogs.adult)],
    ['/assets/js/changed.js',()=>new Response('reviewed source\n',{headers:{'content-type':'application/javascript; charset=utf-8'}})]
  ]),calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});assert.ok(url.startsWith(PRODUCTION_ORIGIN+'/'));
    return (responses.get(new URL(url).pathname)||(()=>new Response('unknown',{status:404})))();
  };
  const options={baseline,config,distDir,version:'2.17.1',source,files:['assets/js/changed.js'],fetchImpl,now};
  return {options,responses,calls,catalogs,version};
}

test('read-only baseline capture hashes exact documents and removes encrypted values',async()=>{
  const calls=[];
  const actual={...settings,id:baseline.deployment.id,environment:'production',latest_stage:{status:'success'},deployment_trigger:{metadata:{commit_hash:source}}};
  actual.env_vars={...settings.env_vars,SESSION_SECRET:{type:'secret_text',value:'DO NOT RETURN THIS'}};
  const request=async options=>{
    calls.push(options);
    if(options.method==='GET')return {success:true,status:200,result:{name:resources.projectName,canonical_deployment:actual,deployment_configs:{production:settings}}};
    return {success:true,status:200,result:[{success:true,meta:{rows_written:0,changes:0},results:[{revision:9,document,updated_at:stamp}]},{success:true,meta:{rows_written:0,changes:0},results:[{id:'snapshot',created_at:stamp,sha256:sha(document),document}]}]};
  };
  const result=await captureProductionBaseline(request,resources);
  validateProductionBaseline(result,config);
  assert.equal(result.database.document,document);assert.equal(result.database.documentSha256,sha(document));
  assert.equal(JSON.stringify(result).includes('DO NOT RETURN THIS'),false);
  assert.equal(calls.length,2);assert.equal(calls[0].method,'GET');assert.equal(calls[1].method,'POST');
  assert.match(calls[1].body.sql,/^SELECT .*; SELECT .*;$/);
  assert.doesNotMatch(calls[1].body.sql,/\b(?:INSERT|UPDATE|DELETE|CREATE|PRAGMA)\b/i);
});

test('baseline capture rejects partial query failure, missing rows and write metadata',async()=>{
  for(const result of [[],[{success:false}],[{success:true,meta:{rows_written:1,changes:1}},{success:true,meta:{rows_written:0,changes:0}}],[{success:true,meta:{rows_written:0,changes:0},results:[]},{success:true,meta:{rows_written:0,changes:0},results:[]}]]){
    await assert.rejects(captureProductionBaseline(async options=>options.method==='GET'?{success:true,status:200,result:{}}:{success:true,status:200,result},resources));
  }
});

test('strict baseline validation rejects stale, forged, damaged and misconfigured inputs',()=>{
  const edits=[
    value=>value.checkedAt='bad',value=>value.checkedAt=new Date(now-16*60_000).toISOString(),value=>value.checkedAt=new Date(now+60_000).toISOString(),
    value=>value.projectName='another-project',value=>value.databaseId='another-database',value=>value.deployment.status='failure',value=>value.deployment.source='short',
    value=>delete value.actual.d1_databases,value=>value.actual.compatibility_date='2026-09-24',value=>value.actual.compatibility_flags=['nodejs_compat'],
    value=>value.saved.env_vars.SESSION_SECRET={type:'secret_text',value:'secret'},value=>delete value.saved.env_vars.SESSION_SECRET,
    value=>value.database.revision='9',value=>value.database.document+=' ',value=>value.database.snapshots[0].actualSha256='0'.repeat(64),
    value=>value.database.snapshots.push(value.database.snapshots[0]),value=>value.databaseWrites=1,
    value=>{value.database.document='{"main":[]}';value.database.documentSha256=sha(value.database.document);}
  ];
  for(const edit of edits){const value=structuredClone(baseline);edit(value);assert.throws(()=>validateProductionBaseline(value,config,{now}));}
});

test('preservation checks include exact serialization, snapshot identities and encrypted setting names',()=>{
  const before=structuredClone(baseline);before.checkedAt=new Date(now-86_400_000).toISOString();
  assert.doesNotThrow(()=>assertProductionPreserved(before,baseline,config,{now}));
  for(const edit of [value=>value.database.revision++,value=>value.database.snapshots[0].id='another-id',value=>{delete value.actual.env_vars.SESSION_SECRET;delete value.saved.env_vars.SESSION_SECRET;},value=>{value.database.document+=' ';value.database.documentSha256=sha(value.database.document);}] ){
    const after=structuredClone(baseline);edit(after);assert.throws(()=>assertProductionPreserved(before,after,config,{now}),/changed/);
  }
});

test('production verification uses only canonical GETs and reports no private document or credentials',async t=>{
  const {options,calls}=await fixture(t);
  const report=await verifyProduction({...options,before:baseline});
  assert.equal(report.checks.length,4);assert.equal(report.preservationChecked,true);assert.equal(report.revision,9);
  for(const {options:request} of calls){assert.equal(request.method,'GET');assert.equal(request.redirect,'manual');assert.equal(request.cache,'no-store');assert.ok(request.signal instanceof AbortSignal);assert.equal(request.body,undefined);}
  for(const privateValue of ['private-coordinate','private-checksum','private.epub','SESSION_SECRET'])assert.equal(JSON.stringify(report).includes(privateValue),false);
});

test('HTTP 200 HTML, malformed JSON, redirects, failed statuses and archived catalogs cannot pass',async t=>{
  const {options,responses,catalogs}=await fixture(t),path='/media/shadow-garden/data/catalog.json';
  for(const response of [()=>new Response('<html>OK</html>',{headers:{'content-type':'text/html'}}),()=>new Response('{',{headers:{'content-type':'application/json'}}),()=>new Response(null,{status:302,headers:{location:'/data/catalog.json'}}),()=>new Response('{}',{status:503}),()=>Response.json({ok:true}),()=>Response.json({...catalogs.main,generatedAt:'2020-01-01T00:00:00Z'}),()=>Response.json({...catalogs.main,series:[]})]){
    responses.set(path,response);await assert.rejects(verifyProduction(options));
  }
});

test('wrong served source, changed asset bytes and HTML masquerading as source fail verification',async t=>{
  const {options,responses,version}=await fixture(t);
  responses.set('/data/version.json',()=>Response.json({...version,commit:'b'.repeat(40)}));
  await assert.rejects(verifyProduction(options),/Served version/);
  responses.set('/data/version.json',()=>Response.json(version));
  for(const response of [()=>new Response('different',{headers:{'content-type':'application/javascript'}}),()=>new Response('reviewed source\n',{headers:{'content-type':'text/html'}})]){
    responses.set('/assets/js/changed.js',response);await assert.rejects(verifyProduction(options),/Served asset/);
  }
});

test('invalid asset paths, missing asset selections and wrong local build fail before network access',async t=>{
  const {options,calls}=await fixture(t);
  for(const files of [[],['assets/../private.js'],['assets//changed.js'],['assets/js/changed.js?secret'],['../private.js'],['assets/js/changed.js','assets/js/changed.js']])await assert.rejects(verifyProduction({...options,files}));
  await assert.rejects(verifyProduction({...options,source:'b'.repeat(40)}));
  await writeFile(join(options.distDir,'data/version.json'),JSON.stringify({version:'2.17.1',releaseVersion:'2.17.1',commit:'b'.repeat(40),branch:'main'}));
  await assert.rejects(verifyProduction(options),/Local dist/);assert.equal(calls.length,0);
});

test('asset symlinks cannot leave the reviewed release directory',async t=>{
  const {options,calls}=await fixture(t),outside=await mkdtemp(join(tmpdir(),'sg-outside-'));
  t.after(()=>rm(outside,{recursive:true,force:true}));await writeFile(join(outside,'private.js'),'private');
  await symlink(join(outside,'private.js'),join(options.distDir,'assets/js/link.js'));
  await assert.rejects(verifyProduction({...options,files:['assets/js/link.js']}),/escapes/);assert.equal(calls.length,0);
});

test('oversized response bodies are canceled and cannot pass',async t=>{
  const {options,responses}=await fixture(t);let canceled=false;
  responses.set('/data/version.json',()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4*1024*1024+1));},cancel(){canceled=true;}}),{headers:{'content-type':'application/json'}}));
  await assert.rejects(verifyProduction(options),/exceeds/);assert.equal(canceled,true);
});
