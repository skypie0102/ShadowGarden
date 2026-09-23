import recovered from './recovered-state.js';
import {database, digest} from './security.js';
import {fail} from './http.js';

export function counts(doc) {
  return {mainSeries:doc.main.length,adultSeries:doc.adult.length,series:doc.main.length+doc.adult.length,
    volumes:[...doc.main,...doc.adult].reduce((sum,s)=>sum+s.volumes.length,0)};
}
export async function loadState(env, {writable = false} = {}) {
  if (!env.DB) {
    if (writable) database(env);
    return {revision:-1,document:structuredClone(recovered),updated_at:'2026-09-11T07:19:46.602Z',source:'recovered-static'};
  }
  const row=await env.DB.prepare('SELECT revision,document,updated_at FROM library_state WHERE id = 1').first();
  if (!row) {
    if (writable) fail(503,'database_not_seeded','Apply the reconstruction migration and explicit catalog seed first.');
    return {revision:-1,document:structuredClone(recovered),updated_at:'2026-09-11T07:19:46.602Z',source:'recovered-static'};
  }
  return {...row,serialized:row.document,document:JSON.parse(row.document),source:'reconstructed-d1'};
}
export async function saveState(env,previous,document,reason) {
  const db=database(env),id=crypto.randomUUID(),date=new Date().toISOString();
  const old=previous.serialized || JSON.stringify(previous.document),next=JSON.stringify(document);
  if (new TextEncoder().encode(next).length > 1500000) fail(413,'catalog_too_large','Catalog exceeds the reconstructed storage limit.');
  const results=await db.batch([
    db.prepare('INSERT INTO snapshots(id,reason,created_at,document,sha256) SELECT ?,?,?,document,? FROM library_state WHERE id = 1 AND revision = ?').bind(id,reason,date,await digest(old),previous.revision),
    db.prepare('UPDATE library_state SET document = ?, revision = revision+1, updated_at = ? WHERE id = 1 AND revision = ?').bind(next,date,previous.revision)
  ]);
  if (results[1]?.meta?.changes !== 1) fail(409,'catalog_conflict','The catalog changed during this edit. Reload and retry.');
  return {revision:previous.revision+1,serialized:next,document,updated_at:date,source:'reconstructed-d1'};
}
export async function snapshots(env) {
  const result=await database(env).prepare('SELECT id,reason,created_at,document,sha256 FROM snapshots ORDER BY created_at DESC LIMIT 200').all();
  return result.results || [];
}
export function adminLibrary(row) {
  const doc=structuredClone(row.document);
  for (const s of [...doc.main,...doc.adult]) for (const v of s.volumes) v.file=doc.books[v.bookId] ? `/media/${doc.books[v.bookId]}` : v.bookId;
  return {ok:true,main:doc.main,adult:doc.adult,counts:counts(doc),revision:row.revision};
}
export function publicCatalog(row,adult) {
  const series=structuredClone(adult?row.document.adult:row.document.main);
  // Strip private storage coordinates and ingestion bookkeeping recursively.
  const clean=value=>{
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key])=>!['file','epubKey','originalFilename','sha256','coverKey','coverThumbKey','fileId'].includes(key)).map(([key,v])=>[key,clean(v)]));
  };
  return {generatedAt:row.updated_at,series:clean(series)};
}
