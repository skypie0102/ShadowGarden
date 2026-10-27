import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installEpubLifecyclePatch} from '../public/assets/js/reader/epub-lifecycle.js';
import {displaySettledRenditionTarget} from '../public/assets/js/reader/rendition.js';
import {createContinuousController} from '../public/assets/js/reader/continuous.js';
import {beginRenditionNavigation,runRenditionMove} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function paint(t){
  for(const [name,value]of Object.entries({requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout})){
    const old=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    t.after(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
  }
}
function fixture(){
  class Book{renderTo(){}}
  class Rendition extends EventEmitter{
    requireManager(){return class Manager{}}
    afterDisplayed(){}
    afterRemoved(){}
    destroy(){this.hooks=undefined}
    triggerMarkEvent(){}
  }
  installEpubLifecyclePatch({VERSION:'0.3',Book,Rendition});
  const rendition=new Rendition(),view=new EventEmitter();
  Object.assign(view,{section:{index:1},contents:{destroy(){}}});
  return{rendition,view};
}

test('late render and content hooks cannot publish after rendition disposal',async()=>{
  for(const stage of ['render','content']){
    const {rendition,view}=fixture(),gate=deferred(),entered=deferred();let calls=0,events=0;
    rendition.hooks={
      render:{trigger:()=>{if(stage==='render'){entered.resolve();return gate.promise}return Promise.resolve()}},
      content:{trigger:()=>{calls++;entered.resolve();return gate.promise}}
    };
    rendition.on('rendered',()=>events++);
    const pending=rendition.afterDisplayed(view);await entered.promise;
    rendition.destroy();gate.resolve();await pending;
    assert.equal(calls,stage==='render'?0:1);assert.equal(events,0);
  }
});

test('a trimmed view cancels render work while a live view still emits rendered',async()=>{
  for(const trim of [false,true]){
    const {rendition,view}=fixture(),gate=deferred();let events=0;
    rendition.hooks={render:{trigger:()=>gate.promise},content:{trigger:()=>Promise.resolve()}};
    rendition.on('rendered',()=>events++);
    const pending=rendition.afterDisplayed(view);
    if(trim)view.contents.destroy();gate.resolve();await pending;
    assert.equal(events,trim?0:1);rendition.destroy();
  }
});

test('late unloaded hooks cannot emit removal on a disposed rendition',async()=>{
  const {rendition,view}=fixture(),gate=deferred();let events=0;
  rendition.hooks={unloaded:{trigger:()=>gate.promise}};rendition.on('removed',()=>events++);
  const pending=rendition.afterRemoved(view);rendition.destroy();gate.resolve();await pending;
  assert.equal(events,0);
});

test('a newly rendered paginated CFI is positioned again only after content styling completes',async t=>{
  paint(t);const {rendition,view}=fixture(),gate=deferred(),calls=[];let styled=false;
  rendition.settings={flow:'paginated'};
  rendition.hooks={render:{trigger:()=>Promise.resolve()},content:{trigger:()=>gate.promise.then(()=>{styled=true})}};
  rendition.display=target=>{calls.push({target,styled});if(calls.length===1)rendition.afterDisplayed(view)};
  const operation=beginRenditionNavigation(rendition),moving=displaySettledRenditionTarget(rendition,'epubcfi(fixture)',{operation});
  await tick();assert.deepEqual(calls,[{target:'epubcfi(fixture)',styled:false}]);
  gate.resolve();assert.equal(await moving,true);
  assert.deepEqual(calls,[{target:'epubcfi(fixture)',styled:false},{target:'epubcfi(fixture)',styled:true}]);
  rendition.destroy();
});

test('a newer navigation cancels an older CFI correction awaiting content styling',async t=>{
  paint(t);const {rendition,view}=fixture(),gate=deferred(),calls=[];
  rendition.settings={flow:'paginated'};
  rendition.hooks={render:{trigger:()=>Promise.resolve()},content:{trigger:()=>gate.promise}};
  rendition.display=target=>{calls.push(target);if(calls.length===1)rendition.afterDisplayed(view)};
  const operation=beginRenditionNavigation(rendition),moving=displaySettledRenditionTarget(rendition,'epubcfi(old)',{operation});
  await tick();const latest=beginRenditionNavigation(rendition);
  await runRenditionMove(rendition,latest,()=>rendition.display('latest.xhtml'));
  gate.resolve();assert.equal(await moving,false);
  assert.deepEqual(calls,['epubcfi(old)','latest.xhtml']);rendition.destroy();
});

for(const wave of [1,2])test(`Continuous restores its target after delayed buffer styling in wave ${wave}`,async t=>{
  paint(t);const {rendition,view}=fixture(),gate=deferred(),entered=deferred();
  let styled=false,visible='',buffers=0,completed=false;
  rendition.hooks={render:{trigger:()=>Promise.resolve()},content:{trigger:()=>{entered.resolve();return gate.promise.then(()=>{styled=true;visible='previous section'})}}};
  rendition.display=target=>{visible=styled?target:'previous section'};
  const controller=createContinuousController({getRendition:()=>rendition,settleNavigation:()=>{if(++buffers===wave)rendition.afterDisplayed(view)}});
  t.after(()=>{controller.dispose();rendition.destroy()});
  const moving=controller.display('epubcfi(saved-section)').then(value=>{completed=true;return value});
  await entered.promise;await tick();assert.equal(completed,false);
  gate.resolve();assert.equal(await moving,true);
  assert.equal(visible,'epubcfi(saved-section)');
});

test('newer Continuous navigation wins while old buffer styling is pending',async t=>{
  paint(t);const {rendition,view}=fixture(),gate=deferred(),entered=deferred(),calls=[];
  rendition.hooks={render:{trigger:()=>Promise.resolve()},content:{trigger:()=>{entered.resolve();return gate.promise}}};
  rendition.display=target=>calls.push(target);
  const controller=createContinuousController({getRendition:()=>rendition,settleNavigation:()=>rendition.afterDisplayed(view)});
  t.after(()=>{controller.dispose();rendition.destroy()});
  const old=controller.display('epubcfi(old)');await entered.promise;
  assert.equal(await controller.display('latest.xhtml',{settle:false}),true);
  gate.resolve();assert.equal(await old,false);
  assert.deepEqual(calls,['epubcfi(old)','latest.xhtml']);
});
