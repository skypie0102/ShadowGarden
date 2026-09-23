import {bodyJson, boundedBytes, fail, json, method, required, safeUrl, text} from './http.js';
import {database, digest, now, requireAdmin} from './security.js';
import {adminLibrary, counts, loadState, saveState, snapshots} from './state.js';
import {bookIdForKey, BOOK_ID} from './books.js';
import {getObject, objectKey, storageConfigured, uploadObject} from './storage.js';
import {validateEpub} from './epub.js';
import {CANONICAL_GENRES, normalizeSeriesTaxonomy, taxonomyDiff} from '../public/assets/js/domain/catalog-taxonomy.js';
import {normalizeTranslations, normalizeTranslationStatus} from '../public/assets/js/domain/translations.js';

const allSeries=doc=>[...doc.main,...doc.adult];
const slug=value=>text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const list=value=>Array.isArray(value)?value.slice(0,100).map(v=>text(v,160)).filter(Boolean):[];
function series(doc,id) {
  for (const scope of ['main','adult']) { const value=doc[scope].find(s=>s.id===id); if (value) return {value,scope}; }
  fail(404,'series_not_found','Series not found.');
}
function volume(s,index) {
  if (!Number.isInteger(index) || index<0 || index>=s.volumes.length) fail(400,'invalid_volume','Invalid volume index.');
  return s.volumes[index];
}
function number(value) {
  const n=Number(value); if (!Number.isFinite(n) || n<=0 || n>100000) fail(400,'invalid_number','Volume number must be positive.'); return n;
}
function translations(value) {
  if (!Array.isArray(value)) fail(400,'invalid_translations','Translations must be an array.');
  return normalizeTranslations(value);
}
function status(value) {
  const aliases={complete:'Complete',completed:'Complete',ongoing:'Ongoing',hiatus:'Hiatus',dropped:'Dropped'};
  return aliases[text(value).toLowerCase()] || 'Ongoing';
}
function setSeriesMetadata(s,p) {
  if ('title' in p) s.title=required(p.title,'Series title');
  for (const k of ['author','description']) if (k in p) s[k]=text(p[k],k==='description'?10000:300);
  if ('year' in p) { const y=Number(p.year); s.year=Number.isInteger(y)&&y>=0&&y<=9999?y:null; }
  if ('status' in p) s.status=status(p.status);
  if ('audioAlignedUrl' in p) s.audioAlignedUrl=safeUrl(p.audioAlignedUrl);
  if ('genres' in p || 'tags' in p) Object.assign(s,normalizeSeriesTaxonomy({genres:'genres' in p?list(p.genres):s.genres,tags:'tags' in p?list(p.tags):s.tags}));
  if ('translations' in p) s.translations=translations(p.translations);
  if ('translationStatus' in p) s.translationStatus=normalizeTranslationStatus(p.translationStatus);
}
function setVolumeMetadata(v,p) {
  if ('title' in p) v.title=required(p.title,'Volume title');
  if ('number' in p) v.number=number(p.number);
  for (const k of ['date','publisher','description','author','language']) if (k in p) v[k]=text(p[k],k==='description'?10000:300);
}
function checkRevision(context,row) {
  const expected=context.request.headers.get('if-match');
  if (expected && expected!==`"${row.revision}"` && expected!==String(row.revision)) fail(409,'catalog_conflict','The catalog changed. Reload before saving.');
}
async function writable(context) { const row=await loadState(context.env,{writable:true});checkRevision(context,row);return row; }

