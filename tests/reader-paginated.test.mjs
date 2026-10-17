import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPaginatedController} from '../public/assets/js/reader/paginated.js';
import {beginRenditionNavigation,renditionNavigationRevision,runRenditionMove} from '../public/assets/js/reader/navigation-state.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(t){
  const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};
  globalThis.document={getElementById:()=>null};
  globalThis.requestAnimationFrame=callback=>{queueMicrotask(()=>callback(0));return 1};
  t.after(()=>{for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value});
  const calls=[],rendition={next:()=>calls.push('next'),prev:()=>calls.push('prev')};
  const controller=createPaginatedController({getRendition:()=>rendition});
  return{controller,rendition,calls};
}

test('a page turn runs after an in-flight seek instead of overlapping the vendor call',async t=>{
  const f=fixture(t),displaying=deferred(),seek=beginRenditionNavigation(f.rendition);
  const moving=runRenditionMove(f.rendition,seek,()=>{f.calls.push('seek');return displaying.promise});
  await tick();const turning=f.controller.turn(1);
  await tick();assert.deepEqual(f.calls,['seek']);
  displaying.resolve();await moving;assert.equal(await turning,true);
  assert.deepEqual(f.calls,['seek','next']);
});

test('rapid intentional page turns accumulate instead of cancelling each other',async t=>{
  const f=fixture(t),first=f.controller.turn(1),second=f.controller.turn(1);
  await first;await second;assert.deepEqual(f.calls,['next','next']);
});

test('chapter navigation cancels queued page turns and takes effect after the active one',async t=>{
  const f=fixture(t),turning=deferred();
  f.rendition.next=()=>{f.calls.push('next');return turning.promise};
  const first=f.controller.turn(1),second=f.controller.turn(1);await tick();
  const explicit=beginRenditionNavigation(f.rendition);
  const navigating=runRenditionMove(f.rendition,explicit,()=>f.calls.push('chapter'));
  turning.resolve();await first;assert.equal(await second,false);await navigating;
  assert.deepEqual(f.calls,['next','chapter']);
});

test('separate page-turn batches invalidate snapshots taken between them',async t=>{
  const f=fixture(t);await f.controller.turn(-1);
  const captured=renditionNavigationRevision(f.rendition);
  await f.controller.turn(-1);
  assert.ok(renditionNavigationRevision(f.rendition)>captured);
});

test('the final encoded linear section completes before trailing auxiliary spine entries',async t=>{
  const f=fixture(t),classes=new Set(['hidden']);
  const endPage={
    classList:{contains:name=>classes.has(name),add:name=>classes.add(name),remove:name=>classes.delete(name)},
    querySelector:()=>null
  };
  document.getElementById=id=>id==='volumeEndPage'?endPage:null;
  document.body={classList:{contains:name=>name==='reader-flow-paginated'}};
  f.rendition.book={spine:{spineItems:[
    {href:'Text/chapter1.xhtml',index:0},
    {href:'Text/caf%C3%A9%20end.xhtml',index:1},
    {href:'notes.xhtml',index:2,linear:'no'}
  ]}};
  f.rendition.location={end:{href:'OEBPS/Text/café end.xhtml#last',displayed:{page:3,total:3}}};
  assert.equal(await f.controller.turn(1),true);
  assert.deepEqual(f.calls,[]);
  assert.equal(classes.has('active'),true);assert.equal(classes.has('hidden'),false);
});
