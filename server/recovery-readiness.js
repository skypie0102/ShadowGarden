import {fail,json,method} from './http.js';
import {requireAdmin} from './security.js';
import {counts,inspectSnapshot,loadStateRecord,recoverySnapshots,snapshotRecord} from './state.js';
import {inspectCatalog} from './catalog-document.js';
import {health} from './catalog-health.js';
import {getObject,getStaticCover,objectKey} from './storage.js';

const READINESS_LIMIT_MS=20000;
function readinessBudget(parent){
  const timeout=new AbortController(),signal=AbortSignal.any([parent,timeout.signal]);
  const timer=setTimeout(()=>timeout.abort(new DOMException('Recovery readiness reached its time limit.','TimeoutError')),READINESS_LIMIT_MS);
  return{
    signal,
    timedOut:()=>timeout.signal.aborted,
    async run(operation){
      signal.throwIfAborted();let onAbort;
      const aborted=new Promise((_,reject)=>{onAbort=()=>reject(signal.reason);signal.addEventListener('abort',onAbort,{once:true});});
      // The race bounds binding/provider implementations that ignore abort.
      // Observe late rejection and release a late Response instead of accepting it.
      const work=Promise.resolve().then(()=>{signal.throwIfAborted();return operation();}).then(async value=>{
        if(signal.aborted){try{await value?.body?.cancel?.();}catch{}signal.throwIfAborted();}
        return value;
      });
      try{return await Promise.race([work,aborted]);}
      finally{signal.removeEventListener('abort',onAbort);}
    },
    dispose:()=>clearTimeout(timer)
  };
}

export async function checkObjects(env,keys,{includeAssets=false,origin,signal}={}){
  const missing=[];
  for(const key of keys){
    signal?.throwIfAborted();objectKey(key);
    const found=(includeAssets&&await getStaticCover(env,key,{head:true,origin,signal}))||await getObject(env,key,{head:true,signal});
    if(!found)missing.push({key});
    else{try{await found.body?.cancel();}catch{}signal?.throwIfAborted();if(!found.ok)fail(502,'storage_error','Media presence could not be verified.');}
  }
  return{checked:keys.length,missing};
}

export async function readiness(context){
  method(context.request,['GET']);
  const budget=readinessBudget(context.request.signal);
  try{
    await budget.run(()=>requireAdmin(context));
    const row=await budget.run(()=>loadStateRecord(context.env));
    const live=inspectCatalog(row.serialized),{entries:saved,total}=await budget.run(()=>recoverySnapshots(context.env));
    let verified=0,damaged=0,uncertain=0,stale=0,inspected=0,anchor=null,candidate=null;
    // Three metadata candidates, one full document at a time, at most 75 media keys.
    for(const metadata of saved){
      if(budget.signal.aborted)break;
      inspected++;let snapshot,result;
      try{
        snapshot=await budget.run(()=>snapshotRecord(context.env,metadata.id));
        if(!snapshot){uncertain++;continue;}
        result=await budget.run(()=>inspectSnapshot(snapshot));
      }catch(error){if(!budget.signal.aborted)throw error;uncertain++;break;}
      if(result.error){damaged++;continue;}
      verified++;const report=health(result.document,{includeTrash:true});
      const choice={id:snapshot.id,sha256:snapshot.sha256,reason:snapshot.reason,createdAt:snapshot.created_at,counts:counts(result.document),mediaStatus:'unverified'};
      candidate ||= choice;
      if(report.metrics.missingBookMappings){choice.mediaStatus='incomplete';stale++;continue;}
      if(report.objectKeys.length>25){uncertain++;continue;}
      try{
        const checked=await budget.run(()=>checkObjects(context.env,report.objectKeys,{includeAssets:true,origin:new URL(context.request.url).origin,signal:budget.signal}));
        if(!checked.missing.length){choice.mediaStatus='complete';candidate=choice;anchor={...choice,verified:true,objectCount:checked.checked};break;}
        choice.mediaStatus='incomplete';stale++;
      }catch{uncertain++;}
    }
    context.request.signal.throwIfAborted();
    uncertain+=total-inspected;
    const exhausted=budget.timedOut();
    const detail=exhausted?'The recovery check reached its time limit before a complete snapshot could be proven. Try again or inspect Catalog History.':
      live.error?(anchor?'The live catalog is damaged. A verified recovery snapshot is available in Catalog History.':'The live catalog is damaged and no object-complete recovery snapshot was proven. Inspect Catalog History and restore missing media separately.'):
      anchor?'A validated snapshot with all active and trashed media was verified.':
      uncertain?'No object-complete recovery snapshot was proven. Some checks could not finish; try again or inspect Catalog History.':
      'No object-complete recovery snapshot was proven. Missing mappings or media must be restored separately.';
    return json({ok:true,revision:row.revision,summary:{total,verified,damaged},
      live:{entries:['main','adult'].map(scope=>({scope,readable:!live.error,detail:live.error||`${live.document[scope].length} series; ${row.source}`}))},
      readiness:{status:live.error?'recovery-required':anchor?'ready':'not-ready',anchor,candidate,staleSnapshots:stale,uncertainSnapshots:uncertain,
        budget:{limitMs:READINESS_LIMIT_MS,exhausted},detail}});
  }catch(error){
    if(context.request.signal.aborted)fail(408,'readiness_cancelled','The recovery check was cancelled. Run it again.');
    if(budget.timedOut())fail(408,'readiness_timeout','The recovery check reached its time limit. Try again.');
    throw error;
  }finally{budget.dispose();}
}
