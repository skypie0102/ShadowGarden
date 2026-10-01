import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,context} from './helpers.mjs';
import {endpoint} from '../server/http.js';
import {adminAccess,humanAccess,checkAdminToken,challenge,signed,verified} from '../server/security.js';
import {bookAccess} from '../server/books.js';
import {library} from '../server/admin.js';
import {loadState,saveState} from '../server/state.js';
import {getObject,uploadObject,deleteObjectVersions,storageConfigured} from '../server/storage.js';

const call=(fn,ctx)=>endpoint(fn)(ctx);
function legacy(t) {
  const env=fixture();t.after(()=>env.DB.sqlite.close());
  for(const [modern,original] of Object.entries({ADMIN_TOKEN:'SG_ADMIN_TOKEN',BOOK_SIGNING_SECRET:'SG_MEDIA_SIGNING_SECRET',TURNSTILE_SITE_KEY:'SG_TURNSTILE_SITE_KEY',TURNSTILE_SECRET_KEY:'SG_TURNSTILE_SECRET_KEY'})){env[original]=env[modern];delete env[modern];}
  return env;
}
function splitStorage() {
  return {B2_READ_KEY_ID:crypto.randomUUID(),B2_READ_APPLICATION_KEY:'fixture-read-key',B2_WRITE_KEY_ID:crypto.randomUUID(),B2_WRITE_APPLICATION_KEY:'fixture-write-key',B2_BUCKET_ID:'fixture-bucket',B2_BUCKET_NAME:'fixture-garden'};
}
const authData=(token='token')=>({apiUrl:'https://api.fixture.backblazeb2.com',downloadUrl:'https://download.fixture.backblazeb2.com',authorizationToken:token,allowed:{bucketId:'fixture-bucket',bucketName:'fixture-garden'}});
const key='shadow-garden/books/config-fixture.epub';

test('existing SG names support Turnstile login, admin authorization and signed book access',async t=>{
  const env=legacy(t),requests=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    const body=JSON.parse(options.body);requests.push(body);
    return Response.json({success:true,hostname:'garden.test',action:body.response==='admin-fixture'?'admin_access':'book_access'});
  });
  assert.equal(challenge(context(env,'/admin-access'),'admin_access').siteKey,env.SG_TURNSTILE_SITE_KEY);
  const login=await call(adminAccess,context(env,'/admin-access','POST',{adminToken:env.SG_ADMIN_TOKEN,turnstileToken:'admin-fixture'}));assert.equal(login.status,200);
  const headers={authorization:`Bearer ${env.SG_ADMIN_TOKEN}`,cookie:login.headers.get('set-cookie').split(';')[0]};
  assert.equal((await call(library,context(env,'/admin-api/library','GET',undefined,headers))).status,200);
  const row=await loadState(env),bookId=row.document.adult[0].volumes[0].bookId;row.document.books[bookId]=key;await saveState(env,row,row.document,'fixture-map');
  const human=await call(humanAccess,context(env,'/human-access','POST',{token:'human-fixture'}));assert.equal(human.status,200);
  const ticket=await call(bookAccess,context(env,'/book-access','POST',{bookId},{cookie:human.headers.get('set-cookie').split(';')[0]}));assert.equal(ticket.status,200);
  const url=new URL((await ticket.json()).url,'https://garden.test'),claims=await verified(env,url.searchParams.get('sig'),'book','BOOK_SIGNING_SECRET');assert.equal(claims.key,key);
  assert.equal(await verified({...env,SG_MEDIA_SIGNING_SECRET:'different-fixture-'.repeat(3)},url.searchParams.get('sig'),'book','BOOK_SIGNING_SECRET'),null);
  assert.ok(requests.every(r=>r.secret===env.SG_TURNSTILE_SECRET_KEY));
});

test('explicit canonical values win over aliases and aliases retain secret strength checks',async t=>{
  const env=legacy(t),oldToken=env.SG_ADMIN_TOKEN;env.ADMIN_TOKEN='new-admin-token-'.repeat(3);
  assert.equal(await checkAdminToken(env,env.ADMIN_TOKEN),true);assert.equal(await checkAdminToken(env,oldToken),false);
  env.ADMIN_TOKEN='';await assert.rejects(checkAdminToken(env,oldToken),e=>e.code==='security_not_configured');
  delete env.ADMIN_TOKEN;env.SG_ADMIN_TOKEN='short';await assert.rejects(checkAdminToken(env,'short'),e=>e.code==='security_not_configured');
  const bookTicket=await signed(env,'book',{},60,'BOOK_SIGNING_SECRET');env.BOOK_SIGNING_SECRET='canonical-book-secret-'.repeat(3);
  assert.equal(await verified(env,bookTicket,'book','BOOK_SIGNING_SECRET'),null);
  env.BOOK_SIGNING_SECRET='';await assert.rejects(verified(env,bookTicket,'book','BOOK_SIGNING_SECRET'),e=>e.code==='ticketing_not_configured');
  delete env.BOOK_SIGNING_SECRET;env.SG_MEDIA_SIGNING_SECRET='short';assert.equal((await call(bookAccess,context(env,'/book-access','POST',{}))).status,503);
  env.TURNSTILE_SECRET_KEY='';assert.throws(()=>challenge(context(env,'/admin-access'),'admin_access'),e=>e.code==='human_verification_unavailable');
  delete env.TURNSTILE_SECRET_KEY;delete env.SESSION_SECRET;assert.throws(()=>challenge(context(env,'/admin-access'),'admin_access'),e=>e.code==='security_not_configured');
});

