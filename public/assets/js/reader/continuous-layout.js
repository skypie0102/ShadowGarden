/* Continuous structural layout changes preserve the live viewport synchronously.
   Never retain a screen coordinate across a chapter load or an animation frame:
   the reader can continue scrolling while that work is pending. */
import {readerAbortError,readerInstanceScope} from './lifecycle.js';
const transactions=new WeakSet();
const wrappedViews=new WeakSet();

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
  if(!manager?.container||manager.__sgDestroyed||transactions.has(manager))return change();
  const anchor=visibleView(manager),generation=manager.__sgGeneration;
  transactions.add(manager);
  try{return change()}
  finally{
    transactions.delete(manager);
    if(anchor&&anchor.element.isConnected!==false&&!manager.__sgDestroyed&&generation===manager.__sgGeneration){
      const rect=anchor.element.getBoundingClientRect();
      const delta=manager.settings?.axis==='horizontal'?rect.left-anchor.left:rect.top-anchor.top;
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
  }
}

export function ownContinuousViewLayout(manager,view){
  if(!view||wrappedViews.has(view)||typeof view.reframe!=='function')return view;
  wrappedViews.add(view);
  // EPUB.js destroy() does not tear down a view whose first render is still
  // pending. Keep its source lease until that vendor work settles, but close
  // its ownership boundary immediately and prevent late iframe loads/events.
  const destroy=view.destroy,display=view.display,load=view.load,onLoad=view.onLoad,emit=view.emit;
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
      this.onDisplayed=lifetime.guard(this.onDisplayed);
      rendering=Promise.resolve().then(()=>{
        lifetime.signal.throwIfAborted();return display.apply(this,args);
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
