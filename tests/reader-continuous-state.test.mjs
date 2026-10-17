import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createContinuousCoreExtension} from '../public/assets/js/reader-continuous-core.js';
import {preserveContinuousLayout} from '../public/assets/js/reader/continuous-layout.js';
import {pendingContinuousBuffer} from '../public/assets/js/reader/continuous-state.js';

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
      await Promise.allSettled([pendingContinuousBuffer(manager)]);
    }finally{for(const reset of restore)reset()}
  });
  function prepareTrim(){
    loaded=Array.from({length:15},(_,index)=>({
      displayed:true,section:{index,href:`chapter${index}.xhtml`},
      element:{getBoundingClientRect:()=>({top:(index-7)*900,bottom:(index-6)*900,left:0,right:800})}
    }));
    manager.erase=view=>{events.push(`erase:${view.section.index}`);loaded=loaded.filter(item=>item!==view)};
    events.length=0;
  }
  return{manager,rendition,extension,first,last,events,prepareTrim,shift:amount=>{top+=amount},destroyed:()=>destroyed};
}

test('a superseded buffer cannot show its late view or clear the newer buffer task',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  const old=pendingContinuousBuffer(f.manager),settling=f.extension.settleNavigation(f.rendition);
  await f.manager.display(f.last.section);
  t.mock.timers.tick(0);await f.last.entered.promise;
  const latest=pendingContinuousBuffer(f.manager);
  assert.notEqual(latest,old);
  f.first.gate.resolve(f.first.view);
  assert.equal(await old,false);assert.equal(await settling,false);
  assert.deepEqual(f.events,[]);
  assert.equal(pendingContinuousBuffer(f.manager),latest);
  f.last.gate.resolve(f.last.view);await latest;
  assert.deepEqual(f.events,['expand:1','show:1']);
});

test('manager destruction invalidates pending neighborhood settlement and late view callbacks',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  const pending=pendingContinuousBuffer(f.manager),settling=f.extension.settleNavigation(f.rendition);
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

test('repeated neighborhood requests reuse the current task and coalesce into one fresh pass',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  const pending=pendingContinuousBuffer(f.manager);
  f.manager.check();f.manager.check();f.manager.fill();
  assert.equal(pendingContinuousBuffer(f.manager),pending);
  f.first.gate.resolve(f.first.view);await pending;
  assert.deepEqual(f.events,['expand:0','show:0','expand:0','show:0']);
  assert.equal(pendingContinuousBuffer(f.manager),null);
});

test('rescheduling trim keeps the full idle deadline and the same retained neighborhood',{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  f.first.gate.resolve(f.first.view);await pendingContinuousBuffer(f.manager);
  f.prepareTrim();f.manager.scheduleTrim();
  t.mock.timers.tick(1000);f.manager.scheduleTrim();
  t.mock.timers.tick(400);assert.deepEqual(f.events,[]);
  t.mock.timers.tick(999);assert.deepEqual(f.events,[]);
  t.mock.timers.tick(1);
  assert.deepEqual(f.events,['erase:0','erase:1','erase:2','erase:14','erase:13','erase:12']);
  assert.equal(f.manager.views.all().length,9);
});

for(const owner of ['manager','rendition'])test(`${owner} teardown prevents a pending trim from removing views`,{timeout:5000},async t=>{
  const f=fixture(t);await f.first.entered.promise;
  f.first.gate.resolve(f.first.view);await pendingContinuousBuffer(f.manager);
  f.prepareTrim();f.manager.scheduleTrim();f[owner].destroy();
  t.mock.timers.tick(5000);
  assert.deepEqual(f.events,[]);assert.equal(f.manager.views.all().length,15);
});
