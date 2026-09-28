import {catalogError} from './catalog-document.js';
import {fail,HttpError,text} from './http.js';
import {database,now} from './security.js';
import {getStaticCover,deleteObjectVersions,objectKey} from './storage.js';

function references(value,books,keys=new Set(),ids=new Set()) {
  if (typeof value==='string') {
    const key=value.startsWith('/media/')?value.slice(7):value;
    if (/^shadow-garden\/(books|covers)\//.test(key)) {try{keys.add(objectKey(key));}catch{}}
  } else if (value && typeof value==='object') {
    if (typeof value.bookId==='string') {ids.add(value.bookId);if(books[value.bookId])keys.add(books[value.bookId]);}
    for (const child of Object.values(value)) references(child,books,keys,ids);
  }
  return {keys,ids};
}
export async function createPurge(env,row,ids) {
  if (!Array.isArray(ids) || ids.some(id=>typeof id!=='string'||!id||id.length>100) || new Set(ids).size!==ids.length) fail(400,'invalid_trash_selection','Select valid, distinct Trash entries.');
  const doc=structuredClone(row.document),selected=ids.length?doc.trash.filter(item=>ids.includes(item.id)):doc.trash;
  if (!selected.length || (ids.length && selected.length!==ids.length)) fail(409,'trash_selection_changed','The selected Trash entries changed. Refresh before purging.');
  const chosen=new Set(selected.map(item=>item.id)),candidates=references(selected,doc.books);
  doc.trash=doc.trash.filter(item=>!chosen.has(item.id));
  const remaining=references([doc.main,doc.adult,doc.trash],doc.books);
  for (const id of candidates.ids) if (!remaining.ids.has(id)) delete doc.books[id];
  if (catalogError(doc)) fail(409,'catalog_invalid','The purge would leave invalid catalog data.');
  const db=database(env),jobId=crypto.randomUUID(),date=new Date().toISOString(),document=JSON.stringify(doc);
  const keys=JSON.stringify([...candidates.keys]);
  // Purge is an explicit permanent removal, so it does not create a new backup
  // of the removed Trash. Every previously retained snapshot remains untouched.
  const results=await db.batch([
    db.prepare('INSERT INTO purge_jobs(id,created_at,updated_at,removed_count) SELECT ?,?,?,? FROM library_state WHERE id=1 AND revision=?').bind(jobId,date,date,selected.length,row.revision),
    db.prepare("INSERT INTO purge_items(job_id,object_key,updated_at) SELECT ?,value,? FROM json_each(?) WHERE EXISTS(SELECT 1 FROM purge_jobs WHERE id=?)").bind(jobId,date,keys,jobId),
    db.prepare('UPDATE library_state SET document=?,revision=revision+1,updated_at=? WHERE id=1 AND revision=?').bind(document,date,row.revision)
  ]);
  if (results[2]?.meta?.changes!==1) fail(409,'catalog_conflict','The catalog changed. Refresh before purging.');
  return jobId;
}
const summarySql=`SELECT j.id,j.created_at,j.removed_count,j.lease_until,
  COUNT(i.object_key) AS total,
  SUM(CASE WHEN i.status='deleted' THEN 1 ELSE 0 END) AS deleted,
  SUM(CASE WHEN i.status='static' THEN 1 ELSE 0 END) AS static,
  SUM(CASE WHEN i.status='retained' THEN 1 ELSE 0 END) AS retained,
  SUM(CASE WHEN i.status='failed' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN i.status='pending' THEN 1 ELSE 0 END) AS pending,
  MAX(CASE WHEN i.status='failed' THEN i.detail END) AS error
  FROM purge_jobs j LEFT JOIN purge_items i ON i.job_id=j.id`;
function jobSummary(row) {
  const {id,created_at,removed_count,lease_until,total,deleted,static:staticAssets,retained,failed,pending,error}=row;
  return {id,createdAt:created_at,removedCount:removed_count,total,deleted,staticAssets,retained,failed,pending,error,
    running:lease_until>now(),complete:pending+retained+failed===0};
}
export async function purgeJobs(env) {
  const rows=await database(env).prepare(`${summarySql} GROUP BY j.id ORDER BY (pending+retained+failed>0) DESC,j.updated_at ASC LIMIT 20`).all();
  return (rows.results||[]).map(jobSummary);
}
export async function continuePurge(env,id,origin) {
  const db=database(env),jobId=text(id,100),token=crypto.randomUUID(),deadline=Date.now()+20000;
  if (!await db.prepare('SELECT id FROM purge_jobs WHERE id=?').bind(jobId).first()) fail(404,'purge_not_found','Cleanup job not found.');
  const claimed=await db.prepare('UPDATE purge_jobs SET lease_token=?,lease_until=? WHERE id=? AND lease_until<=?').bind(token,now()+90,jobId,now()).run();
  if (claimed.meta.changes===1) try {
    // Three objects and at most five versions of each keep native API work
    // bounded. Unfinished work is durable and can resume after a page reload.
    const rows=await db.prepare("SELECT object_key FROM purge_items WHERE job_id=? AND status IN ('pending','retained','failed') ORDER BY updated_at,object_key LIMIT 3").bind(jobId).all();
    for (const {object_key:key} of rows.results||[]) {
      if(Date.now()>=deadline)break;
      const renewed=await db.prepare('UPDATE purge_jobs SET lease_until=? WHERE id=? AND lease_token=?').bind(now()+90,jobId,token).run();
      if (renewed.meta.changes!==1) break;
      let status='pending',detail='More file versions remain.';
      try {
        const asset=await getStaticCover(env,key,{head:true,origin});
        if (asset) {await asset.body?.cancel();status='static';detail='Bundled public asset retained.';}
        else {
          let retired=await db.prepare('SELECT deleted_at FROM media_retirements WHERE object_key=?').bind(key).first();
          if (!retired) {
            // SQL triggers atomically reject referenced keys and active uploads.
            await db.prepare('INSERT OR IGNORE INTO media_retirements(object_key,job_id,created_at) VALUES(?,?,?)').bind(key,jobId,new Date().toISOString()).run();
            retired=await db.prepare('SELECT deleted_at FROM media_retirements WHERE object_key=?').bind(key).first();
          }
          if (retired.deleted_at || (await deleteObjectVersions(env,key,{deadline})).complete) {
            status='deleted';detail='All B2 versions are absent.';
            await db.prepare('UPDATE media_retirements SET deleted_at=? WHERE object_key=?').bind(new Date().toISOString(),key).run();
          }
        }
      } catch (error) {
        if (error?.code==='cleanup_budget') {status='pending';detail=error.message;}
        else if (/media_referenced|upload_in_progress/.test(error?.message||'')) {status='retained';detail='Kept while referenced by the catalog, a retained snapshot, or an active upload.';}
        else {status='failed';detail=error instanceof HttpError?error.message:'Cleanup could not complete. Retry this job.';}
      }
      await db.prepare('UPDATE purge_items SET status=?,detail=?,updated_at=? WHERE job_id=? AND object_key=? AND EXISTS(SELECT 1 FROM purge_jobs WHERE id=? AND lease_token=?)')
        .bind(status,detail,new Date().toISOString(),jobId,key,jobId,token).run();
    }
  } finally {
    await db.prepare('UPDATE purge_jobs SET lease_token=NULL,lease_until=0,updated_at=? WHERE id=? AND lease_token=?').bind(new Date().toISOString(),jobId,token).run();
  }
  const row=await db.prepare(`${summarySql} WHERE j.id=? GROUP BY j.id`).bind(jobId).first();
  const issues=(await db.prepare("SELECT object_key AS key,status,detail FROM purge_items WHERE job_id=? AND status IN ('retained','failed') ORDER BY object_key LIMIT 20").bind(jobId).all()).results||[];
  return {...jobSummary(row),issues};
}
