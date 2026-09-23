/* Shadow Garden v2.6 — Reader interaction and perceived-loading controller. */

const EXTERNAL_RE=/^(?:https?:)?\/\//i;

function externalHref(anchor){
  const raw=String(anchor?.getAttribute?.("href")||"").trim();
  return EXTERNAL_RE.test(raw)?raw:"";
}

function decorateExternalLinks(doc){
  if(!doc?.documentElement||doc.documentElement.dataset.sgInteractionLinks==="1")return;
  doc.documentElement.dataset.sgInteractionLinks="1";
  const style=doc.createElement?.("style");
  if(style){
    style.id="sg-external-link-affordance";
    style.textContent='.sg-external-link::after{content:" ↗";display:inline-block;margin-inline-start:.12em;font-size:.72em;line-height:1;vertical-align:.16em;opacity:.68;text-decoration:none!important}';
    doc.head?.appendChild(style);
  }
  doc.querySelectorAll?.("a[href]").forEach(anchor=>{
    if(!externalHref(anchor))return;
    anchor.classList.add("sg-external-link");
    if(!anchor.title)anchor.title="External link — opens after confirmation";
  });
}

function eventPoint(event,changed=false){
  const list=changed?event?.changedTouches:event?.touches;
  const point=list?.[0]||event;
  return{x:Number(point?.clientX)||0,y:Number(point?.clientY)||0};
}

export function installReaderInteractionController(){
  const loading=document.getElementById("readerLoading");
  const loadingText=loading?.querySelector("p");
  const bookTitle=document.getElementById("bookTitle");
  const progressText=document.getElementById("progressText");
  const viewer=document.getElementById("viewer");
  const mobile=window.matchMedia?.("(max-width:700px)");
  let chromeTimer=0;
  let lastStage="";

  function stage(message,key=message){
    if(!loadingText||loading?.classList.contains("hidden")||lastStage===key)return;
    lastStage=key;
    loading.dataset.stage=key;
    loadingText.textContent=message;
  }

  function chromeBlocked(){
    return Boolean(document.querySelector(".reader-drawer.open,dialog[open],.reader-image-focus:not(.hidden)"));
  }

  function setChromeHidden(hidden){
    document.body.classList.toggle("reader-chrome-hidden",Boolean(hidden&&mobile?.matches));
  }

  function scheduleChromeHide(){
    clearTimeout(chromeTimer);
    if(!mobile?.matches||chromeBlocked()||!loading?.classList.contains("hidden")){setChromeHidden(false);return}
    chromeTimer=setTimeout(()=>{if(!chromeBlocked())setChromeHidden(true)},3200);
  }

  function revealChrome(){
    setChromeHidden(false);
    scheduleChromeHide();
  }

  function attachContentDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgInteractionReady==="1")return;
    doc.documentElement.dataset.sgInteractionReady="1";
    decorateExternalLinks(doc);
    let gesture=null;

    const begin=event=>{
      const point=eventPoint(event);
      gesture={x:point.x,y:point.y,pointerId:event.pointerId??null};
    };
    const finish=event=>{
      const start=gesture;gesture=null;if(!start)return;
      if(start.pointerId!==null&&event.pointerId!==undefined&&event.pointerId!==start.pointerId)return;
      const point=eventPoint(event,true),dx=point.x-start.x,dy=point.y-start.y;
      const distance=Math.hypot(dx,dy);
      if(distance<=12||(dy<=-18&&Math.abs(dy)>Math.abs(dx)*.85))revealChrome();
    };
    const cancel=()=>{gesture=null};
    const win=doc.defaultView;
    if(typeof win?.PointerEvent==="function"){
      doc.addEventListener("pointerdown",begin,{capture:true,passive:true});
      doc.addEventListener("pointerup",finish,{capture:true,passive:true});
      doc.addEventListener("pointercancel",cancel,{capture:true,passive:true});
    }else{
      doc.addEventListener("touchstart",begin,{capture:true,passive:true});
      doc.addEventListener("touchend",finish,{capture:true,passive:true});
      doc.addEventListener("touchcancel",cancel,{capture:true,passive:true});
    }
    win?.addEventListener?.("wheel",event=>{if((Number(event.deltaY)||0)<0)revealChrome()},{passive:true});
  }

  function attachIframe(frame){
    if(!frame||frame.dataset.sgInteractionFrame==="1")return;
    frame.dataset.sgInteractionFrame="1";
    const attach=()=>{try{attachContentDocument(frame.contentDocument)}catch{}};
    frame.addEventListener("load",attach);
    attach();
  }

  function attachContinuousScroller(){
    const scroller=viewer?.querySelector?.(".epub-container");
    if(!scroller||scroller.dataset.sgInteractionScroll==="1")return;
    scroller.dataset.sgInteractionScroll="1";
    let lastTop=Number(scroller.scrollTop)||0;
    scroller.addEventListener("scroll",()=>{
      const top=Number(scroller.scrollTop)||0;
      if(document.body.classList.contains("reader-flow-scrolled")&&top<lastTop-6)revealChrome();
      lastTop=top;
    },{passive:true});
  }

  function inspectViewer(){
    viewer?.querySelectorAll?.("iframe").forEach(attachIframe);
    attachContinuousScroller();
    if(viewer?.querySelector?.("iframe"))stage("Laying out the page…","layout");
  }

  document.addEventListener("click",revealChrome,{passive:true});
  document.addEventListener("focusin",event=>{if(event.target?.closest?.(".reader-topbar,.reader-bottombar,.reader-drawer,.continuous-seek"))revealChrome()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)revealChrome()});
  mobile?.addEventListener?.("change",revealChrome);

  if(bookTitle){
    const syncTitle=()=>{const value=String(bookTitle.textContent||"").trim();if(value&&!/^Opening EPUB/i.test(value))stage("Preparing chapters…","metadata")};
    new MutationObserver(syncTitle).observe(bookTitle,{childList:true,characterData:true,subtree:true});
    syncTitle();
  }

  if(progressText){
    const syncMap=()=>{if(/Preparing device page map/i.test(progressText.title||""))stage("Mapping pages for this device…","page-map")};
    new MutationObserver(syncMap).observe(progressText,{attributes:true,attributeFilter:["title"]});
    syncMap();
  }

  if(viewer){new MutationObserver(inspectViewer).observe(viewer,{childList:true,subtree:true});inspectViewer()}
  if(loading)new MutationObserver(()=>{if(loading.classList.contains("hidden"))scheduleChromeHide();else setChromeHidden(false)}).observe(loading,{attributes:true,attributeFilter:["class"]});

  stage("Authorizing the book…","authorize");
  return {stage,revealChrome,decorateExternalLinks};
}
