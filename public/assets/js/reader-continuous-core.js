import {recordReaderDiagnostic,measureReaderOperation} from './reader/diagnostics.js';
import {readerInstanceScope,readerContentsScope} from "./reader/lifecycle.js";
import {installContinuousLayout} from './reader/continuous-layout.js';
import {interruptRenditionNavigation} from './reader/navigation-state.js';
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
export function createContinuousCoreExtension(){

  const BUFFER_EACH_SIDE=4;
  const MAX_RETAINED_VIEWS=12;
  const VIEW_TIMEOUT_MS=5000;
  const SCROLL_DEBOUNCE_MS=30;
  const TRIM_IDLE_MS=1400;

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

  function masterEndPage(){return document.getElementById("volumeEndPage")}
  function pagedEndVisible(){return masterEndPage()?.classList.contains("active")===true}
  function hidePagedEnd(){
    const page=masterEndPage();if(!page)return;
    page.classList.add("hidden");page.classList.remove("active");
  }
  function showPagedEnd(rendition){
    const page=masterEndPage();
    if(!page||!document.body.classList.contains("reader-flow-paginated"))return;
    page.classList.remove("hidden");page.classList.add("active");
    readerInstanceScope(rendition).frame(()=>page.querySelector("a:not(.hidden)")?.focus?.({preventScroll:true}));
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
    const scope=readerInstanceScope(view).child();
    if(scope.disposed)return false;
    try{
      const work=Promise.resolve(view.display(manager.request)).then(async shown=>{
        const live=shown||view;
        if(scope.disposed||manager.__sgDestroyed||generation!==undefined&&generation!==manager.__sgGeneration)return false;
        live.stopExpanding=false;
        try{live.expand?.(true)}catch{}
        live.show?.();
        await scope.paint();
        return true;
      });
      const result=await scope.wait(Promise.race([work,new Promise(resolve=>scope.timeout(()=>resolve(false),VIEW_TIMEOUT_MS))]));
      if(result!==true&&!manager.__sgDestroyed&&generation===manager.__sgGeneration){
        recordReaderDiagnostic('continuous.timeout');
      }
      return result===true;
    }catch(error){
      if(error?.name!=='AbortError'&&!manager.__sgDestroyed&&(generation===undefined||generation===manager.__sgGeneration)){
        recordReaderDiagnostic('continuous.failed');
      }
      return false;
    }finally{scope.dispose()}
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

  async function prependOne(manager,generation){
    if(generation!==manager.__sgGeneration)return false;
    const first=manager.views?.first?.(),section=first?.section?.prev?.();
    if(!section)return false;
    let view=null;
    try{view=manager.prepend(section)}catch(error){recordReaderDiagnostic('continuous.failed');return false}
    return displayView(view,manager,generation);
  }
  async function appendOne(manager,generation){
    if(generation!==manager.__sgGeneration)return false;
    const last=manager.views?.last?.(),section=last?.section?.next?.();
    if(!section)return false;
    let view=null;
    try{view=manager.append(section)}catch(error){recordReaderDiagnostic('continuous.failed');return false}
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
      if(manager.__sgBufferPromise||Date.now()-(Number(manager.__sgLastUserScrollAt)||0)<650){scheduleTrim(manager,rendition);return}
      const range=visibleRange(manager),views=range.views;
      if(range.first<0||views.length<=MAX_RETAINED_VIEWS)return;
      const keepStart=Math.max(0,range.first-BUFFER_EACH_SIDE);
      const keepEnd=Math.min(views.length-1,range.last+BUFFER_EACH_SIDE);
      const above=views.slice(0,keepStart);
      const below=views.slice(keepEnd+1);
      try{above.forEach(view=>manager.erase?.(view,true))}catch(error){recordReaderDiagnostic('continuous.failed')}
      try{below.slice().reverse().forEach(view=>manager.erase?.(view))}catch(error){recordReaderDiagnostic('continuous.failed')}
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
    let changed=false;

    const before=Math.max(0,range.first);
    for(let count=before;count<BUFFER_EACH_SIDE;count+=1){
      if(generation!==manager.__sgGeneration)return false;
      if(!await prependOne(manager,generation))break;
      changed=true;
    }
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
    if(manager.__sgBufferPromise&&manager.__sgBufferGeneration===generation){
      manager.__sgBufferAgain=true;
      return manager.__sgBufferPromise;
    }
    const finish=measureReaderOperation('continuous.buffered');
    const task=Promise.resolve().then(async()=>{
      let changed=false;
      do{
        manager.__sgBufferAgain=false;
        changed=await ensureNeighborhood(manager,rendition,generation)||changed;
      }while(manager.__sgBufferAgain&&generation===manager.__sgGeneration&&!manager.__sgDestroyed);
      finish({views:loadedViews(manager).length},generation===manager.__sgGeneration&&!manager.__sgDestroyed?'continuous.buffered':'continuous.cancelled');
      return changed;
    }).catch(error=>{
      finish({},error?.name==='AbortError'||manager.__sgDestroyed||generation!==manager.__sgGeneration?'continuous.cancelled':'continuous.failed');
      return false;
    }).finally(()=>{
      if(manager.__sgBufferPromise===task){manager.__sgBufferPromise=null;manager.__sgBufferGeneration=-1}
    });
    manager.__sgBufferPromise=task;
    manager.__sgBufferGeneration=generation;
    return task;
  }

  function noteUserScroll(manager,rendition){
    interruptRenditionNavigation(rendition);
    manager.ignore=false;manager.__sgSuppressScrollUntil=0;
    manager.__sgLastUserScrollAt=Date.now();
  }

  function wireBoundaryContents(contents,manager,rendition){
    const doc=contents?.document;
    if(!doc||readerInstanceScope(rendition).disposed||doc.documentElement?.dataset.sgContinuousCoreBoundary==="1")return;
    const scope=readerContentsScope(rendition,contents);
    scope.add(()=>delete doc.documentElement.dataset.sgContinuousCoreBoundary);
    doc.documentElement.dataset.sgContinuousCoreBoundary="1";
    doc.documentElement.style.setProperty("overflow-anchor","none","important");
    doc.body?.style?.setProperty("overflow-anchor","none","important");
    const request=()=>{noteUserScroll(manager,rendition);scheduleBuffer(manager,rendition)};
    scope.listen(doc,"wheel",event=>{if(Math.abs(Number(event.deltaY)||0)>1)request()},{passive:true});
    let startY=null;
    scope.listen(doc,"touchstart",event=>{
      startY=Number(event.touches?.[0]?.clientY);if(!Number.isFinite(startY))startY=null;
    },{passive:true});
    scope.listen(doc,"touchmove",event=>{
      if(startY==null)return;
      const y=Number(event.touches?.[0]?.clientY);
      if(Number.isFinite(y)&&Math.abs(y-startY)>18)request();
    },{passive:true});
    scope.listen(doc,"touchend",()=>{startY=null},{passive:true});
    scope.listen(doc,"touchcancel",()=>{startY=null},{passive:true});
    scope.listen(doc,'keydown',event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.target?.closest?.('input,textarea,select,[contenteditable]'))return;
      if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))request();
    },{passive:true});
  }

  function patchManagerMethods(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgCoreMethodsInstalled)return Boolean(manager?.__sgCoreMethodsInstalled);
    manager.__sgCoreMethodsInstalled=true;
    readerInstanceScope(manager).link(readerInstanceScope(rendition));
    manager.__sgDestroyed=false;
    manager.__sgGeneration=0;
    manager.__sgBufferGeneration=-1;

    manager.getScrollPosition=()=>getScrollPosition(manager);
    manager.syncScrollPosition=()=>syncScrollPosition(manager);
    // Remember owned writes synchronously. A later scroll event at a different
    // position is new movement (including kinetic touch scrolling), even when
    // it arrives without another wheel/touchmove event.
    for(const name of ['scrollTo','scrollBy']){
      const move=manager[name];
      if(typeof move==='function')manager[name]=function(...args){
        try{return move.apply(this,args)}
        finally{
          const position=syncScrollPosition(this);
          this.prevScrollTop=position.top;this.prevScrollLeft=position.left;
        }
      };
    }
    installContinuousLayout(manager);
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
          readerInstanceScope(rendition).timeout(()=>scheduleBuffer(manager,rendition),0);
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
    // Native anchoring and owned compensation must not both adjust the same
    // inserted/resized chapter. EPUB iframe roots are disabled separately.
    manager.container.style?.setProperty('overflow-anchor','none','important');
    const scope=readerInstanceScope(rendition);
    scope.listen(manager.container,'wheel',event=>{
      if(Math.abs(Number(event.deltaY)||0)>1)noteUserScroll(manager,rendition);
    },{passive:true});
    let parentTouchY=null;
    scope.listen(manager.container,'touchstart',event=>{parentTouchY=event.touches?.length===1?event.touches[0].clientY:null},{passive:true});
    scope.listen(manager.container,'touchmove',event=>{
      if(parentTouchY!==null&&Math.abs((Number(event.touches?.[0]?.clientY)||0)-parentTouchY)>18)noteUserScroll(manager,rendition);
    },{passive:true});
    scope.listen(manager.container,'touchend',()=>{parentTouchY=null},{passive:true});
    scope.listen(manager.container,'touchcancel',()=>{parentTouchY=null},{passive:true});
    scope.listen(manager.container,'keydown',event=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.target?.closest?.('input,textarea,select,[contenteditable]'))return;
      if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))noteUserScroll(manager,rendition);
    },{passive:true});

    try{manager._scrolled?.cancel?.()}catch{}
    try{if(manager._onScroll)scroller?.removeEventListener?.("scroll",manager._onScroll)}catch{}

    const initial=syncScrollPosition(manager);
    manager.prevScrollTop=initial.top;
    manager.prevScrollLeft=initial.left;
    manager.scrollDeltaVert=0;
    manager.scrollDeltaHorz=0;

    const onScrolled=()=>{
      if(manager.__sgDestroyed)return;
      const position=syncScrollPosition(manager);
      try{manager.emit?.("scroll",position)}catch{}
      scheduleBuffer(manager,rendition);
      clearTimeout(manager.afterScrolled);
      manager.afterScrolled=setTimeout(()=>{
        if(manager.snapper&&manager.snapper.supportsTouch&&manager.snapper.needsSnap?.())return;
        emitScrolled(manager);
      },Number(manager.settings?.afterScrolledTimeout)||10);
    };
    // Vendor scrollTo/scrollBy also use `scrolled` as a boolean bookkeeping
    // flag. Keep the owned callback separate from that mutable vendor field.
    manager.__sgContinuousScrolled=onScrolled;
    manager.scrolled=onScrolled;
    manager._scrolled=debounce(onScrolled,SCROLL_DEBOUNCE_MS);
    manager.onScroll=()=>{
      const {top,left}=syncScrollPosition(manager);
      const suppressed=performance.now()<(Number(manager.__sgSuppressScrollUntil)||0);
      if(!suppressed){
        // Focus owns temporary browser-induced drift beneath its overlay.
        // Real wheel/touch intent still interrupts through the input handlers.
        if(!document.body.classList.contains('reader-image-focused')&&(Math.abs(top-(Number(manager.prevScrollTop)||0))>.5||Math.abs(left-(Number(manager.prevScrollLeft)||0))>.5))noteUserScroll(manager,rendition);
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
    try{scope.hook(rendition.hooks?.content,contents=>wireBoundaryContents(contents,manager,rendition))}catch{}
    try{scope.on(rendition,"rendered",()=>{
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
    const scope=readerInstanceScope(rendition);
    if(scope.disposed)return false;
    const manager=rendition?.manager;
    if(!manager){
      scope.clearTimeout(rendition.__sgInstallTimer);
      rendition.__sgInstallTimer=scope.timeout(()=>installManager(rendition),25);
      return false;
    }
    patchManagerMethods(rendition);
    if(!manager.container||!manager.views){
      scope.clearTimeout(rendition.__sgInstallTimer);
      rendition.__sgInstallTimer=scope.timeout(()=>installManager(rendition),25);
      return false;
    }
    return bindScrollLifecycle(rendition);
  }

  function patchRendition(rendition,options){
    if(!rendition||rendition.__sgContinuousCorePatched)return rendition;
    rendition.__sgContinuousCorePatched=true;
    const scope=readerInstanceScope(rendition);
    scope.add(()=>{
      const manager=rendition.manager;
      if(manager){manager.__sgDestroyed=true;manager.__sgGeneration=(manager.__sgGeneration||0)+1;clearTimeout(manager.__sgTrimTimer);clearTimeout(manager.afterScrolled);clearTimeout(manager.scrollTimeout);manager._scrolled?.cancel?.()}
      hidePagedEnd();manager?.__sgEndPage?.remove?.();
    });
    const continuous=isContinuous(options,rendition);
    let lastKey="",lastPromise=null;

    if(typeof rendition.display==="function"){
      const rawDisplay=rendition.display.bind(rendition);
      rendition.display=(...args)=>{
        if(scope.disposed)return Promise.resolve();
        hidePagedEnd();
        if(continuous)installManager(rendition);
        const key=targetKey(args[0]);
        if(continuous&&key&&key===lastKey){
          if(lastPromise)return lastPromise;
        }
        lastKey=key;
        const task=Promise.resolve(rawDisplay(...args)).then(result=>{
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
          if(lastPromise===task)lastPromise=null;
        });
        lastPromise=task;
        return task;
      };
    }

    if(typeof rendition.next==="function"){
      const rawNext=rendition.next.bind(rendition);
      rendition.next=(...args)=>{
        if(scope.disposed)return Promise.resolve();
        if(!continuous&&locationAtBookEnd(rendition)){showPagedEnd(rendition);return Promise.resolve()}
        hidePagedEnd();return rawNext(...args);
      };
    }
    if(typeof rendition.prev==="function"){
      const rawPrev=rendition.prev.bind(rendition);
      rendition.prev=(...args)=>{
        if(scope.disposed)return Promise.resolve();
        if(!continuous&&pagedEndVisible()){hidePagedEnd();return Promise.resolve()}
        return rawPrev(...args);
      };
    }

    if(continuous){
      const install=scope.guard(()=>installManager(rendition));
      install();
      try{scope.on(rendition,"started",install)}catch{}
      try{Promise.resolve(rendition.started).then(()=>{install();scope.timeout(install,0)}).catch(()=>{})}catch{}
      try{scope.on(rendition,"rendered",()=>syncContinuousEnd(rendition))}catch{}
    }else{
      try{scope.on(rendition,"relocated",()=>hidePagedEnd())}catch{}
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

  async function settleNavigation(rendition){
    const manager=rendition?.manager;
    if(!manager?.container||manager.__sgDestroyed)return false;
    const generation=manager.__sgGeneration;
    await scheduleBuffer(manager,rendition);
    if(manager.__sgDestroyed||generation!==manager.__sgGeneration)return false;
    await safeUpdate(manager,0,generation);
    await readerInstanceScope(manager).paint();
    return !manager.__sgDestroyed&&generation===manager.__sgGeneration;
  }

  return {name:"continuous-core",attachBook:patchBook,settleNavigation};
}
