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
// Retired after final copy moved to its owning templates/workflows (website W2).
const retired=new Set(['public/assets/js/site-flavor.js','public/assets/js/admin-upload-completion.js']);
for(const entry of provenance.files){
  if(!await exists(entry.path)){if(!retired.has(entry.path))errors.push(`Missing recovered file ${entry.path}`);continue;}
  const sha=createHash('sha256').update(await readFile(entry.path)).digest('hex');
  if(sha!==entry.sha256)modified.push(entry.path);
}
const deliberate=new Set([
  'public/assets/js/data-source.js',
  'public/assets/js/domain/catalog.js',
  'public/assets/js/domain/urls.js',
  // v2.17.0 browser persistence: checked grouped writes and conditional rollback.
  'public/assets/js/domain/storage.js',
  'public/assets/js/domain/progress.js',
  'public/assets/js/domain/bookmarks.js',
  'public/assets/js/domain/reading-state.js',
  'public/assets/js/library-renderers.js',
  'public/assets/js/series-renderers.js',
  'public/assets/js/series.js',
  'public/assets/js/nav-pinned.js',
  'public/index.html',
  'public/nsfw.html',
  'public/assets/js/library-footer-version.js',
  'public/assets/js/admin/core.js',
  // v2.18.3: syntax-equivalent shared Keeper/Upload readability batch.
  'public/assets/js/admin/upload-fields.js',
  'public/assets/js/admin/trash-workflow.js',
  'public/assets/js/admin/recovery-readiness-workflow.js',
  'public/assets/js/admin/library-workflow.js',
  'public/assets/js/admin/history-workflow.js',
  'public/assets/js/admin/maintenance-workflow.js',
  'public/assets/js/reader-a11y.js',
  'public/assets/js/site-a11y.js',
  'public/assets/js/admin/app.js',
  'public/assets/js/admin/auth-session.js',
  'public/assets/js/admin/shell.js',
  // v2.18.4: syntax-equivalent Keeper UI/session readability batch.
  'public/assets/js/admin/motion.js',
  // v2.18.4: queue visibility follows its owner's explicit hidden state.
  'public/assets/css/admin-components.css',
  'public/assets/js/admin-batch.js',
  'public/assets/js/admin-upload-workflow.js',
  'public/assets/js/admin/abuse-workflow.js',
  'public/admin.html',
  'public/assets/css/nav.css',
  'public/assets/css/site.css',
  'public/assets/js/admin-batch-editor.js',
  'public/assets/js/admin-upload-presentation.js',
  'public/assets/js/admin/upload-similar-volume.js',
  'public/assets/js/admin/upload-safety.js',
  'public/assets/js/admin/upload-preflight-report.js',
  'public/assets/js/admin/upload-events.js',
  'public/assets/js/admin/editor-interactions.js',
  // v2.18.2: syntax-equivalent Keeper workflow readability batch.
  'public/assets/js/admin/translation-workflow.js',
  'public/assets/js/library.js',
  // v2.18.0: the mobile filter shares the canonical public domain module URL.
  'public/assets/js/library-mobile-filter.js',
  'public/series.html',
  'public/assets/js/book-access.js',
  'public/assets/js/site-flavor.js',
  'public/assets/js/public/volume-actions.js',
  'public/reader.html',
  'public/assets/js/reader-bootstrap.js',
  'public/assets/js/reader-epub-adapter.js',
  'public/assets/js/reader-footnotes.js',
  'public/assets/js/reader-internal-links.js',
  'public/assets/js/reader-visual-cache.js',
  'public/assets/js/reader-paginated-visual-fit.js',
  'public/assets/js/reader-continuous-core.js',
  'public/assets/js/reader/error-presentation.js',
  'public/assets/js/reader/image-focus.js',
  'public/assets/css/reader-image-focus.css',
  'public/assets/js/reader/continuous.js',
  'public/assets/js/reader/navigation-state.js',
  'public/assets/js/reader/progress-controller.js',
  'public/assets/js/reader/resume-controller.js',
  'public/assets/js/reader/rendition.js',
  'public/assets/js/reader/page-map.js',
  'public/assets/js/reader/paginated.js',
  'public/assets/js/reader/book-session.js',
  'public/assets/js/reader/book-search.js',
  'public/assets/js/reader/epub-lifecycle.js',
  'public/assets/js/reader/image-focus-touch-compat.js',
  'public/assets/js/reader/page-navigation-input.js',
  'public/assets/js/reader/bookmarks-controller.js',
  'public/assets/js/reader/theme.js',
  'public/assets/js/reader/settings.js',
  'public/assets/js/reader/storage.js',
  'public/assets/js/reader/toc.js',
  'public/assets/js/reader/completion.js',
  'public/assets/js/reader/interaction-controller.js',
  'public/assets/js/reader/app.js'
]);
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
// The owner confirmed these five books are disposable test fixtures, not a recovery gate.
console.log(JSON.stringify({recoveredFiles:provenance.files.length,byteIdentical:provenance.files.length-modified.length-provenance.files.filter(entry=>retired.has(entry.path)).length,retiredRecoveredFiles:[...retired],documentedModifications:modified,routes:routes.length,literalReferences:references.length,series,volumes,warnings,errors},null,2));
if(errors.length)process.exitCode=1;
