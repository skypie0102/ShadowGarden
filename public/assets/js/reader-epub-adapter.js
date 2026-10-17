import {recordReaderDiagnostic} from './reader/diagnostics.js';
import {readerInstanceScope,readerContentsScope} from "./reader/lifecycle.js";
import {preserveContinuousLayout} from './reader/continuous-layout.js';
import {linearSpineItems} from './reader/sections.js';
import {isContinuousDestroyed} from './reader/continuous-state.js';
import {continuousContentHeight} from './reader/continuous-height.js';
/* Shadow Garden EPUB.js compatibility adapter.
 * Keeps third-party layout/navigation quirks outside the reader state engine.
 */
// One-shot checks after a contents document is first bound. Load events alone
// miss media decoded before binding and SVG sizing that settles asynchronously.
const MEDIA_HEIGHT_RECHECK_DELAYS_MS=[300,1200,2600,4200];
// All contents in one manager share this trailing reconciliation window.
const FRAME_HEIGHT_SYNC_DEBOUNCE_MS=150;

export function createEpubCompatibilityExtension(){

  let currentBook=null,currentRendition=null,currentTarget=null,viewportTimer=0,pendingExternalHref="";
  const progressByCfi=new Map();
  const heightSyncTasks=new WeakMap();
  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));

  function viewerElement(target=currentTarget){
    if(target instanceof Element)return target;
    if(typeof target==="string")return document.getElementById(target)||document.querySelector(target);
    return document.getElementById("viewer");
  }

  function measuredViewer(target=currentTarget){
    const viewer=viewerElement(target);
    if(!viewer)return null;
    const rect=viewer.getBoundingClientRect();
    const width=Math.max(1,Math.floor(rect.width||viewer.clientWidth||0));
    const height=Math.max(1,Math.floor(rect.height||viewer.clientHeight||0));
    return width&&height?{width,height}:null;
  }

  function mobilePagination(){
    if(!document.body?.classList.contains("reader-flow-paginated"))return false;
    const visual=Number(window.visualViewport?.width),inner=Number(window.innerWidth),client=Number(document.documentElement?.clientWidth);
    const widths=[visual,inner,client].filter(value=>Number.isFinite(value)&&value>0);
    const width=widths.length?Math.min(...widths):0;
    const coarse=window.matchMedia?.("(pointer: coarse)")?.matches===true;
    const mobile=navigator.userAgentData?.mobile===true||/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent||"");
    return mobile||(width>0&&width<900)||(coarse&&width>0&&width<=1024);
  }

  function normalizeMobilePage(contents){
    if(!mobilePagination())return;
    const doc=contents?.document;
    if(!doc?.head)return;
    let style=doc.getElementById("sg-mobile-page-layout");
    if(!style){
      style=doc.createElement("style");
      style.id="sg-mobile-page-layout";
      doc.head.appendChild(style);
    }
    /* Do not force a body width here. EPUB.js writes the exact paginated column width
       inline; overriding that width was what allowed a neighboring column to bleed into
       the mobile viewport. We only normalize box sizing and author-side margins. */
    style.textContent="html,body{box-sizing:border-box!important}html{max-width:none!important}body{max-width:none!important;margin-left:0!important;margin-right:0!important}";
  }

  function externalHttpHref(anchor){
    const raw=String(anchor?.getAttribute?.("href")||"").trim();
    if(/^https?:\/\//i.test(raw))return raw;
    if(/^\/\//.test(raw))return `${location.protocol==="http:"?"http:":"https:"}${raw}`;
    return"";
  }

  function externalDialogElements(){return{
    dialog:document.getElementById("externalLinkDialog"),
    destination:document.getElementById("externalLinkDestination"),
    cancel:document.getElementById("externalLinkCancel"),
    open:document.getElementById("externalLinkOpen")
  }}

  function closeExternalDialog(){
    const {dialog}=externalDialogElements();
    if(!dialog)return;
    if(dialog.open&&typeof dialog.close==="function")dialog.close();
    else dialog.removeAttribute("open");
  }

  function setupExternalDialog(){
    const {dialog,cancel,open}=externalDialogElements();
    if(!dialog||dialog.__sgExternalLinkReady)return Boolean(dialog);
    dialog.__sgExternalLinkReady=true;
    cancel?.addEventListener("click",closeExternalDialog);
    open?.addEventListener("click",()=>{
      const href=pendingExternalHref;
      if(!href)return closeExternalDialog();
      closeExternalDialog();
      const opened=window.open(href,"_blank","noopener,noreferrer");
      try{if(opened)opened.opener=null}catch{}
    });
    dialog.addEventListener("click",event=>{if(event.target===dialog)closeExternalDialog()});
    dialog.addEventListener("close",()=>{pendingExternalHref=""});
    return true;
  }

  function showExternalLinkConfirmation(href){
    if(!setupExternalDialog())return;
    const {dialog,destination,cancel,open}=externalDialogElements();
    pendingExternalHref=href;
    try{
      const parsed=new URL(href);
      if(destination)destination.textContent=parsed.hostname||href;
      if(open)open.setAttribute("aria-label",`Open ${parsed.hostname||"external website"} in a new tab`);
    }catch{
      if(destination)destination.textContent=href;
    }
    if(typeof dialog.showModal==="function"){
      if(!dialog.open)dialog.showModal();
    }else dialog.setAttribute("open","");
    if(currentRendition)readerInstanceScope(currentRendition).frame(()=>cancel?.focus?.({preventScroll:true}));
  }

  function installExternalLinkGuard(contents,rendition=currentRendition){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!rendition||readerInstanceScope(rendition).disposed||!doc?.documentElement||doc.documentElement.dataset.sgExternalLinks==="1")return;
    doc.documentElement.dataset.sgExternalLinks="1";
    const scope=readerContentsScope(rendition,contents);
    scope.add(()=>delete doc.documentElement.dataset.sgExternalLinks);
    scope.listen(doc,"click",event=>{
      const anchor=event.target?.closest?.("a[href]");
      const href=externalHttpHref(anchor);
      if(!href)return;
      try{event.preventDefault()}catch{}
      try{event.stopPropagation()}catch{}
      try{event.stopImmediatePropagation()}catch{}
      showExternalLinkConfirmation(href);
    },{capture:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupExternalDialog,{once:true});
  else setupExternalDialog();

  function sameHref(a,b){
    const clean=value=>String(value||"").split("#")[0].replace(/^\.\//,"");
    const left=clean(a),right=clean(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  }

  function spinePosition(book,start={}){
    const items=linearSpineItems(book);
    if(!items.length)return{index:-1,total:0};
    const raw=book?.spine?.spineItems||[];
    const rawIndex=Number(start.index);
    if(Number.isInteger(rawIndex)&&rawIndex>=0){
      const section=raw[rawIndex];
      const mapped=section?items.findIndex(item=>item===section||sameHref(item.href,section.href)):-1;
      if(mapped>=0)return{index:mapped,total:items.length};
      if(rawIndex<items.length)return{index:rawIndex,total:items.length};
    }
    const href=start.href||"";
    const byHref=items.findIndex(item=>sameHref(item.href,href));
    if(byHref>=0)return{index:byHref,total:items.length};
    if(start.cfi){
      try{
        const section=book?.spine?.get?.(start.cfi);
        const byCfi=items.findIndex(item=>item===section||sameHref(item.href,section?.href));
        if(byCfi>=0)return{index:byCfi,total:items.length};
      }catch{}
    }
    return{index:-1,total:items.length};
  }

  function coarseProgress(book,start={}){
    const {index,total}=spinePosition(book,start);
    if(index<0||!total)return null;
    const page=Math.max(1,Number(start?.displayed?.page)||1);
    const pages=Math.max(1,Number(start?.displayed?.total)||1);
    const inside=clamp01((page-1)/pages);
    return clamp01((index+inside)/total);
  }

  function reliableProgress(book,start={}){
    const direct=Number(start.percentage);
    if(Number.isFinite(direct)&&direct>0)return clamp01(direct);
    const location=Number(start.location);
    if(Number.isFinite(location)&&location>0&&typeof book?.locations?.percentageFromLocation==="function"){
      try{
        const generated=Number(book.locations.percentageFromLocation(location));
        if(Number.isFinite(generated)&&generated>0)return clamp01(generated);
      }catch{}
    }
    const coarse=coarseProgress(book,start);
    if(Number.isFinite(coarse))return coarse;
    return Number.isFinite(direct)?clamp01(direct):null;
  }

  function normalizeLocationProgress(book,location){
    if(!book||!location?.start)return;
    const progress=reliableProgress(book,location.start);
    if(Number.isFinite(progress)){
      location.start.percentage=progress;
      if(location.start.cfi)progressByCfi.set(location.start.cfi,progress);
    }
    if(location?.end){
      const endProgress=reliableProgress(book,location.end);
      if(Number.isFinite(endProgress)){
        location.end.percentage=endProgress;
        if(location.end.cfi)progressByCfi.set(location.end.cfi,endProgress);
      }
    }
  }

  function patchLocations(book){
    const locations=book?.locations;
    if(!locations||locations.__sgProgressPatched)return;
    locations.__sgProgressPatched=true;
    const rawPercentage=typeof locations.percentageFromCfi==="function"?locations.percentageFromCfi.bind(locations):null;
    if(rawPercentage){
      locations.percentageFromCfi=cfi=>{
        let exact=NaN;
        try{exact=Number(rawPercentage(cfi))}catch{}
        if(Number.isFinite(exact)&&exact>0)return clamp01(exact);
        const remembered=progressByCfi.get(cfi);
        if(Number.isFinite(remembered)&&remembered>0)return clamp01(remembered);
        const coarse=coarseProgress(book,{cfi});
        if(Number.isFinite(coarse)&&coarse>0)return coarse;
        return Number.isFinite(exact)?clamp01(exact):0;
      };
    }
  }

  function patchRendition(rendition,target){
    if(!rendition||rendition.__sgAdapterPatched)return rendition;
    rendition.__sgAdapterPatched=true;
    const scope=readerInstanceScope(rendition);
    scope.add(()=>{if(currentRendition===rendition){currentRendition=null;currentTarget=null;pendingExternalHref="";closeExternalDialog()}});
    currentRendition=rendition;
    currentTarget=target;

    const rawResize=typeof rendition.resize==="function"?rendition.resize.bind(rendition):null;
    if(rawResize){
      rendition.resize=(width,height)=>{
        if(document.body?.classList.contains("reader-flow-paginated")){
          const size=measuredViewer(target);
          if(size)return rawResize(size.width,size.height);
        }
        return rawResize(width,height);
      };
    }

    /* Register before reader.js does. The core will therefore receive a location whose
       percentage has already been repaired from the reliable spine index when EPUB.js
       reports a missing/zero generated-location percentage. */
    try{scope.on(rendition,"relocated",location=>normalizeLocationProgress(currentBook,location))}catch{}
    try{scope.hook(rendition.hooks?.content,contents=>installExternalLinkGuard(contents,rendition))}catch(error){recordReaderDiagnostic('navigation.hookUnavailable')}

    try{
      scope.on(rendition,"rendered",(_,view)=>{
        if(rendition!==currentRendition)return;
        const contents=view?.contents;
        if(contents)scope.timeout(()=>{normalizeMobilePage(contents);installExternalLinkGuard(contents,rendition);syncContinuousFrameHeights(contents,rendition)},0);
        else scope.timeout(()=>{
          try{rendition.getContents?.().forEach(contents=>{normalizeMobilePage(contents);installExternalLinkGuard(contents,rendition);syncContinuousFrameHeights(contents,rendition)})}catch{}
        },0);
      });
    }catch{}
    return rendition;
  }

  /* v2.6.6 (#160 follow-up family): Continuous mode stacks section documents in normal
     flow (.epub-view relative wrappers inside the scrolling container). EPUB.js freezes
     wrapper/frame heights at display time, so artwork that grows afterwards - late SVG
     decode, or width caps narrowing an image and increasing its rendered height - leaves
     the tail beyond the frozen slot where the next section visually crops it. Reconcile
     idempotently: rewrite every frame/wrapper height to its document's exact extent and
     clear stale inline tops; natural flow then always matches real content. */
  function syncContinuousFrameHeights(contents,rendition=currentRendition){
    try{
      const doc=contents?.document,win=doc?.defaultView;
      const manager=rendition?.manager;
      if(!win||!doc||!manager||!String(rendition.settings?.flow||manager.settings?.flow||'').startsWith('scrolled')||readerInstanceScope(rendition).disposed)return;
      const scope=readerContentsScope(rendition,contents);
      if(scope.disposed)return;
      const doc0=doc;
      if(!win.__sgTallSyncBound){
        win.__sgTallSyncBound=true;
        scope.add(()=>{delete win.__sgTallSyncBound});
        /* media loads inside a rendered document are what grow it late; reconcile again */
        scope.listen(doc0,"load",event=>{
          const target=event.target;
          if(target&&(target.tagName==="IMG"||(typeof SVGElement!=="undefined"&&target instanceof doc0.defaultView.SVGElement)))syncContinuousFrameHeights(contents,rendition);
        },true);
        /* media may already be decoded before these hooks attach, and engines differ in
           when async svg sizing settles; guaranteed staggered passes cover both cases
           without spamming the reconciler once growth is exhausted. */
        MEDIA_HEIGHT_RECHECK_DELAYS_MS.forEach(delay=>scope.timeout(()=>{try{syncContinuousFrameHeights(contents,rendition)}catch{}},delay));
      }
      const owner=readerInstanceScope(manager);
      owner.clearTimeout(heightSyncTasks.get(manager));
      heightSyncTasks.set(manager,owner.timeout(()=>{
        heightSyncTasks.delete(manager);
        try{
          if(isContinuousDestroyed(manager)||!String(rendition.settings?.flow||manager.settings?.flow||'').startsWith('scrolled'))return;
          const targets=(manager.views?.all?.()||[]).map(view=>({view,el:view.element,frame:view.iframe}));
          /* Idempotent truth-up: any drift between a section frame's frozen height and its
             live document extent is rewritten to the exact current value, so natural flow
             stacking always matches real content - late-growing tall artwork included.
             Stale inline `top`s (absolute-position era leftovers) would visually offset
             relative-flow sections and are cleared as well. */
          preserveContinuousLayout(manager,()=>{for(const entry of targets){
            const entryDoc=entry.frame?.contentDocument;
            if(!entry.view.displayed||!entry.view.contents||!entry.frame||!entryDoc||!entryDoc.documentElement)continue;
            const need=continuousContentHeight(entry.view.contents);
            if(!need)continue;
            const current=Math.round(entry.frame.getBoundingClientRect().height);
            if(Math.abs(need-current)>2){
              entry.view.reframe(entry.view._width||entry.frame.clientWidth,need);
            }
            if(entry.el.style.top)entry.el.style.top="";
          }});
        }catch{}
      },FRAME_HEIGHT_SYNC_DEBOUNCE_MS));
    }catch{}
  }

  function patchBook(book){
    if(!book||book.__sgAdapterPatched)return book;
    book.__sgAdapterPatched=true;
    const scope=readerInstanceScope(book);
    scope.add(()=>{if(currentBook===book){currentBook=null;progressByCfi.clear()}});
  /* Mobile browser chrome continuously changes visualViewport height while scrolling.
     Only paginated mode needs those changes forwarded into EPUB.js page measurement;
     forwarding them in continuous mode causes repeated reflows and breaks scroll/seek. */
  scope.listen(window.visualViewport,"resize",()=>{
    if(!document.body?.classList.contains("reader-flow-paginated"))return;
    scope.clearTimeout(viewportTimer);
    viewportTimer=scope.timeout(()=>window.dispatchEvent(new Event("resize")),80);
  });
    currentBook=book;
    progressByCfi.clear();
    patchLocations(book);
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>{
      const next={...options};
      if(next.flow==="paginated"){
        const size=measuredViewer(target);
        if(size){next.width=size.width;next.height=size.height}
      }
      return patchRendition(rawRenderTo(target,next),target);
    };
    return book;
  }

  return {name:"compatibility",attachBook:patchBook};
}
