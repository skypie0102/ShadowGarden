import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter,getEventListeners} from 'node:events';
import {createReaderScope,readerInstanceScope,readerContentsScope} from '../public/assets/js/reader/lifecycle.js';
import {beginRenditionNavigation,disposeRenditionNavigation,navigateRendition,runRenditionMove} from '../public/assets/js/reader/navigation-state.js';
import {createAuthorizedBookSession} from '../public/assets/js/reader/book-session.js';
import {resetFinishedVolume} from '../public/assets/js/public/volume-actions.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function globals(t,values){
  for(const[name,value]of Object.entries(values)){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
    t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
  }
}

test('disposal removes listeners, emitter handlers and content hooks exactly once',()=>{
  const scope=createReaderScope(),target=new EventTarget(),emitter=new EventEmitter(),hooks=new Set();
  const hook={register:fn=>hooks.add(fn),deregister:fn=>hooks.delete(fn)};
  let calls=0,released=0;
  scope.listen(target,'input',()=>calls++);scope.on(emitter,'rendered',()=>calls++);scope.hook(hook,()=>calls++);
  scope.add(()=>released++);
  target.dispatchEvent(new Event('input'));emitter.emit('rendered');[...hooks][0]();
  const late=[...hooks][0];scope.dispose();scope.dispose();late();
  target.dispatchEvent(new Event('input'));emitter.emit('rendered');
  assert.equal(calls,3);assert.equal(released,1);assert.equal(emitter.listenerCount('rendered'),0);assert.equal(hooks.size,0);
});

test('disposal cancels pending timers, animation frames and observers',t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const frames=new Map();let serial=0,calls=0,disconnected=0;
  globals(t,{requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial},cancelAnimationFrame:id=>frames.delete(id)});
  const scope=createReaderScope();
  scope.timeout(()=>calls++,100);scope.interval(()=>calls++,100);scope.frame(()=>calls++);
  scope.observe({observe(){},disconnect(){disconnected++}},{});
  scope.dispose();t.mock.timers.tick(2000);for(const fn of frames.values())fn();
  assert.equal(calls,0);assert.equal(frames.size,0);assert.equal(disconnected,1);
});

test('disposing a child releases its resources without disposing its parent',()=>{
  const scope=createReaderScope(),child=scope.child();let calls=0;
  child.add(()=>calls++);child.dispose();scope.dispose();
  assert.equal(calls,1);assert.equal(child.disposed,true);
  const closed=scope.child();assert.equal(closed.disposed,true);
});

test('cleanup errors do not skip remaining owners or permit callbacks after closure',t=>{
  const warnings=[];t.mock.method(console,'warn',(...args)=>warnings.push(args));
  const scope=createReaderScope();let released=0;
  scope.add(()=>released++);scope.add(()=>{throw Error('fixture cleanup failure')});scope.dispose();
  scope.add(()=>released++);scope.guard(()=>released++)();
  assert.equal(released,2);assert.equal(warnings.length,1);
});

test('an interrupted wait settles immediately and ignores a later result or rejection',async()=>{
  for(const reject of [false,true]){
    const scope=createReaderScope(),pending=deferred();
    const waiting=scope.wait(pending.promise);scope.dispose();
    await assert.rejects(waiting,{name:'AbortError'});
    assert.equal(getEventListeners(scope.signal,'abort').length,0);
    if(reject)pending.reject(Error('obsolete failure'));else pending.resolve('obsolete result');
    await tick();
    await assert.rejects(scope.wait(Promise.resolve()),{name:'AbortError'});
  }
});

test('instance teardown releases content work at trimming, remains idempotent and preserves destroy arguments',()=>{
  const events=[],rendition={destroy:arg=>events.push(arg)},contents={destroy:()=>events.push('contents')};
  const lifetime=readerInstanceScope(rendition),child=readerContentsScope(rendition,contents);
  assert.equal(readerInstanceScope(rendition),lifetime);
  assert.equal(readerContentsScope(rendition,contents),child);
  child.add(()=>events.push('release'));
  contents.destroy();contents.destroy();assert.equal(child.disposed,true);assert.equal(lifetime.disposed,false);
  rendition.destroy('rendition');rendition.destroy('duplicate');
  assert.deepEqual(events,['release','contents','rendition']);
});

test('a disposed rendition rejects navigation without falling through to vendor display',async()=>{
  let displays=0;const rendition={display:()=>displays++};
  const operation=beginRenditionNavigation(rendition);disposeRenditionNavigation(rendition);
  assert.equal(operation.isCurrent(),false);
  assert.equal(await navigateRendition(rendition,'chapter.xhtml'),false);
  const stale=beginRenditionNavigation(rendition);
  assert.equal(await runRenditionMove(rendition,stale,()=>rendition.display()),false);
  assert.equal(displays,0);
});

