import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/assets/js/book-access.js',import.meta.url),'utf8');
const bookId='bk_A2yCOKedG1g4xXTJJhbEzA';
function fixture(){
  const location=new URL('https://garden.test/series?id=fixture'),requests=[];
  const window={addEventListener(){},fetch:async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:input,location);
    requests.push({url,request:new Request(input instanceof Request?input:url,init)});
    if(url.pathname==='/book-access')return Response.json({ok:true,bookId,url:'/media/shadow-garden/books/fixture.epub?sig=fixture',expiresAt:Math.floor(Date.now()/1000)+3600});
    return new Response(null,{status:200});
  }};
  runInNewContext(source,{window,location,document:{addEventListener(){},body:{classList:{contains:()=>false}}},URL,URLSearchParams,Request,TextEncoder,AbortController,DOMException,crypto,btoa,console,setTimeout,clearTimeout});
  return{fetch:window.fetch,requests};
}

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
