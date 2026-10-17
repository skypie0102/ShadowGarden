import {recordReaderDiagnostic} from './diagnostics.js';
import {renditionRenderRevision,settleRenditionContent} from './epub-lifecycle.js';
import {continuousGeneration,isContinuousDestroyed,continuousInputState} from './continuous-state.js';
/* Shadow Garden R4 — EPUB.js rendition lifecycle adapter. */
import {beginRenditionNavigation,holdRenditionNavigation,runRenditionMove} from "./navigation-state.js";

export function paginatedNeedsSinglePage(){
  const visualWidth=Number(window.visualViewport?.width),innerWidth=Number(window.innerWidth),clientWidth=Number(document.documentElement?.clientWidth);
  const widths=[visualWidth,innerWidth,clientWidth].filter(value=>Number.isFinite(value)&&value>0);
  const viewportWidth=widths.length?Math.min(...widths):0;
  const coarsePointer=window.matchMedia?.("(pointer: coarse)")?.matches===true;
  const mobileUa=navigator.userAgentData?.mobile===true||/Android|iPhone|iPod|Mobile/i.test(navigator.userAgent||"");
  return mobileUa||(viewportWidth>0&&viewportWidth<900)||(coarsePointer&&viewportWidth>0&&viewportWidth<=1024);
}

export function pageMapLayoutMetrics(viewerShell){
  const shell=viewerShell;
  const rect=shell?.getBoundingClientRect?.();
  const width=Math.max(320,Math.round(Number(rect?.width)||Number(shell?.clientWidth)||Number(window.innerWidth)||720));
  const height=Math.max(320,Math.round(Number(rect?.height)||Number(shell?.clientHeight)||Number(window.innerHeight)*.8||800));
  const single=paginatedNeedsSinglePage()||width<900;
  return{width,height,spread:single?"single":"spread"};
}

export function configureSpread(rendition,flow="paginated"){
  if(!rendition)return;
  try{
    if(flow==="paginated"){
      if(paginatedNeedsSinglePage())rendition.spread("none");
      else rendition.spread("auto",900);
    }else rendition.spread("none");
  }catch(error){recordReaderDiagnostic('layout.spreadFailed')}
}

function continuousViewport(manager){
  const fullsize=manager?.settings?.fullsize===true;
  if(fullsize){
    if(typeof window==="undefined")return null;
    return{fullsize:true,top:0,left:0,height:Math.max(1,Number(window.innerHeight)||1),width:Math.max(1,Number(window.innerWidth)||1)};
  }
  const container=manager?.container;
  if(!container)return null;
  const rect=container.getBoundingClientRect?.()||{top:0,left:0,width:container.clientWidth,height:container.clientHeight};
  return{
    fullsize:false,
    top:Number(rect.top)||0,left:Number(rect.left)||0,
    height:Math.max(1,Number(container.clientHeight)||Number(rect.height)||1),
    width:Math.max(1,Number(container.clientWidth)||Number(rect.width)||1)
  };
}

function continuousTrackingPoint(viewport){
  return{
    x:viewport.left+Math.min(viewport.width*.35,Math.max(1,viewport.width-1)),
    y:viewport.top+Math.min(viewport.height*.3,Math.max(1,viewport.height-1))
  };
}

function continuousViews(manager){
  try{
    const all=manager?.views?.all?.();
    return Array.isArray(all)?all:[];
  }catch{return[]}
}

function viewIdentity(view){
  const section=view?.section;
  const index=Number(section?.index??view?.index);
  return{
    index:Number.isFinite(index)?index:null,
    href:String(section?.href||""),
    id:String(view?.id||"")
  };
}

