import {readFile, readdir, stat} from 'node:fs/promises';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const errors=[],warnings=[];
async function walk(dir) {
  const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=`${dir}/${entry.name}`;if(entry.isDirectory())out.push(...await walk(path));else out.push(path);
  }return out;
}
const files=await walk('public'),known=new Set(files.map(p=>'/'+p.slice(7))),references=[];
const exists=async path=>{try{return (await stat(path)).isFile();}catch{return false;}};
function reference(source,target) {
  if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return;
  const path=target.split(/[?#]/)[0];if(!path)return;
  const normalized=path.startsWith('/')?path:'/'+relative(resolve('public'),resolve(dirname(source),path));
  if (!known.has(normalized) && normalized!=='/' && !['/admin','/reader','/series','/nsfw'].includes(normalized)) errors.push(`${source}: missing literal asset ${target}`);
  references.push({source,target});
}
for(const path of files){
  const data=await readFile(path);
  if(path.endsWith('.html')){
    const html=data.toString();
    if(!/^<!doctype html>/i.test(html.trim()))errors.push(`${path}: missing doctype`);
    for(const match of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi))reference(path,match[1]);
  }
  if(path.endsWith('.css'))for(const match of data.toString().matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g))reference(path,match[1]);
  if(path.endsWith('.js')){
    try{execFileSync(process.execPath,['--check',path],{stdio:'pipe'});}catch{errors.push(`${path}: syntax error`);}
    if(!path.includes('/vendor/'))for(const match of data.toString().matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["']([^"']+)["']/g))reference(path,match[1]);
  }
  if(path.endsWith('.json'))try{JSON.parse(data.toString());}catch{errors.push(`${path}: invalid JSON`);}
}
const provenance=JSON.parse(await readFile('recovery-info/provenance.json','utf8'));
const modified=[];
for(const entry of provenance.files){
  if(!await exists(entry.path)){errors.push(`Missing recovered file ${entry.path}`);continue;}
  const sha=createHash('sha256').update(await readFile(entry.path)).digest('hex');
  if(sha!==entry.sha256)modified.push(entry.path);
}
const deliberate=new Set(['public/assets/js/admin/core.js','public/assets/js/admin/trash-workflow.js','public/assets/js/admin/library-workflow.js','public/assets/js/library.js']);
for(const path of modified)if(!deliberate.has(path))errors.push(`Undocumented change to recovered file ${path}`);
const manifest=await readFile('recovery-info/FUNCTION_ROUTES.md','utf8');
const routes=[...manifest.matchAll(/`(functions\/[^`:]+\.js)(?::[^`]*)?`/g)].map(m=>m[1]);
for(const route of routes)if(!await exists(route))errors.push(`Missing function ${route}`);
const routeUrls=new Set(['/admin-access','/human-access','/book-access',...routes.filter(r=>r.includes('/admin-api/')).map(r=>r.replace(/^functions/,'').replace(/\.js$/,''))]);
for(const path of files.filter(p=>p.endsWith('.js')&&!p.includes('/vendor/'))){
  const code=await readFile(path,'utf8');
  for(const match of code.matchAll(/["'`](\/(?:admin-api\/[\w-]+|admin-access|human-access|book-access))(?:[?"'`])/g))if(!routeUrls.has(match[1]))errors.push(`No function for ${match[1]}`);
}
let series=0,volumes=0;const ids=new Set();
for(const name of ['catalog','adult-catalog']){
  const catalog=JSON.parse(await readFile(`public/media/shadow-garden/data/${name}.json`,'utf8'));
  for(const s of catalog.series){series++;for(const v of s.volumes){volumes++;if(!/^bk_[A-Za-z0-9_-]{22}$/.test(v.bookId))errors.push(`Invalid book ID ${v.bookId}`);if(ids.has(v.bookId))errors.push(`Duplicate book ID ${v.bookId}`);ids.add(v.bookId);}
    for(const v of [s,...s.volumes])for(const field of ['cover','coverThumb'])if(v[field])reference(`public/media/shadow-garden/data/${name}.json`,v[field]);
  }
}
for(const path of await walk('functions'))if(path.endsWith('.js'))execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
for(const path of await walk('server'))if(path.endsWith('.js'))execFileSync(process.execPath,['--check',path],{stdio:'pipe'});
warnings.push(`${volumes} recovered EPUB identities have no recovered binaries or private mappings.`);
console.log(JSON.stringify({recoveredFiles:provenance.files.length,byteIdentical:provenance.files.length-modified.length,documentedModifications:modified,routes:routes.length,literalReferences:references.length,series,volumes,warnings,errors},null,2));
if(errors.length)process.exitCode=1;
