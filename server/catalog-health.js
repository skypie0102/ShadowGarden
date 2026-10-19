import {counts} from './state.js';

export function health(doc,{includeTrash=false}={}) {
  const objectKeys=new Set(),issues=[],optimizationCandidates=[];let missingCovers=0,missingThumbs=0,missingBookMappings=0;
  for (const scope of ['main','adult']) for (const s of [...doc[scope],...(includeTrash?doc.trash.filter(t=>t.scope===scope).map(t=>t.type==='series'?t.series:{...t.series,volumes:[t.volume]}):[])]) {
    const check=(v,volumeIndex)=>{
      for (const field of ['cover','coverThumb']) if (v[field]?.startsWith('/media/')) objectKeys.add(v[field].slice(7));
      if (!v.cover) missingCovers++;
      if (v.cover&&!v.coverThumb) {missingThumbs++;optimizationCandidates.push({scope,seriesId:s.id,seriesTitle:s.title,volumeIndex,volumeTitle:v.title,volumeFile:doc.books[v.bookId]?`/media/${doc.books[v.bookId]}`:'',source:v.cover});}
    };
    check(s,null);
    for (const [index,v] of s.volumes.entries()) {
      check(v,index);
      if (doc.books[v.bookId]) objectKeys.add(doc.books[v.bookId]);
      else {missingBookMappings++;issues.push({severity:'error',code:'missing-book-mapping',title:'Private book mapping missing',detail:`${v.title} (${v.bookId})`});}
    }
  }
  if (missingCovers) issues.push({severity:'warning',code:'missing-covers',title:'Missing covers',detail:`${missingCovers} catalog entries lack a cover.`});
  return {status:issues.some(x=>x.severity==='error')?'attention':issues.length?'warning':'healthy',counts:counts(doc),
    metrics:{referencedObjects:objectKeys.size,missingCovers,missingThumbs,missingBookMappings,legacyIdentity:0,trashItems:doc.trash.length},issues,objectKeys:[...objectKeys],optimizationCandidates};
}