function findContinuousAnchorView(manager,viewport){
  const point=continuousTrackingPoint(viewport);
  let best=null;
  for(const view of continuousViews(manager)){
    const element=view?.element;
    if(!element?.getBoundingClientRect)continue;
    const rect=element.getBoundingClientRect();
    const top=Number(rect.top),bottom=Number(rect.bottom);
    if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)continue;
    const distance=point.y<top?top-point.y:point.y>bottom?point.y-bottom:0;
    if(!best||distance<best.distance)best={view,rect,distance,point};
  }
  return best;
}

function resolveContinuousAnchorView(manager,snapshot){
  const views=continuousViews(manager);
  if(snapshot?.index!==null&&snapshot?.index!==undefined){
    const byIndex=views.find(view=>Number(view?.section?.index??view?.index)===Number(snapshot.index));
    if(byIndex)return byIndex;
  }
  if(snapshot?.href){
    const byHref=views.find(view=>String(view?.section?.href||"")===String(snapshot.href));
    if(byHref)return byHref;
  }
  if(snapshot?.id)return views.find(view=>String(view?.id||"")===String(snapshot.id))||null;
  return null;
}

function viewFrame(view){
  return view?.iframe||view?.element?.querySelector?.("iframe")||null;
}

function viewDocument(view){
  return view?.document||view?.contents?.document||viewFrame(view)?.contentDocument||null;
}

// Standalone covers/plates are normalized into this wrapper without prose.
// Anchor their real block so focus return does not depend on an empty caret
// range or on a CFI left over from an earlier passage.
const continuousBlockSelector="p,li,dd,dt,blockquote,pre,h1,h2,h3,h4,h5,h6,figcaption,figure,td,th,.sg-synthetic-visual-page";

function semanticBlockAtPoint(doc,x,y){
  let hitBlock=null;
  try{hitBlock=doc?.elementFromPoint?.(x,y)?.closest?.(continuousBlockSelector)||null}catch{}

  /* The Reader's visible-passage contract is geometry-based. Firefox can return a later
     semantic element from elementFromPoint() at iframe paragraph boundaries even when the
     nearest rendered block at the tracking line is the preceding paragraph. Use the same
     nearest-block geometry as progress/visibility tracking, and keep hit-testing only as a
     tie-breaker/fallback for overlapping or unusual markup. */
  let best=null;
  try{
    for(const node of doc?.querySelectorAll?.(continuousBlockSelector)||[]){
      const rect=node?.getBoundingClientRect?.();
      const top=Number(rect?.top),bottom=Number(rect?.bottom);
      if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)continue;
      const distance=y<top?top-y:y>bottom?y-bottom:0;
      if(!best||distance<best.distance)best={node,distance};
    }
  }catch{}
  if(best?.node){
    if(hitBlock){
      try{
        const rect=hitBlock.getBoundingClientRect?.();
        const top=Number(rect?.top),bottom=Number(rect?.bottom);
        if(Number.isFinite(top)&&Number.isFinite(bottom)&&bottom>top){
          const hitDistance=y<top?top-y:y>bottom?y-bottom:0;
          if(hitDistance<=best.distance+.5)return hitBlock;
        }
      }catch{}
    }
    return best.node;
  }
  return hitBlock;
}

function boundedOffset(node,offset){
  const max=node?.nodeType===3?String(node?.nodeValue||"").length:Number(node?.childNodes?.length)||0;
  return Math.max(0,Math.min(max,Number(offset)||0));
}

