import {test} from 'node:test';
import assert from 'node:assert/strict';
import {captureRenditionPosition,displayRenditionTarget} from '../public/assets/js/reader/rendition.js';
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

function pageFixture({textFirst=false}={}){
  const rect=(top,bottom)=>({top,bottom,left:1300,right:1600});
  const image={tagName:'IMG',getClientRects:()=>[rect(textFirst?250:40,textFirst?450:240)]};
  const paragraph={tagName:'P',getClientRects:()=>[rect(textFirst?30:260,textFirst?100:340)]};
  const document={querySelectorAll:()=>[image,paragraph]};
  const view={displayed:true,document,iframe:{getBoundingClientRect:()=>({left:-1280,top:54})},
    section:{index:5,href:'chapter4.xhtml',cfiFromElement:node=>{assert.equal(node,image);return'epubcfi(visible-image)'}}};
  let captures=0;
  const rendition={manager:{container:{clientWidth:640,clientHeight:618,getBoundingClientRect:()=>({left:0,top:54,width:640,height:618})},
    settings:{axis:'horizontal'},layout:{pageWidth:640},views:{all:()=>[view]}},
    location:{start:{cfi:'epubcfi(stale-text)'}},currentLocation:()=>{captures++;return{start:{cfi:'epubcfi(current-text)'}}}};
  return{rendition,captures:()=>captures};
}

test('a leading paginated illustration is retained even when vendor location starts at following text',async()=>{
  const f=pageFixture();
  const position=await captureRenditionPosition({rendition:f.rendition,flow:'paginated',fallback:{cfi:'epubcfi(fallback)'}});
  assert.equal(position.cfi,'epubcfi(visible-image)');assert.equal(position.href,'chapter4.xhtml');assert.equal(f.captures(),0);
});

test('text preceding a paginated illustration retains the vendor live text position',async()=>{
  const f=pageFixture({textFirst:true});
  const position=await captureRenditionPosition({rendition:f.rendition,flow:'paginated',pageMap:{positionForLocation:location=>({cfi:location.start.cfi})}});
  assert.equal(position.cfi,'epubcfi(current-text)');assert.equal(f.captures(),1);
});
