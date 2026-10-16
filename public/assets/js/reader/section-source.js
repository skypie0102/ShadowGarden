import {recordReaderDiagnostic} from './diagnostics.js';

// A Section's parsed source is distinct from its rendered iframe document.
// Every live view and temporary reader (search, note, location generation or CFI
// resolution) holds a lease, so one consumer cannot unload another's source.
const sources=new WeakMap();
const ownedViews=new WeakSet();

function sourceState(section){
  if(sources.has(section))return sources.get(section);
  const load=section.load,unload=section.unload;
  const state={users:0,pending:null,releaseRequested:false};
  const flush=()=>{
    if(!state.releaseRequested||state.users||state.pending)return;
    state.releaseRequested=false;
    if(section.document||section.contents||section.output){
      unload?.call(section);
      recordReaderDiagnostic('source.released');
    }
  };
  if(typeof load==='function')section.load=function(...args){
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
  state.flush=flush;
  sources.set(section,state);
  return state;
}

export function retainSectionSource(section){
  const state=sourceState(section);
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
  locations.process=function(section,...args){
    const release=retainSectionSource(section);
    return Promise.resolve().then(()=>process.call(this,section,...args)).finally(release);
  };
}