test('B2 reads use the read pair and uploads plus exact-version deletion use the write pair',async t=>{
  const env=splitStorage(),auths=[],operations=[];let exists=true;
  t.mock.method(globalThis,'fetch',async(input,options={})=>{
    const url=new URL(input);
    if(url.pathname.endsWith('b2_authorize_account')){
      const credentials=atob(options.headers.authorization.slice(6));auths.push(credentials);
      const token=credentials===`${env.B2_READ_KEY_ID}:${env.B2_READ_APPLICATION_KEY}`?'read-token':'write-token';return Response.json(authData(token));
    }
    operations.push({path:url.pathname,method:options.method,token:options.headers.authorization});
    if(url.pathname.startsWith('/file/'))return new Response(options.method==='HEAD'?null:'fixture-bytes');
    if(url.pathname.endsWith('b2_get_upload_url'))return Response.json({uploadUrl:'https://upload.fixture.backblazeb2.com/upload',authorizationToken:'upload-token'});
    if(url.pathname==='/upload')return Response.json({fileId:'uploaded'});
    if(url.pathname.endsWith('b2_list_file_versions'))return Response.json({files:exists?[{fileName:key,fileId:'version',action:'upload',bucketId:env.B2_BUCKET_ID}]:[],nextFileName:null});
    if(url.pathname.endsWith('b2_delete_file_version')){exists=false;return Response.json({fileName:key,fileId:'version'});}
    throw new Error('Unexpected request');
  });
  assert.equal(storageConfigured(env),true);await getObject(env,key,{head:true});await getObject(env,key);
  await uploadObject(env,key,new Uint8Array([1,2]));assert.equal((await deleteObjectVersions(env,key)).complete,true);
  await getObject(env,key,{head:true});
  assert.deepEqual(auths,[`${env.B2_READ_KEY_ID}:${env.B2_READ_APPLICATION_KEY}`,`${env.B2_WRITE_KEY_ID}:${env.B2_WRITE_APPLICATION_KEY}`]);
  assert.ok(operations.filter(o=>o.path.startsWith('/file/')).every(o=>o.token==='read-token'));
  assert.ok(operations.filter(o=>o.path.includes('/b2api/')).every(o=>o.token==='write-token'));
  assert.equal(operations.find(o=>o.path==='/upload').token,'upload-token');
});

test('partial or absent B2 role pairs cannot borrow another role or silently use shared credentials',async t=>{
  const env=splitStorage();let requests=0;t.mock.method(globalThis,'fetch',async()=>{requests++;throw new Error('Unexpected request');});
  delete env.B2_READ_APPLICATION_KEY;env.B2_APPLICATION_KEY_ID='shared-id';env.B2_APPLICATION_KEY='shared-key';
  await assert.rejects(getObject(env,key),e=>e.code==='storage_not_configured');
  assert.equal(storageConfigured(env),false);assert.equal(storageConfigured(env,'write'),true);
  delete env.B2_READ_KEY_ID;delete env.B2_APPLICATION_KEY_ID;delete env.B2_APPLICATION_KEY;
  await assert.rejects(getObject(env,key),e=>e.code==='storage_not_configured');
  env.B2_READ_KEY_ID='read-id';env.B2_READ_APPLICATION_KEY='read-key';delete env.B2_WRITE_APPLICATION_KEY;
  await assert.rejects(uploadObject(env,key,new Uint8Array()),e=>e.code==='storage_not_configured');
  await assert.rejects(deleteObjectVersions(env,key),e=>e.code==='storage_not_configured');assert.equal(requests,0);
});

test('B2 authorization cache respects key rotation and rejects changed bucket bindings',async t=>{
  const env=splitStorage(),auths=[];t.mock.method(globalThis,'fetch',async(input,options)=>{
    if(String(input).includes('b2_authorize_account')){auths.push(options.headers.authorization);return Response.json(authData());}
    return new Response(null);
  });
  await getObject(env,key,{head:true});env.B2_READ_APPLICATION_KEY='rotated-fixture-key';await getObject(env,key,{head:true});
  assert.equal(auths.length,2);assert.notEqual(auths[0],auths[1]);
  env.B2_BUCKET_ID='different-bucket';await assert.rejects(getObject(env,key,{head:true}),e=>e.code==='storage_auth_failed');
  env.B2_BUCKET_ID='fixture-bucket';env.B2_BUCKET_NAME='different-name';await assert.rejects(getObject(env,key,{head:true}),e=>e.code==='storage_auth_failed');
  assert.equal(auths.length,2);
});

test('rejected B2 read authorization never retries with the write key',async t=>{
  const env=splitStorage(),auths=[];
  t.mock.method(globalThis,'fetch',async(input,options)=>{auths.push(atob(options.headers.authorization.slice(6)));return Response.json({code:'unauthorized'},{status:401});});
  await assert.rejects(getObject(env,key),e=>e.code==='storage_auth_failed');
  assert.deepEqual(auths,[`${env.B2_READ_KEY_ID}:${env.B2_READ_APPLICATION_KEY}`]);
});