function contentRangeAtPoint(view,point){
  const frame=viewFrame(view),doc=viewDocument(view);
  if(!frame?.getBoundingClientRect||!doc?.createRange)return null;
  const frameRect=frame.getBoundingClientRect();
  const width=Math.max(1,Number(frameRect.width)||Number(frame.clientWidth)||1);
  const height=Math.max(1,Number(frameRect.height)||Number(frame.clientHeight)||1);
  const x=Math.max(0,Math.min(width-1,(Number(point?.x)-Number(frameRect.left))||0));
  const y=Math.max(0,Math.min(height-1,(Number(point?.y)-Number(frameRect.top))||0));

  /* Reader progress is visually block-based. Prefer the semantic block nearest the same
     tracking line used by the viewport marker so browser-specific caret placement at a
     line boundary cannot move the lifecycle anchor to the next paragraph. */
  const block=semanticBlockAtPoint(doc,x,y);
  if(block){
    try{
      const range=doc.createRange();
      range.selectNodeContents(block);
      return{range,frameRect,node:block};
    }catch{}
  }

  /* Unusual publications can contain meaningful text without semantic block wrappers.
     Keep a caret-based compatibility fallback for those documents. */
  let range=null;
  try{
    const caret=doc.caretPositionFromPoint?.(x,y);
    if(caret?.offsetNode){
      range=doc.createRange();
      range.setStart(caret.offsetNode,boundedOffset(caret.offsetNode,caret.offset));
      range.collapse(true);
    }
  }catch{}
  if(!range){
    try{
      const caret=doc.caretRangeFromPoint?.(x,y);
      if(caret)range=caret.cloneRange?.()||caret;
    }catch{}
  }
  return range?{range,frameRect,node:null}:null;
}

function rangeRect(range){
  try{
    const rect=range?.getBoundingClientRect?.();
    if(rect&&Number.isFinite(Number(rect.top))&&Number.isFinite(Number(rect.left)))return rect;
    const first=range?.getClientRects?.()?.[0];
    return first&&Number.isFinite(Number(first.top))&&Number.isFinite(Number(first.left))?first:null;
  }catch{return null}
}

function contentAnchorGeometry(view,range,frameRect=viewFrame(view)?.getBoundingClientRect?.()){
  const rect=rangeRect(range);
  if(!rect||!frameRect)return null;
  return{
    top:(Number(frameRect.top)||0)+(Number(rect.top)||0),
    left:(Number(frameRect.left)||0)+(Number(rect.left)||0)
  };
}

function contentNodeLocalGeometry(view,node){
  if(!node?.getBoundingClientRect)return null;
  const doc=viewDocument(view);
  try{
    if(node.isConnected===false)return null;
    if(node.ownerDocument&&doc&&node.ownerDocument!==doc)return null;
    const rect=node.getBoundingClientRect();
    const top=Number(rect?.top),left=Number(rect?.left),bottom=Number(rect?.bottom),right=Number(rect?.right);
    if(!Number.isFinite(top)||!Number.isFinite(left))return null;
    return{
      top,left,
      height:Number.isFinite(bottom)?Math.max(0,bottom-top):Math.max(0,Number(rect?.height)||0),
      width:Number.isFinite(right)?Math.max(0,right-left):Math.max(0,Number(rect?.width)||0)
    };
  }catch{return null}
}

function contentNodeGeometry(view,node,frameRect=viewFrame(view)?.getBoundingClientRect?.()){
  if(!frameRect)return null;
  const local=contentNodeLocalGeometry(view,node);
  return local?{
    top:(Number(frameRect.top)||0)+local.top,
    left:(Number(frameRect.left)||0)+local.left
  }:null;
}

function semanticBlockIndex(view,node){
  if(!node)return null;
  const doc=viewDocument(view);
  try{
    const nodes=[...(doc?.querySelectorAll?.(continuousBlockSelector)||[])];
    const index=nodes.indexOf(node);
    return index>=0?index:null;
  }catch{return null}
}

function semanticBlockGeometryByIndex(view,index){
  if(!Number.isInteger(index)||index<0)return null;
  const doc=viewDocument(view);
  try{
    const node=doc?.querySelectorAll?.(continuousBlockSelector)?.[index]||null;
    if(!node)return null;
    const rect=node.getBoundingClientRect?.();
    const top=Number(rect?.top),left=Number(rect?.left),bottom=Number(rect?.bottom),right=Number(rect?.right);
    if(!Number.isFinite(top)||!Number.isFinite(left))return null;
    return{
      top,left,
      height:Number.isFinite(bottom)?Math.max(0,bottom-top):Math.max(0,Number(rect?.height)||0),
      width:Number.isFinite(right)?Math.max(0,right-left):Math.max(0,Number(rect?.width)||0)
    };
  }catch{return null}
}

