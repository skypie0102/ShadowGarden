import {recordReaderDiagnostic} from './diagnostics.js';
import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — Reader-facing progress adapter over the canonical R2 service. */
import { beginRenditionNavigation,holdRenditionNavigation,navigateRendition } from "./navigation-state.js";
import {linearSpineItems} from './sections.js';

const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
const refinementWindow=10000;

export function formatReaderProgress({percentage=0,position=null,chapter=""}={}){
  const value=clamp01(percentage),percent=`${Math.round(value*100)}%`;
  const rawPage=Number(position?.page),rawTotal=Number(position?.totalPages);
  const hasPages=Number.isFinite(rawPage)&&Number.isFinite(rawTotal)&&rawPage>=1&&rawTotal>=1&&rawPage<=rawTotal;
  const page=hasPages?Math.trunc(rawPage):null,total=hasPages?Math.trunc(rawTotal):null;
  const chapterLabel=String(chapter||"").trim();
  const rail=hasPages?`${page}/${total}`:percent;
  const compact=hasPages?`${rail} · ${percent}`:percent;
  const volume=`${hasPages?`Page ${page} of ${total} · `:""}${percent} of volume`;
  const visual=`${volume}${chapterLabel?` · ${chapterLabel}`:""}`;
  const accessible=`${chapterLabel?`${chapterLabel} · `:""}${hasPages?`Page ${page} of ${total} · `:""}${percent} of volume`;
  return{value,percent,rail,compact,volume,chapter:chapterLabel,visual,accessible};
}

