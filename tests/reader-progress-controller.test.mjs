import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createProgressController} from '../public/assets/js/reader/progress-controller.js';
import {beginRenditionNavigation,cancelRenditionNavigation,registerRenditionNavigator} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t,pageMap){
  const generated=deferred(),calls=[];
  const book={ready:Promise.resolve(),spine:{spineItems:Array.from({length:10},(_,index)=>({href:`chapter${index}.xhtml`}))},locations:{generate:()=>generated.promise,cfiFromPercentage:value=>`epubcfi(${value})`}};
  const rendition={display(){throw Error('Seek bypassed the app navigator')}};
  const current={book,rendition};
  const cleanup=registerRenditionNavigator(rendition,async(target,{operation})=>{if(operation.isCurrent())calls.push(target);return operation.isCurrent()});
  const controller=createProgressController({storage:{},elements:{},getBook:()=>current.book,getRendition:()=>current.rendition,getPageMap:()=>pageMap});
  t.after(()=>{cancelRenditionNavigation(rendition);cleanup()});
  return{controller,generated,calls,current,rendition};
}

test('an older asynchronous page-map seek cannot overwrite a newer seek',async t=>{
  const first=deferred(),second=deferred();
  const f=fixture(t,{hasCompleteMap:()=>true,targetForPercentage:value=>value<.5?first.promise:second.promise});
  const old=f.controller.seekTo(.2,true),latest=f.controller.seekTo(.8,true);
  second.resolve('latest.xhtml');await latest;
  first.resolve('old.xhtml');await old;await tick();
  assert.deepEqual(f.calls,['latest.xhtml']);
});

test('a late failed page-map resolution cannot trigger fallback after explicit chapter navigation',async t=>{
  const target=deferred(),f=fixture(t,{hasCompleteMap:()=>true,targetForPercentage:()=>target.promise});
  const seeking=f.controller.seekTo(.2,true);
  beginRenditionNavigation(f.rendition);
  target.reject(Error('old map failed'));await seeking;await tick();
  assert.deepEqual(f.calls,[]);
});

test('location generation cannot replay an old seek after explicit navigation',async t=>{
  const f=fixture(t,{hasCompleteMap:()=>false});
  f.controller.startLocationGeneration();
  const seeking=f.controller.seekTo(.2,true);await tick();
  assert.deepEqual(f.calls,['chapter2.xhtml']);
  beginRenditionNavigation(f.rendition);
  f.generated.resolve();await seeking;await tick();
  assert.deepEqual(f.calls,['chapter2.xhtml']);
  assert.equal(f.controller.locationsReady(),true);
});

test('only the most recent seek is refined when generated locations become ready',async t=>{
  const f=fixture(t,{hasCompleteMap:()=>false});
  f.controller.startLocationGeneration();
  const old=f.controller.seekTo(.2,true);await tick();
  const latest=f.controller.seekTo(.8,true);await tick();
  f.generated.resolve();await latest;await old;
  assert.deepEqual(f.calls,['chapter2.xhtml','chapter8.xhtml','epubcfi(0.8)']);
});

test('a seek resolving for a replaced rendition is discarded',async t=>{
  const target=deferred(),f=fixture(t,{hasCompleteMap:()=>true,targetForPercentage:()=>target.promise});
  const seeking=f.controller.seekTo(.6,true);
  f.current.rendition={};target.resolve('old-rendition.xhtml');await seeking;
  assert.deepEqual(f.calls,[]);
});

test('a stalled location generator stops holding the seek barrier after the refinement window',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture(t,{hasCompleteMap:()=>false});
  f.controller.startLocationGeneration();
  const seeking=f.controller.seekTo(.2,true);await tick();
  t.mock.timers.tick(10001);await seeking;
  f.generated.resolve();await tick();
  assert.deepEqual(f.calls,['chapter2.xhtml']);
});

test('an invalid generated CFI uses the spine fallback instead of displaying the sentinel',async t=>{
  const f=fixture(t,{hasCompleteMap:()=>false});
  f.current.book.locations.cfiFromPercentage=()=>'-1';
  f.controller.startLocationGeneration();f.generated.resolve();await tick();
  await f.controller.seekTo(.6,true);
  assert.deepEqual(f.calls,['chapter6.xhtml']);
});
