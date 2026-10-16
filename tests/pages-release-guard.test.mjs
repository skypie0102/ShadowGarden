import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertReleaseBindings,readWorkerMetadata,assertDeployedBindings,assertCatalogUnchanged} from '../scripts/pages-release-guard.mjs';

const config={name:'fixture-project',d1_databases:[{binding:'DB',database_id:'11111111-1111-1111-1111-111111111111'}],vars:{B2_BUCKET_NAME:'fixture-bucket',B2_BUCKET_ID:'fixture-id'}};
const bindings=[{name:'DB',type:'d1',id:config.d1_databases[0].database_id},{name:'B2_BUCKET_NAME',type:'plain_text',text:'fixture-bucket'},{name:'B2_BUCKET_ID',type:'plain_text',text:'fixture-id'}];

test('a successful source compile without deployment bindings is rejected',async()=>{
  const form=new FormData();form.set('metadata',JSON.stringify({main_module:'worker.js'}));
  form.set('worker.js',new Blob(['export default {fetch(){return new Response("ok")}}'],{type:'application/javascript'}),'worker.js');
  const metadata=await readWorkerMetadata(new Uint8Array(await new Response(form).arrayBuffer()));
  assert.throws(()=>assertReleaseBindings(metadata,config),/no binding metadata/);
});

test('the required database and bucket settings must match the production configuration',()=>{
  assert.doesNotThrow(()=>assertReleaseBindings({bindings},config));
  for(const name of ['DB','B2_BUCKET_NAME','B2_BUCKET_ID'])assert.throws(()=>assertReleaseBindings({bindings:bindings.filter(b=>b.name!==name)},config));
  const wrong=structuredClone(bindings);wrong[0].id='22222222-2222-2222-2222-222222222222';
  assert.throws(()=>assertReleaseBindings({bindings:wrong},config),/D1 binding/);
  const stale=structuredClone(bindings);stale[1].text='different-bucket';
  assert.throws(()=>assertReleaseBindings({bindings:stale},config),/variable/);
});

test('placeholder databases and duplicate bindings cannot pass release validation',()=>{
  const placeholder=structuredClone(config);placeholder.d1_databases[0].database_id='00000000-0000-0000-0000-000000000000';
  assert.throws(()=>assertReleaseBindings({bindings},placeholder),/placeholder/);
  assert.throws(()=>assertReleaseBindings({bindings:[...bindings,bindings[0]]},config),/Duplicate/);
});

test('the actual deployment must retain bindings even when its status says success',()=>{
  const deployment={environment:'production',project_name:config.name,latest_stage:{status:'success'},d1_databases:{DB:{id:config.d1_databases[0].database_id}},env_vars:Object.fromEntries(Object.entries(config.vars).map(([name,value])=>[name,{type:'plain_text',value}]))};
  assert.doesNotThrow(()=>assertDeployedBindings(deployment,config));
  const missing=structuredClone(deployment);delete missing.d1_databases;
  assert.throws(()=>assertDeployedBindings(missing,config),/Deployed D1/);
  const missingBucket=structuredClone(deployment);delete missingBucket.env_vars.B2_BUCKET_NAME;
  assert.throws(()=>assertDeployedBindings(missingBucket,config),/Deployed variable/);
});

test('HTTP 200 with a recovered catalog is not equivalent to the actual live catalog',()=>{
  const live={generatedAt:'2026-10-16T00:00:00.000Z',series:[{id:'fixture',volumes:[{bookId:'live-book'}]}]};
  const recovered={generatedAt:'2026-09-11T07:19:46.602Z',series:[{id:'fixture',volumes:[{bookId:'deleted-book'}]}]};
  assert.throws(()=>assertCatalogUnchanged(live,recovered),/differs/);
  assert.doesNotThrow(()=>assertCatalogUnchanged(live,{series:live.series,generatedAt:live.generatedAt}));
  assert.throws(()=>assertCatalogUnchanged(live,{ok:true}),/invalid/);
});