function captureContentAnchor(view,point){
  const located=contentRangeAtPoint(view,point);
  if(!located)return null;
  const local=located.node?contentNodeLocalGeometry(view,located.node):null;
  const geometry=located.node
    ?contentNodeGeometry(view,located.node,located.frameRect)
    :contentAnchorGeometry(view,located.range,located.frameRect);
  if(!geometry)return null;
  let cfi="";
  try{cfi=String(view?.section?.cfiFromRange?.(located.range)||"")}catch{}
  return{
    cfi,node:located.node||null,...geometry,
    blockIndex:located.node?semanticBlockIndex(view,located.node):null,
    localTop:local?.top??null,localLeft:local?.left??null,
    localHeight:local?.height??null,localWidth:local?.width??null
  };
}

function resolveContentAnchor(view,cfi){
  if(!cfi)return null;
  try{
    const range=view?.contents?.range?.(cfi);
    return range?contentAnchorGeometry(view,range):null;
  }catch{return null}
}

function continuousScrollMetrics(manager,viewport){
  if(viewport.fullsize){
    if(typeof window==="undefined")return null;
    const root=document?.documentElement,body=document?.body;
    return{
      top:Number(window.scrollY)||0,left:Number(window.scrollX)||0,
      height:Math.max(Number(root?.scrollHeight)||0,Number(body?.scrollHeight)||0,viewport.height),
      width:Math.max(Number(root?.scrollWidth)||0,Number(body?.scrollWidth)||0,viewport.width)
    };
  }
  const container=manager?.container;
  if(!container)return null;
  return{
    top:Number(container.scrollTop)||0,left:Number(container.scrollLeft)||0,
    height:Math.max(Number(container.scrollHeight)||0,viewport.height),
    width:Math.max(Number(container.scrollWidth)||0,viewport.width)
  };
}

function rectDimension(rect,start,end,size){
  const direct=Number(rect?.[size]);
  if(Number.isFinite(direct))return Math.max(0,direct);
  const first=Number(rect?.[start]),last=Number(rect?.[end]);
  return Number.isFinite(first)&&Number.isFinite(last)?Math.max(0,last-first):0;
}

function captureNativeContinuousGeometry(manager,viewport,view,viewRect,content){
  const scroll=continuousScrollMetrics(manager,viewport);
  if(!scroll||!viewRect)return null;
  return{
    scrollTop:scroll.top,scrollLeft:scroll.left,scrollHeight:scroll.height,scrollWidth:scroll.width,
    viewportHeight:viewport.height,viewportWidth:viewport.width,
    viewTop:scroll.top+((Number(viewRect.top)||0)-viewport.top),
    viewLeft:scroll.left+((Number(viewRect.left)||0)-viewport.left),
    viewHeight:rectDimension(viewRect,"top","bottom","height"),
    viewWidth:rectDimension(viewRect,"left","right","width"),
    blockIndex:Number.isInteger(content?.blockIndex)?content.blockIndex:null,
    blockTop:content?.localTop??null,blockLeft:content?.localLeft??null,
    blockHeight:content?.localHeight??null,blockWidth:content?.localWidth??null
  };
}

function nearlyEqual(left,right,tolerance=1){
  const a=Number(left),b=Number(right);
  return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
}

