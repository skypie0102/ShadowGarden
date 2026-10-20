import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/assets/js/book-access.js',import.meta.url),'utf8');
const bookId='bk_A2yCOKedG1g4xXTJJhbEzA';
function fixture({authorize}={}){
  const location=new URL('https://garden.test/series?id=fixture'),requests=[];
  const window={addEventListener(){},fetch:async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:input,location);
    requests.push({url,request:new Request(input instanceof Request?input:url,init)});
    if(url.pathname==='/book-access')return authorize?authorize():Response.json({ok:true,bookId,url:'/media/shadow-garden/books/fixture.epub?sig=fixture',expiresAt:Math.floor(Date.now()/1000)+3600});
    return new Response(null,{status:200});
  }};
  const nativeFetch=window.fetch;
  runInNewContext(source,{window,location,document:{addEventListener(){},body:{classList:{contains:()=>false}}},URL,URLSearchParams,Request,TextEncoder,AbortController,DOMException,crypto,btoa,console,setTimeout,clearTimeout});
  return{fetch:window.ShadowGardenBookAccess.fetch,requests,window,nativeFetch};
}

test('book access leaves global fetch unchanged and exposes explicit protected transport',async()=>{
  const f=fixture();
  assert.equal(f.window.fetch,f.nativeFetch);
  assert.equal(typeof f.fetch,'function');
  await f.window.fetch('/'+bookId);
  assert.equal(f.requests.length,1);
  assert.equal(f.requests[0].url.pathname,'/'+bookId);
});

test('opaque protected Request rewriting preserves method, headers, credentials and caller cancellation',async()=>{
  const f=fixture(),controller=new AbortController();
  const input=new Request('https://garden.test/'+bookId,{method:'HEAD',headers:{range:'bytes=0-7','x-fixture':'preserved'},credentials:'same-origin',signal:controller.signal});
  await f.fetch(input);
  const {request}=f.requests.at(-1);
  assert.equal(new URL(request.url).pathname,'/media/shadow-garden/books/fixture.epub');
  assert.equal(request.method,'HEAD');assert.equal(request.headers.get('range'),'bytes=0-7');assert.equal(request.headers.get('x-fixture'),'preserved');
  assert.equal(request.credentials,'same-origin');controller.abort();assert.equal(request.signal.aborted,true);
});

test('an already cancelled protected fetch does not request authorization',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();
  await assert.rejects(f.fetch(new Request('https://garden.test/'+bookId,{signal:controller.signal})),error=>error.name==='AbortError');
  assert.equal(f.requests.length,0);
});

test('opaque string and URL sources use the authorized path and reuse a live ticket',async()=>{
  const f=fixture();
  await f.fetch('/'+bookId,{cache:'force-cache',credentials:'same-origin'});
  await f.fetch(new URL('https://garden.test/'+bookId));
  assert.equal(f.requests.filter(r=>r.url.pathname==='/book-access').length,1);
  assert.equal(f.requests[1].url.pathname,'/media/shadow-garden/books/fixture.epub');
  assert.equal(f.requests[1].url.search,'');
  assert.equal(f.requests[1].request.cache,'force-cache');
  assert.equal(f.requests[1].request.credentials,'same-origin');
});

test('legacy source authorization preserves its encoded path, query and request options',async()=>{
  const f=fixture(),path='/media/shadow-garden/books/encoded%20title.epub?download=1';
  const input=new Request('https://garden.test'+path,{method:'HEAD',headers:{range:'bytes=2-9'},cache:'no-store'});
  await f.fetch(input);
  assert.equal(f.requests[0].url.pathname,'/book-access');
  assert.equal(JSON.parse(await f.requests[0].request.text()).book,'/media/shadow-garden/books/encoded%20title.epub');
  const {request,url}=f.requests[1];
  assert.equal(url.pathname+url.search,path);
  assert.equal(request.method,'HEAD');assert.equal(request.headers.get('range'),'bytes=2-9');assert.equal(request.cache,'no-store');
});

test('explicit transport passes unrelated, cross-origin and already signed requests through without authorizing',async()=>{
  const f=fixture();
  for(const path of ['/data/version.json','https://elsewhere.test/'+bookId,'https://elsewhere.test/media/shadow-garden/books/fixture.epub','/media/shadow-garden/books/fixture.epub?sig=existing','blob:https://garden.test/fixture','data:text/plain,fixture'])await f.fetch(path);
  assert.equal(f.requests.length,6);
  assert.equal(f.requests.some(r=>r.url.pathname==='/book-access'),false);
});

test('Request init overrides are retained when an opaque source is rewritten',async()=>{
  const f=fixture(),original=new AbortController(),override=new AbortController();
  const input=new Request('https://garden.test/'+bookId,{headers:{'x-original':'old'},credentials:'omit',signal:original.signal});
  await f.fetch(input,{method:'HEAD',headers:{range:'bytes=0-1'},credentials:'include',redirect:'error',cache:'reload',signal:override.signal});
  const request=f.requests.at(-1).request;
  assert.equal(request.method,'HEAD');assert.equal(request.credentials,'include');assert.equal(request.redirect,'error');assert.equal(request.cache,'reload');
  assert.equal(request.headers.get('x-original'),null);assert.equal(request.headers.get('range'),'bytes=0-1');
  original.abort();assert.equal(request.signal.aborted,false);
  override.abort();assert.equal(request.signal.aborted,true);
});

test('cancellation during authorization prevents the EPUB request',async()=>{
  let finish;const ticket=new Promise(resolve=>{finish=resolve});
  const f=fixture({authorize:()=>ticket}),controller=new AbortController();
  const pending=f.fetch('/'+bookId,{signal:controller.signal});
  controller.abort();finish(Response.json({bookId,url:'/media/shadow-garden/books/fixture.epub?sig=fixture',expiresAt:Math.floor(Date.now()/1000)+3600}));
  await assert.rejects(pending,error=>error.name==='AbortError');
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].url.pathname,'/book-access');
});

test('failed authorization does not request protected bytes',async()=>{
  const f=fixture({authorize:()=>Response.json({error:'Fixture denial'},{status:403})});
  await assert.rejects(f.fetch('/'+bookId),/Fixture denial/);
  assert.equal(f.requests.length,1);
});

test('rewriting a Request preserves the body and native body-transfer semantics',async()=>{
  const f=fixture();
  const input=new Request('https://garden.test/'+bookId,{method:'POST',body:'fixture-body',duplex:'half'});
  await f.fetch(input);
  assert.equal(await f.requests.at(-1).request.text(),'fixture-body');
  // Request construction transfers the input body, as native fetch does.
  assert.equal(input.bodyUsed,true);
});
