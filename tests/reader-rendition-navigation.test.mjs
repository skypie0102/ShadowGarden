import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayRenditionTarget} from '../public/assets/js/reader/rendition.js';
import {beginRenditionNavigation,runRenditionMove} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('a missing saved CFI falls back to the first readable content while startup owns navigation',async()=>{
  const calls=[],rendition={display:target=>{calls.push(target);if(target)throw Error('Missing saved target')}};
  assert.deepEqual(await displayRenditionTarget(rendition,'epubcfi(missing)'),{fallback:true});
  assert.deepEqual(calls,['epubcfi(missing)',undefined]);
});

test('a failed obsolete startup display cannot return to the first chapter after a newer selection',async()=>{
  const failed=deferred(),calls=[];
  const rendition={display:target=>{calls.push(target);return target==='old.xhtml'?failed.promise:undefined}};
  const starting=displayRenditionTarget(rendition,'old.xhtml');await tick();
  const latest=beginRenditionNavigation(rendition);
  const navigating=runRenditionMove(rendition,latest,()=>rendition.display('latest.xhtml'));
  failed.reject(Error('Old chapter unavailable'));
  assert.equal((await starting).cancelled,true);await navigating;
  assert.deepEqual(calls,['old.xhtml','latest.xhtml']);
});

test('a startup fallback failure propagates the original saved-target failure as its cause',async()=>{
  const initial=Error('Saved CFI failed'),fallback=Error('Book failed');
  const rendition={display:target=>{throw target?initial:fallback}};
  await assert.rejects(displayRenditionTarget(rendition,'epubcfi(missing)'),error=>error===fallback&&error.cause===initial);
});
