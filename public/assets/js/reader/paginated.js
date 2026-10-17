import {recordReaderDiagnostic} from './diagnostics.js';
import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — Paginated-mode navigation adapter. */
import { beginRenditionNavigation,holdRenditionNavigation,runRenditionMove } from "./navigation-state.js";
import {cleanSectionHref,sectionHrefMatches,linearSpineItems} from './sections.js';

function currentSection(rendition){
  const location=rendition?.location||{},start=location.start||{},end=location.end||{};
  const book=rendition?.book;
  for(const target of[end.cfi,start.cfi,end.href,start.href]){
    if(!target)continue;
    try{const section=book?.spine?.get?.(target);if(section)return section}catch{}
  }
  try{return rendition?.manager?.current?.()?.section||null}catch{return null}
}

function onFinalSpineItem(rendition){
  const items=linearSpineItems(rendition?.book),last=items[items.length-1];
  if(!last)return false;
  const current=currentSection(rendition);
  const currentIndex=Number(current?.index),lastIndex=Number(last.index);
  if(Number.isFinite(currentIndex)&&Number.isFinite(lastIndex)&&currentIndex===lastIndex)return true;
  const location=rendition?.location,start=location?.start||{},end=location?.end||{};
  return Boolean(last.href&&sectionHrefMatches(end.href||start.href,last.href));
}

function onFinalDisplayedPage(rendition){
  if(!onFinalSpineItem(rendition))return false;
  const location=rendition?.location||{};
  if(location.atEnd===true)return true;
  for(const displayed of[location.end?.displayed,location.start?.displayed]){
    const page=Number(displayed?.page),total=Number(displayed?.total);
    if(Number.isFinite(page)&&Number.isFinite(total)&&total>0&&page>=total)return true;
  }
  return false;
}

function locationKey(rendition){
  const location=rendition?.location||{},start=location.start||{},end=location.end||{};
  const manager=rendition?.manager,current=currentSection(rendition);
  const scrollLeft=Number(manager?.container?.scrollLeft??manager?.scrollLeft)||0;
  const scrollTop=Number(manager?.container?.scrollTop??manager?.scrollTop)||0;
  return[
    Number(current?.index)||0,cleanSectionHref(current?.href),
    String(start.cfi||""),Number(start.displayed?.page)||0,Number(start.displayed?.total)||0,
    String(end.cfi||""),Number(end.displayed?.page)||0,Number(end.displayed?.total)||0,
    Math.round(scrollLeft),Math.round(scrollTop)
  ].join("|");
}

function endPageVisible(){return document.getElementById("volumeEndPage")?.classList.contains("active")===true}
function showEndPage(scope){
  const page=document.getElementById("volumeEndPage");
  if(!page||!document.body.classList.contains("reader-flow-paginated"))return false;
  page.classList.remove("hidden");page.classList.add("active");
  scope.frame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  return true;
}

export function createPaginatedController({getRendition,beforeTurn}={}){
  const scope=createReaderScope();
  let queue=Promise.resolve(true),pendingTurns=0,turnOperation=null;

  async function performTurn(direction,rendition,operation){
    const current=()=>rendition===getRendition?.()&&operation.isCurrent();
    if(!current())return false;
    return runRenditionMove(rendition,operation,async()=>{
      if(!current())return;
      if(direction<0){await rendition.prev?.();return true}
      if(endPageVisible())return true;

      /* EPUB.js can still adjust manager scroll coordinates on WebKit when next() is called from
         the last displayed page, so an exact post-turn location-key comparison is not a reliable
         primary end signal. Detect the last displayed page before navigation and hand ownership
         to the Reader completion page immediately. Keep the no-op comparison below as a fallback
         for EPUBs that do not expose displayed page metadata. */
      const wasFinalSpine=onFinalSpineItem(rendition);
      if(wasFinalSpine&&onFinalDisplayedPage(rendition)){showEndPage(scope);return true}
      const before=locationKey(rendition);
      await rendition.next?.();
      await scope.paint();
      if(current()&&wasFinalSpine&&before&&locationKey(rendition)===before)showEndPage(scope);
      return true;
    });
  }

  function turn(direction){
    if(scope.disposed)return Promise.resolve(false);
    const rendition=getRendition?.();if(!rendition)return Promise.resolve(false);
    // Keep intentional repeated page turns in order. A different navigation
    // cancels the batch, and a new batch invalidates older lifecycle snapshots.
    if(!pendingTurns||!turnOperation?.isCurrent()||turnOperation.rendition!==rendition)turnOperation=beginRenditionNavigation(rendition,{kind:"turn"});
    const operation=turnOperation;pendingTurns++;beforeTurn?.();
    const task=queue.then(()=>performTurn(direction,rendition,operation)).catch(error=>{
      if(!scope.disposed)recordReaderDiagnostic('progress.seekFailed');
      return false;
    }).finally(()=>{
      pendingTurns--;if(!pendingTurns)turnOperation=null;
    });
    holdRenditionNavigation(rendition,task,{signal:operation.signal});
    queue=task;
    return task;
  }
  return{dispose(){scope.dispose();turnOperation?.cancel()},turn};
}
