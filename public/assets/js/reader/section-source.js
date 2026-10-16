import {recordReaderDiagnostic} from './diagnostics.js';
import {readerInstanceScope} from './lifecycle.js';

// A Section's parsed source is distinct from its rendered iframe document.
// Every live view and temporary reader (search, note, location generation or CFI
// resolution) holds a lease, so one consumer cannot unload another's source.
const sources=new WeakMap();
const ownedViews=new WeakSet();

function sourceState(section){
  if(sources.has(section))return sources.get(section);
  const load=section.load,unload=section.unload,destroy=section.destroy;
  const state={users:0,pending:null,releaseRequested:false,destroyRequested:false,destroyed:false,destroyArgs:[]};
  const flush=()=>{
    if(state.users||state.pending)return;
    if(state.destroyRequested&&!state.destroyed){
      state.destroyed=true;
      destroy?.apply(section,state.destroyArgs);
      return;
    }
    if(!state.releaseRequested)return;
    state.releaseRequested=false;
    if(section.document||section.contents||section.output){
      unload?.call(section);
      recordReaderDiagnostic('source.released');
    }
  };
  if(typeof load==='function')section.load=function(...args){
    if(state.destroyRequested)return Promise.reject(Object.assign(new Error('EPUB section is disposed'),{name:'AbortError'}));
    if(state.pending){
      recordReaderDiagnostic('source.joined');
      return state.pending;
    }
    const promise=Promise.resolve(load.apply(this,args));
    state.pending=promise;
    const settled=()=>{
      if(state.pending!==promise)return;
      state.pending=null;
      flush();
    };
    promise.then(settled,settled);
    return promise;
  };
  section.unload=function(){
    state.releaseRequested=true;
    flush();
  };
  if(typeof destroy==='function')section.destroy=function(...args){
    if(state.destroyRequested)return;
    state.destroyRequested=true;state.destroyArgs=args;
    // Section.load's vendor continuation still reads its hooks after the
    // request resolves. Keep them until pending loads/read leases settle, then
    // destroy once; new work fails immediately at this closed boundary.
    flush();
  };
  state.flush=flush;
  sources.set(section,state);
  return state;
}

export function retainSectionSource(section){
  const state=sourceState(section);
  if(state.destroyRequested)throw Object.assign(new Error('EPUB section is disposed'),{name:'AbortError'});
  state.users++;
  let released=false;
  return()=>{
    if(released)return;
    released=true;
    state.users--;
    state.releaseRequested=true;
    state.flush();
  };
}

export async function withSectionSource(section,request,read){
  const release=retainSectionSource(section),state=sourceState(section);
  try{
    if(state.pending)await state.pending;
    else if(!section.document)await section.load(request);
    return await read(section.document);
  }finally{release()}
}

export function ownViewSource(view,section){
  if(ownedViews.has(view))return view;
  ownedViews.add(view);
  const release=retainSectionSource(section),destroy=view.destroy;
  view.destroy=function(...args){
    try{
      return destroy?.apply(this,args);
    }finally{
      release();
    }
  };
  return view;
}

export function ownLocationSources(book){
  const locations=book?.locations,process=locations?.process;
  if(typeof process!=='function')return;
  if(typeof locations.generate==='function'&&typeof locations.parse==='function'){
    const scope=readerInstanceScope(locations),owner=readerInstanceScope(book);
    const release=owner.add(()=>scope.dispose());scope.add(release.forget);
    let generation=null;
    locations.process=async function(section){
      scope.signal.throwIfAborted();
      const parts=await scope.wait(withSectionSource(section,this.request,document=>{
        scope.signal.throwIfAborted();
        const result=this.parse(document.documentElement,section.cfiBase);
        this._locations=this._locations.concat(result);
        return result;
      }));
      await scope.wait(new Promise(resolve=>scope.timeout(resolve,Math.max(0,Number(this.pause)||0))));
      return parts;
    };
    locations.generate=function(chars){
      if(scope.disposed)return Promise.reject(Object.assign(new Error('EPUB locations are disposed'),{name:'AbortError'}));
      if(generation)return generation;
      if(chars)this.break=chars;
      // The vendor queue does not cancel its in-flight process() continuation
      // when destroy clears _locations. Own the sequential work explicitly,
      // retaining vendor parsing and pacing while making every await cancellable.
      this.q?.stop?.();
      const sections=[];this.spine.each(section=>{if(section.linear)sections.push(section)});
      generation=(async()=>{
        for(const section of sections)await this.process(section);
        scope.signal.throwIfAborted();
        this.total=this._locations.length-1;
        if(this._currentCfi)this.currentLocation=this._currentCfi;
        return this._locations;
      })();
      const clear=()=>{generation=null};generation.then(clear,clear);
      return generation;
    };
    return;
  }
  locations.process=function(section,...args){
    const release=retainSectionSource(section);
    return Promise.resolve().then(()=>process.call(this,section,...args)).finally(release);
  };
}