function nativeContinuousGeometryStable(manager,viewport,view,viewRect,native){
  if(!native||!Number.isInteger(native.blockIndex)||native.blockIndex<0)return false;
  const scroll=continuousScrollMetrics(manager,viewport);
  const block=semanticBlockGeometryByIndex(view,native.blockIndex);
  if(!scroll||!block)return false;
  const currentViewTop=scroll.top+((Number(viewRect?.top)||0)-viewport.top);
  const currentViewLeft=scroll.left+((Number(viewRect?.left)||0)-viewport.left);
  return nearlyEqual(viewport.height,native.viewportHeight)
    &&nearlyEqual(viewport.width,native.viewportWidth)
    &&nearlyEqual(scroll.height,native.scrollHeight,2)
    &&nearlyEqual(scroll.width,native.scrollWidth,2)
    &&nearlyEqual(currentViewTop,native.viewTop,1)
    &&nearlyEqual(currentViewLeft,native.viewLeft,1)
    &&nearlyEqual(rectDimension(viewRect,"top","bottom","height"),native.viewHeight,1)
    &&nearlyEqual(rectDimension(viewRect,"left","right","width"),native.viewWidth,1)
    &&nearlyEqual(block.top,native.blockTop,1)
    &&nearlyEqual(block.left,native.blockLeft,1)
    &&nearlyEqual(block.height,native.blockHeight,1)
    &&nearlyEqual(block.width,native.blockWidth,1);
}

/* Continuous buffering deliberately changes absolute scrollTop when views are prepended or
   trimmed. Anchor to the visible semantic content block at the Reader tracking line, plus
   its transient viewport offset. Also retain a structural native-scroll fingerprint: if the
   same view and semantic block geometry survive unchanged, exact scrollTop is safe and more
   faithful than a browser-dependent CFI round-trip. Persistent Reader progress is still
   owned elsewhere. */
// A live layout anchor needs document-local geometry, not a persistent CFI or
// an old screen coordinate. Parent scrolling does not change these offsets.
export function captureContinuousLayoutAnchor(manager){
  try{
    const viewport=continuousViewport(manager),anchor=viewport&&findContinuousAnchorView(manager,viewport);
    const view=anchor?.view,frame=viewFrame(view),doc=viewDocument(view);
    if(!view?.displayed||!frame||!doc)return null;
    const rect=frame.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width-1,anchor.point.x-rect.left));
    const y=Math.max(0,Math.min(rect.height-1,anchor.point.y-rect.top));
    const node=doc.elementFromPoint?.(x,y)?.closest?.(continuousBlockSelector)||semanticBlockAtPoint(doc,x,y);
    if(!node)return null;
    const block=node.getBoundingClientRect(),scroll=Number(doc.defaultView?.scrollY)||0;
    const distance=Math.max(0,block.top-y,y-block.bottom);
    return{view,node,width:rect.width,localTop:block.top+scroll,height:block.height,distance,generation:continuousGeneration(manager)};
  }catch{return null}
}

export function captureContinuousScrollPosition(rendition){
  const manager=rendition?.manager;
  const viewport=continuousViewport(manager);
  if(!manager||!viewport)return null;
  const anchor=findContinuousAnchorView(manager,viewport);
  if(!anchor)return null;
  const identity=viewIdentity(anchor.view);
  const content=captureContentAnchor(anchor.view,anchor.point);
  const native=captureNativeContinuousGeometry(manager,viewport,anchor.view,anchor.rect,content);
  if(content){
    return{
      ...identity,
      contentCfi:content.cfi,
      contentNode:content.node||null,
      top:content.top-viewport.top,
      left:content.left-viewport.left,
      fullsize:viewport.fullsize,
      native
    };
  }
  return{
    ...identity,
    contentCfi:"",
    contentNode:null,
    top:(Number(anchor.rect.top)||0)-viewport.top,
    left:(Number(anchor.rect.left)||0)-viewport.left,
    fullsize:viewport.fullsize,
    native
  };
}

