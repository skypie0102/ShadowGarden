// Diagnostics deliberately accept only known codes and numeric measurements.
// Never retain Error objects, publication text, paths, CFIs or access URLs.
const messages=Object.freeze({
  'source.joined':null,'source.released':null,
  'pageMap.ready':null,'pageMap.cached':null,'pageMap.cancelled':null,
  'pageMap.sectionFallback':'A chapter could not be mapped; using approximate pages.',
  'pageMap.failed':'Page-map generation failed; EPUB navigation remains available.',
  'pageMap.cacheUnavailable':null,
  'visual.ready':null,'visual.cached':null,'visual.cancelled':null,'visual.assetReused':null,
  'visual.assetFailed':'An illustration could not be prepared; using its EPUB source.',
  'visual.failed':'Visual preparation failed; using EPUB source pages.',
  'visual.cacheUnavailable':null,
  'continuous.buffered':null,'continuous.cancelled':null,
  'continuous.timeout':'A neighboring chapter did not finish rendering in time.',
  'continuous.failed':'Some neighboring chapters could not be buffered.',
  'search.sectionFailed':'A chapter could not be searched.',
  'search.matchSkipped':'A search match could not be located.',
  'note.failed':'A footnote could not be shown; following its EPUB link.',
  'navigation.targetFallback':null,
  'reader.startupFailed':'The reader could not start. The error screen offers recovery steps.',
  'access.catalogUnavailable':null,
  'access.renewalDelayed':'Book access could not be renewed yet.',
  'visual.handoffFailed':'Visual preparation could not finish; using EPUB source pages.',
  'navigation.tocFailed':'The selected chapter could not be opened.',
  'navigation.searchFailed':'The selected search match could not be opened.',
  'navigation.bookmarkFailed':'The selected bookmark could not be opened.',
  'navigation.linkFailed':'An internal EPUB link could not be opened.',
  'navigation.hookUnavailable':'EPUB link handling could not be installed.',
  'navigation.barrierFailed':null,
  'input.pageUnavailable':'Some page input could not be installed.',
  'image.hookUnavailable':'Image focus could not be installed.',
  'theme.refreshFailed':'The reader theme could not be updated.',
  'lifecycle.cleanupFailed':'A reader resource could not be released.',
  'source.releaseFailed':'A parsed chapter could not be released.',
  'pageMap.refreshFailed':'The page map could not be refreshed.',
  'layout.relayoutFailed':'The reader layout could not be restored.',
  'navigation.canonicalFallback':null,
  'flow.switchFailed':'The reading mode could not be changed.',
  'flow.recoveryFailed':'The reader could not recover its previous reading mode.',
  'navigation.tocUnavailable':'This EPUB has no usable table of contents.',
  'resume.captureFailed':null,
  'resume.layoutFailed':'The reader layout could not be updated on resume.',
  'resume.anchorExpired':'The reader no longer has a usable resume position.',
  'resume.failed':'The reader could not restore its suspended position.',
  'layout.spreadFailed':'The reader spread could not be configured.',
  'navigation.savedPlaceFallback':null,
  'progress.canonicalFallback':null,
  'progress.locationFallback':null,
  'progress.seekFailed':'The requested reading position could not be opened.',
  'progress.locationsFailed':'Exact EPUB locations could not be generated.',
  'note.hookUnavailable':'EPUB footnote handling could not be installed.',
  'completion.contextUnavailable':null
});
const numericFields=new Set(['durationMs','sections','pages','views','sources','assets','converted','scanned','hits']);
const events=[],counts=Object.create(null),limit=64;
const clock=()=>globalThis.performance?.now?.()||0;

export function recordReaderDiagnostic(code,measurements={}){
  if(!Object.hasOwn(messages,code))return;
  const event={code,atMs:Math.round(clock())};
  for(const key of numericFields){
    const value=measurements[key];
    if(typeof value==='number'&&Number.isFinite(value)&&value>=0)event[key]=Math.round(value*100)/100;
  }
  counts[code]=(counts[code]||0)+1;
  events.push(event);if(events.length>limit)events.shift();
  if(messages[code]&&counts[code]===1)console.warn('[Reader] '+messages[code]);
}

export function measureReaderOperation(code){
  const start=clock();let finished=false;
  return(measurements={},outcome=code)=>{
    if(finished)return;finished=true;
    recordReaderDiagnostic(outcome,{...measurements,durationMs:Math.max(0,clock()-start)});
  };
}

export function getReaderDiagnostics(){
  return{version:1,limit,counts:{...counts},events:events.map(event=>({...event}))};
}
