import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createContinuousCoreExtension} from '../public/assets/js/reader-continuous-core.js';
import {preserveContinuousLayout} from '../public/assets/js/reader/continuous-layout.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};

function fixture(t){
  t.mock.timers.enable({apis:['setTimeout']});
  const globals={
    document:{getElementById:()=>null,body:{classList:{contains:()=>false}}},
    requestAnimationFrame:callback=>{queueMicrotask(()=>callback(0));return 1},
    cancelAnimationFrame:()=>{}
  };
  const restore=[];
  for(const [name,value] of Object.entries(globals)){
    const old=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true});
    restore.push(()=>old?Object.defineProperty(globalThis,name,old):delete globalThis[name]);
  }
  const events=[];let top=0,destroyed=0;
  const rectangle=()=>({top,left:0,bottom:top+900,right:800,width:800,height:900});
  function pendingView(index){
    const entered=deferred(),gate=deferred();
    const section={index,href:`chapter${index}.xhtml`,prev:()=>null,next:()=>null};
    const view={section,displayed:false,element:{isConnected:true,getBoundingClientRect:rectangle},
      display(){entered.resolve();return gate.promise},
      expand(){events.push(`expand:${index}`)},show(){events.push(`show:${index}`)}};
    return{entered,gate,view,section};
  }
  const first=pendingView(0),last=pendingView(1);let loaded=[first.view];
  class DefaultManager extends EventEmitter{
    display(section){loaded=[section===last.section?last.view:first.view];return loaded[0]}
    destroy(){destroyed++}
  }
  class ContinuousManager extends DefaultManager{}
  const manager=new ContinuousManager();
  manager.container=Object.assign(new EventTarget(),{
    scrollTop:200,scrollLeft:0,style:{setProperty(){}},
    getBoundingClientRect:()=>({top:0,left:0,bottom:600,right:800,width:800,height:600})
  });
  manager.settings={axis:'vertical'};
  manager.isVisible=()=>true;
  manager.views={all:()=>loaded,first:()=>loaded[0],last:()=>loaded.at(-1)};
  const rendition=Object.assign(new EventEmitter(),{manager,book:{spine:{spineItems:[]}}});
  const extension=createContinuousCoreExtension();
  extension.attachBook({renderTo:()=>rendition}).renderTo('viewer',{flow:'scrolled-doc'});
  t.after(async()=>{
    try{
      rendition.destroy();manager.destroy();first.gate.resolve(first.view);last.gate.resolve(last.view);
      await Promise.allSettled([manager.__sgBufferPromise]);
    }finally{for(const reset of restore)reset()}
  });
  return{manager,rendition,extension,first,last,events,shift:amount=>{top+=amount},destroyed:()=>destroyed};
}

test('a superseded buffer cannot show its late view or clear the newer buffer task',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  const old=f.manager.__sgBufferPromise,settling=f.extension.settleNavigation(f.rendition);
  await f.manager.display(f.last.section);
  t.mock.timers.tick(0);await f.last.entered.promise;
  const latest=f.manager.__sgBufferPromise;
  assert.notEqual(latest,old);
  f.first.gate.resolve(f.first.view);
  assert.equal(await old,false);assert.equal(await settling,false);
  assert.deepEqual(f.events,[]);
  assert.equal(f.manager.__sgBufferPromise,latest);
  f.last.gate.resolve(f.last.view);await latest;
  assert.deepEqual(f.events,['expand:1','show:1']);
});

test('manager destruction invalidates pending neighborhood settlement and late view callbacks',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  const pending=f.manager.__sgBufferPromise,settling=f.extension.settleNavigation(f.rendition);
  f.manager.destroy();f.first.gate.resolve(f.first.view);
  assert.equal(await pending,false);assert.equal(await settling,false);
  assert.equal(await f.extension.settleNavigation(f.rendition),false);
  assert.deepEqual(f.events,[]);assert.equal(f.destroyed(),1);
});

test('a layout transaction cannot compensate a manager destroyed by its own change',t=>{
  const f=fixture(t);f.first.view.displayed=true;
  preserveContinuousLayout(f.manager,()=>{f.shift(150);f.manager.destroy()});
  assert.equal(f.manager.container.scrollTop,200);
  assert.equal(f.destroyed(),1);
});
