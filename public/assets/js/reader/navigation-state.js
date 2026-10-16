import {recordReaderDiagnostic} from './diagnostics.js';
/* Shared Reader navigation ownership and ordered vendor moves. */
const barriers=new WeakMap();
const navigators=new WeakMap();
const operations=new WeakMap();
const disposed=new WeakSet();

function navigationState(rendition){
  let state=operations.get(rendition);
  if(!state){state={revision:0,current:null,tail:Promise.resolve()};operations.set(rendition,state)}
  return state;
}

export function renditionNavigationRevision(rendition){
  return rendition?operations.get(rendition)?.revision||0:0;
}

// Begin at the user's request, before resolving a page-map target or waiting for
// a paint. Older work loses ownership immediately, including deferred retries.
export function beginRenditionNavigation(rendition,{kind="explicit"}={}){
  const state=navigationState(rendition),previous=state.current,controller=new AbortController();
  const revision=++state.revision;
  const operation={
    rendition,kind,revision,signal:controller.signal,
    isCurrent:()=>state.current===operation&&!controller.signal.aborted,
    cancel(){
      if(state.current===operation){state.current=null;state.revision++}
      controller.abort();
    }
  };
  state.current=operation;
  previous?.cancel();
  if(disposed.has(rendition))operation.cancel();
  return operation;
}

export function cancelRenditionNavigation(rendition){operations.get(rendition)?.current?.cancel()}

export function disposeRenditionNavigation(rendition){
  if(!rendition)return;
  disposed.add(rendition);cancelRenditionNavigation(rendition);navigators.delete(rendition);
}

// EPUB.js cannot cancel a display already in progress. Serialize vendor moves
// so the newer target is applied after that call, and skip stale queued work.
export function runRenditionMove(rendition,operation,move){
  const state=navigationState(rendition);
  const task=state.tail.then(async()=>{
    if(!operation?.isCurrent()||operation.rendition!==rendition)return false;
    await move();
    return operation.isCurrent();
  });
  state.tail=task.catch(()=>{});
  return task;
}

// Content extensions delegate explicit navigation to the active application
// owner so chapter state, input reset and Continuous settling stay together.
export function registerRenditionNavigator(rendition,navigate){
  if(!rendition||typeof navigate!=="function")throw new TypeError("A rendition navigation owner is required");
  navigators.set(rendition,navigate);
  return()=>{if(navigators.get(rendition)===navigate)navigators.delete(rendition);};
}

export function navigateRendition(rendition,target,options={}){
  if(!rendition||!target||disposed.has(rendition))return Promise.resolve(false);
  const navigate=navigators.get(rendition);
  if(navigate)return Promise.resolve(navigate(target,options));
  if(options.operation)return runRenditionMove(rendition,options.operation,()=>rendition.display(target));
  return Promise.resolve(rendition.display(target));
}

export function holdRenditionNavigation(rendition,promise,{signal}={}){
  if(!rendition||!promise?.then)return Promise.resolve();
  let onAbort;
  const cancelled=new Promise(resolve=>{
    onAbort=resolve;
    if(signal?.aborted)resolve();else signal?.addEventListener("abort",onAbort,{once:true});
  });
  let pending=barriers.get(rendition);
  if(!pending){pending=new Set();barriers.set(rendition,pending)}
  let barrier;
  barrier=Promise.race([promise,cancelled]).catch(error=>{
    recordReaderDiagnostic('navigation.barrierFailed');
  }).finally(()=>{
    signal?.removeEventListener("abort",onAbort);
    pending.delete(barrier);
    if(!pending.size)barriers.delete(rendition);
  });
  pending.add(barrier);
  return barrier;
}

export function waitForRenditionNavigation(rendition){
  return Promise.all(barriers.get(rendition)||[]);
}

export function hasPendingRenditionNavigation(rendition){
  return Boolean(barriers.get(rendition)?.size);
}