export function restoreContinuousScrollPosition(rendition,snapshot){
  const manager=rendition?.manager;
  const viewport=continuousViewport(manager);
  if(!manager||!snapshot||!viewport||Boolean(snapshot.fullsize)!==viewport.fullsize)return false;
  const view=resolveContinuousAnchorView(manager,snapshot);
  const element=view?.element;
  if(!view||!element?.getBoundingClientRect)return false;

  const rect=element.getBoundingClientRect();
  const horizontal=manager.settings?.axis==="horizontal";
  const nativeStable=nativeContinuousGeometryStable(manager,viewport,view,rect,snapshot.native);
  let deltaTop=0,deltaLeft=0;

  if(nativeStable){
    const scroll=continuousScrollMetrics(manager,viewport);
    if(!scroll)return false;
    deltaTop=horizontal?0:Number(snapshot.native.scrollTop)-scroll.top;
    deltaLeft=horizontal?Number(snapshot.native.scrollLeft)-scroll.left:0;
  }else{
    /* Buffer trims and real iframe reflow invalidate the native fingerprint. Preserve the
       semantic block instead; the direct node avoids CFI reconstruction when it survives,
       while the transient CFI remains a replacement-view fallback. */
    const content=contentNodeGeometry(view,snapshot.contentNode)
      ||(snapshot.contentCfi?resolveContentAnchor(view,snapshot.contentCfi):null);
    const currentTop=content?content.top-viewport.top:(Number(rect.top)||0)-viewport.top;
    const currentLeft=content?content.left-viewport.left:(Number(rect.left)||0)-viewport.left;
    deltaTop=horizontal?0:currentTop-(Number(snapshot.top)||0);
    deltaLeft=horizontal?currentLeft-(Number(snapshot.left)||0):0;
  }
  if(!Number.isFinite(deltaTop)||!Number.isFinite(deltaLeft))return false;

  const now=globalThis.performance?.now?.()||Date.now();
  continuousInputState(manager).suppressScrollUntil=now+320;
  try{manager._scrolled?.cancel?.()}catch{}
  try{clearTimeout(manager.trimTimeout);manager.trimTimeout=0}catch{}

  if(Math.abs(deltaTop)>=.5||Math.abs(deltaLeft)>=.5){
    if(viewport.fullsize){
      if(typeof window==="undefined")return false;
      window.scrollBy(deltaLeft,deltaTop);
    }else{
      const container=manager.container;
      if(!container)return false;
      const maxTop=Math.max(0,(Number(container.scrollHeight)||0)-(Number(container.clientHeight)||0));
      const maxLeft=Math.max(0,(Number(container.scrollWidth)||0)-(Number(container.clientWidth)||0));
      container.scrollTop=Math.max(0,Math.min(maxTop,(Number(container.scrollTop)||0)+deltaTop));
      container.scrollLeft=Math.max(0,Math.min(maxLeft,(Number(container.scrollLeft)||0)+deltaLeft));
    }
  }

  const top=viewport.fullsize?Number(window.scrollY)||0:Number(manager.container?.scrollTop)||0;
  const left=viewport.fullsize?Number(window.scrollX)||0:Number(manager.container?.scrollLeft)||0;
  manager.scrollTop=top;manager.scrollLeft=left;
  manager.prevScrollTop=top;manager.prevScrollLeft=left;
  manager.scrollDeltaVert=0;manager.scrollDeltaHorz=0;manager.didScroll=false;
  return true;
}

/* EPUB.js versions differ in whether ContinuousManager keeps `scrolled` callable after
   internal lifecycle work. Shadow Garden's Continuous core deliberately routes scroll
   events through manager._scrolled, so keep that debounce defensive at the rendition
   boundary instead of allowing a late callback to throw after a flow switch/relayout.
   EPUB.js also schedules trim() separately after update(); guard that same short correction
   window so stale pre-suspend maintenance cannot undo the restored viewport. */
