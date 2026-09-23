/* Shadow Garden v1.4.1 — Continuous render/location lifecycle fix.
 *
 * Keeps v1.4's single-owner Continuous architecture, but separates three concerns:
 * 1) navigation displays the requested spine item immediately;
 * 2) bounded neighbor buffering runs in the background and is invalidated by navigation;
 * 3) scroll/location events never wait for buffering.
 *
 * Visible views are actively repaired/re-shown instead of relying on a no-op update(), so a
 * partially prepared iframe cannot remain as a permanent blank shell after first open.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const BUFFER_EACH_SIDE=4;
  const MAX_RETAINED_VIEWS=12;
  const VIEW_TIMEOUT_MS=5000;
  const DISPLAY_DEDUPE_MS=750;
  const SCROLL_DEBOUNCE_MS=30;
  const TRIM_IDLE_MS=1400;

  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));
  const targetKey=target=>typeof target==="string"?target:target?.toString?.()||"";

  function cleanHref(value){
    let href=String(value||"").split("#")[0].split("?")[0];
    try{href=decodeURIComponent(href)}catch{}
    return href.replace(/^\.\//,"").replace(/^\//,"");
  }
  function hrefMatches(a,b){
    const left=cleanHref(a),right=cleanHref(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  }
  function isContinuous(options,rendition){
    return options?.manager==="continuous"||String(options?.flow||rendition?.settings?.flow||"").startsWith("scrolled");
  }
  function loadedViews(manager){
    try{return manager?.views?.all?.()||[]}catch{return[]}
  }
  function linearSpine(rendition){
    const raw=rendition?.book?.spine?.spineItems||[];
    const linear=raw.filter(item=>item?.href&&item.linear!=="no");
    return linear.length?linear:raw.filter(item=>item?.href);
  }
  function lastSpineItem(rendition){
    const items=linearSpine(rendition);
    return items[items.length-1]||null;
  }

  function renderSeekPreview(range){
    const value=clamp01(Number(range?.value||0)/1000);
    const total=Number(window.__sgCanonicalPageMap?.totalPages)||0;
    const text=document.getElementById("progressText");
    if(!text)return;
    if(total>0){
      const page=value>=1?total:Math.min(total,Math.floor(value*total)+1);
      text.textContent=`${page}/${total}`;
      text.title=`Page ${page} of ${total} · ${Math.round(value*100)}% · release to navigate`;
    }else{
      text.textContent=`${Math.round(value*100)}%`;
      text.title="Release the seek bar to navigate";
    }
  }

  /* Keep legacy reader.js drag handlers from navigating repeatedly. `change` remains the one
     committed seek event; the dedicated Continuous rail already forwards that event. */
  document.addEventListener("input",event=>{
    if(event.target?.id!=="progressRange")return;
    event.stopImmediatePropagation();
    renderSeekPreview(event.target);
  },true);
  document.addEventListener("pointerup",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);
  document.addEventListener("touchend",event=>{
    if(event.target?.id==="progressRange")event.stopImmediatePropagation();
  },true);

  function masterEndPage(){return document.getElementById("volumeEndPage")}
  function pagedEndVisible(){return masterEndPage()?.classList.contains("active")===true}
  function hidePagedEnd(){
    const page=masterEndPage();if(!page)return;
    page.classList.add("hidden");page.classList.remove("active");
  }
  function showPagedEnd(){
    const page=masterEndPage();
    if(!page||!document.body.classList.contains("reader-flow-paginated"))return;
    page.classList.remove("hidden");page.classList.add("active");
    requestAnimationFrame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
  }
  function stripCloneIds(root){
    root.removeAttribute("id");root.removeAttribute("aria-labelledby");root.removeAttribute("aria-describedby");
    root.querySelectorAll?.("[id]").forEach(node=>node.removeAttribute("id"));
  }
  function syncContinuousEnd(rendition){
    const manager=rendition?.manager,container=manager?.container;
    if(!manager||!container||!document.body.classList.contains("reader-flow-scrolled"))return;
    const finalSection=lastSpineItem(rendition);
    const views=loadedViews(manager);
    const finalLoaded=Boolean(finalSection&&views.some(view=>view?.displayed&&hrefMatches(view?.section?.href,finalSection.href)));
    const existing=container.querySelector?.(".volume-end-page-continuous");
    if(!finalLoaded){existing?.remove();return}
    if(existing)return;
    const master=masterEndPage();if(!master)return;
    const clone=master.cloneNode(true);
    stripCloneIds(clone);
    clone.classList.remove("hidden","active");
    clone.classList.add("continuous-end","volume-end-page-continuous");
    container.appendChild(clone);
  }
  function locationAtBookEnd(rendition){
    const location=rendition?.location;
    if(location?.atEnd===true)return true;
    const last=lastSpineItem(rendition),end=location?.end||location?.start;
    if(!last||!end||!hrefMatches(end.href,last.href))return false;
    const displayed=end.displayed||location?.start?.displayed;
    const page=Number(displayed?.page),total=Number(displayed?.total);
    return Number.isFinite(page)&&Number.isFinite(total)&&total>0&&page>=total;
  }

  function scrollerFor(manager){return manager?.settings?.fullsize?window:manager?.container}
  function getScrollPosition(manager){
    if(!manager)return{top:0,left:0};
    const dir=manager.settings?.direction==="rtl"&&manager.settings?.rtlScrollType==="default"?-1:1;
    if(manager.settings?.fullsize)return{top:(Number(window.scrollY)||0)*dir,left:(Number(window.scrollX)||0)*dir};
    return{top:Number(manager.container?.scrollTop)||0,left:Number(manager.container?.scrollLeft)||0};
  }
  function syncScrollPosition(manager){
    const position=getScrollPosition(manager);
    manager.scrollTop=position.top;
    manager.scrollLeft=position.left;
    return position;
  }
  function defaultManagerDisplay(manager){
    try{
      const continuousProto=Object.getPrototypeOf(manager);
      const defaultProto=continuousProto&&Object.getPrototypeOf(continuousProto);
      return typeof defaultProto?.display==="function"?defaultProto.display:null;
    }catch{return null}
  }
  function debounce(fn,wait){
    let timer=0;
    const wrapped=(...args)=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{timer=0;fn(...args)},wait);
    };
    wrapped.cancel=()=>{clearTimeout(timer);timer=0};
    return wrapped;
  }

  function visibleRange(manager){
    const views=loadedViews(manager);
    if(!views.length)return{views,first:-1,last:-1};
    const viewport=manager.container?.getBoundingClientRect?.();
    const indices=[];
    if(viewport){
      views.forEach((view,index)=>{
        const rect=view?.element?.getBoundingClientRect?.();
        if(!rect)return;
        const vertical=rect.bottom>viewport.top+1&&rect.top<viewport.bottom-1;
        const horizontal=rect.right>viewport.left+1&&rect.left<viewport.right-1;
        if(vertical&&horizontal)indices.push(index);
      });
    }
    if(indices.length)return{views,first:indices[0],last:indices[indices.length-1]};

    const axis=manager.settings?.axis==="horizontal"?"horizontal":"vertical";
    const center=axis==="horizontal"?(viewport?.left||0)+(viewport?.width||0)/2:(viewport?.top||0)+(viewport?.height||0)/2;
    let nearest=0,distance=Infinity;
    views.forEach((view,index)=>{
      const rect=view?.element?.getBoundingClientRect?.();if(!rect)return;
      const itemCenter=axis==="horizontal"?(rect.left+rect.right)/2:(rect.top+rect.bottom)/2;
      const next=Math.abs(itemCenter-center);
      if(next<distance){distance=next;nearest=index}
    });
    return{views,first:nearest,last:nearest};
  }

  function viewNeedsRepair(view){
    if(!view?.displayed)return true;
    if(!view.iframe||!view.contents)return true;
    const width=Number(view._width)||Number(view.element?.offsetWidth)||0;
    const height=Number(view._height)||Number(view.element?.offsetHeight)||0;
    return width<=1||height<=1;
  }

  async function displayView(view,manager,generation){
    if(!view)return false;
    try{
      const work=Promise.resolve(view.display(manager.request)).then(async shown=>{
        const live=shown||view;
        if(generation!==undefined&&generation!==manager.__sgGeneration)return false;
        live.stopExpanding=false;
        try{live.expand?.(true)}catch{}
        live.show?.();
        await paint();
        return true;
      });
      const result=await Promise.race([work,delay(VIEW_TIMEOUT_MS).then(()=>false)]);
      if(result!==true&&generation===manager.__sgGeneration){
        console.warn("Continuous neighbor display timed out",view?.section?.href||"");
      }
      return result===true;
    }catch(error){
      if(generation===undefined||generation===manager.__sgGeneration){
        console.warn("Continuous neighbor display skipped",view?.section?.href||"",error);
      }
      return false;
    }
  }

  async function safeUpdate(manager,offset=0,generation=manager.__sgGeneration){
    if(!manager?.container||!manager?.views||generation!==manager.__sgGeneration)return false;
    const bounds=manager.bounds?.();
    const views=loadedViews(manager);
    const jobs=[];
    for(const view of views){
      let visible=false;
      try{visible=manager.isVisible?.(view,offset,offset,bounds)===true}catch{}
      if(!visible)continue;
      if(viewNeedsRepair(view)){
        jobs.push(displayView(view,manager,generation));
      }else{
        try{
          view.stopExpanding=false;
          view.expand?.(true);
          if(view.element?.style?.visibility!=="visible"||view.iframe?.style?.visibility!=="visible")view.show?.();
        }catch{}
      }
    }
    if(jobs.length)await Promise.allSettled(jobs);
    return jobs.length>0;
  }

  function preserveAnchor(range){
    const view=range.views[range.first];
    const top=view?.element?.getBoundingClientRect?.().top;
    return Number.isFinite(top)?{view,top}:null;
  }
  async function restoreAnchor(manager,anchor,generation){
    if(generation!==manager.__sgGeneration||!anchor?.view?.element||!manager.container)return;
    await paint();
    if(generation!==manager.__sgGeneration)return;
    const top=anchor.view.element.getBoundingClientRect?.().top;
    if(!Number.isFinite(top))return;
    const delta=top-anchor.top;
    if(Math.abs(delta)>1){
      manager.__sgSuppressScrollUntil=performance.now()+100;
      manager.container.scrollTop=(Number(manager.container.scrollTop)||0)+delta;
    }
    manager.ignore=false;
    syncScrollPosition(manager);
  }

  async function prependOne(manager,generation){
    if(generation!==manager.__sgGeneration)return false;
    const first=manager.views?.first?.(),section=first?.section?.prev?.();
    if(!section)return false;
    let view=null;
    try{view=manager.prepend(section)}catch(error){console.warn("Continuous prepend skipped",error);return false}
    return displayView(view,manager,generation);
  }
  async function appendOne(manager,generation){
    if(generation!==manager.__sgGeneration)return false;
    const last=manager.views?.last?.(),section=last?.section?.next?.();
    if(!section)return false;
    let view=null;
    try{view=manager.append(section)}catch(error){console.warn("Continuous append skipped",error);return false}
    return displayView(view,manager,generation);
  }

  function emitScrolled(manager){
    if(!manager?.container)return;
    const position=syncScrollPosition(manager);
    try{manager.emit?.("scrolled",position)}catch{}
  }

  function scheduleTrim(manager,rendition){
    clearTimeout(manager.__sgTrimTimer);
    manager.__sgTrimTimer=setTimeout(()=>{
      if(manager.__sgDestroyed)return;
      if(Date.now()-(Number(manager.__sgLastUserScrollAt)||0)<650){scheduleTrim(manager,rendition);return}
      const range=visibleRange(manager),views=range.views;
      if(range.first<0||views.length<=MAX_RETAINED_VIEWS)return;
      const keepStart=Math.max(0,range.first-BUFFER_EACH_SIDE);
      const keepEnd=Math.min(views.length-1,range.last+BUFFER_EACH_SIDE);
      const above=views.slice(0,keepStart);
      const below=views.slice(keepEnd+1);
      try{above.forEach(view=>manager.erase?.(view,true))}catch(error){console.warn("Continuous upper trim skipped",error)}
      try{below.slice().reverse().forEach(view=>manager.erase?.(view))}catch(error){console.warn("Continuous lower trim skipped",error)}
      manager.ignore=false;
      syncScrollPosition(manager);
      syncContinuousEnd(rendition);
      emitScrolled(manager);
    },TRIM_IDLE_MS);
  }

  async function ensureNeighborhood(manager,rendition,generation){
    if(generation!==manager.__sgGeneration||manager.__sgDestroyed||!manager.container||!manager.views)return false;
    syncScrollPosition(manager);
    let range=visibleRange(manager);
    if(range.first<0)return false;
    const anchor=preserveAnchor(range);
    let changed=false;

    const before=Math.max(0,range.first);
    for(let count=before;count<BUFFER_EACH_SIDE;count+=1){
      if(generation!==manager.__sgGeneration)return false;
      if(!await prependOne(manager,generation))break;
      changed=true;
    }
    if(changed)await restoreAnchor(manager,anchor,generation);
    if(generation!==manager.__sgGeneration)return false;

    range=visibleRange(manager);
    const after=Math.max(0,range.views.length-1-range.last);
    for(let count=after;count<BUFFER_EACH_SIDE;count+=1){
      if(generation!==manager.__sgGeneration)return false;
      if(!await appendOne(manager,generation))break;
      changed=true;
    }
    if(generation!==manager.__sgGeneration)return false;

    await safeUpdate(manager,0,generation);
    if(generation!==manager.__sgGeneration)return false;
    manager.ignore=false;
    syncScrollPosition(manager);
    scheduleTrim(manager,rendition);
    syncContinuousEnd(rendition);
    emitScrolled(manager);
    return changed;
  }

  function scheduleBuffer(manager,rendition){
    if(!manager?.container||!manager?.views||manager.__sgDestroyed)return Promise.resolve(false);
    const generation=manager.__sgGeneration||0;
    if(manager.__sgBufferPromise&&manager.__sgBufferGeneration===generation)return manager.__sgBufferPromise;
    const task=ensureNeighborhood(manager,rendition,generation).catch(error=>{
      if(generation===manager.__sgGeneration)console.warn("Continuous background buffer skipped",error);
      return false;
    }).finally(()=>{
      if(manager.__sgBufferPromise===task){manager.__sgBufferPromise=null;manager.__sgBufferGeneration=-1}
    });
    manager.__sgBufferPromise=task;
    manager.__sgBufferGeneration=generation;
    return task;
  }

  function wireBoundaryContents(contents,manager,rendition){
    const doc=contents?.document;
    if(!doc||doc.documentElement?.dataset.sgContinuousCoreBoundary==="1")return;
    doc.documentElement.dataset.sgContinuousCoreBoundary="1";
    doc.documentElement.style.setProperty("overflow-anchor","none","important");
    doc.body?.style?.setProperty("overflow-anchor","none","important");
    const request=()=>{scheduleBuffer(manager,rendition)};
    doc.addEventListener("wheel",event=>{if(Math.abs(Number(event.deltaY)||0)>1)request()},{passive:true});
    let startY=null;
    doc.addEventListener("touchstart",event=>{
      startY=Number(event.touches?.[0]?.clientY);if(!Number.isFinite(startY))startY=null;
    },{passive:true});
    doc.addEventListener("touchmove",event=>{
      if(startY==null)return;
      const y=Number(event.touches?.[0]?.clientY);
      if(Number.isFinite(y)&&Math.abs(y-startY)>18)request();
    },{passive:true});
    doc.addEventListener("touchend",()=>{startY=null},{passive:true});
  }

  function patchManagerMethods(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgCoreMethodsInstalled)return Boolean(manager?.__sgCoreMethodsInstalled);
    manager.__sgCoreMethodsInstalled=true;
    manager.__sgDestroyed=false;
    manager.__sgGeneration=0;
    manager.__sgBufferGeneration=-1;

    manager.getScrollPosition=()=>getScrollPosition(manager);
    manager.syncScrollPosition=()=>syncScrollPosition(manager);
    manager.update=offset=>safeUpdate(manager,Number(offset)||0,manager.__sgGeneration);
    manager.check=()=>{
      scheduleBuffer(manager,rendition);
      return Promise.resolve(false);
    };
    manager.fill=()=>{
      scheduleBuffer(manager,rendition);
      return Promise.resolve();
    };
    manager.scheduleTrim=()=>scheduleTrim(manager,rendition);

    const baseDisplay=defaultManagerDisplay(manager);
    if(baseDisplay){
      manager.display=(section,displayTarget)=>{
        const generation=(manager.__sgGeneration||0)+1;
        manager.__sgGeneration=generation;
        manager.__sgBufferGeneration=-1;
        manager.__sgBufferPromise=null;
        clearTimeout(manager.__sgTrimTimer);
        return Promise.resolve(baseDisplay.call(manager,section,displayTarget)).then(result=>{
          if(generation!==manager.__sgGeneration)return result;
          manager.ignore=false;
          if(manager.container)syncScrollPosition(manager);
          setTimeout(()=>scheduleBuffer(manager,rendition),0);
          return result;
        });
      };
    }
    return true;
  }

  function bindScrollLifecycle(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgCoreScrollBound||!manager.container||!manager.views)return false;
    patchManagerMethods(rendition);
    manager.__sgCoreScrollBound=true;
    const scroller=scrollerFor(manager);

    try{manager._scrolled?.cancel?.()}catch{}
    try{if(manager._onScroll)scroller?.removeEventListener?.("scroll",manager._onScroll)}catch{}

    const initial=syncScrollPosition(manager);
    manager.prevScrollTop=initial.top;
    manager.prevScrollLeft=initial.left;
    manager.scrollDeltaVert=0;
    manager.scrollDeltaHorz=0;

    manager.scrolled=()=>{
      const position=syncScrollPosition(manager);
      try{manager.emit?.("scroll",position)}catch{}
      scheduleBuffer(manager,rendition);
      clearTimeout(manager.afterScrolled);
      manager.afterScrolled=setTimeout(()=>{
        if(manager.snapper&&manager.snapper.supportsTouch&&manager.snapper.needsSnap?.())return;
        emitScrolled(manager);
      },Number(manager.settings?.afterScrolledTimeout)||10);
    };
    manager._scrolled=debounce(()=>manager.scrolled(),SCROLL_DEBOUNCE_MS);
    manager.onScroll=()=>{
      const {top,left}=syncScrollPosition(manager);
      const suppressed=performance.now()<(Number(manager.__sgSuppressScrollUntil)||0);
      if(!suppressed){
        if(!manager.ignore)manager._scrolled();
        else manager.ignore=false;
        manager.__sgLastUserScrollAt=Date.now();
      }else{
        manager.ignore=false;
      }
      manager.scrollDeltaVert+=(Math.abs(top-(Number(manager.prevScrollTop)||0))||0);
      manager.scrollDeltaHorz+=(Math.abs(left-(Number(manager.prevScrollLeft)||0))||0);
      manager.prevScrollTop=top;
      manager.prevScrollLeft=left;
      clearTimeout(manager.scrollTimeout);
      manager.scrollTimeout=setTimeout(()=>{manager.scrollDeltaVert=0;manager.scrollDeltaHorz=0},150);
      manager.didScroll=false;
    };
    manager._onScroll=manager.onScroll;
    try{scroller?.addEventListener?.("scroll",manager._onScroll,{passive:true})}catch{}

    try{rendition.getContents?.().forEach(contents=>wireBoundaryContents(contents,manager,rendition))}catch{}
    try{rendition.hooks?.content?.register?.(contents=>wireBoundaryContents(contents,manager,rendition))}catch{}
    try{rendition.on?.("rendered",()=>{
      try{rendition.getContents?.().forEach(contents=>wireBoundaryContents(contents,manager,rendition))}catch{}
      safeUpdate(manager,0,manager.__sgGeneration).catch(()=>{});
      scheduleBuffer(manager,rendition);
    })}catch{}

    const rawDestroy=typeof manager.destroy==="function"?manager.destroy.bind(manager):null;
    if(rawDestroy)manager.destroy=(...args)=>{
      manager.__sgDestroyed=true;
      manager.__sgGeneration=(manager.__sgGeneration||0)+1;
      clearTimeout(manager.__sgTrimTimer);
      clearTimeout(manager.afterScrolled);
      clearTimeout(manager.scrollTimeout);
      clearTimeout(rendition.__sgInstallTimer);
      try{manager._scrolled?.cancel?.()}catch{}
      try{scroller?.removeEventListener?.("scroll",manager._onScroll)}catch{}
      return rawDestroy(...args);
    };

    manager.ignore=false;
    scheduleBuffer(manager,rendition);
    return true;
  }

  function installManager(rendition){
    const manager=rendition?.manager;
    if(!manager){
      clearTimeout(rendition.__sgInstallTimer);
      rendition.__sgInstallTimer=setTimeout(()=>installManager(rendition),25);
      return false;
    }
    patchManagerMethods(rendition);
    if(!manager.container||!manager.views){
      clearTimeout(rendition.__sgInstallTimer);
      rendition.__sgInstallTimer=setTimeout(()=>installManager(rendition),25);
      return false;
    }
    return bindScrollLifecycle(rendition);
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgContinuousCorePatched)return rendition;
    rendition.__sgContinuousCorePatched=true;
    const continuous=isContinuous(options,rendition);
    let lastKey="",lastDoneAt=0,lastPromise=null,lastResult=null;

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      rendition.display=(...args)=>{
        hidePagedEnd();
        if(continuous)installManager(rendition);
        const key=targetKey(args[0]),now=performance.now();
        if(continuous&&key&&key===lastKey){
          if(lastPromise)return lastPromise;
          if(now-lastDoneAt<DISPLAY_DEDUPE_MS)return Promise.resolve(lastResult||rendition);
        }
        lastKey=key;
        const task=Promise.resolve(rawDisplay(...args)).then(result=>{
          lastResult=result;
          if(continuous){
            installManager(rendition);
            const manager=rendition.manager;
            if(manager?.container){
              manager.ignore=false;
              syncScrollPosition(manager);
              safeUpdate(manager,0,manager.__sgGeneration).catch(()=>{});
              scheduleBuffer(manager,rendition);
            }
            syncContinuousEnd(rendition);
          }
          return result;
        }).finally(()=>{
          lastDoneAt=performance.now();
          lastPromise=null;
        });
        lastPromise=task;
        return task;
      };
    }

    if(typeof rendition.next==="function"){
      const rawNext=rendition.next.bind(rendition);
      rendition.next=(...args)=>{
        if(!continuous&&locationAtBookEnd(rendition)){showPagedEnd();return Promise.resolve()}
        hidePagedEnd();return rawNext(...args);
      };
    }
    if(typeof rendition.prev==="function"){
      const rawPrev=rendition.prev.bind(rendition);
      rendition.prev=(...args)=>{
        if(!continuous&&pagedEndVisible()){hidePagedEnd();return Promise.resolve()}
        return rawPrev(...args);
      };
    }

    if(continuous){
      const install=()=>installManager(rendition);
      install();
      try{rendition.on?.("started",install)}catch{}
      try{Promise.resolve(rendition.started).then(()=>{install();setTimeout(install,0)}).catch(()=>{})}catch{}
      try{rendition.on?.("rendered",()=>syncContinuousEnd(rendition))}catch{}
    }else{
      try{rendition.on?.("relocated",()=>hidePagedEnd())}catch{}
    }
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgContinuousCoreBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgContinuousCoreBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
