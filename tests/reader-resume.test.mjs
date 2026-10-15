import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReaderResumeController} from '../public/assets/js/reader/resume-controller.js';
import {beginRenditionNavigation,holdRenditionNavigation,runRenditionMove} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t,options={}){
  const calls=[],position={cfi:'epubcfi(old)'},rendition={display:target=>calls.push(target)};
  const previous=globalThis.requestAnimationFrame,previousCancel=globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame=()=>{};
  globalThis.requestAnimationFrame=callback=>{queueMicrotask(()=>callback(0));return 1};
  t.after(()=>{if(previous)globalThis.requestAnimationFrame=previous;else delete globalThis.requestAnimationFrame;if(previousCancel)globalThis.cancelAnimationFrame=previousCancel;else delete globalThis.cancelAnimationFrame});
  const controller=createReaderResumeController({getRendition:()=>rendition,getFlow:()=> 'paginated',getPosition:()=>position,capturePosition:()=>({...position}),resizeRendition:()=>calls.push('resize'),...options});
  return{controller,rendition,calls,position};
}

test('resume waiting for access renewal cannot move the reader after a newer user navigation',async t=>{
  const renewed=deferred(),f=fixture(t,{renewAccess:()=>renewed.promise});
  await f.controller.capture();const restoring=f.controller.restore();await tick();
  const explicit=beginRenditionNavigation(f.rendition);
  await runRenditionMove(f.rendition,explicit,()=>f.rendition.display('latest.xhtml'));
  renewed.resolve();assert.equal(await restoring,false);
  assert.deepEqual(f.calls,['latest.xhtml']);
});

test('a delayed semantic capture cannot replace the position remembered after navigation',async t=>{
  const captured=deferred(),f=fixture(t,{capturePosition:()=>captured.promise});
  const capturing=f.controller.capture(),restoring=f.controller.restore();
  beginRenditionNavigation(f.rendition);f.position.cfi='epubcfi(latest)';f.controller.remember();
  captured.resolve({cfi:'epubcfi(old)'});
  assert.equal((await capturing).cfi,'epubcfi(latest)');assert.equal(await restoring,false);
  assert.deepEqual(f.calls,[]);
});

test('a pre-navigation lifecycle snapshot is discarded before renewal or geometry changes',async t=>{
  let renewals=0;const f=fixture(t,{renewAccess:()=>{renewals++}});
  await f.controller.capture();beginRenditionNavigation(f.rendition);
  assert.equal(await f.controller.restore(),false);
  assert.equal(renewals,0);assert.deepEqual(f.calls,[]);
});

test('a restore already displaying cannot perform a later move after explicit navigation',async t=>{
  const displaying=deferred(),f=fixture(t);
  f.rendition.display=target=>{f.calls.push(target);return target==='epubcfi(old)'?displaying.promise:undefined};
  await f.controller.capture();const restoring=f.controller.restore();await tick();
  const explicit=beginRenditionNavigation(f.rendition);
  const navigating=runRenditionMove(f.rendition,explicit,()=>f.rendition.display('latest.xhtml'));
  displaying.resolve();assert.equal(await restoring,false);await navigating;
  assert.deepEqual(f.calls,['resize','epubcfi(old)','latest.xhtml']);
});

test('an unchanged Continuous lifecycle snapshot does not request semantic capture or display',async t=>{
  let captured=0;const f=fixture(t,{getFlow:()=> 'scrolled-doc',capturePosition:()=>{captured++}});
  await f.controller.capture({semantic:false});assert.equal(await f.controller.restore(),true);
  assert.equal(captured,0);assert.deepEqual(f.calls,[]);
});

test('recovery cannot cancel a user seek that was still pending when suspension captured it',async t=>{
  let captures=0,renewals=0;
  const f=fixture(t,{capturePosition:()=>{captures++},renewAccess:()=>{renewals++}});
  const seeking=deferred(),operation=beginRenditionNavigation(f.rendition,{kind:'seek'});
  const barrier=holdRenditionNavigation(f.rendition,seeking.promise,{signal:operation.signal});
  await f.controller.capture();assert.equal(await f.controller.restore(),false);
  assert.equal(operation.isCurrent(),true);assert.equal(captures,0);assert.equal(renewals,0);
  seeking.resolve();await barrier;
});

test('resume geometry waits for an already-running vendor display instead of resizing it mid-move',async t=>{
  const f=fixture(t),displaying=deferred();
  await f.controller.capture();
  const old=beginRenditionNavigation(f.rendition);
  const moving=runRenditionMove(f.rendition,old,()=>displaying.promise);
  await tick();
  // This fresh lifecycle snapshot is taken after the earlier request. The
  // in-flight move still has to finish before resize can touch its manager.
  const capture=f.controller.capture();await tick();
  assert.deepEqual(f.calls,[]);
  displaying.resolve();await moving;await capture;
  assert.equal(await f.controller.restore(),true);
  assert.deepEqual(f.calls,['resize','epubcfi(old)']);
});

test('disposing resume recovery settles its access wait without moving the closed rendition',async t=>{
  const renewal=deferred(),f=fixture(t,{renewAccess:()=>renewal.promise});
  await f.controller.capture();const restoring=f.controller.restore();await tick();
  f.controller.dispose();assert.equal(await restoring,false);assert.equal(f.controller.isRestoring(),false);
  renewal.resolve();await tick();assert.deepEqual(f.calls,[]);
});

test('disposing a pending semantic capture prevents it from remembering a closed book',async t=>{
  const captured=deferred(),f=fixture(t,{capturePosition:()=>captured.promise});
  const capturing=f.controller.capture();await tick();f.controller.dispose();captured.resolve({cfi:'epubcfi(stale)'});
  assert.equal(await capturing,null);assert.equal(await f.controller.restore(),false);assert.deepEqual(f.calls,[]);
});