export function stabilizeContinuousScrollLifecycle(rendition){
  const manager=rendition?.manager;
  const input=manager&&continuousInputState(manager);
  if(!manager||input.stabilized)return Boolean(input?.stabilized);
  const current=manager._scrolled;
  if(typeof current!=="function")return false;
  let timer=0;
  const clock=()=>globalThis.performance?.now?.()||Date.now();
  const suppressed=()=>Number(input.suppressScrollUntil||0)>clock();
  const safe=(...args)=>{
    clearTimeout(timer);timer=0;
    if(suppressed())return;
    timer=setTimeout(()=>{
      timer=0;
      if(isContinuousDestroyed(manager)||suppressed())return;
      const scrolled=input.onScrolled||manager.scrolled;
      if(typeof scrolled==="function")scrolled.apply(manager,args);
    },30);
  };
  safe.cancel=()=>{clearTimeout(timer);timer=0;try{current.cancel?.()}catch{}};
  try{current.cancel?.()}catch{}
  manager._scrolled=safe;

  const currentTrim=typeof manager.trim==="function"?manager.trim:null;
  if(currentTrim){
    manager.trim=function(...args){
      if(isContinuousDestroyed(manager)||suppressed())return Promise.resolve();
      try{return currentTrim.apply(manager,args)}catch(error){return Promise.reject(error)}
    };
  }

  input.stabilized=true;
  return true;
}

export async function displaySettledRenditionTarget(rendition,target,{operation}={}){
  const revision=renditionRenderRevision(rendition);
  const moved=await runRenditionMove(rendition,operation,()=>rendition.display(target));
  if(!moved||!operation.isCurrent())return false;
  const changed=await settleRenditionContent(rendition,revision);
  if(!operation.isCurrent())return false;
  const paginated=rendition.settings?.flow==='paginated'||rendition.manager?.isPaginated===true;
  if(changed&&paginated&&String(target||'').startsWith('epubcfi(')){
    // The vendor positions a newly inserted view before asynchronous content
    // hooks finish styling its columns. Reapply the same explicit CFI once at
    // the completed content/layout boundary; newer navigation still wins.
    return runRenditionMove(rendition,operation,()=>rendition.display(target));
  }
  return true;
}

export async function displayRenditionTarget(rendition,target,{operation}={}){
  if(!rendition?.display)throw new Error("EPUB rendition is unavailable");
  operation=operation||beginRenditionNavigation(rendition,{kind:"startup"});
  try{
    const moved=await displaySettledRenditionTarget(rendition,target,{operation});
    return{fallback:false,...(!moved?{cancelled:true}:{})};
  }catch(error){
    // A failed old display must not fall back to the first chapter after a
    // newer navigation has already selected a different target.
    if(!operation.isCurrent())return{fallback:false,cancelled:true};
    if(!target)throw error;
    recordReaderDiagnostic('navigation.savedPlaceFallback');
    try{
      const moved=await runRenditionMove(rendition,operation,()=>rendition.display());
      return{fallback:true,...(!moved?{cancelled:true}:{})};
    }catch(fallbackError){
      try{if(fallbackError&&fallbackError.cause===undefined)fallbackError.cause=error}catch{}
      throw fallbackError;
    }
  }
}

export function createRendition({book,target,viewerId="viewer",flow="paginated",wire,onCreate,themeCss}={}){
  if(!book)throw new Error("EPUB is not open");
  const scrolled=flow==="scrolled-doc",singlePage=!scrolled&&paginatedNeedsSinglePage();
  const rendition=book.renderTo(viewerId,{
    width:"100%",height:"100%",manager:scrolled?"continuous":"default",flow:scrolled?"scrolled-doc":"paginated",
    spread:scrolled||singlePage?"none":"auto",minSpreadWidth:900
  });
  const operation=beginRenditionNavigation(rendition,{kind:"startup"});
  onCreate?.(rendition,operation);
  wire?.(rendition);
  try{if(themeCss)rendition.themes.default(themeCss)}catch{}
  configureSpread(rendition,flow);
  const displaying=displayRenditionTarget(rendition,target,{operation});
  holdRenditionNavigation(rendition,displaying,{signal:operation.signal});
  return displaying.then(()=>{
    if(scrolled)stabilizeContinuousScrollLifecycle(rendition);
    return rendition;
  });
}

