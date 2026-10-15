import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginRenditionNavigation,holdRenditionNavigation,registerRenditionNavigator,navigateRendition,runRenditionMove,waitForRenditionNavigation} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('internal navigation delegates to the application instead of bypassing its position state',async()=>{
  const calls=[],rendition={display(){throw Error('Direct display bypassed application navigation');}};
  registerRenditionNavigator(rendition,async target=>{calls.push(target);return 'settled';});
  assert.equal(await navigateRendition(rendition,'chapter4.xhtml#target-4'),'settled');
  assert.deepEqual(calls,['chapter4.xhtml#target-4']);
});

test('old navigation cleanup cannot remove a replacement owner',async()=>{
  const rendition={display:()=> 'vendor'},old=registerRenditionNavigator(rendition,()=> 'old');
  const current=registerRenditionNavigator(rendition,()=> 'current');old();
  assert.equal(await navigateRendition(rendition,'chapter.xhtml'),'current');
  current();assert.equal(await navigateRendition(rendition,'chapter.xhtml'),'vendor');
});

test('a content extension without an app owner retains standalone navigation',async()=>{
  let calls=0;const rendition={display:target=>{calls++;return target;}};
  assert.equal(await navigateRendition(rendition,'chapter.xhtml'),'chapter.xhtml');
  assert.equal(await navigateRendition(rendition,''),false);assert.equal(await navigateRendition(null,'chapter.xhtml'),false);
  assert.equal(calls,1);
});

test('a newer target runs after an in-flight vendor move and stale queued moves are skipped',async()=>{
  const rendition={},first=deferred(),calls=[];
  let active=0,maxActive=0;
  const old=beginRenditionNavigation(rendition);
  const moving=runRenditionMove(rendition,old,async()=>{calls.push('old');maxActive=Math.max(maxActive,++active);await first.promise;active--});
  await tick();
  const skipped=runRenditionMove(rendition,old,()=>calls.push('obsolete retry'));
  const current=beginRenditionNavigation(rendition);
  const latest=runRenditionMove(rendition,current,()=>{calls.push('latest');maxActive=Math.max(maxActive,++active);active--});
  assert.equal(old.signal.aborted,true);assert.deepEqual(calls,['old']);
  first.resolve();
  assert.equal(await moving,false);assert.equal(await skipped,false);assert.equal(await latest,true);
  assert.deepEqual(calls,['old','latest']);assert.equal(maxActive,1);
});

test('a failed vendor move does not block subsequent navigation',async()=>{
  const rendition={},old=beginRenditionNavigation(rendition);
  await assert.rejects(runRenditionMove(rendition,old,()=>{throw Error('display failed')}),/display failed/);
  let moved=false;const current=beginRenditionNavigation(rendition);
  assert.equal(await runRenditionMove(rendition,current,()=>{moved=true}),true);
  assert.equal(moved,true);
});

test('the navigation barrier retains every active move when a later one finishes first',async()=>{
  const rendition={},first=deferred(),second=deferred();
  holdRenditionNavigation(rendition,first.promise);holdRenditionNavigation(rendition,second.promise);
  let done=false;const waiting=waitForRenditionNavigation(rendition).then(()=>{done=true});
  second.resolve();await tick();assert.equal(done,false);
  first.resolve();await waiting;assert.equal(done,true);
});

test('superseding a navigation releases its barrier without waiting for a stalled provider',async()=>{
  const rendition={},stalled=deferred(),old=beginRenditionNavigation(rendition);
  holdRenditionNavigation(rendition,stalled.promise,{signal:old.signal});
  const waiting=waitForRenditionNavigation(rendition);
  beginRenditionNavigation(rendition);await waiting;
  assert.equal(old.isCurrent(),false);
});