export async function library(context) {
  method(context.request,['GET','POST']); await requireAdmin(context);
  if (context.request.method==='GET') return json(adminLibrary(await loadState(context.env,{writable:true})));
  const p=await bodyJson(context.request),row=await writable(context),doc=structuredClone(row.document);
  const {value:s,scope}=series(doc,p.id);
  if (p.action==='update-series') {
    setSeriesMetadata(s,p);
    if ('adult' in p) {
      if (typeof p.adult!=='boolean') fail(400,'invalid_scope','Adult scope must be a boolean.');
      const next=p.adult?'adult':'main';s.nsfw=p.adult;
      if (scope!==next) {doc[scope]=doc[scope].filter(x=>x.id!==s.id);doc[next].push(s);}
    }
  } else if (p.action==='update-volume') setVolumeMetadata(volume(s,p.volumeIndex),p);
  else if (p.action==='delete-series' || p.action==='delete-volume') {
    const item={id:crypto.randomUUID(),scope,removedAt:new Date().toISOString(),seriesId:s.id,series:structuredClone(s)};
    if (p.action==='delete-series') {Object.assign(item,{type:'series',title:s.title,subtitle:`${s.volumes.length} volumes`});doc[scope]=doc[scope].filter(x=>x.id!==s.id);}
    else {
      const v=volume(s,p.volumeIndex);Object.assign(item,{type:'volume',title:v.title,subtitle:s.title,volume:structuredClone(v)});
      s.volumes.splice(p.volumeIndex,1);if (s.bannerBookId===v.bookId) delete s.bannerBookId;
      if (!s.volumes.length) doc[scope]=doc[scope].filter(x=>x.id!==s.id);
    }
    doc.trash.push(item);
  } else fail(400,'unknown_action','Unknown library action.');
  const saved=await saveState(context.env,row,doc,p.action);return json(adminLibrary(saved));
}
export async function upload(context) {
  method(context.request,['POST']);await requireAdmin(context);
  const key=objectKey(new URL(context.request.url).searchParams.get('key'));
  const bytes=await boundedBytes(context.request,key.endsWith('.epub')?50*1024*1024:10*1024*1024);
  const signature=String.fromCharCode(...bytes.slice(0,12));
  const valid=key.endsWith('.epub') ? signature.startsWith('PK\u0003\u0004') : /\.webp$/i.test(key) ? signature.startsWith('RIFF')&&signature.slice(8)==='WEBP' : /\.png$/i.test(key) ? bytes[0]===137&&signature.slice(1,4)==='PNG' : /\.gif$/i.test(key) ? /^GIF8[79]a/.test(signature) : bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if (!valid) fail(415,'invalid_media','The file signature does not match the media extension.');
  if(key.endsWith('.epub'))validateEpub(bytes);
  // No object overwrite: old snapshots must continue to refer to their original bytes.
  const existing=await getObject(context.env,key,{head:true});
  if (existing) fail(409,'object_exists','This object key already exists. Upload using a new key.');
  const reserved=await database(context.env).prepare('INSERT OR IGNORE INTO media_uploads(object_key,created_at) VALUES(?,?)').bind(key,new Date().toISOString()).run();
  if(reserved.meta.changes!==1)fail(409,'object_reserved','This upload key has already been used. Retry with a new key.');
  return json({ok:true,...await uploadObject(context.env,key,bytes)});
}
async function requireObject(env,key,kind) {
  objectKey(key,kind);const found=await getObject(env,key,{head:true});
  if (!found) fail(400,'object_missing','Upload the referenced media object first.');
  return found;
}
export async function catalog(context) {
  method(context.request,['POST']);await requireAdmin(context);
  const p=await bodyJson(context.request),row=await writable(context),doc=structuredClone(row.document);
  const scope=p.adult===true?'adult':'main',title=required(p.series,'Series title'),id=p.targetSeriesId||`${scope==='adult'?'adult-':''}${slug(title)}`;
  if (!id || id==='adult-') fail(400,'invalid_series','Provide an ASCII series slug or an existing target series.');
  let s=doc[scope].find(x=>x.id===id);
  if (p.targetSeriesId && !s) fail(404,'series_not_found','Target series not found in this scope.');
  if (!s) {
    if (allSeries(doc).some(x=>x.id===id)) fail(409,'series_conflict','This series identifier is already used in the other library.');
    s={id,title,author:'',status:'Ongoing',nsfw:scope==='adult',volumes:[],genres:[],tags:[]};
    setSeriesMetadata(s,{...p,title});doc[scope].push(s);
  }
  const n=number(p.number),policy=p.duplicatePolicy||'reject';
  if (!['reject','replace','separate'].includes(policy)) fail(400,'invalid_policy','Unknown duplicate policy.');
  const target=s.volumes.find(v=>v.bookId===p.replaceTargetFile || (doc.books[v.bookId] && `/media/${doc.books[v.bookId]}`===p.replaceTargetFile));
  if (policy==='replace' && !target) fail(409,'replacement_missing','Replacement target is no longer present.');
  if (policy==='reject' && s.volumes.some(v=>Number(v.number)===n || (p.sha256&&v.sha256===p.sha256))) fail(409,'duplicate_volume','A matching volume already exists.');
  const key=objectKey(p.epubKey,'book'),stored=await requireObject(context.env,key,'book');
  const bookId=target&&policy==='replace'?target.bookId:await bookIdForKey(key);
  if (allSeries(doc).some(other=>other.volumes.some(v=>v.bookId===bookId&&v!==target))) fail(409,'duplicate_book','This book is already cataloged.');
  const v={title:required(p.title,'Volume title'),number:n,bookId,added:new Date().toISOString().slice(0,10)};
  setVolumeMetadata(v,p);
  v.size=Number(stored.headers.get('content-length'))||Math.max(0,Number(p.size)||0);v.sha256=/^[a-f0-9]{64}$/i.test(p.sha256||'')?p.sha256:'';v.originalFilename=text(p.originalFilename,255);
  if ('translations' in p) v.translations=translations(p.translations);
  for (const [field,input] of [['cover','coverKey'],['coverThumb','coverThumbKey']]) {
    if (p[input]) {const cover=objectKey(p[input],'cover');await requireObject(context.env,cover,'cover');v[field]=`/media/${cover}`;}
    else if (target?.[field]) v[field]=target[field];
  }
  if (target&&policy==='replace') s.volumes[s.volumes.indexOf(target)]={...target,...v};else s.volumes.push(v);
  s.volumes.sort((a,b)=>a.number-b.number);doc.books[bookId]=key;
  if (!s.cover) s.cover=v.cover||'';if (!s.coverThumb) s.coverThumb=v.coverThumb||'';
  const saved=await saveState(context.env,row,doc,policy==='replace'?'replace-volume':'add-volume');
  return json({ok:true,seriesId:s.id,bookId,revision:saved.revision});
}
export async function seriesBanner(context) {
  method(context.request,['GET','POST']);await requireAdmin(context);
  const p=context.request.method==='POST'?await bodyJson(context.request):{id:new URL(context.request.url).searchParams.get('id')};
  const row=await writable(context),doc=structuredClone(row.document),{value:s}=series(doc,p.id);
  if (context.request.method==='POST') {
    const id=text(p.bannerBookId);if (id&&!s.volumes.some(v=>v.bookId===id)) fail(400,'invalid_banner','Choose a volume from this series.');
    if (id) s.bannerBookId=id;else delete s.bannerBookId;
    const saved=await saveState(context.env,row,doc,'series-banner');return json({ok:true,id:s.id,bannerBookId:id,revision:saved.revision});
  }
  return json({ok:true,id:s.id,current:s.bannerBookId||'',bannerBookId:s.bannerBookId||'',revision:row.revision,choices:s.volumes.map(v=>({bookId:v.bookId,title:v.title,number:v.number,cover:v.cover||v.coverThumb||''}))});
}
export async function translationUpdate(context) {
  method(context.request,['POST']);await requireAdmin(context);
  const p=await bodyJson(context.request),row=await writable(context),doc=structuredClone(row.document),{value:s}=series(doc,p.id);
  if (p.target==='volume') volume(s,p.volumeIndex).translations=translations(p.translations);
  else if (p.target==='series') {s.translations=translations(p.translations);if ('translationStatus' in p) s.translationStatus=normalizeTranslationStatus(p.translationStatus);}
  else fail(400,'invalid_target','Choose series or volume translations.');
  return json(adminLibrary(await saveState(context.env,row,doc,'translations')));
}