function paginatedVisualAnchor(rendition){
  const manager=rendition?.manager,viewport=continuousViewport(manager);
  if(!viewport)return null;
  const columnWidth=Math.max(1,Number(manager?.layout?.pageWidth)||viewport.width);
  const rtl=manager?.settings?.direction==="rtl";
  const candidates=[];
  for(const view of continuousViews(manager)){
    if(view.displayed===false)continue;
    const doc=viewDocument(view),frame=viewFrame(view)?.getBoundingClientRect?.();
    if(!doc||!frame)continue;
    const nodes=doc.querySelectorAll?.("p,li,dd,dt,blockquote,pre,h1,h2,h3,h4,h5,h6,figcaption,td,th,img,svg,object")||[];
    for(const node of nodes){
      const style=doc.defaultView?.getComputedStyle?.(node);
      if(style?.visibility==="hidden"||style?.display==="none")continue;
      const rects=node.getClientRects?.()||[node.getBoundingClientRect?.()];
      for(const rect of rects){
        if(!rect)continue;
        const left=frame.left+rect.left,right=frame.left+rect.right,top=frame.top+rect.top,bottom=frame.top+rect.bottom;
        if(right<=viewport.left+1||left>=viewport.left+viewport.width-1||bottom<=viewport.top+1||top>=viewport.top+viewport.height-1)continue;
        const leading=rtl?viewport.left+viewport.width-Math.min(right,viewport.left+viewport.width):Math.max(left,viewport.left)-viewport.left;
        candidates.push({view,node,top,column:Math.floor((leading+1)/columnWidth)});
      }
    }
  }
  candidates.sort((a,b)=>a.column-b.column||a.top-b.top);
  const first=candidates[0];
  if(!first||!["IMG","SVG","OBJECT"].includes(String(first.node.tagName).toUpperCase()))return null;
  let cfi="";
  try{cfi=first.view.section?.cfiFromElement?.(first.node)||first.view.contents?.cfiFromNode?.(first.node)||""}catch{}
  return cfi?{cfi,href:first.view.section?.href||"",sectionIndex:first.view.section?.index}:null;
}

export async function captureRenditionPosition({rendition,flow,pageMap,fallback}={}){
  if(!rendition)return fallback||null;
  let location=rendition.location;
  if(flow==="scrolled-doc"){
    // currentLocation() calls the vendor's updateLayout(), which can move a
    // long Continuous iframe before its visible passage has been sampled.
    const viewport=captureContinuousScrollPosition(rendition);
    const mapped=pageMap?.positionForLocation?.(location,{rendition,flow})||fallback||null;
    if(viewport?.contentCfi)return{...mapped,cfi:viewport.contentCfi,href:viewport.href||mapped?.href,sectionIndex:viewport.index??mapped?.sectionIndex};
    return mapped;
  }
  // Vendor page mapping starts at a text node. A leading illustration is a
  // real reading anchor too, even when the same page also contains text.
  const visual=paginatedVisualAnchor(rendition);
  if(visual){
    const anchored={...location,start:{...location?.start,cfi:visual.cfi,href:visual.href,index:visual.sectionIndex}};
    return{...(pageMap?.positionForLocation?.(anchored,{rendition,flow})||fallback),...visual};
  }
  try{
    const live=rendition.currentLocation?.();
    if(live&&typeof live.then==="function")location=await live;else if(live)location=live;
  }catch{}
  return pageMap?.positionForLocation?.(location,{rendition,flow})||fallback||null;
}

export function destroyRendition(rendition,viewer){
  try{rendition?.destroy?.()}catch(error){recordReaderDiagnostic('lifecycle.cleanupFailed')}
  if(viewer)viewer.innerHTML="";
}