function sessionFixture(t){
  const window=new EventTarget(),document=Object.assign(new EventTarget(),{hidden:false,body:{classList:{add(){},remove(){},toggle(){}}}});
  globals(t,{window,document,location:{href:'https://reader.test/reader.html?book=/media/shadow-garden/books/test.epub',search:'?book=/media/shadow-garden/books/test.epub'}});
  return{window,document,access:{initial:Promise.resolve({sourcePath:'/media/shadow-garden/books/test.epub'})}};
}

test('visual preparation uses the injected service and cancels with authorization ownership',async t=>{
  const f=sessionFixture(t),pending=deferred(),controller=new AbortController();
  Object.defineProperty(f.window,'__sgVisualPageCache',{
    get(){throw Error('An authorized session must not read the legacy global cache');}
  });
  const prepared=[];
  const opening=createAuthorizedBookSession({
    access:f.access,
    signal:controller.signal,
    visualPages:{prepare(reference){prepared.push(reference);return pending.promise;}}
  });
  await tick();
  assert.deepEqual(prepared,['/media/shadow-garden/books/test.epub']);
  controller.abort();
  await assert.rejects(opening,{name:'AbortError'});
  pending.resolve({visualPages:1});
  await tick();
  assert.equal(getEventListeners(f.window,'pageshow').length,0);

  const session=await createAuthorizedBookSession({
    access:f.access,
    visualPages:{prepare(reference){prepared.push(reference);return{visualPages:1};}}
  });
  assert.equal(prepared.length,2);
  assert.equal(session.sourcePath,prepared[1]);
  session.dispose();
});

test('each authorized session owns renewal; replacing it does not renew the old book',async t=>{
  const f=sessionFixture(t);let firstCalls=0,secondCalls=0;
  const first=await createAuthorizedBookSession({access:{...f.access,resolve:()=>{firstCalls++;return{expires:1}}}});
  f.window.dispatchEvent(new Event('pageshow'));await tick();assert.equal(firstCalls,1);
  first.dispose();
  const second=await createAuthorizedBookSession({access:{...f.access,resolve:()=>{secondCalls++;return{expires:2}}}});
  f.window.dispatchEvent(new Event('pageshow'));await tick();
  assert.equal(firstCalls,1);assert.equal(secondCalls,1);
  second.dispose();f.window.dispatchEvent(new Event('pageshow'));await tick();assert.equal(secondCalls,1);
});

test('disposal during access renewal prevents late ticket mutation',async t=>{
  const f=sessionFixture(t),pending=deferred();
  const session=await createAuthorizedBookSession({access:{...f.access,resolve:()=>pending.promise}});
  const initial=session.ticket,renewing=session.renewAccess();await tick();session.dispose();
  assert.equal(await renewing,null);pending.resolve({expires:99});await tick();assert.equal(session.ticket,initial);
});

test('aborted authorization cannot create a session or install resume handlers',async t=>{
  const f=sessionFixture(t),pending=deferred(),controller=new AbortController();let renewals=0;
  const opening=createAuthorizedBookSession({signal:controller.signal,access:{initial:pending.promise,resolve:()=>renewals++}});
  controller.abort();await assert.rejects(opening,{name:'AbortError'});
  pending.resolve({sourcePath:'/media/shadow-garden/books/test.epub'});await tick();
  f.window.dispatchEvent(new Event('pageshow'));await tick();assert.equal(renewals,0);
});

test('abandoned Read Again authorization cannot clear progress after catalog resolution',async t=>{
  const f=sessionFixture(t),pending=deferred(),controller=new AbortController();
  location.search+='&restart=1';location.href+='&restart=1';
  f.window.ShadowGardenData={loadCatalog:()=>pending.promise};
  const values=new Map([['sg-finished-books',JSON.stringify({'/media/shadow-garden/books/test.epub':123})],['sg-reader-progress:/media/shadow-garden/books/test.epub','{"cfi":"epubcfi(saved)"}']]);
  let writes=0;globals(t,{localStorage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes++;values.set(key,value)},removeItem:key=>{writes++;values.delete(key)}}});
  const before=[...values],opening=createAuthorizedBookSession({signal:controller.signal,access:f.access});
  await tick();controller.abort();await assert.rejects(opening,{name:'AbortError'});
  pending.resolve({series:[]});await tick();
  assert.deepEqual([...values],before);assert.equal(writes,0);
});

test('completion restart reset cannot write after its reader is disposed',async t=>{
  const f=sessionFixture(t),pending=deferred(),controller=new AbortController();
  f.window.ShadowGardenData={loadCatalog:()=>pending.promise};
  let writes=0;globals(t,{localStorage:{getItem:()=>null,setItem:()=>writes++,removeItem:()=>writes++}});
  const resetting=resetFinishedVolume('fixture-series','bk_fixture',{signal:controller.signal});
  controller.abort();pending.resolve({series:[{id:'fixture-series',volumes:[{file:'bk_fixture',number:1}]}]});
  assert.equal(await resetting,false);assert.equal(writes,0);
});
