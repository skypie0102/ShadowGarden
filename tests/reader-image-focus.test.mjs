import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDoubleTapActivation} from '../public/assets/js/reader/image-focus-touch-compat.js';
import {createImageFocusController} from '../public/assets/js/reader/image-focus.js';
import {beginRenditionNavigation} from '../public/assets/js/reader/navigation-state.js';
import {captureRenditionPosition,stabilizeContinuousScrollLifecycle} from '../public/assets/js/reader/rendition.js';
import {createReaderResumeController} from '../public/assets/js/reader/resume-controller.js';
import {initializeContinuousState,advanceContinuousGeneration} from '../public/assets/js/reader/continuous-state.js';

function fixture(t,{finePointer=true,visualOnly=false}={}){
  const frames=[];
  function element(){
    const node=new EventTarget(),classes=new Set();
    return Object.assign(node,{isConnected:true,scrollTop:0,scrollLeft:0,style:{},dataset:{},
      classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),
        toggle:(name,on)=>on?classes.add(name):classes.delete(name)},setAttribute(){},removeAttribute(){},focus(){}});
  }
  const container=Object.assign(element(),{scrollTop:8000,scrollHeight:20000,scrollWidth:800,clientHeight:700,clientWidth:800,
    getBoundingClientRect:()=>({top:54,left:0,height:700,width:800})});
  let origin=1000,flow='scrolled-doc';
  const root=element(),frame=element(),wrapper=element(),paragraph=element();
  wrapper.parentElement=container;frame.parentElement=wrapper;
  frame.getBoundingClientRect=()=>({top:54+origin-container.scrollTop-wrapper.scrollTop,left:0,width:800,height:14000});
  const doc=Object.assign(element(),{documentElement:element(),scrollingElement:root,defaultView:{frameElement:frame},
    querySelectorAll:selector=>!visualOnly||selector.includes('.sg-synthetic-visual-page')?[paragraph]:[],
    elementFromPoint:()=>paragraph,createRange:()=>({selectNodeContents(){},getBoundingClientRect:()=>paragraph.getBoundingClientRect()})});
  paragraph.ownerDocument=doc;paragraph.closest=selector=>!visualOnly||selector.includes('.sg-synthetic-visual-page')?paragraph:null;
  paragraph.getBoundingClientRect=()=>({top:7400-root.scrollTop,left:0,bottom:7500-root.scrollTop,right:700});
  const view={id:'chapter-view',element:{getBoundingClientRect:()=>({...frame.getBoundingClientRect(),bottom:frame.getBoundingClientRect().top+14000})},
    iframe:frame,document:doc,section:{index:7,href:'chapter7.xhtml',cfiFromRange:()=> 'epubcfi(focus-fixture)'}};
  const manager={container,settings:{axis:'vertical'},views:{all:()=>[view]}};
  initializeContinuousState(manager);advanceContinuousGeneration(manager);
  let rendition={manager,display(){throw new Error('Image focus must not navigate the EPUB')},currentLocation(){throw new Error('Image focus must not reframe the EPUB')}};
  const viewport=Object.assign(element(),{clientWidth:800,clientHeight:700}),closeButton=element(),overlay=element(),image=element();
  const document={activeElement:frame,body:element(),contains:node=>node.isConnected,addEventListener(){},removeEventListener(){}};
  let focusCalls=0;
  // Reproduce a browser focus scroll after the dialog has closed.
  frame.focus=()=>{focusCalls++;container.scrollTop+=360;root.scrollTop=40};
  const globals={window:{innerWidth:800,innerHeight:700,addEventListener(){},removeEventListener(){}},document,
    requestAnimationFrame:callback=>{frames.push(callback);return callback},cancelAnimationFrame:callback=>{const index=frames.indexOf(callback);if(index>=0)frames.splice(index,1)},matchMedia:query=>({matches:query===(finePointer?'(pointer: fine)':'(pointer: coarse)')})};
  for(const [name,value] of Object.entries(globals)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
    t.after(()=>{controller.dispose();if(previous)Object.defineProperty(globalThis,name,previous);else delete globalThis[name]});
  }
  const controller=createImageFocusController({overlay,viewport,image,closeButton,getRendition:()=>rendition,getFlow:()=>flow});
  t.after(()=>controller.dispose());
  const source={currentSrc:'https://garden.test/art.png',alt:'Fixture illustration',closest:()=>source};
  const send=(node,type,properties={})=>{const event=new Event(type,{cancelable:true});for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{value});node.dispatchEvent(event);return event};
  const touch=(node,type,x=150,y=200)=>{const point={identifier:1,clientX:x,clientY:y};return send(node,type,{target:source,touches:type==='touchend'?[]:[point],changedTouches:[point]})};
  controller.installDocument(doc);
  const flush=()=>{for(let count=0;frames.length&&count<10;count++)frames.splice(0).forEach(callback=>callback())};
  return{controller,container,root,wrapper,viewport,closeButton,doc,source,send,touch,flush,open:()=>controller.openImageFocus(source,doc),
    get rendition(){return rendition},
    shift:amount=>{origin+=amount;container.scrollHeight+=amount},focusCalls:()=>focusCalls,
    navigate:()=>{advanceContinuousGeneration(manager)},requestNavigation:()=>beginRenditionNavigation(rendition),switchFlow:()=>{flow='paginated';rendition={manager:{}}}};
}

