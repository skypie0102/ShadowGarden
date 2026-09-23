// Generates a revision-guarded migration from an explicit database export + mapping.
// No network requests; no live database changes. Keep inputs and output in private/.
import {readFile,writeFile} from 'node:fs/promises';
import {digest} from '../server/security.js';
import {objectKey} from '../server/storage.js';
import {BOOK_ID} from '../server/books.js';
const [stateFile,mapFile,output]=process.argv.slice(2);
if(!stateFile||!mapFile||!output)throw new Error('Usage: node scripts/restore-book-map.mjs private/state.json private/book-map.json private/restore.sql');
const raw=JSON.parse(await readFile(stateFile,'utf8'));
const row=Array.isArray(raw)?raw[0]?.results?.[0]:raw;
if(!row || !Number.isInteger(row.revision) || typeof row.document!=='string')throw new Error('Expected a D1 SELECT revision,document,updated_at result.');
const original=row.document,doc=JSON.parse(original),map=JSON.parse(await readFile(mapFile,'utf8'));
const ids=new Set([...doc.main,...doc.adult].flatMap(s=>s.volumes.map(v=>v.bookId)));
if(!map || typeof map!=='object' || Array.isArray(map) || !Object.keys(map).length)throw new Error('Provide explicit book ID to private B2 key mappings.');
for(const [id,key] of Object.entries(map)){
  if(!BOOK_ID.test(id)||!ids.has(id))throw new Error('Mapping contains an unknown book ID.');
  objectKey(key,'book');
  if(Object.entries(doc.books).some(([other,k])=>other!==id&&k===key))throw new Error('Two book IDs cannot share one private object key.');
  doc.books[id]=key;
}
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const id=crypto.randomUUID(),date=new Date().toISOString(),hash=await digest(original);
// Both writes require the exported revision. Inspect updated_rows: 0 means stale input.
const sql=`-- Private mapping restore. Inspect the target database and mappings before applying.\nINSERT INTO snapshots(id,reason,created_at,document,sha256) SELECT ${quote(id)},'before-private-map-restore',${quote(date)},${quote(original)},${quote(hash)} FROM library_state WHERE id=1 AND revision=${row.revision};\nUPDATE library_state SET document=${quote(JSON.stringify(doc))},revision=revision+1,updated_at=${quote(date)} WHERE id=1 AND revision=${row.revision};\nSELECT changes() AS updated_rows;\n`;
await writeFile(output,sql,{mode:0o600});console.log(`Prepared ${Object.keys(map).length} mappings. No database was changed.`);
