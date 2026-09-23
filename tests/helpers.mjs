import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {ADMIN_COOKIE,cookie,now,signed} from '../server/security.js';

export function dbFixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_reconstructed.sql',import.meta.url),'utf8'));
  sqlite.exec(readFileSync(new URL('../recovery-info/seed.sql',import.meta.url),'utf8'));
  const prepare=(sql,args=[])=>({
    bind:(...bound)=>prepare(sql,bound),
    async first(){return sqlite.prepare(sql).get(...args)||null;},
    async all(){return {results:sqlite.prepare(sql).all(...args)};},
    async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}
  });
  return {sqlite,prepare,async batch(statements){sqlite.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
}
export function fixture() {
  return {DB:dbFixture(),ADMIN_TOKEN:'test-keeper-token-'.repeat(3),SESSION_SECRET:'test-session-secret-'.repeat(3),
    BOOK_SIGNING_SECRET:'test-book-secret-'.repeat(3),TURNSTILE_SITE_KEY:'test-site-key',TURNSTILE_SECRET_KEY:'test-turnstile-secret',
    ASSETS:{async fetch(){return new Response('Not found',{status:404});}}};
}
export function context(env,path,method='GET',body,headers={}) {
  return {env,request:new Request(`https://garden.test${path}`,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)})};
}
export async function adminHeaders(env) {
  const sid=crypto.randomUUID();await env.DB.prepare('INSERT INTO admin_sessions(id,expires_at) VALUES(?,?)').bind(sid,now()+3600).run();
  return {authorization:`Bearer ${env.ADMIN_TOKEN}`,cookie:cookie(ADMIN_COOKIE,await signed(env,'admin',{sid},3600),3600).split(';')[0],origin:'https://garden.test'};
}