for(const control of ['close button','double click'])test(`image ${control} restores live Continuous position after focus and inner-frame scroll`,t=>{
  const f=fixture(t);f.open();f.flush();
  f.container.scrollTop+=900;f.root.scrollTop=120;f.wrapper.scrollTop=25;
  (control==='close button'?f.closeButton:f.viewport).dispatchEvent(new Event(control==='close button'?'click':'dblclick',{cancelable:true}));
  f.flush();
  assert.equal(f.controller.isFocused(),false);
  assert.equal(f.container.scrollTop,8000);
  assert.equal(f.root.scrollTop,0);assert.equal(f.wrapper.scrollTop,0);
  assert.equal(f.focusCalls(),1);
});

test('image return follows its live passage when Continuous buffering changes absolute offsets',t=>{
  const f=fixture(t);f.open();f.flush();
  f.shift(640);f.container.scrollTop=10000;
  f.controller.closeImageFocus();f.flush();
  assert.equal(f.container.scrollTop,8640);
});

test('image return suppresses scroll reporting and trim for the same correction window',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});let now=1000,reports=0,trims=0;
  t.mock.method(performance,'now',()=>now);
  const f=fixture(t),manager=f.rendition.manager;
  manager._scrolled=()=>{};manager.scrolled=()=>{reports++};manager.trim=()=>{trims++};
  assert.equal(stabilizeContinuousScrollLifecycle(f.rendition),true);
  f.open();f.flush();f.controller.closeImageFocus();f.flush();
  now=1319;manager._scrolled();t.mock.timers.tick(31);await manager.trim();
  assert.equal(reports,0);assert.equal(trims,0);
  now=1320;manager._scrolled();t.mock.timers.tick(31);await manager.trim();
  assert.equal(reports,1);assert.equal(trims,1);
});

test('single mouse and compatibility clicks neither open nor dismiss an image',t=>{
  const f=fixture(t);
  f.send(f.doc,'click',{target:f.source});
  f.send(f.doc,'pointerdown',{target:f.source,pointerId:1});
  f.send(f.doc,'pointerup',{target:f.source,pointerId:1});
  assert.equal(f.controller.isFocused(),false);
  f.send(f.doc,'dblclick',{target:f.source});
  assert.equal(f.controller.isFocused(),true);
  f.send(f.viewport,'click');
  assert.equal(f.controller.isFocused(),true);
  f.send(f.viewport,'dblclick');
  assert.equal(f.controller.isFocused(),false);
});

test('touch double taps open and dismiss without counting compatibility clicks',t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const f=fixture(t,{finePointer:false});
  const tap=node=>{f.touch(node,'touchstart');now+=30;f.touch(node,'touchend');f.send(node,'click',{target:f.source})};
  tap(f.doc);assert.equal(f.controller.isFocused(),false);
  now+=80;tap(f.doc);assert.equal(f.controller.isFocused(),true);
  tap(f.viewport);assert.equal(f.controller.isFocused(),true);
  now+=80;tap(f.viewport);f.flush();
  assert.equal(f.controller.isFocused(),false);assert.equal(f.container.scrollTop,8000);
});

test('scrolling, a moved touch, a cancelled touch and a long press break the opening tap pair',t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const f=fixture(t,{finePointer:false});
  const tap=()=>{f.touch(f.doc,'touchstart');now+=30;f.touch(f.doc,'touchend')};
  for(const interruption of [
    ()=>f.send(f.doc,'scroll'),
    ()=>{f.touch(f.doc,'touchstart');f.touch(f.doc,'touchmove',150,240);f.touch(f.doc,'touchend')},
    ()=>f.send(f.doc,'touchcancel'),
    ()=>{f.touch(f.doc,'touchstart');now+=301;f.touch(f.doc,'touchend')}
  ]){
    tap();interruption();tap();assert.equal(f.controller.isFocused(),false);
    now+=351;
  }
});

