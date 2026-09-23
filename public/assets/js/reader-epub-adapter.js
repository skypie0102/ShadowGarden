/* Shadow Garden EPUB.js compatibility adapter.
 * Keeps third-party layout/navigation quirks outside the reader state engine.
 */
(()=>{
  const originalEpub=window.ePub;
  if(typeof originalEpub!=="function")return;

  let currentBook=null,currentRendition=null,currentTarget=null,viewportTimer=0,seekTimer=0,seekSerial=0,pendingExternalHref="";
  const progressByCfi=new Map();
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
    requestAnimationFrame(()=>cancel?.focus?.({preventScroll:true}));
  }

  function installExternalLinkGuard(contents){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!doc?.documentElement||doc.documentElement.dataset.sgExternalLinks==="1")return;
    doc.documentElement.dataset.sgExternalLinks="1";
    doc.addEventListener("click",event=>{
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

  function linearSpine(book){
    const raw=book?.spine?.spineItems||[];
    const linear=raw.filter(item=>item?.href&&item.linear!=="no");
    return linear.length?linear:raw.filter(item=>item?.href);
  }

  function spinePosition(book,start={}){
    const items=linearSpine(book);
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
    try{rendition.on("relocated",location=>normalizeLocationProgress(currentBook,location))}catch{}
    try{rendition.hooks?.content?.register?.(contents=>installExternalLinkGuard(contents))}catch(error){console.warn("External EPUB link hook unavailable",error)}

    try{
      rendition.on("rendered",(_,view)=>{
        if(rendition!==currentRendition)return;
        const contents=view?.contents;
        if(contents)setTimeout(()=>{normalizeMobilePage(contents);installExternalLinkGuard(contents);syncContinuousFrameHeights(contents)},0);
        else setTimeout(()=>{
          try{rendition.getContents?.().forEach(contents=>{normalizeMobilePage(contents);installExternalLinkGuard(contents);syncContinuousFrameHeights(contents)})}catch{}
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
  function syncContinuousFrameHeights(contents){
    try{
      const doc=contents?.document,win=doc?.defaultView;
      if(!win||!doc)return;
      const doc0=doc;
      if(!win.__sgTallSyncBound){
        win.__sgTallSyncBound=true;
        /* media loads inside a rendered document are what grow it late; reconcile again */
        doc0.addEventListener("load",event=>{
          const target=event.target;
          if(target&&(target.tagName==="IMG"||(typeof SVGElement!=="undefined"&&target instanceof doc0.defaultView.SVGElement)))syncContinuousFrameHeights(contents);
        },true);
        /* media may already be decoded before these hooks attach, and engines differ in
           when async svg sizing settles; guaranteed staggered passes cover both cases
           without spamming the reconciler once growth is exhausted. */
        [300,1200,2600,4200].forEach(delay=>setTimeout(()=>{try{syncContinuousFrameHeights(contents)}catch{}},delay));
      }
      clearTimeout(win.__sgTallSyncTimer);
      win.__sgTallSyncTimer=setTimeout(()=>{
        try{
          const views=[...(document.querySelectorAll(".epub-view")||[])];
          const targets=views.length
            ? views.map(el=>({el,frame:el.querySelector?.("iframe")}))
            : [...((document.getElementById("viewer")||{}).children||[])].map(el=>({el,frame:el.matches?.("iframe")?el:el.querySelector?.("iframe")}));
          /* Idempotent truth-up: any drift between a section frame's frozen height and its
             live document extent is rewritten to the exact current value, so natural flow
             stacking always matches real content - late-growing tall artwork included.
             Stale inline `top`s (absolute-position era leftovers) would visually offset
             relative-flow sections and are cleared as well. */
          for(const entry of targets){
            const entryDoc=entry.frame?.contentDocument;
            if(!entry.frame||!entryDoc||!entryDoc.documentElement)continue;
            const need=Math.max(
              entryDoc.documentElement.scrollHeight,
              entryDoc.body?entryDoc.body.scrollHeight:0
            );
            if(!need)continue;
            const current=Math.round(entry.frame.getBoundingClientRect().height);
            if(Math.abs(need-current)>2){
              entry.frame.style.height=`${need}px`;
              if(entry.el!==entry.frame)entry.el.style.height=`${need}px`;
            }
            if(entry.el.style.top)entry.el.style.top="";
          }
        }catch{}
      },150);
    }catch{}
  }

  function patchBook(book){
    if(!book||book.__sgAdapterPatched)return book;
    book.__sgAdapterPatched=true;
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

  function wrappedEpub(...args){return patchBook(originalEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,originalEpub)}catch{}
  try{wrappedEpub.prototype=originalEpub.prototype}catch{}
  window.ePub=wrappedEpub;

  function decodeFragment(value){try{return decodeURIComponent(value)}catch{return value}}

  async function cfiFromTocHref(book,href){
    const text=String(href||"");
    if(!text)return"";
    let section=null;
    try{section=book?.spine?.get?.(text)}catch{}
    if(!section){
      const path=text.split("#")[0];
      try{section=book?.spine?.get?.(path)}catch{}
    }
    if(!section)return text;

    if(!section.document)await section.load(book.load.bind(book));
    const hash=text.indexOf("#"),fragment=hash>=0?decodeFragment(text.slice(hash+1)):"";
    let element=null;
    if(fragment){
      element=section.document?.getElementById?.(fragment)||null;
      if(!element){
        try{element=section.document?.querySelector?.(`[name="${CSS.escape(fragment)}"]`)||null}catch{}
      }
    }
    element=element||section.document?.body||section.document?.documentElement;
    if(!element||typeof section.cfiFromElement!=="function")return text;
    try{return section.cfiFromElement(element)||text}catch{return text}
  }

  function closeTocDrawer(){
    document.querySelectorAll(".reader-drawer").forEach(drawer=>drawer.classList.remove("open"));
    document.getElementById("drawerBackdrop")?.classList.add("hidden");
  }

  async function displaySettled(rendition,target){
    await rendition.display(target);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    if(rendition===currentRendition&&document.body?.classList.contains("reader-flow-scrolled"))await rendition.display(target);
  }

  /* In the continuous manager, display(href) can reuse a retained section offset.
     Resolve the TOC href to a concrete CFI so chapter/anchor navigation is exact. */
  document.addEventListener("click",event=>{
    const button=event.target?.closest?.("#tocPanel .toc-entry-link[data-href]");
    if(!button||!document.body?.classList.contains("reader-flow-scrolled"))return;
    const book=currentBook,rendition=currentRendition;
    if(!book||!rendition)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const href=button.dataset.href||"";
    (async()=>{
      try{
        const target=await cfiFromTocHref(book,href);
        await displaySettled(rendition,target);
        closeTocDrawer();
      }catch(error){
        console.error("Continuous TOC navigation failed",error);
        try{await rendition.display(href);closeTocDrawer()}catch(fallbackError){console.error("TOC fallback navigation failed",fallbackError)}
      }
    })();
  },true);

  function locationCount(book){
    try{
      const value=book?.locations?.length?.();
      if(Number.isFinite(value))return value;
    }catch{}
    return Array.isArray(book?.locations?._locations)?book.locations._locations.length:0;
  }

  async function spineStartTarget(book,percentage){
    const items=linearSpine(book);
    if(!items.length)return"";
    const p=clamp01(percentage);
    const index=p>=1?items.length-1:Math.min(items.length-1,Math.floor(p*items.length));
    const section=items[index];
    if(!section)return"";
    try{
      if(!section.document)await section.load(book.load.bind(book));
      const element=section.document?.body||section.document?.documentElement;
      if(element&&typeof section.cfiFromElement==="function"){
        const cfi=section.cfiFromElement(element);
        if(cfi)return cfi;
      }
    }catch(error){console.warn("Continuous spine fallback CFI failed",error)}
    return section.href||"";
  }

  function updateProgressUi(percentage){
    const p=clamp01(percentage);
    const range=document.getElementById("progressRange"),text=document.getElementById("progressText");
    if(range)range.value=String(Math.round(p*1000));
    if(text)text.textContent=`${Math.round(p*100)}%`;
  }

  async function continuousSeek(percentage){
    const book=currentBook,rendition=currentRendition;
    if(!book||!rendition||!document.body?.classList.contains("reader-flow-scrolled"))return;
    const serial=++seekSerial,p=clamp01(percentage);
    let target="";
    if(locationCount(book)>0){
      try{
        const candidate=book.locations.cfiFromPercentage(p);
        if(typeof candidate==="string"&&candidate&&candidate!=="-1")target=candidate;
      }catch(error){console.warn("Continuous exact seek failed",error)}
    }
    if(!target)target=await spineStartTarget(book,p);
    if(!target||serial!==seekSerial)return;
    updateProgressUi(p);
    try{await displaySettled(rendition,target)}catch(error){console.error("Continuous seek failed",error)}
  }

  /* Dedicated Continuous rail. Native range events are no longer used in Continuous
     mode; this single custom event is the only seek entry point for that flow. */
  document.addEventListener("sg-continuous-seek",event=>{
    if(!document.body?.classList.contains("reader-flow-scrolled"))return;
    const p=clamp01(event.detail?.percentage);
    const immediate=event.detail?.immediate===true;
    updateProgressUi(p);
    clearTimeout(seekTimer);
    if(immediate)continuousSeek(p);
    else seekTimer=setTimeout(()=>continuousSeek(p),140);
  });

  /* Mobile browser chrome continuously changes visualViewport height while scrolling.
     Only paginated mode needs those changes forwarded into EPUB.js page measurement;
     forwarding them in continuous mode causes repeated reflows and breaks scroll/seek. */
  window.visualViewport?.addEventListener("resize",()=>{
    if(!document.body?.classList.contains("reader-flow-paginated"))return;
    clearTimeout(viewportTimer);
    viewportTimer=setTimeout(()=>window.dispatchEvent(new Event("resize")),80);
  });
})();
