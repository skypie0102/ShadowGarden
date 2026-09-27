import {objectKey} from './storage.js';

export const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
const record=value=>value!==null && typeof value==='object' && !Array.isArray(value);
const nonempty=value=>typeof value==='string' && value.trim().length>0;
function check(condition,message) { if (!condition) throw new Error(message); }
function covers(value) {
  for (const field of ['cover','coverThumb']) {
    check(value[field]===undefined || typeof value[field]==='string','Cover references must be strings.');
    if (value[field]?.startsWith('/media/')) objectKey(value[field].slice(7),'cover');
  }
}
function volume(value) {
  check(record(value) && typeof value.bookId==='string' && BOOK_ID.test(value.bookId) && nonempty(value.title),'A volume is missing its identity or title.');
  check(Number.isFinite(value.number) && value.number>0,'A volume number is invalid.');
  covers(value);
}
function series(value) {
  check(record(value) && nonempty(value.id) && nonempty(value.title) && Array.isArray(value.volumes),'A series is missing its identity, title or volume list.');
  covers(value);
  const ids=new Set();
  for (const entry of value.volumes) {
    volume(entry);check(!ids.has(entry.bookId),'A series contains duplicate book identities.');ids.add(entry.bookId);
  }
}
// This validates the reconstructed storage shape, not an unrecovered original
// schema. Missing private mappings are allowed and reported by media readiness.
export function catalogError(document) {
  try {
    check(record(document) && Array.isArray(document.main) && Array.isArray(document.adult) && record(document.books) && Array.isArray(document.trash),'Catalogs need main/adult lists, a book map and a trash list.');
    const seriesIds=new Set(),bookIds=new Set(),keys=new Set(),trashIds=new Set();
    for (const entry of [...document.main,...document.adult]) {
      series(entry);check(!seriesIds.has(entry.id),'Active series identities must be unique.');seriesIds.add(entry.id);
      for (const v of entry.volumes) {check(!bookIds.has(v.bookId),'Active book identities must be unique.');bookIds.add(v.bookId);}
    }
    for (const [id,key] of Object.entries(document.books)) {
      check(BOOK_ID.test(id) && typeof key==='string','A private book mapping is invalid.');objectKey(key,'book');
      check(!keys.has(key),'Different book identities cannot share a private object.');keys.add(key);
    }
    for (const entry of document.trash) {
      check(record(entry) && nonempty(entry.id) && ['series','volume'].includes(entry.type) && ['main','adult'].includes(entry.scope),'A trash record is invalid.');
      check(!trashIds.has(entry.id),'Trash identities must be unique.');trashIds.add(entry.id);
      series(entry.series);check(entry.seriesId===entry.series.id,'A trash record has mismatched series identities.');
      if (entry.type==='volume') volume(entry.volume);
    }
    return '';
  } catch (error) { return error.message; }
}
export function inspectCatalog(serialized) {
  let document;
  try { document=JSON.parse(serialized); }
  catch { return {document:null,error:'Catalog JSON cannot be read.'}; }
  const error=catalogError(document);
  return {document:error?null:document,error};
}
