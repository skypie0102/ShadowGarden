/* Continuous structural layout changes preserve the live viewport synchronously.
   Never retain a screen coordinate across a chapter load or an animation frame:
   the reader can continue scrolling while that work is pending. */
import {readerAbortError,readerInstanceScope} from './lifecycle.js';
import {captureContinuousLayoutAnchor} from './rendition.js';
import {continuousGeneration,isContinuousDestroyed} from './continuous-state.js';
const transactions=new WeakSet();
const wrappedViews=new WeakSet();
const contentAnchors=new WeakMap();

export function rememberContinuousLayout(manager){
  if(!manager?.container||isContinuousDestroyed(manager)||document.body.classList.contains('reader-image-focused')){
    contentAnchors.delete(manager);return;
  }
  const anchor=captureContinuousLayoutAnchor(manager);
  if(anchor)contentAnchors.set(manager,anchor);else contentAnchors.delete(manager);
}

function contentLayoutAnchor(manager){
  const saved=contentAnchors.get(manager);
  if(!saved||saved.generation!==continuousGeneration(manager)||!saved.node.isConnected||!saved.view.iframe?.isConnected||manager.settings?.axis!=='vertical')return null;
  const frame=saved.view.iframe.getBoundingClientRect(),viewport=manager.container.getBoundingClientRect();
  if(Math.abs(frame.width-saved.width)>1)return null;
  const scroll=Number(saved.node.ownerDocument?.defaultView?.scrollY)||0;
  // Only preserve a block that would still be visible at the *current* parent
  // scroll position without its document's layout change. New user movement
  // is never reversed, and prepend compensation cannot be counted twice.
  const expectedTop=frame.top+saved.localTop-scroll;
  if(expectedTop+saved.height<=viewport.top||expectedTop>=viewport.bottom)return null;
  const trackingLine=viewport.top+viewport.height*.3;
  const distance=Math.max(0,expectedTop-trackingLine,trackingLine-expectedTop-saved.height);
  if(distance>saved.distance+1)return null;
  return{element:saved.view.element,frame:saved.view.iframe,node:saved.node,top:expectedTop,left:0};
}

function visibleView(manager){
  const viewport=manager.settings?.fullsize
    ?{top:0,left:0,bottom:window.innerHeight,right:window.innerWidth}
    :manager.container?.getBoundingClientRect?.();
  if(!viewport)return null;
  const horizontal=manager.settings?.axis==='horizontal';
  const point=horizontal?viewport.left+(viewport.right-viewport.left)*.35
    :viewport.top+(viewport.bottom-viewport.top)*.3;
  let best=null;
  for(const view of manager.views?.all?.()||[]){
    if(view.displayed===false||view.element?.isConnected===false)continue;
    const rect=view.element?.getBoundingClientRect?.();
    if(!rect||rect.bottom-rect.top<=1||rect.right-rect.left<=1)continue;
    const visible=horizontal?rect.right>viewport.left+1&&rect.left<viewport.right-1
      :rect.bottom>viewport.top+1&&rect.top<viewport.bottom-1;
    if(!visible)continue;
    const start=horizontal?rect.left:rect.top,end=horizontal?rect.right:rect.bottom;
    const distance=point<start?start-point:point>end?point-end:0;
    if(!best||distance<best.distance)best={element:view.element,top:rect.top,left:rect.left,distance};
  }
  return best;
}

export function preserveContinuousLayout(manager,change){
  if(!manager?.container||isContinuousDestroyed(manager)||transactions.has(manager))return change();
  transactions.add(manager);
  let anchor=null;const generation=continuousGeneration(manager);
  try{
    anchor=(!document.body.classList.contains('reader-image-focused')&&contentLayoutAnchor(manager))||visibleView(manager);
    return change();
  }
  finally{
    transactions.delete(manager);
    if(anchor&&anchor.element.isConnected!==false&&!isContinuousDestroyed(manager)&&generation===continuousGeneration(manager)){
      const rect=anchor.element.getBoundingClientRect();
      const top=anchor.node?.isConnected?anchor.frame.getBoundingClientRect().top+anchor.node.getBoundingClientRect().top:rect.top;
      const delta=manager.settings?.axis==='horizontal'?rect.left-anchor.left:top-anchor.top;
      if(Number.isFinite(delta)&&Math.abs(delta)>=.5){
        manager.ignore=true;
        if(manager.settings?.fullsize){
          window.scrollBy(manager.settings.axis==='horizontal'?delta:0,manager.settings.axis==='horizontal'?0:delta);
        }else if(manager.settings?.axis==='horizontal')manager.container.scrollLeft+=delta;
        else manager.container.scrollTop+=delta;
      }
    }
    const position=manager.syncScrollPosition?.();
    if(position){manager.prevScrollTop=position.top;manager.prevScrollLeft=position.left}
    rememberContinuousLayout(manager);
  }
}

