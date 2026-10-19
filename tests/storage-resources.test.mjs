import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getObject} from '../server/storage.js';

for(const status of [401,404,500])test(`discarded storage ${status} response releases its body`,async t=>{
  const env={B2_READ_KEY_ID:crypto.randomUUID(),B2_READ_APPLICATION_KEY:'fixture-key',B2_BUCKET_ID:'fixture-bucket',B2_BUCKET_NAME:'fixture-bucket'};
  let cancelled=0;
  const discarded=()=>new Response(new ReadableStream({cancel(){cancelled++}}),{status});
  t.mock.method(globalThis,'fetch',async input=>{
    if(new URL(input).pathname.endsWith('b2_authorize_account'))return status===401?discarded():Response.json({authorizationToken:'fixture-auth',apiInfo:{storageApi:{apiUrl:'https://api.audit.backblazeb2.com',downloadUrl:'https://download.audit.backblazeb2.com',allowed:{buckets:[{id:env.B2_BUCKET_ID,name:env.B2_BUCKET_NAME}]}}}});
    return discarded();
  });
  if(status===404)assert.equal(await getObject(env,'shadow-garden/covers/fixture.png'),null);
  else await assert.rejects(getObject(env,'shadow-garden/covers/fixture.png'));
  assert.equal(cancelled,1);
});
