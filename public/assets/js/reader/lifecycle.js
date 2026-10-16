import {recordReaderDiagnostic} from './diagnostics.js';
/* Resource ownership for reader sessions, controllers and EPUB instances. */
export function readerAbortError(){return new DOMException("Reader disposed", "AbortError")}

export function createReaderScope(){
  const controller=new AbortController(),cleanups=new Set(),timers=new Map(),frames=new Map();
  const scope={
    signal:controller.signal,
    get disposed(){return controller.signal.aborted},
    add(cleanup){
      let active=true;
      const release=()=>{
        if(!active)return;
        active=false;cleanups.delete(release);
        cleanup();
      };
      release.forget=()=>{active=false;cleanups.delete(release)};
      if(scope.disposed)release();else cleanups.add(release);
      return release;
    },
    child(){
      const child=createReaderScope(),release=scope.add(()=>child.dispose());
      child.add(release.forget);
      return child;
    },
    link(owner){const release=owner.add(()=>scope.dispose());scope.add(release.forget);return scope},
    guard(callback){return function(...args){if(!scope.disposed)return callback.apply(this,args)}},
    listen(target,type,callback,options){
      if(scope.disposed||!target?.addEventListener)return()=>{};
      const listener=scope.guard(callback);
      target.addEventListener(type,listener,options);
      return scope.add(()=>target.removeEventListener(type,listener,options));
    },
    on(emitter,event,callback){
      if(scope.disposed||!emitter?.on)return()=>{};
      const listener=scope.guard(callback);
      emitter.on(event,listener);
      return scope.add(()=>emitter.off?.(event,listener));
    },
    hook(hook,callback){
      if(scope.disposed||!hook?.register)return()=>{};
      const listener=scope.guard(callback);
      hook.register(listener);
      return scope.add(()=>hook.deregister?.(listener));
    },
    timeout(callback,delay=0){
      if(scope.disposed)return 0;
      const id=setTimeout(()=>{release();if(!scope.disposed)callback()},delay);
      const release=scope.add(()=>{clearTimeout(id);timers.delete(id)});
      timers.set(id,release);
      return id;
    },
    clearTimeout(id){timers.get(id)?.()},
    interval(callback,delay){
      if(scope.disposed)return 0;
      const id=setInterval(scope.guard(callback),delay);
      scope.add(()=>clearInterval(id));
      return id;
    },
    frame(callback){
      if(scope.disposed)return 0;
      const id=requestAnimationFrame(time=>{release.forget();frames.delete(id);if(!scope.disposed)callback(time)});
      const release=scope.add(()=>{cancelAnimationFrame(id);frames.delete(id)});
      frames.set(id,release);
      return id;
    },
    cancelFrame(id){frames.get(id)?.()},
    paint(){return scope.wait(new Promise(resolve=>scope.frame(()=>scope.frame(resolve))))},
    observe(observer,target,options){
      if(scope.disposed||!target){observer.disconnect();return observer}
      observer.observe(target,options);scope.add(()=>observer.disconnect());
      return observer;
    },
    wait(promise){
      if(scope.disposed){Promise.resolve(promise).catch(()=>{});return Promise.reject(readerAbortError())}
      return new Promise((resolve,reject)=>{
        const onAbort=()=>{scope.signal.removeEventListener("abort",onAbort);reject(readerAbortError())};
        scope.signal.addEventListener("abort",onAbort,{once:true});
        const release=()=>scope.signal.removeEventListener("abort",onAbort);
        Promise.resolve(promise).then(value=>{release();if(!scope.disposed)resolve(value)},error=>{release();reject(error)});
      });
    },
    dispose(){
      if(scope.disposed)return;
      controller.abort();
      // Release children and late-installed resources before their owners.
      for(const release of [...cleanups].reverse()){
        try{release()}catch(error){recordReaderDiagnostic('lifecycle.cleanupFailed')}
      }
    }
  };
  return scope;
}

const instanceScopes=new WeakMap();

// Install once, before feature extensions wrap destroy(). Instance patches live
// for the vendor runtime; the resources they own live only for this instance.
export function readerInstanceScope(instance){
  if(!instance)throw new TypeError("A reader instance is required");
  let scope=instanceScopes.get(instance);
  if(scope)return scope;
  scope=createReaderScope();instanceScopes.set(instance,scope);
  const destroy=instance.destroy;
  let destroyed=false;
  instance.destroy=function(...args){
    if(destroyed)return;
    destroyed=true;scope.dispose();
    return destroy?.apply(this,args);
  };
  return scope;
}

// A view can be trimmed before its rendition closes. Its iframe listeners and
// delayed layout work must be released at that earlier boundary.
export function readerContentsScope(rendition,contents,view){
  const owner=contents||view;
  const scope=readerInstanceScope(owner);
  if(!scope.parentAttached){
    scope.parentAttached=true;
    const parent=readerInstanceScope(rendition),release=parent.add(()=>scope.dispose());
    scope.add(release.forget);
  }
  return scope;
}