export function createProgressController({storage,elements,getBook,getRendition,getPageMap,getFlow,getChapter,toast,onPositionChange}={}){
  const scope=createReaderScope();
  const state={currentCfi:"",currentPosition:null,locationsReady:false,locationsFailed:false,pendingSeek:null,seekTimer:0,refinementTimer:0,seekBarrier:null};

  function supersedeSeek(){
    scope.clearTimeout(state.seekTimer);state.seekTimer=0;
    scope.clearTimeout(state.refinementTimer);state.refinementTimer=0;
    state.pendingSeek?.finishInitial?.();state.pendingSeek=null;
    const previous=state.seekBarrier;state.seekBarrier=null;
    if(previous){previous.operation.signal.removeEventListener("abort",previous.onAbort);previous.finishInitial?.();previous.resolve();previous.operation.cancel()}
  }
  function beginSeekBarrier(rendition){
    supersedeSeek();
    const operation=beginRenditionNavigation(rendition,{kind:"seek"});
    let resolve=()=>{};
    const promise=new Promise(done=>{resolve=done});
    const barrier={operation,rendition,book:getBook?.(),pageMap:getPageMap?.(),flow:getFlow?.(),promise,resolve,onAbort:null};
    barrier.onAbort=()=>{if(state.seekBarrier===barrier)supersedeSeek()};
    operation.signal.addEventListener("abort",barrier.onAbort,{once:true});
    state.seekBarrier=barrier;
    holdRenditionNavigation(rendition,promise,{signal:operation.signal});
    return barrier;
  }
  function finishSeekBarrier(operation){
    const barrier=state.seekBarrier;
    if(!barrier||barrier.operation!==operation)return;
    scope.clearTimeout(state.refinementTimer);state.refinementTimer=0;
    operation.signal.removeEventListener("abort",barrier.onAbort);
    state.seekBarrier=null;barrier.resolve();
  }

  function pageMapPositionFromPercentage(percentage){
    const map=getPageMap?.()?.map?.(),total=Number(map?.totalPages)||0;if(!total)return null;
    const value=clamp01(percentage),page=value>=1?total:Math.min(total,Math.floor(value*total)+1);
    return{page,totalPages:total,pageFraction:value>=1?1:(value*total)%1};
  }
  function publishPresentation(presentation){
    try{document.dispatchEvent(new CustomEvent("sg:reader-progress",{detail:presentation}))}catch{}
  }
  function setProgressUI(percentage,position=state.currentPosition){
    if(scope.disposed)return;
    const range=elements.progressRange,text=elements.progressText;
    const chapter=String(position?.chapter||(position?.cfi?getChapter?.():"")||"").trim();
    const presentation=formatReaderProgress({percentage,position,chapter});
    if(elements.currentChapterText)elements.currentChapterText.textContent=presentation.chapter||"Updating…";
    if(elements.volumeProgressText)elements.volumeProgressText.textContent=presentation.volume;
    if(range){range.value=Math.round(presentation.value*1000);range.setAttribute("aria-valuetext",presentation.accessible)}
    if(text){
      text.textContent=presentation.visual;
      text.dataset.compact=presentation.compact;
      // Read-only diagnostics for browser tests and inspection. Continuous rail ownership
      // remains event-driven through sg:reader-progress and never consumes these attributes.
      text.dataset.rail=presentation.rail;
      text.dataset.accessible=presentation.accessible;
      text.title=!Number(position?.totalPages)&&getPageMap?.()?.isGenerating?.()
        ?`${presentation.accessible} · Preparing device page map…`
        :presentation.accessible;
    }
    publishPresentation(presentation);
  }
  function approximateProgress(location){
    const book=getBook?.(),displayed=location?.start?.displayed,href=String(location?.start?.href||"").split("#")[0];
    const items=linearSpineItems(book);
    if(!items.length)return Number(location?.start?.percentage)||0;
    const index=items.findIndex(item=>{const itemHref=String(item.href||"").split("#")[0];return itemHref===href||itemHref.endsWith(href)||href.endsWith(itemHref)});
    if(index<0)return Number(location?.start?.percentage)||0;
    const page=Number(displayed?.page)||1,total=Math.max(1,Number(displayed?.total)||1),sectionFraction=clamp01((page-1)/total);
    return clamp01((index+sectionFraction)/items.length);
  }
  function progressFromLocation(location){
    const book=getBook?.(),cfi=location?.start?.cfi||state.currentCfi;
    if(state.locationsReady&&cfi){try{const exact=book.locations.percentageFromCfi(cfi);if(Number.isFinite(exact))return clamp01(exact)}catch{}}
    const reported=Number(location?.start?.percentage);if(Number.isFinite(reported)&&reported>=0)return clamp01(reported);
    return approximateProgress(location);
  }
  function currentPageMapPosition(location){
    const rendition=getRendition?.(),pageMap=getPageMap?.();if(!pageMap||!location?.start)return null;
    try{return pageMap.positionForLocation(location,{rendition,flow:getFlow?.()})}catch{return null}
  }
  function save(location){
    if(scope.disposed)return state.currentPosition;
    const reportedCfi=location?.start?.cfi;if(!reportedCfi)return state.currentPosition;
    const pageMap=getPageMap?.(),position=currentPageMapPosition(location)||{cfi:reportedCfi},cfi=position.cfi||reportedCfi;
    const chapter=getChapter?.()||"";
    state.currentCfi=cfi;
    const fallback=progressFromLocation(location),percentage=pageMap?.percentageForPosition?.(position,fallback)??fallback;
    state.currentPosition={...position,cfi,percentage,chapter};
    storage.saveProgress({
      file:storage.canonicalIdentity,cfi,percentage,page:position.page||null,totalPages:position.totalPages||null,pageFraction:position.pageFraction||0,
      sectionIndex:position.sectionIndex??null,localPage:position.localPage||null,pageMapFingerprint:pageMap?.fingerprint?.()||null,
      chapter,title:elements.bookTitle?.textContent||"",updatedAt:Date.now()
    });
    setProgressUI(percentage,state.currentPosition);onPositionChange?.(state.currentPosition);return state.currentPosition;
  }
  function spineTarget(percentage){
    const items=linearSpineItems(getBook?.());
    if(!items.length)return"";const value=clamp01(percentage),index=value>=1?items.length-1:Math.min(items.length-1,Math.floor(value*items.length));return items[index]?.href||"";
  }
  async function performSeek(percentage,{rendition,book,pageMap,flow,operation}){
    const current=()=>!scope.disposed&&operation.isCurrent()&&rendition===getRendition?.()&&book===getBook?.();
    if(!current())return false;
    const value=clamp01(percentage);
    if(pageMap?.hasCompleteMap?.()){
      try{
        const target=await pageMap.targetForPercentage(value,{flow});
        if(!current())return false;
        if(target)return await navigateRendition(rendition,target,{operation});
      }catch(error){if(!current())return false;recordReaderDiagnostic('progress.canonicalFallback')}
    }
    if(!current())return false;
    if(state.locationsReady&&book.locations){
      try{const cfi=book.locations.cfiFromPercentage(value);if(cfi&&cfi!=="-1")return await navigateRendition(rendition,cfi,{operation})}
      catch(error){if(!current())return false;recordReaderDiagnostic('progress.locationFallback')}
    }
    if(!current())return false;
    const href=spineTarget(value);if(!href){if(state.locationsFailed)toast?.("Progress seeking is unavailable for this EPUB");return}
    try{return await navigateRendition(rendition,href,{operation})}
    catch(error){if(current()){recordReaderDiagnostic('progress.seekFailed');toast?.("Could not seek to that location")}return false}
  }
  function seekTo(percentage,immediate=false){
    if(scope.disposed)return Promise.resolve(false);
    const value=clamp01(percentage);setProgressUI(value,pageMapPositionFromPercentage(value));
    const rendition=getRendition?.();if(!rendition)return Promise.resolve();
    const barrier=beginSeekBarrier(rendition);
    const needsRefinement=!getPageMap?.()?.hasCompleteMap?.()&&!state.locationsReady&&!state.locationsFailed;
    let finishInitial=()=>{};
    const initialDone=new Promise(resolve=>{finishInitial=resolve});
    barrier.finishInitial=finishInitial;
    if(needsRefinement){
      const pending={percentage:value,requestedAt:Date.now(),barrier,initialDone,finishInitial};
      state.pendingSeek=pending;
      state.refinementTimer=scope.timeout(()=>{
        if(state.pendingSeek!==pending)return;
        state.pendingSeek=null;state.refinementTimer=0;
        void initialDone.then(()=>finishSeekBarrier(barrier.operation));
      },refinementWindow);
    }

    const run=async()=>{
      try{await performSeek(value,barrier)}
      catch(error){if(barrier.operation.isCurrent())recordReaderDiagnostic('progress.seekFailed')}
      finally{
        finishInitial();
        if(!needsRefinement)finishSeekBarrier(barrier.operation);
      }
    };
    if(immediate)void run();else state.seekTimer=scope.timeout(()=>{state.seekTimer=0;void run()},120);
    return barrier.promise;
  }
  function startLocationGeneration(){
    const book=getBook?.();if(!book||scope.disposed)return;
    book.ready.then(()=>scope.disposed?null:book.locations.generate(1200)).then(async()=>{
      if(scope.disposed||book!==getBook?.())return;
      state.locationsReady=true;state.locationsFailed=false;
      const pending=state.pendingSeek;state.pendingSeek=null;
      if(pending&&Date.now()-pending.requestedAt<refinementWindow){
        try{
          await pending.initialDone;
          await performSeek(pending.percentage,pending.barrier);
        }finally{finishSeekBarrier(pending.barrier.operation)}
        return;
      }
      if(pending)finishSeekBarrier(pending.barrier.operation);
      const location=getRendition?.()?.location;if(location?.start){save(location);return}
      if(state.currentCfi){try{const exact=book.locations.percentageFromCfi(state.currentCfi);if(Number.isFinite(exact))setProgressUI(exact,state.currentPosition)}catch{}}
    }).catch(error=>{
      if(scope.disposed||book!==getBook?.())return;
      state.locationsFailed=true;
      const pending=state.pendingSeek;state.pendingSeek=null;
      if(pending){pending.finishInitial?.();finishSeekBarrier(pending.barrier.operation)}
      recordReaderDiagnostic('progress.locationsFailed');
    });
  }
  function restoreSaved(){
    const saved=storage.loadProgress();
    if(saved?.cfi)state.currentCfi=saved.cfi;
    if(saved)state.currentPosition={...saved};
    if(Number.isFinite(Number(saved?.percentage)))setProgressUI(Number(saved.percentage),saved);
    return saved;
  }
  function setPosition(position){
    if(scope.disposed||!position)return;state.currentPosition={...position};if(position.cfi)state.currentCfi=position.cfi;
  }
  function pageMapReady(){
    const location=getRendition?.()?.location;if(location?.start)save(location);
  }

  return{
    dispose(){scope.dispose();supersedeSeek();state.currentCfi="";state.currentPosition=null},
    save,seekTo,navigateToPercentage:percentage=>seekTo(percentage,true),startLocationGeneration,restoreSaved,setProgressUI,pageMapReady,setPosition,
    currentCfi:()=>state.currentCfi,currentPosition:()=>state.currentPosition,locationsReady:()=>state.locationsReady
  };
}
