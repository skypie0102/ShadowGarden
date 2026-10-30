// Local-only integration fixture. Never used by a deployed Worker or release app.
import {createServer} from 'node:https';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {endpoint} from '../../../server/http.js';
import {humanAccess, adminAccess} from '../../../server/security.js';
import {bookAccess, media} from '../../../server/books.js';
import {statusEndpoint} from '../../../server/admin.js';
import {createFixtureEpub} from './generated-epub.mjs';

const BOOK_ID='bk_0123456789abcdefghijkl';
const BOOK_KEY='shadow-garden/books/fixture.epub';
const EPUB_ID='bk_abcdefghijklmnopqrstuv';
const EPUB_KEY='shadow-garden/books/generated-download.epub';
const EPUB_BYTES=await createFixtureEpub();
const FIXTURE_BYTES='generated-fixture-bytes';
const FIXTURE_KEY='keeper-fixture';
const HERE=new URL('.',import.meta.url);

function database() {
  const sqlite=new DatabaseSync(':memory:');
  const migrations=new URL('../../../migrations/',import.meta.url);
  for (const name of readdirSync(migrations).filter(value=>value.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(name,migrations),'utf8'));
  }
  const document={main:[{id:'fixture-series',title:'Generated fixture',volumes:[{bookId:BOOK_ID,title:'Fixture volume',number:1},{bookId:EPUB_ID,title:'Generated EPUB',number:2}]}],adult:[],books:{[BOOK_ID]:BOOK_KEY,[EPUB_ID]:EPUB_KEY},trash:[]};
  sqlite.prepare('INSERT INTO library_state(id,revision,document,updated_at) VALUES(1,0,?,?)')
    .run(JSON.stringify(document),'2026-01-01T00:00:00Z');
  const prepare=(sql,args=[])=>({
    bind:(...bound)=>prepare(sql,bound),
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){const result=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(result.changes)}};}
  });
  return {sqlite,prepare,async batch(statements){
    sqlite.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec('COMMIT');return out;}
    catch(error){sqlite.exec('ROLLBACK');throw error;}
  }};
}

// All outbound calls are intercepted. This fixture cannot contact Siteverify or B2.
const originalFetch=globalThis.fetch;
function fakeExternalFetch(input,init={}) {
  const url=String(input);
  if (url==='https://challenges.cloudflare.com/turnstile/v0/siteverify') {
    const body=JSON.parse(init.body);
    const action=body.response==='human-fixture'||body.response==='wrong-host'?'book_access':
      body.response==='admin-fixture'||body.response==='wrong-action'?'admin_access':'invalid';
    const hostname=body.response==='wrong-host'?'foreign.invalid':'localhost';
    return Promise.resolve(Response.json({success:action!=='invalid',action,hostname}));
  }
  if (url==='https://api.backblazeb2.com/b2api/v4/b2_authorize_account') {
    return Promise.resolve(Response.json({authorizationToken:'fixture-provider',apiInfo:{storageApi:{apiUrl:'https://api.example.backblazeb2.com',downloadUrl:'https://download.example.backblazeb2.com',allowed:{buckets:[{id:'fixture-bucket',name:'fixture'}]}}}}));
  }
  if (url==='https://download.example.backblazeb2.com/file/fixture/'+BOOK_KEY) {
    return Promise.resolve(new Response(FIXTURE_BYTES,{status:200,headers:{'content-type':'application/epub+zip'}}));
  }
  if (url==='https://download.example.backblazeb2.com/file/fixture/'+EPUB_KEY) {
    return Promise.resolve(new Response(EPUB_BYTES,{status:200,headers:{'content-type':'application/epub+zip'}}));
  }
  return Promise.reject(new Error('External network is disabled in the access fixture'));
}

export async function startFixture(port=18443) {
  if (process.env.SG_ACCESSLAB_FIXTURE !== '1') throw new Error('Set SG_ACCESSLAB_FIXTURE=1 for this isolated test server');
  if (!Number.isInteger(port) || port<0 || port>65535) throw new Error('Invalid fixture port');
  const db=database();
  const env={DB:db,ADMIN_TOKEN:FIXTURE_KEY,SESSION_SECRET:'fixture-session-secret-'.repeat(3),BOOK_SIGNING_SECRET:'fixture-book-secret-'.repeat(3),
    TURNSTILE_SITE_KEY:'fixture-site',TURNSTILE_SECRET_KEY:'fixture-turnstile-secret',TURNSTILE_HOSTNAME:'localhost',
    B2_APPLICATION_KEY_ID:'fixture-id',B2_APPLICATION_KEY:'fixture-secret',B2_BUCKET_ID:'fixture-bucket',B2_BUCKET_NAME:'fixture',
    ASSETS:{async fetch(){return new Response('Not found',{status:404});}}};
  const handlers={'/human-access':humanAccess,'/book-access':bookAccess,'/admin-access':adminAccess,'/admin-api/status':statusEndpoint};
  const html=readFileSync(new URL('../src/androidTest/assets/real-handlers-fixture.html',HERE));
  const downloadHtml=readFileSync(new URL('../src/androidTest/assets/download-fixture.html',HERE));
  const pfx=readFileSync(new URL('../src/androidTest/assets/localhost-fixture.p12',HERE));
  globalThis.fetch=fakeExternalFetch;
  const server=createServer({pfx,passphrase:'accesslab-fixture'},async (incoming,outgoing)=>{
    try {
      // Accept only localhost Host headers, and enforce a small bounded body.
      if (!/^localhost(?::\d+)?$/.test(incoming.headers.host||'')) { outgoing.writeHead(403).end(); return; }
      const url=new URL(incoming.url,`https://${incoming.headers.host}`);
      if (incoming.method==='GET' && url.pathname==='/') {
        outgoing.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}).end(html);return;
      }
      if (incoming.method==='GET' && url.pathname==='/download-fixture') {
        outgoing.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}).end(downloadHtml);return;
      }
      const handler=handlers[url.pathname] || (url.pathname.startsWith('/media/')?media:null);
      if (!handler) {outgoing.writeHead(404).end();return;}
      const parts=[];let size=0;
      for await (const chunk of incoming) {size+=chunk.length;if(size>16384){outgoing.writeHead(413).end();return;}parts.push(chunk);}
      const request=new Request(url,{method:incoming.method,headers:incoming.headers,body:parts.length?Buffer.concat(parts):undefined});
      const response=await endpoint(handler)({request,env});
      const headers=Object.fromEntries(response.headers.entries());
      outgoing.writeHead(response.status,headers).end(Buffer.from(await response.arrayBuffer()));
    } catch(error) {
      console.error('Fixture request failed:',error.name);
      if(!outgoing.headersSent)outgoing.writeHead(500);outgoing.end();
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {port:server.address().port,async close(){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));db.sqlite.close();globalThis.fetch=originalFetch;}};
}

if (process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const fixture=await startFixture(Number(process.env.SG_ACCESSLAB_PORT||18443));
  console.log(`Access fixture listening on localhost:${fixture.port}`);
  const stop=async()=>{await fixture.close();};
  process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
}
