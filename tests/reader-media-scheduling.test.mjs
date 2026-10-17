import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createEpubCompatibilityExtension} from '../public/assets/js/reader-epub-adapter.js';
import {readerInstanceScope} from '../public/assets/js/reader/lifecycle.js';

function fixture(t){
  t.mock.timers.enable({apis:['setTimeout','Date'],now:0});
  const restore=[];
  const globals={document:{readyState:'complete',getElementById:()=>null,body:{classList:{contains:()=>false}}},
    window:{visualViewport:new EventTarget()},SVGElement:class ParentSvg{}};
  for(const [name,value] of Object.entries(globals)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    restore.push(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
  }
  let views=[];
  const calls=[];
  const manager={settings:{axis:'vertical',flow:'scrolled-doc'},views:{all:()=>views},
    container:{scrollTop:0,scrollLeft:0,getBoundingClientRect:()=>({top:0,left:0,bottom:600,right:800,width:800,height:600})}};
  const rendition=Object.assign(new EventEmitter(),{manager,settings:{flow:'scrolled-doc'}});
  const book=createEpubCompatibilityExtension().attachBook({renderTo:()=>rendition});
  book.renderTo('viewer',{flow:'scrolled-doc'});
  t.after(()=>{
    readerInstanceScope(manager).dispose();rendition.destroy();book.destroy();
    for(const reset of restore)reset();
  });
  function addView(name,{displayed=true}={}){
    let height=800;
    const doc=Object.assign(new EventTarget(),{documentElement:{dataset:{},scrollHeight:800},
      body:{scrollHeight:800},defaultView:{SVGElement:class ContentsSvg{}},querySelectorAll:()=>[]});
    const contents={document:doc};
    const rectangle=()=>({top:0,left:0,bottom:height,right:800,width:800,height});
    const element={isConnected:true,style:{top:'12px'},getBoundingClientRect:rectangle};
    const frame={isConnected:true,clientWidth:480,contentDocument:doc,getBoundingClientRect:rectangle};
    const view={displayed,contents,element,iframe:frame,_width:640,
      reframe(width,nextHeight){calls.push({name,width,height:nextHeight,at:Date.now()});height=nextHeight}};
    views.push(view);
    return{view,contents,doc,
      grow:next=>{doc.documentElement.scrollHeight=next;doc.body.scrollHeight=next},
      load:target=>{const event=new Event('load');Object.defineProperty(event,'target',{value:target});doc.dispatchEvent(event)},
      retire(){contents.destroy();views=views.filter(item=>item!==view)}};
  }
  return{manager,rendition,calls,addView,
    render:item=>rendition.emit('rendered',null,item.view),
    tick:time=>t.mock.timers.tick(time)};
}

test('one-shot media checks repair late sizing without another load event',t=>{
  const f=fixture(t),item=f.addView('late');f.render(item);f.tick(0);f.tick(150);
  assert.deepEqual(f.calls,[]);assert.equal(item.view.element.style.top,'');
  for(const [index,deadline] of [300,1200,2600,4200].entries()){
    item.grow(900+index*100);f.tick(deadline-Date.now());f.tick(149);
    assert.equal(f.calls.length,index);
    f.tick(1);
    assert.deepEqual(f.calls.at(-1),{name:'late',width:640,height:900+index*100,at:deadline+150});
  }
  item.grow(1400);f.tick(5000);assert.equal(f.calls.length,4);
});

test('load bursts across contents share one trailing repair and skip undisplayed views',t=>{
  const f=fixture(t),first=f.addView('first'),second=f.addView('second'),pending=f.addView('pending',{displayed:false});
  f.render(first);f.render(second);f.tick(0);
  first.grow(900);first.load({tagName:'IMG'});f.tick(50);
  second.view._width=0;second.grow(1000);pending.grow(1200);second.load({tagName:'IMG'});
  f.tick(149);assert.deepEqual(f.calls,[]);f.tick(1);
  assert.deepEqual(f.calls,[{name:'first',width:640,height:900,at:200},{name:'second',width:480,height:1000,at:200}]);
  assert.equal(pending.view.element.style.top,'12px');
});

test('only media loads request repair, including SVG elements from the contents realm',t=>{
  const f=fixture(t),item=f.addView('svg');f.render(item);f.tick(0);f.tick(5000);f.tick(150);
  item.grow(900);item.load({tagName:'DIV'});f.tick(200);assert.deepEqual(f.calls,[]);
  item.load(new item.doc.defaultView.SVGElement());f.tick(149);assert.deepEqual(f.calls,[]);f.tick(1);
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].height,900);
  item.load({tagName:'IMG'});f.tick(150);assert.equal(f.calls.length,1);
});

test('retired contents cancel fallback work while a queued manager sweep repairs its remaining views',t=>{
  const f=fixture(t),retired=f.addView('retired'),live=f.addView('live');
  f.render(retired);f.tick(0);retired.grow(900);live.grow(1000);f.tick(50);retired.retire();f.tick(100);
  assert.deepEqual(f.calls,[{name:'live',width:640,height:1000,at:150}]);
  live.grow(1100);retired.load({tagName:'IMG'});f.tick(5000);f.tick(150);
  assert.equal(f.calls.length,1);assert.equal(retired.doc.defaultView.__sgTallSyncBound,undefined);
});

for(const boundary of ['manager disposal','flow switch'])test(`${boundary} prevents a queued media sweep from reframing views`,t=>{
  const f=fixture(t),item=f.addView('late');f.render(item);f.tick(0);item.grow(900);f.tick(50);
  if(boundary==='manager disposal')f.manager.destroy();else f.rendition.settings.flow='paginated';
  f.tick(5000);f.tick(150);assert.deepEqual(f.calls,[]);
});

test('rendition disposal cancels deferred rendered work before media listeners bind',t=>{
  const f=fixture(t),item=f.addView('late');item.grow(900);f.render(item);f.rendition.destroy();
  f.tick(5000);f.tick(150);item.load({tagName:'IMG'});f.tick(150);
  assert.deepEqual(f.calls,[]);assert.equal(item.doc.defaultView.__sgTallSyncBound,undefined);
});
