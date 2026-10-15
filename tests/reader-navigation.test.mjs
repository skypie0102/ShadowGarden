import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerRenditionNavigator,navigateRendition} from '../public/assets/js/reader/navigation-state.js';

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