export function health(doc) {
  const objectKeys=new Set(),issues=[],optimizationCandidates=[];let missingCovers=0,missingThumbs=0,missingBookMappings=0;
  for (const scope of ['main','adult']) for (const s of doc[scope]) {
    const check=(v,volumeIndex)=>{
      for (const field of ['cover','coverThumb']) if (v[field]?.startsWith('/media/')) objectKeys.add(v[field].slice(7));
      if (!v.cover) missingCovers++;
      if (v.cover&&!v.coverThumb) {missingThumbs++;optimizationCandidates.push({scope,seriesId:s.id,seriesTitle:s.title,volumeIndex,volumeTitle:v.title,volumeFile:doc.books[v.bookId]?`/media/${doc.books[v.bookId]}`:'',source:v.cover});}
    };
    check(s,null);
    for (const v of s.volumes) {
      check(v,s.volumes.indexOf(v));
      if (doc.books[v.bookId]) objectKeys.add(doc.books[v.bookId]);
      else {missingBookMappings++;issues.push({severity:'error',code:'missing-book-mapping',title:'Private book mapping missing',detail:`${v.title} (${v.bookId})`});}
    }
  }
  if (missingCovers) issues.push({severity:'warning',code:'missing-covers',title:'Missing covers',detail:`${missingCovers} catalog entries lack a cover.`});
  return {status:issues.some(x=>x.severity==='error')?'attention':issues.length?'warning':'healthy',counts:counts(doc),
    metrics:{referencedObjects:objectKeys.size,missingCovers,missingThumbs,missingBookMappings,legacyIdentity:0,trashItems:doc.trash.length},issues,objectKeys:[...objectKeys],optimizationCandidates};
}
async function maintenanceData(env,row) {
  const saved=await snapshots(env),doc=row.document,preview=allSeries(doc).map(s=>({...taxonomyDiff(s),title:s.title,beforeGenres:s.genres||[],beforeTags:s.tags||[]})).filter(x=>x.changed);
  return {ok:true,revision:row.revision,health:health(doc),trash:doc.trash.map(({series,volume,...entry})=>entry),
    backups:saved.map(s=>({id:s.id,reason:s.reason,createdAt:s.created_at,counts:counts(JSON.parse(s.document))})),
    taxonomy:{totalSeries:allSeries(doc).length,affectedSeries:preview.length,canonicalGenreCount:CANONICAL_GENRES.length,preview:preview.slice(0,100)}};
}
export async function checkObjects(env,keys) {
  const missing=[];for (const key of keys) if (!await getObject(env,objectKey(key),{head:true})) missing.push({key});
  return {checked:keys.length,missing};
}
async function backupRow(env,id) {
  const row=await database(env).prepare('SELECT id,reason,created_at,document,sha256 FROM snapshots WHERE id = ?').bind(text(id,100)).first();
  if (!row) fail(404,'backup_not_found','Backup not found.');
  if (await digest(row.document)!==row.sha256) fail(409,'backup_damaged','Backup checksum verification failed.');
  return row;
}
export async function maintenance(context) {
  method(context.request,['GET','POST']);await requireAdmin(context);
  let row=await writable(context);
  if (context.request.method==='GET') return json(await maintenanceData(context.env,row));
  const p=await bodyJson(context.request),doc=structuredClone(row.document);let extra={};
  if (p.action==='check-objects') {
    if (!Array.isArray(p.keys)||p.keys.length>25) fail(400,'invalid_keys','Check at most 25 media keys at a time.');
    return json({ok:true,...await checkObjects(context.env,p.keys)});
  }
  if (p.action==='purge-trash') fail(501,'purge_not_reconstructed','Permanent B2 deletion is unavailable until the original retention and recovery rules are recovered. Trash can still be restored.');
  if (p.action==='create-backup') {
    const db=database(context.env),document=JSON.stringify(doc),id=crypto.randomUUID();
    await db.prepare('INSERT INTO snapshots(id,reason,created_at,document,sha256) VALUES(?,?,?,?,?)').bind(id,text(p.reason)||'manual-backup',new Date().toISOString(),document,await digest(document)).run();
  } else if (p.action==='restore-backup') {
    const saved=await backupRow(context.env,p.id);
    row=await saveState(context.env,row,JSON.parse(saved.document),'before-restore-backup');
  } else if (p.action==='restore-trash') {
    const item=doc.trash.find(t=>t.id===p.id);if (!item) fail(404,'trash_not_found','Trash item not found.');
    const existing=allSeries(doc).find(s=>s.id===item.seriesId);
    if (item.type==='series') {
      if (existing) fail(409,'restore_conflict','A series with this identity already exists.');
      doc[item.scope].push(item.series);
    } else {
      const s=existing||{...item.series,volumes:[]};
      if (s.volumes.some(v=>v.bookId===item.volume.bookId)) fail(409,'restore_conflict','This volume is already present.');
      s.volumes.push(item.volume);s.volumes.sort((a,b)=>a.number-b.number);
      if (!existing) doc[item.scope].push(s);
    }
    doc.trash=doc.trash.filter(t=>t.id!==item.id);row=await saveState(context.env,row,doc,'restore-trash');
  } else if (p.action==='normalize-taxonomy') {
    let changed=0;for (const s of allSeries(doc)) {const next=taxonomyDiff(s);if(next.changed){Object.assign(s,{genres:next.genres,tags:next.tags});changed++;}}
    if (changed) row=await saveState(context.env,row,doc,'normalize-taxonomy');extra.normalizedTaxonomy=changed;
  } else if (p.action==='apply-cover-optimizations') {
    if (!Array.isArray(p.updates)||p.updates.length>100) fail(400,'invalid_updates','Provide at most 100 cover updates.');
    for (const update of p.updates) {
      const {value:s,scope}=series(doc,update.seriesId);if (scope!==update.scope) fail(409,'catalog_conflict','Series moved to a different library.');
      const v=update.volumeIndex===null?s:volume(s,update.volumeIndex);
      if (update.volumeIndex!==null && update.volumeFile && update.volumeFile!==v.bookId && update.volumeFile!==`/media/${doc.books[v.bookId]}`) fail(409,'catalog_conflict','Volume identity changed.');
      const detail=objectKey(update.coverKey,'cover'),thumb=objectKey(update.coverThumbKey,'cover');
      await requireObject(context.env,detail,'cover');await requireObject(context.env,thumb,'cover');v.cover=`/media/${detail}`;v.coverThumb=`/media/${thumb}`;
    }
    row=await saveState(context.env,row,doc,'optimize-covers');extra.optimized=p.updates.length;
  } else fail(400,'unknown_action','Unknown maintenance action.');
  return json({...await maintenanceData(context.env,row),...extra});
}
export async function backup(context) {
  method(context.request,['POST']);await requireAdmin(context);const p=await bodyJson(context.request);
  if (p.action!=='delete') fail(400,'unknown_action','Use maintenance to create or restore a snapshot.');
  await backupRow(context.env,p.id);await database(context.env).prepare('DELETE FROM snapshots WHERE id = ?').bind(p.id).run();
  return json({ok:true});
}
export async function readiness(context) {
  method(context.request,['GET']);await requireAdmin(context);
  const row=await loadState(context.env,{writable:true}),saved=await snapshots(context.env);
  let verified=0,damaged=0,uncertain=0,stale=0,anchor=null;
  // Inspect at most 3 complete snapshots and 75 media keys per request.
  for (const snapshot of saved.slice(0,3)) {
    if (await digest(snapshot.document)!==snapshot.sha256) {damaged++;continue;}
    verified++;const report=health(JSON.parse(snapshot.document));
    if (report.metrics.missingBookMappings) {stale++;continue;}
    if (!storageConfigured(context.env)||report.objectKeys.length>25) {uncertain++;continue;}
    try {const result=await checkObjects(context.env,report.objectKeys);if (!result.missing.length) {anchor={id:snapshot.id,reason:snapshot.reason,verified:true,objectCount:result.checked};break;}stale++;}
    catch {uncertain++;}
  }
  uncertain+=Math.max(0,saved.length-3);
  return json({ok:true,summary:{total:saved.length,verified,damaged},
    live:{entries:['main','adult'].map(scope=>({scope,readable:true,detail:`${row.document[scope].length} series; ${row.source}`}))},
    readiness:{status:anchor?'ready':'not-ready',anchor,staleSnapshots:stale,uncertainSnapshots:uncertain,
      detail:anchor?'A checksummed snapshot with all referenced media was verified.':'No object-complete recovery snapshot was proven. Missing mappings or media must be restored separately.'}});
}
export async function recovery(context) {
  method(context.request,['GET','POST']);
  if (context.request.method==='GET') return readiness(context);
  await requireAdmin(context);
  fail(501,'recovery_contract_missing','The archive does not contain this recovery mutation contract. Use tested Catalog History restore or explicit private mapping import.');
}
export async function statusEndpoint(context) {
  method(context.request,['POST']);await requireAdmin(context);
  const row=await loadState(context.env,{writable:true});
  return json({ok:true,authorized:true,storageConfigured:storageConfigured(context.env),revision:row.revision,reconstructed:true});
}
export async function abuse(context) {
  method(context.request,['GET','POST']);await requireAdmin(context);const db=database(context.env);
  if (context.request.method==='POST') {
    const p=await bodyJson(context.request);
    if (p.action!=='release'||!/^[A-Za-z0-9_-]{43}$/.test(p.clientId||'')) fail(400,'invalid_release','Select a recorded public cooldown.');
    const found=await db.prepare("SELECT id FROM security_events WHERE client_id = ? AND kind = 'public_cooldown' AND released_at IS NULL AND cooldown_until > ?").bind(p.clientId,now()).first();
    if (!found) fail(404,'cooldown_not_found','Active public cooldown not found.');
    await db.batch([
      db.prepare("UPDATE security_events SET released_at = ? WHERE client_id = ? AND kind = 'public_cooldown' AND released_at IS NULL").bind(new Date().toISOString(),p.clientId),
      db.prepare('DELETE FROM rate_limits WHERE id IN (?,?)').bind(`human:${p.clientId}`,`book:${p.clientId}`)
    ]);
  }
  const rows=(await db.prepare('SELECT * FROM security_events ORDER BY created_at DESC LIMIT 50').all()).results||[];
  const events=rows.map(r=>({id:r.id,clientId:r.client_id,kind:r.kind,createdAt:r.created_at,cooldownUntil:r.cooldown_until,releasedAt:r.released_at,detail:JSON.parse(r.detail),trigger:JSON.parse(r.detail).scope||'rate_limit'}));
  return json({ok:true,events,activeCooldowns:events.filter(e=>!e.releasedAt&&e.cooldownUntil>now()).length,policy:{windowSeconds:600,cooldownSeconds:600}});
}
