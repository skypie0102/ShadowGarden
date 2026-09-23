/* Shadow Garden v2.8 — Reader lifecycle resume coordination. */
import { holdRenditionNavigation } from "./navigation-state.js";
import { captureContinuousScrollPosition,restoreContinuousScrollPosition } from "./rendition.js";

const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function createReaderResumeController({
  getRendition,getFlow,getPageMap,getPosition,getCfi,capturePosition,renewAccess,resetInput,
  resizeRendition,configureRendition,layoutChanged,onLayoutChanged
}={}){
  const state={anchor:null,cfi:"",scroll:null,running:null,capturing:null,queued:false,bound:false,layoutProbe:false};
  let cleanup=null;

  function remember(position=getPosition?.()){
    const next=position||getPosition?.()||null;
    const cfi=next?.cfi||getCfi?.()||"";
    if(next)state.anchor={...next};
    if(cfi)state.cfi=cfi;
    return state.anchor;
  }

  function rememberNativeScroll(rendition=getRendition?.()){
    if(!rendition||getFlow?.()!=="scrolled-doc"){state.scroll=null;return null}
    const position=captureContinuousScrollPosition(rendition);
    if(position)state.scroll={rendition,position:{...position}};
    return position;
  }

  function capture({semantic=true}={}){
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(remember());
    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    /* A semantic capture is the explicit signal used by resize/orientation recovery. Ordinary
       Continuous lifecycle snapshots are mutation-free and must not inherit Page Map layout
       mismatch as proof that the live viewport changed. Keep a pending probe until restore
       consumes it so repeated lifecycle signals cannot erase an already-detected resize. */
    if(semantic)state.layoutProbe=true;
    /* Continuous lifecycle signals must snapshot transient geometry synchronously without
       asking EPUB.js for currentLocation(). EPUB.js currentLocation() calls updateLayout(),
       which is a mutating operation that can reframe a long Continuous iframe. Semantic
       capture is reserved for explicit layout-changing recovery such as resize/orientation. */
    if(flow==="scrolled-doc")rememberNativeScroll(rendition);else state.scroll=null;
    if(!semantic)return Promise.resolve(remember());
    if(state.capturing)return state.capturing;
    const fallback=state.anchor||getPosition?.()||null;
    const task=Promise.resolve(capturePosition?.({rendition,flow,pageMap:getPageMap?.(),fallback})||fallback)
      .then(position=>remember(position||fallback))
      .catch(error=>{
        console.warn("Reader resume live capture skipped",error);
        return remember(fallback);
      });
    let tracked;
    tracked=task.finally(()=>{if(state.capturing===tracked)state.capturing=null});
    state.capturing=tracked;
    return tracked;
  }

  async function restoreOnce(rendition,position,cfi,nativeScroll,layoutProbe){
    try{await renewAccess?.()}catch(error){console.warn("Reader access resume renewal delayed",error)}
    if(rendition!==getRendition?.())return false;

    const flow=getFlow?.()==="scrolled-doc"?"scrolled-doc":"paginated";
    /* Page Map geometry is only meaningful here when the preceding capture intentionally
       sampled semantic location for a resize/orientation recovery. A pagehide/pageshow
       snapshot in Continuous mode is transient-only, so stale Page Map dimensions must not
       trigger rendition.display(cfi) and replace the exact live viewport. */
    const changed=layoutProbe&&layoutChanged?.()===true;
    resetInput?.();

    /* Unchanged Continuous resumes first restore the pre-suspend content CFI/range relative
       to the Reader viewport. This survives prepend/trim compensation and iframe reflow. If
       that transient view was removed entirely, fall through to the frozen semantic CFI. */
    let continuousAnchorExpired=false;
    if(flow==="scrolled-doc"&&!changed){
      if(!nativeScroll)return rendition===getRendition?.();
      const first=restoreContinuousScrollPosition(rendition,nativeScroll);
      if(first){
        await nextPaint();
        if(rendition!==getRendition?.())return false;
        if(restoreContinuousScrollPosition(rendition,nativeScroll))return true;
      }
      continuousAnchorExpired=true;
    }

    /* Paginated recovery still refreshes rendition geometry. Continuous only reaches this
       path when layout changed or its transient live-content anchor no longer exists. */
    if(flow!=="scrolled-doc"||changed){
      try{resizeRendition?.(rendition)}catch(error){console.warn("Reader resume resize skipped",error)}
      try{configureRendition?.(rendition,flow)}catch(error){console.warn("Reader resume spread update skipped",error)}
    }
    await nextPaint();
    if(rendition!==getRendition?.())return false;

    let target=cfi||position?.cfi||"";
    if(!target&&!changed&&position){
      try{
        target=await getPageMap?.()?.targetForPosition?.(position,{includeFraction:flow==="scrolled-doc"})||"";
      }catch(error){console.warn("Reader resume canonical target fallback",error)}
    }
    if(!target)target=position?.href||"";

    if(target&&rendition===getRendition?.()){
      await rendition.display(target);
      if(flow==="scrolled-doc"){
        await nextPaint();
        if(rendition===getRendition?.())await rendition.display(target);
      }
    }else if(continuousAnchorExpired){
      console.warn("Reader Continuous resume anchor expired without a semantic fallback");
    }
    if(changed)onLayoutChanged?.();
    return rendition===getRendition?.();
  }

  function restore({queue=false}={}){
    if(state.running){if(queue)state.queued=true;return state.running}
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(false);

    /* Suspension/resize handlers capture before the viewport can move. Never start a fresh
       semantic capture after pageshow/reflow, but do wait for an already-running pre-suspend
       capture so layout-changing recovery cannot fall back to an older remembered CFI. */
    const pendingCapture=state.capturing;
    const nativeScroll=state.scroll?.rendition===rendition?{...state.scroll.position}:null;
    const layoutProbe=state.layoutProbe;
    state.layoutProbe=false;
    const task=(async()=>{
      if(pendingCapture){
        try{await pendingCapture}catch{}
        if(rendition!==getRendition?.())return false;
      }
      const position=state.anchor||getPosition?.()||null;
      const cfi=position?.cfi||state.cfi||getCfi?.()||"";
      return restoreOnce(rendition,position,cfi,nativeScroll,layoutProbe);
    })().catch(error=>{
      console.warn("Reader resume recovery skipped",error);
      return false;
    });
    let tracked;
    tracked=task.finally(()=>{
      if(state.running===tracked)state.running=null;
      if(state.queued){
        state.queued=false;
        queueMicrotask(()=>void restore());
      }else{
        /* Do not immediately call EPUB.js currentLocation() after a Continuous restore.
           Refresh only the mutation-free transient snapshot; relocated events already own
           the canonical semantic CFI. Paginated mode can keep its semantic refresh. */
        queueMicrotask(()=>{
          if(getFlow?.()==="scrolled-doc")void capture({semantic:false});
          else void capture();
        });
      }
    });
    state.running=tracked;
    holdRenditionNavigation(rendition,tracked);
    return tracked;
  }

  function wait(){return state.running||Promise.resolve()}

  function bind(){
    if(state.bound)return cleanup||(()=>{});
    state.bound=true;
    const captureLifecycle=()=>capture({semantic:getFlow?.()!=="scrolled-doc"});
    const onVisibility=()=>{if(document.hidden)void captureLifecycle();else void restore()};
    const onPageHide=()=>void captureLifecycle();
    const onPageShow=()=>void restore();
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("pagehide",onPageHide);
    window.addEventListener("pageshow",onPageShow);
    cleanup=()=>{
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("pagehide",onPageHide);
      window.removeEventListener("pageshow",onPageShow);
      state.bound=false;
      cleanup=null;
    };
    return cleanup;
  }

  return{remember,capture,restore,wait,bind,isRestoring:()=>Boolean(state.running)};
}
