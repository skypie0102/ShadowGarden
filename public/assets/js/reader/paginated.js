/* Shadow Garden R4 — Paginated-mode navigation adapter. */
import { waitForRenditionNavigation } from "./navigation-state.js";

const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

function cleanHref(value){
  let href=String(value||"").split("#")[0].split("?")[0];
  try{href=decodeURIComponent(href)}catch{}
  return href.replace(/^\.\//,"").replace(/^\//,"");
}

function hrefMatches(a,b){
  const left=cleanHref(a),right=cleanHref(b);
  return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
}

function linearSpine(rendition){
  const raw=rendition?.book?.spine?.spineItems||[];
  const linear=raw.filter(item=>item?.href&&item.linear!=="no");
  return linear.length?linear:raw.filter(item=>item?.href);
}

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
  const items=linearSpine(rendition),last=items[items.length-1];
  if(!last)return false;
  const current=currentSection(rendition);
  const currentIndex=Number(current?.index),lastIndex=Number(last.index);
  if(Number.isFinite(currentIndex)&&Number.isFinite(lastIndex)&&currentIndex===lastIndex)return true;
  const location=rendition?.location,start=location?.start||{},end=location?.end||{};
  return Boolean(last.href&&hrefMatches(end.href||start.href,last.href));
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
    Number(current?.index)||0,cleanHref(current?.href),
    String(start.cfi||""),Number(start.displayed?.page)||0,Number(start.displayed?.total)||0,
    String(end.cfi||""),Number(end.displayed?.page)||0,Number(end.displayed?.total)||0,
    Math.round(scrollLeft),Math.round(scrollTop)
  ].join("|");
}

function endPageVisible(){return document.getElementById("volumeEndPage")?.classList.contains("active")===true}
function showEndPage(){
  const page=document.getElementById("volumeEndPage");
  if(!page||!document.body.classList.contains("reader-flow-paginated"))return false;
  page.classList.remove("hidden");page.classList.add("active");
  requestAnimationFrame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  return true;
}

export function createPaginatedController({getRendition,beforeTurn}={}){
  let queue=Promise.resolve(true);

  async function performTurn(direction){
    const rendition=getRendition?.();if(!rendition)return false;
    await waitForRenditionNavigation(rendition);
    if(rendition!==getRendition?.())return false;
    beforeTurn?.();
    if(direction<0){await rendition.prev?.();return true}
    if(endPageVisible())return true;

    /* EPUB.js can still adjust manager scroll coordinates on WebKit when next() is called from
       the last displayed page, so an exact post-turn location-key comparison is not a reliable
       primary end signal. Detect the last displayed page before navigation and hand ownership
       to the Reader completion page immediately. Keep the no-op comparison below as a fallback
       for EPUBs that do not expose displayed page metadata. */
    const wasFinalSpine=onFinalSpineItem(rendition);
    if(wasFinalSpine&&onFinalDisplayedPage(rendition)){showEndPage();return true}
    const before=locationKey(rendition);
    await rendition.next?.();
    await paint();
    if(wasFinalSpine&&before&&locationKey(rendition)===before)showEndPage();
    return true;
  }

  function turn(direction){
    const task=queue.then(()=>performTurn(direction)).catch(error=>{
      console.warn("Paginated Reader turn skipped",error);
      return false;
    });
    queue=task;
    return task;
  }
  return{turn};
}
