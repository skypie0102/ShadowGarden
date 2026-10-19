import {fail} from './http.js';
import {b64,database} from './security.js';
import {counts,inspectSnapshot,snapshotRecord} from './state.js';

const PAGE_SIZE=10;
function decodeCursor(value){
  if(!value)return null;
  try{
    if(!/^[A-Za-z0-9_-]{1,2048}$/.test(value))throw new Error();
    const bytes=Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    const tuple=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!Array.isArray(tuple)||tuple.length!==2||tuple.some(part=>typeof part!=='string'||!part.length||part.length>100))throw new Error();
    return tuple;
  }catch{fail(400,'invalid_history_cursor','Refresh Catalog History to load a valid page.');}
}
function encodeCursor(row){
  return b64(new TextEncoder().encode(JSON.stringify([row.created_at,row.id])));
}

export async function snapshotHistory(env,{cursor=''}={}){
  const before=decodeCursor(cursor),db=database(env);
  // Metadata only. One statement also supplies the retained total for empty pages.
  // A timestamp + ID boundary survives deletion of the cursor's own snapshot.
  const where=before?'WHERE created_at < ? OR (created_at = ? AND id < ?)':'';
  const query=db.prepare(`WITH page AS (
    SELECT id,reason,created_at,sha256 FROM snapshots ${where}
    ORDER BY created_at DESC,id DESC LIMIT ?
  ), retained AS (SELECT COUNT(*) AS total FROM snapshots)
  SELECT page.*,retained.total FROM retained LEFT JOIN page ON 1
  ORDER BY page.created_at DESC,page.id DESC`);
  const result=await query.bind(...(before?[before[0],before[0],before[1]]:[]),PAGE_SIZE+1).all();
  const rows=result.results||[],entries=rows.filter(row=>row.id!==null).slice(0,PAGE_SIZE),backups=[];
  for(const entry of entries){
    // Never retain a batch of full documents. A concurrent delete simply omits its row.
    const saved=await snapshotRecord(env,entry.id);if(!saved)continue;
    const inspected=await inspectSnapshot(saved);
    backups.push({id:saved.id,reason:saved.reason,createdAt:saved.created_at,
      counts:inspected.error?null:counts(inspected.document),restorable:!inspected.error,
      integrity:{status:inspected.error?'damaged':'valid',detail:inspected.error||'Catalog snapshot validated. Check recovery readiness for media availability.'}});
  }
  return{backups,history:{total:rows[0]?.total||0,pageSize:PAGE_SIZE,
    nextCursor:rows.filter(row=>row.id!==null).length>PAGE_SIZE?encodeCursor(entries.at(-1)):null}};
}