// The pinned EPUB.js IframeView render path, kept in one observed promise.
// Retain Section rendering until it settles; a cancelled view must not unload
// source DOM that its serialization hooks are still using.
async function renderContinuousView(view,lifetime,request){
  try{
    view.create();view.size();
    view.sectionRender ||= view.section.render(request);
    const source=await view.sectionRender;
    lifetime.signal.throwIfAborted();
    await view.load(source);
    lifetime.signal.throwIfAborted();
    const writingMode=view.contents.writingMode(),vertical=writingMode.startsWith('vertical');
    const axis=view.settings.flow==='scrolled'?(vertical?'horizontal':'vertical'):(vertical?'vertical':'horizontal');
    if(vertical&&view.settings.flow==='paginated')view.layout.delta=view.layout.height;
    view.setAxis(axis);view.emit('axis',axis);
    view.setWritingMode(writingMode);view.emit('writingMode',writingMode);
    view.layout.format(view.contents,view.section,view.axis);
    view.addListeners();view.expand();
    if(view.settings.forceRight)view.element.style.marginLeft=`${view.width()}px`;
    view.emit('rendered',view.section);
  }catch(error){if(!lifetime.disposed)view.emit?.('loaderror',error);throw error}
}

export function ownContinuousViewLayout(manager,view){
  if(!view||wrappedViews.has(view)||typeof view.reframe!=='function')return view;
  wrappedViews.add(view);
  // EPUB.js destroy() does not tear down a view whose first render is still
  // pending. Keep its source lease until that vendor work settles, but close
  // its ownership boundary immediately and prevent late iframe loads/events.
  const destroy=view.destroy,display=view.display,render=view.render,load=view.load,onLoad=view.onLoad,emit=view.emit;
  let rendering=null,cleaned=false,destroyArgs=[];
  const cleanup=()=>{
    if(cleaned)return;cleaned=true;
    const frame=view.iframe;
    if(!view.displayed&&view.contents&&frame)view.displayed=true;
    try{destroy?.apply(view,destroyArgs)}
    finally{
      if(frame){frame.onload=null;frame.remove?.()}
      if(view.iframe===frame)view.iframe=undefined;
    }
  };
  view.destroy=function(...args){destroyArgs=args;if(!rendering)cleanup()};
  const lifetime=readerInstanceScope(view).link(readerInstanceScope(manager));
  if(typeof emit==='function')view.emit=lifetime.guard(emit);
  if(typeof onLoad==='function')view.onLoad=lifetime.guard(onLoad);
  if(typeof load==='function')view.load=function(...args){
    if(lifetime.disposed)return Promise.reject(readerAbortError());
    return lifetime.wait(load.apply(this,args));
  };
  if(typeof display==='function')view.display=function(...args){
    if(lifetime.disposed)return Promise.reject(readerAbortError());
    if(!rendering){
      rendering=Promise.resolve().then(async()=>{
        lifetime.signal.throwIfAborted();
        if(typeof render!=='function')return display.apply(this,args);
        if(!this.displayed){
          // Own the complete render/display promise chain, including rejection
          // when a first iframe load is cancelled during teardown.
          await renderContinuousView(this,lifetime,args[0]);
          lifetime.signal.throwIfAborted();
          this.emit?.('displayed',this);this.onDisplayed?.(this);this.displayed=true;
        }
        return this;
      }).finally(()=>{rendering=null;if(lifetime.disposed)cleanup()});
    }
    return lifetime.wait(rendering);
  };
  const reframe=view.reframe;
  view.reframe=function(...args){if(!lifetime.disposed)return preserveContinuousLayout(manager,()=>reframe.apply(this,args))};
  return view;
}

export function installContinuousLayout(manager){
  if(typeof manager.createView==='function'){
    const createView=manager.createView;
    manager.createView=function(...args){return ownContinuousViewLayout(manager,createView.apply(this,args))};
  }
  for(const view of manager.views?.all?.()||[])ownContinuousViewLayout(manager,view);
  for(const name of ['prepend','append','erase']){
    const mutate=manager[name];
    if(typeof mutate==='function')manager[name]=function(...args){
      return preserveContinuousLayout(manager,()=>{
        try{return mutate.apply(this,args)}
        finally{if(name==='erase')args[0]?.destroy?.()}
      });
    };
  }
  const clear=manager.clear;
  if(typeof clear==='function')manager.clear=function(...args){
    const views=[...(this.views?.all?.()||[])];
    try{return clear.apply(this,args)}
    finally{for(const view of views)view.destroy?.()}
  };
  // Prepend compensation belongs to each live layout transaction, rather than
  // an unconditional counter attached permanently to every prepended view.
  manager.counter=()=>{};

  if(typeof manager.currentLocation==='function'){
    const currentLocation=manager.currentLocation;
    manager.currentLocation=function(...args){
      if(!this.isPaginated&&typeof this.scrolledLocation==='function')return this.location=this.scrolledLocation();
      return currentLocation.apply(this,args);
    };
  }

  if(typeof manager.resize==='function'){
    const resize=manager.resize;
    manager.resize=function(...args){
      const previous=this._stageSize;
      if(previous&&!this.isPaginated&&this.settings?.axis==='vertical'&&!this.settings.fullsize&&this.stage?.size){
        const next=this.stage.size(args[0],args[1]);
        if(Math.abs(next.width-previous.width)<=1){
          // Browser chrome changes the available height while scrolling. Width
          // and text wrapping are unchanged, so retain the live documents.
          this._stageSize=next;this._bounds=this.bounds();
          this.layout?.calculate?.(next.width,next.height);
          if(this.viewSettings)this.viewSettings.height=next.height;
          return;
        }
      }
      return resize.apply(this,args);
    };
  }
}
