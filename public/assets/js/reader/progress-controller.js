/* Shadow Garden R4 — Reader-facing progress adapter over the canonical R2 service. */
import { holdRenditionNavigation } from "./navigation-state.js";

const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function formatReaderProgress({percentage=0,position=null,chapter=""}={}){
  const value=clamp01(percentage),percent=`${Math.round(value*100)}%`;
  const rawPage=Number(position?.page),rawTotal=Number(position?.totalPages);
  const hasPages=Number.isFinite(rawPage)&&Number.isFinite(rawTotal)&&rawPage>=1&&rawTotal>0;
  const page=hasPages?Math.trunc(rawPage):null,total=hasPages?Math.trunc(rawTotal):null;
  const chapterLabel=String(chapter||"").trim();
  const rail=hasPages?`${page}/${total}`:percent;
  const compact=hasPages?`${rail} · ${percent}`:percent;
  const visual=`${hasPages?`Page ${rail} · `:""}${percent}${chapterLabel?` · ${chapterLabel}`:""}`;
  const accessible=`${chapterLabel?`${chapterLabel} · `:""}${hasPages?`Page ${page} of ${total} · `:""}${percent} of volume`;
  return{value,percent,rail,compact,visual,accessible};
}

export function createProgressController({storage,elements,getBook,getRendition,getPageMap,getFlow,getChapter,toast,onPositionChange}={}){
  const state={currentCfi:"",currentPosition:null,locationsReady:false,locationsFailed:false,pendingSeek:null,seekTimer:0,seekRevision:0,seekBarrier:null};

  function supersedeSeek(){
    clearTimeout(state.seekTimer);state.seekTimer=0;
    state.pendingSeek?.finishInitial?.();state.pendingSeek=null;
    const previous=state.seekBarrier;state.seekBarrier=null;previous?.resolve?.();
  }
  function beginSeekBarrier(rendition){
    supersedeSeek();
    const revision=++state.seekRevision;
    let resolve=()=>{};
    const promise=new Promise(done=>{resolve=done});
    const barrier={revision,rendition,promise,resolve};
    state.seekBarrier=barrier;
    holdRenditionNavigation(rendition,promise);
    return barrier;
  }
  function finishSeekBarrier(revision){
    const barrier=state.seekBarrier;
    if(!barrier||barrier.revision!==revision)return;
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
    const range=elements.progressRange,text=elements.progressText;
    const chapter=String(position?.chapter||(position?.cfi?getChapter?.():"")||"").trim();
    const presentation=formatReaderProgress({percentage,position,chapter});
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
    const raw=book?.spine?.spineItems||[],linear=raw.filter(item=>item?.href&&item.linear!=="no"),items=linear.length?linear:raw.filter(item=>item?.href);
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
    const book=getBook?.(),raw=book?.spine?.spineItems||[],linear=raw.filter(item=>item?.href&&item.linear!=="no"),items=linear.length?linear:raw.filter(item=>item?.href);
    if(!items.length)return"";const value=clamp01(percentage),index=value>=1?items.length-1:Math.min(items.length-1,Math.floor(value*items.length));return items[index]?.href||"";
  }
  async function navigateToPercentage(percentage){
    const rendition=getRendition?.(),book=getBook?.(),pageMap=getPageMap?.();if(!rendition||!book)return;
    const value=clamp01(percentage);
    if(pageMap?.hasCompleteMap?.()){
      try{const target=await pageMap.targetForPercentage(value);if(target){await rendition.display(target);if(getFlow?.()==="scrolled-doc"){await nextPaint();await rendition.display(target)}return}}
      catch(error){console.warn("Canonical page seek failed; using EPUB location fallback",error)}
    }
    if(state.locationsReady&&book.locations){
      try{const cfi=book.locations.cfiFromPercentage(value);if(cfi){await rendition.display(cfi);return}}
      catch(error){console.warn("Exact progress seek failed; using spine fallback",error)}
    }
    const href=spineTarget(value);if(!href){if(state.locationsFailed)toast?.("Progress seeking is unavailable for this EPUB");return}
    try{await rendition.display(href)}catch(error){console.error("Progress seek failed",error);toast?.("Could not seek to that location")}
  }
  function seekTo(percentage,immediate=false){
    const value=clamp01(percentage);setProgressUI(value,pageMapPositionFromPercentage(value));
    const rendition=getRendition?.();if(!rendition)return Promise.resolve();
    const barrier=beginSeekBarrier(rendition);
    const needsRefinement=!getPageMap?.()?.hasCompleteMap?.()&&!state.locationsReady&&!state.locationsFailed;
    let finishInitial=()=>{};
    const initialDone=new Promise(resolve=>{finishInitial=resolve});
    if(needsRefinement)state.pendingSeek={percentage:value,requestedAt:Date.now(),revision:barrier.revision,rendition,initialDone,finishInitial};

    const run=async()=>{
      try{await navigateToPercentage(value)}
      finally{
        finishInitial();
        if(!needsRefinement)finishSeekBarrier(barrier.revision);
      }
    };
    if(immediate)void run();else state.seekTimer=setTimeout(()=>{state.seekTimer=0;void run()},120);
    return barrier.promise;
  }
  function startLocationGeneration(){
    const book=getBook?.();if(!book)return;
    book.ready.then(()=>book.locations.generate(1200)).then(async()=>{
      state.locationsReady=true;state.locationsFailed=false;
      const pending=state.pendingSeek;state.pendingSeek=null;
      if(pending&&Date.now()-pending.requestedAt<10000){
        try{
          await pending.initialDone;
          if(pending.revision===state.seekRevision&&pending.rendition===getRendition?.())await navigateToPercentage(pending.percentage);
        }finally{finishSeekBarrier(pending.revision)}
        return;
      }
      if(pending)finishSeekBarrier(pending.revision);
      const location=getRendition?.()?.location;if(location?.start){save(location);return}
      if(state.currentCfi){try{const exact=book.locations.percentageFromCfi(state.currentCfi);if(Number.isFinite(exact))setProgressUI(exact,state.currentPosition)}catch{}}
    }).catch(error=>{
      state.locationsFailed=true;
      const pending=state.pendingSeek;state.pendingSeek=null;
      if(pending){pending.finishInitial?.();finishSeekBarrier(pending.revision)}
      console.warn("EPUB location generation failed",error);
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
    if(!position)return;state.currentPosition={...position};if(position.cfi)state.currentCfi=position.cfi;
  }
  function pageMapReady(){
    const location=getRendition?.()?.location;if(location?.start)save(location);
  }

  return{
    save,seekTo,navigateToPercentage,startLocationGeneration,restoreSaved,setProgressUI,pageMapReady,setPosition,
    currentCfi:()=>state.currentCfi,currentPosition:()=>state.currentPosition,locationsReady:()=>state.locationsReady
  };
}
