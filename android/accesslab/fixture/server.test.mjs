import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpsRequest} from 'node:https';
import {readFileSync} from 'node:fs';
import {startFixture} from './server.mjs';

const ca=readFileSync(new URL('../src/debug/res/raw/access_lab_ca.pem',import.meta.url));
const bookId='bk_0123456789abcdefghijkl';

test('real access handlers enforce verification, tickets and revocable Keeper sessions',async t=>{
  process.env.SG_ACCESSLAB_FIXTURE='1';
  const fixture=await startFixture(0);
  t.after(async()=>{await fixture.close();delete process.env.SG_ACCESSLAB_FIXTURE;});
  const origin=`https://localhost:${fixture.port}`;
  const cookies=new Map();
  async function call(path,method='GET',body,extra={}) {
    const data=body===undefined?undefined:JSON.stringify(body);
    const headers={host:`localhost:${fixture.port}`,origin,...extra};
    if(data!==undefined){headers['content-type']='application/json';headers['content-length']=Buffer.byteLength(data);}
    if(cookies.size)headers.cookie=[...cookies].map(([key,value])=>`${key}=${value}`).join('; ');
    return new Promise((resolve,reject)=>{
      const req=httpsRequest({host:'localhost',family:4,port:fixture.port,path,method,headers,ca},response=>{
        for(const value of response.headers['set-cookie']||[]){const [pair]=value.split(';');const i=pair.indexOf('=');if(i>0){const key=pair.slice(0,i),v=pair.slice(i+1);if(v)cookies.set(key,v);else cookies.delete(key);}}
        const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks).toString()}));
      });req.on('error',reject);if(data!==undefined)req.write(data);req.end();
    });
  }
  assert.equal((await call('/book-access','POST',{bookId})).status,428);
  assert.equal((await call('/human-access','POST',{token:'human-fixture'},{origin:'https://foreign.invalid'})).status,403);
  assert.equal((await call('/human-access','POST',{token:'invalid-fixture'})).status,403);
  assert.equal((await call('/human-access','POST',{token:'wrong-action'})).status,403);
  assert.equal((await call('/human-access','POST',{token:'wrong-host'})).status,403);
  assert.equal((await call('/human-access','POST',{token:'human-fixture'})).status,200);
  const ticket=JSON.parse((await call('/book-access','POST',{bookId})).body);
  assert.ok(ticket.url.includes('sig='));
  const broken=new URL(ticket.url,origin);broken.searchParams.set('sig','tampered');
  assert.equal((await call(broken.pathname+broken.search)).status,403);
  const fresh=JSON.parse((await call('/book-access','POST',{bookId})).body);
  const download=await call(fresh.url);assert.equal(download.status,200);assert.equal(download.body,'generated-fixture-bytes');
  assert.equal((await call('/admin-access','POST',{adminToken:'wrong',turnstileToken:'admin-fixture'})).status,401);
  assert.equal((await call('/admin-access','POST',{adminToken:'keeper-fixture',turnstileToken:'admin-fixture'})).status,200);
  assert.equal((await call('/admin-api/status','POST',{})).status,401);
  const bearer={authorization:'Bearer keeper-fixture'};
  assert.equal((await call('/admin-api/status','POST',{},bearer)).status,200);
  const revokedSession=cookies.get('__Host-sg_admin');
  assert.ok(revokedSession);
  assert.equal((await call('/admin-access','DELETE')).status,200);
  cookies.set('__Host-sg_admin',revokedSession);
  assert.equal((await call('/admin-api/status','POST',{},bearer)).status,401);
});
