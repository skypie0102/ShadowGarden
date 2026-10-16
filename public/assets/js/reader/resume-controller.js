import {recordReaderDiagnostic} from './diagnostics.js';
import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden v2.8 — Reader lifecycle resume coordination. */
import { beginRenditionNavigation,hasPendingRenditionNavigation,holdRenditionNavigation,navigateRendition,renditionNavigationRevision,runRenditionMove,waitForRenditionNavigation } from "./navigation-state.js";
import { captureContinuousScrollPosition,restoreContinuousScrollPosition } from "./rendition.js";


export function createReaderResumeController({
  getRendition,getFlow,getPageMap,getPosition,getCfi,capturePosition,renewAccess,resetInput,
  resizeRendition,configureRendition,layoutChanged,onLayoutChanged
}={}){
  const scope=createReaderScope();
  const state={anchor:null,cfi:"",scroll:null,live:null,snapshot:null,operation:null,running:null,capturing:null,queued:false,bound:false,layoutProbe:false};
  let cleanup=null;

  function viewportChanged(before,after){
    const a=before?.native,b=after?.native;
    return Boolean(a&&b&&(Math.abs(a.viewportWidth-b.viewportWidth)>1||Math.abs(a.viewportHeight-b.viewportHeight)>1));
  }

  function remember(position=getPosition?.()){
    if(scope.disposed)return null;
    const rendition=getRendition?.();
    const scroll=getFlow?.()==="scrolled-doc"?captureContinuousScrollPosition(rendition):null;
    // Window resize events arrive after CSS and the vendor's earlier listener
    // can move the iframe. Freeze the last stable passage across that boundary.
    if(state.live?.rendition===rendition&&state.live.revision===renditionNavigationRevision(rendition)&&viewportChanged(state.live.scroll,scroll))return state.anchor;
    const next=position||getPosition?.()||null;
    const cfi=next?.cfi||getCfi?.()||"";
    if(next)state.anchor={...next};
    if(cfi)state.cfi=cfi;
    if(scroll)state.live={rendition,revision:renditionNavigationRevision(rendition),position:state.anchor?{...state.anchor}:null,scroll};
    return state.anchor;
  }

  function rememberNativeScroll(rendition=getRendition?.()){
    if(!rendition||getFlow?.()!=="scrolled-doc"){state.scroll=null;return null}
    const position=captureContinuousScrollPosition(rendition);
    if(position)state.scroll={rendition,position:{...position}};
    return position;
  }

  function capture({semantic=true}={}){
    if(scope.disposed)return Promise.resolve(null);
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(remember());
    const revision=renditionNavigationRevision(rendition);
    state.snapshot={rendition,revision};
    // A suspend/resize snapshot taken halfway through a user move cannot
    // describe its destination. Recovery must not cancel that pending intent.
    if(hasPendingRenditionNavigation(rendition)&&!state.operation?.isCurrent()){
      state.snapshot.interrupted=true;state.layoutProbe=false;
      return Promise.resolve(remember());
    }
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
    if(flow==="scrolled-doc"){
      const scroll=rememberNativeScroll(rendition),live=state.live;
      if(live?.rendition===rendition&&live.revision===revision&&viewportChanged(live.scroll,scroll)){
        state.anchor=live.position?{...live.position}:state.anchor;
        state.cfi=state.anchor?.cfi||state.cfi;
        state.scroll={rendition,position:{...live.scroll}};state.layoutProbe=true;
        return Promise.resolve(state.anchor);
      }
    }else state.scroll=null;
    if(!semantic)return Promise.resolve(remember());
    if(state.capturing)return state.capturing;
    const fallback=state.anchor||getPosition?.()||null;
    const captureOperation={rendition,isCurrent:()=>!scope.disposed&&rendition===getRendition?.()&&revision===renditionNavigationRevision(rendition)};
    let position=fallback;
    const task=runRenditionMove(rendition,captureOperation,async()=>{
      position=await scope.wait(capturePosition?.({rendition,flow,pageMap:getPageMap?.(),fallback}))||fallback;
    }).then(current=>current?remember(position):state.anchor)
      .catch(error=>{
        if(!scope.disposed)recordReaderDiagnostic('resume.captureFailed');
        return rendition===getRendition?.()&&revision===renditionNavigationRevision(rendition)?remember(fallback):state.anchor;
      });
    let tracked;
    tracked=task.finally(()=>{if(state.capturing===tracked)state.capturing=null});
    state.capturing=tracked;
    return tracked;
  }

  async function restoreOnce(rendition,position,cfi,nativeScroll,layoutProbe,operation){
    const current=()=>!scope.disposed&&rendition===getRendition?.()&&operation.isCurrent();
    if(!current())return false;
    try{await scope.wait(renewAccess?.())}catch(error){if(!scope.disposed)recordReaderDiagnostic('access.renewalDelayed')}
    if(!current())return false;

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
      if(!nativeScroll)return current();
      let first=false;
      if(!await runRenditionMove(rendition,operation,()=>{first=restoreContinuousScrollPosition(rendition,nativeScroll)}))return false;
      if(first){
        await scope.paint();
        if(!current())return false;
        let restored=false;
        if(!await runRenditionMove(rendition,operation,()=>{restored=restoreContinuousScrollPosition(rendition,nativeScroll)}))return false;
        if(restored)return true;
      }
      continuousAnchorExpired=true;
    }

    /* Paginated recovery still refreshes rendition geometry. Continuous only reaches this
       path when layout changed or its transient live-content anchor no longer exists. */
    if(flow!=="scrolled-doc"||changed){
      if(!await runRenditionMove(rendition,operation,()=>{
        try{resizeRendition?.(rendition)}catch(error){recordReaderDiagnostic('resume.layoutFailed')}
        try{configureRendition?.(rendition,flow)}catch(error){recordReaderDiagnostic('resume.layoutFailed')}
      }))return false;
    }
    await scope.paint();
    if(!current())return false;

    let target=cfi||position?.cfi||"";
    if(!target&&!changed&&position){
      try{
        target=await getPageMap?.()?.targetForPosition?.(position,{includeFraction:flow==="scrolled-doc"})||"";
      }catch(error){recordReaderDiagnostic('navigation.canonicalFallback')}
    }
    if(!target)target=position?.href||"";

    if(!current())return false;
    if(target){
      if(!await navigateRendition(rendition,target,{operation}))return false;
    }else if(continuousAnchorExpired){
      recordReaderDiagnostic('resume.anchorExpired');
    }
    if(current()&&changed)onLayoutChanged?.();
    return current();
  }

  function restore({queue=false}={}){
    if(scope.disposed)return Promise.resolve(false);
    if(state.running&&(!state.operation||state.operation.isCurrent())){if(queue)state.queued=true;return state.running}
    const rendition=getRendition?.();
    if(!rendition)return Promise.resolve(false);
    const snapshot=state.snapshot;
    const revision=snapshot?.rendition===rendition?snapshot.revision:renditionNavigationRevision(rendition);
    if(snapshot?.interrupted||revision!==renditionNavigationRevision(rendition))return Promise.resolve(false);

    /* Suspension/resize handlers capture before the viewport can move. Never start a fresh
       semantic capture after pageshow/reflow, but do wait for an already-running pre-suspend
       capture so layout-changing recovery cannot fall back to an older remembered CFI. */
    const pendingCapture=state.capturing;
    const nativeScroll=state.scroll?.rendition===rendition?{...state.scroll.position}:null;
    const layoutProbe=state.layoutProbe;
    state.layoutProbe=false;
    let operation=null;
    const task=Promise.resolve().then(async()=>{
      if(pendingCapture){
        try{await pendingCapture}catch{}
      }
      if(scope.disposed||rendition!==getRendition?.()||revision!==renditionNavigationRevision(rendition))return false;
      operation=beginRenditionNavigation(rendition,{kind:"resume"});
      state.operation=operation;
      holdRenditionNavigation(rendition,tracked,{signal:operation.signal});
      const position=state.anchor||getPosition?.()||null;
      const cfi=position?.cfi||state.cfi||getCfi?.()||"";
      return restoreOnce(rendition,position,cfi,nativeScroll,layoutProbe,operation);
    }).catch(error=>{
      if(!scope.disposed)recordReaderDiagnostic('resume.failed');
      return false;
    });
    let tracked;
    tracked=task.finally(()=>{
      if(state.running!==tracked)return;
      state.running=null;state.operation=null;
      if(!operation?.isCurrent()){state.queued=false;return}
      state.live=null;
      if(state.queued){
        state.queued=false;
        queueMicrotask(()=>void restore());
      }else{
        /* Do not immediately call EPUB.js currentLocation() after a Continuous restore.
           Refresh only the mutation-free transient snapshot; relocated events already own
           the canonical semantic CFI. Paginated mode can keep its semantic refresh. */
        void waitForRenditionNavigation(rendition).then(()=>{
          if(!operation.isCurrent())return;
          if(getFlow?.()==="scrolled-doc")void capture({semantic:false});
          else void capture();
        });
      }
    });
    state.running=tracked;
    return tracked;
  }

  function wait(){return state.operation&&!state.operation.isCurrent()?Promise.resolve():state.running||Promise.resolve()}

  function bind(){
    if(scope.disposed)return()=>{};
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

  return{dispose(){scope.dispose();cleanup?.();state.operation?.cancel();state.queued=false;state.anchor=null;state.scroll=null;state.live=null;state.snapshot=null},remember,capture,restore,wait,bind,isRestoring:()=>!scope.disposed&&Boolean(state.running)&&(!state.operation||state.operation.isCurrent())};
}