test('a moved or cancelled overlay touch cannot complete dismissal',t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const f=fixture(t,{finePointer:false});f.open();
  const tap=()=>{f.touch(f.viewport,'touchstart');now+=30;f.touch(f.viewport,'touchend')};
  tap();f.touch(f.viewport,'touchstart');f.touch(f.viewport,'touchmove',150,240);f.touch(f.viewport,'touchend');
  tap();assert.equal(f.controller.isFocused(),true);
  f.send(f.viewport,'touchcancel');tap();assert.equal(f.controller.isFocused(),true);
  now+=351;tap();assert.equal(f.controller.isFocused(),true);
});

test('double taps require the same image, nearby points and a short interval',()=>{
  const activation=createDoubleTapActivation(),a={},b={};
  assert.equal(activation.tap(a,{clientX:10,clientY:10},1000),false);
  assert.equal(activation.tap(b,{clientX:10,clientY:10},1100),false);
  assert.equal(activation.tap(b,{clientX:60,clientY:10},1200),false);
  assert.equal(activation.tap(b,{clientX:60,clientY:10},1551),false);
  assert.equal(activation.tap(b,{clientX:61,clientY:11},1650),true);
  assert.equal(activation.tap(b,{clientX:61,clientY:11},1700),false);
  activation.reset();
  assert.equal(activation.tap(b,{clientX:61,clientY:11},1800),false);
});

test('a navigation reset cancels pending image position and focus restoration',t=>{
  const f=fixture(t);f.open();f.flush();f.controller.closeImageFocus();
  f.controller.closeImageFocus({restoreFocus:false});f.container.scrollTop=12000;f.flush();
  assert.equal(f.container.scrollTop,12000);assert.equal(f.focusCalls(),0);
});

test('closing for a flow switch preserves the new rendition and skips delayed overlay focus',t=>{
  const f=fixture(t);f.open();f.switchFlow();f.controller.closeImageFocus({restoreFocus:false});
  f.container.scrollTop=12000;f.flush();
  assert.equal(f.container.scrollTop,12000);assert.equal(f.focusCalls(),0);
});

test('an explicit EPUB navigation invalidates an image return snapshot',t=>{
  const f=fixture(t);f.open();f.flush();f.navigate();f.container.scrollTop=12000;
  f.controller.closeImageFocus({restoreFocus:false});f.flush();
  assert.equal(f.container.scrollTop,12000);assert.equal(f.focusCalls(),0);
});

test('a navigation request cancels delayed image return before its vendor display changes generation',t=>{
  const f=fixture(t);f.open();f.flush();f.controller.closeImageFocus();
  f.requestNavigation();f.container.scrollTop=12000;f.flush();
  assert.equal(f.container.scrollTop,12000);assert.equal(f.focusCalls(),0);
});

test('Continuous semantic capture reads the live passage without calling the mutating vendor location method',async t=>{
  const f=fixture(t);
  const position=await captureRenditionPosition({rendition:f.rendition,flow:'scrolled-doc',fallback:{cfi:'epubcfi(stale)',page:19}});
  assert.equal(position.cfi,'epubcfi(focus-fixture)');assert.equal(position.page,19);assert.equal(position.sectionIndex,7);
  assert.equal(f.container.scrollTop,8000);
});

test('an image-only visual page supplies its own Continuous anchor instead of stale prose progress',async t=>{
  const f=fixture(t,{visualOnly:true});
  const position=await captureRenditionPosition({rendition:f.rendition,flow:'scrolled-doc',fallback:{cfi:'epubcfi(stale-prose)',page:19}});
  assert.equal(position.cfi,'epubcfi(focus-fixture)');
  assert.equal(position.sectionIndex,7);
  assert.equal(f.container.scrollTop,8000);
});

test('resize capture retains the last stable Continuous passage after viewport geometry has already changed',async t=>{
  const f=fixture(t);let position={cfi:'epubcfi(before-resize)'},captures=0;
  const resume=createReaderResumeController({getRendition:()=>f.rendition,getFlow:()=> 'scrolled-doc',getPosition:()=>position,
    capturePosition:()=>{captures++;return position}});
  resume.remember();f.container.clientWidth+=100;position={cfi:'epubcfi(after-browser-reflow)'};
  // A relocated event can arrive before the application's resize handler.
  resume.remember();
  assert.equal((await resume.capture()).cfi,'epubcfi(before-resize)');assert.equal(captures,0);
});

test('disposing focused artwork cancels its queued return and removes close handling',t=>{
  const f=fixture(t);f.open();f.flush();f.controller.closeImageFocus();f.controller.dispose();
  f.container.scrollTop=9500;f.root.scrollTop=250;f.flush();
  f.closeButton.dispatchEvent(new Event('click',{cancelable:true}));
  assert.equal(f.controller.isFocused(),false);assert.equal(f.container.scrollTop,9500);assert.equal(f.root.scrollTop,250);
  assert.equal(f.open(),false);
});
