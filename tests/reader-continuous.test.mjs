import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContinuousController} from '../public/assets/js/reader/continuous.js';
import {createContinuousCoreExtension} from '../public/assets/js/reader-continuous-core.js';
import {stabilizeContinuousScrollLifecycle} from '../public/assets/js/reader/rendition.js';
import {initializeContinuousState,advanceContinuousGeneration,destroyContinuousState} from '../public/assets/js/reader/continuous-state.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('fragment navigation gives EPUB.js a text-node CFI rather than an element character offset',async()=>{
  const text={nodeType:3,textContent:'Chapter four'},heading={},range={setStart(node,offset){this.node=node;this.offset=offset;},collapse(value){this.collapsed=value;}};
  const document={getElementById:id=>id==='heading'?heading:null,createTreeWalker:(element,filter)=>{assert.equal(element,heading);assert.equal(filter,4);return{nextNode:()=>text};},createRange:()=>range};
  const section={document,cfiFromRange:value=>{assert.equal(value.node,text);assert.equal(value.offset,0);assert.equal(value.collapsed,true);return'epubcfi(fragment-text)';},cfiFromElement(){throw Error('Element CFI can be misread as a character offset');}};
  const controller=createContinuousController({getBook:()=>({spine:{get:()=>section}})});
  assert.equal(await controller.resolveTarget('chapter.xhtml#heading'),'epubcfi(fragment-text)');
});

test('non-text fragment targets retain element navigation',async()=>{
  const image={},section={document:{getElementById:()=>image,createTreeWalker:()=>({nextNode:()=>null})},cfiFromElement:node=>{assert.equal(node,image);return'epubcfi(image-anchor)';}};
  const controller=createContinuousController({getBook:()=>({spine:{get:()=>section}})});
  assert.equal(await controller.resolveTarget('chapter.xhtml#image'),'epubcfi(image-anchor)');
});

test('an older chapter load cannot display after a newer target is selected',async()=>{
  const loaded=deferred(),calls=[];
  const section={load:()=>loaded.promise,href:'old.xhtml'};
  const book={load(){},spine:{get:target=>target==='old.xhtml'?section:null}};
  const rendition={display:target=>calls.push(target)};
  const controller=createContinuousController({getBook:()=>book,getRendition:()=>rendition});
  const old=controller.display('old.xhtml',{settle:false});
  assert.equal(await controller.display('latest.xhtml',{settle:false}),true);
  loaded.resolve();assert.equal(await old,false);
  assert.deepEqual(calls,['latest.xhtml']);
});

test('a superseded Continuous display does not perform its deferred second display',async t=>{
  const frames=[],calls=[];
  const original=globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame=callback=>{frames.push(callback);return frames.length};
  t.after(()=>original?globalThis.requestAnimationFrame=original:delete globalThis.requestAnimationFrame);
  const rendition={display:target=>calls.push(target)};
  const controller=createContinuousController({getRendition:()=>rendition});
  const old=controller.display('old.xhtml');await tick();
  await controller.display('latest.xhtml',{settle:false});
  while(frames.length)frames.shift()(0);
  assert.equal(await old,false);assert.deepEqual(calls,['old.xhtml','latest.xhtml']);
});

test('a navigation superseded during engine buffering cannot perform a stale settling display',async()=>{
  const buffered=deferred(),calls=[],rendition={display:target=>calls.push(target)};
  const controller=createContinuousController({getRendition:()=>rendition,settleNavigation:()=>buffered.promise});
  const old=controller.display('old.xhtml');await tick();
  assert.deepEqual(calls,['old.xhtml']);
  await controller.display('latest.xhtml',{settle:false});buffered.resolve();
  assert.equal(await old,false);assert.deepEqual(calls,['old.xhtml','latest.xhtml']);
});

test('completed same-target displays can settle new geometry instead of being suppressed by a timer',async t=>{
  const oldDocument=globalThis.document;
  globalThis.document={getElementById:()=>null,body:{classList:{contains:()=>false}}};
  t.after(()=>oldDocument?globalThis.document=oldDocument:delete globalThis.document);
  let calls=0;
  const manager={__sgCoreMethodsInstalled:true,__sgCoreScrollBound:true,container:{scrollTop:0,scrollLeft:0},settings:{},views:{all:()=>[]}};
  initializeContinuousState(manager);advanceContinuousGeneration(manager);
  const rendition={manager,display:async()=>{calls++},book:{spine:{spineItems:[]}}};
  const extension=createContinuousCoreExtension(),book=extension.attachBook({renderTo:()=>rendition});
  const patched=book.renderTo('viewer',{flow:'scrolled-doc'});
  await patched.display('chapter.xhtml');await patched.display('chapter.xhtml');
  assert.equal(calls,2);
});

test('vendor boolean scroll bookkeeping cannot replace the owned scroll reporter',t=>{
  t.mock.timers.enable({apis:['setTimeout']});let calls=0;
  const manager={scrolled:true,_scrolled(){},__sgContinuousScrolled(){calls++}};
  assert.equal(stabilizeContinuousScrollLifecycle({manager}),true);
  manager._scrolled();t.mock.timers.tick(31);assert.equal(calls,1);
  destroyContinuousState(manager);manager._scrolled();t.mock.timers.tick(31);assert.equal(calls,1);
});
