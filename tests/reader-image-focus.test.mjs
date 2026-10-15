import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createImageFocusController} from '../public/assets/js/reader/image-focus.js';
import {beginRenditionNavigation} from '../public/assets/js/reader/navigation-state.js';
import {captureRenditionPosition} from '../public/assets/js/reader/rendition.js';
import {createReaderResumeController} from '../public/assets/js/reader/resume-controller.js';

function fixture(t,{finePointer=true}={}){
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
  const doc={scrollingElement:root,defaultView:{frameElement:frame},querySelectorAll:()=>[paragraph],
    elementFromPoint:()=>paragraph,createRange:()=>({selectNodeContents(){},getBoundingClientRect:()=>paragraph.getBoundingClientRect()})};
  paragraph.ownerDocument=doc;paragraph.closest=()=>paragraph;
  paragraph.getBoundingClientRect=()=>({top:7400-root.scrollTop,left:0,bottom:7500-root.scrollTop,right:700});
  const view={id:'chapter-view',element:{getBoundingClientRect:()=>({...frame.getBoundingClientRect(),bottom:frame.getBoundingClientRect().top+14000})},
    iframe:frame,document:doc,section:{index:7,href:'chapter7.xhtml',cfiFromRange:()=> 'epubcfi(focus-fixture)'}};
  const manager={container,settings:{axis:'vertical'},views:{all:()=>[view]},__sgGeneration:1};
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
  const source={currentSrc:'https://garden.test/art.png',alt:'Fixture illustration'};
  const flush=()=>{for(let count=0;frames.length&&count<10;count++)frames.splice(0).forEach(callback=>callback())};
  return{controller,container,root,wrapper,viewport,closeButton,flush,open:()=>controller.openImageFocus(source,doc),
    get rendition(){return rendition},
    shift:amount=>{origin+=amount;container.scrollHeight+=amount},focusCalls:()=>focusCalls,
    navigate:()=>{manager.__sgGeneration++},requestNavigation:()=>beginRenditionNavigation(rendition),switchFlow:()=>{flow='paginated';rendition={manager:{}}}};
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

test('a touch opening click cannot immediately dismiss its focused image',t=>{
  let now=1000;t.mock.method(Date,'now',()=>now);
  const f=fixture(t,{finePointer:false});f.open();f.flush();
  f.viewport.dispatchEvent(new Event('click',{cancelable:true}));
  assert.equal(f.controller.isFocused(),true);
  now+=401;f.container.scrollTop+=500;
  f.viewport.dispatchEvent(new Event('click',{cancelable:true}));f.flush();
  assert.equal(f.controller.isFocused(),false);assert.equal(f.container.scrollTop,8000);
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
