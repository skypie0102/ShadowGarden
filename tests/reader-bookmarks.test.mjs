import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookmarksController} from '../public/assets/js/reader/bookmarks-controller.js';
import {getReaderDiagnostics} from '../public/assets/js/reader/diagnostics.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const failures=()=>getReaderDiagnostics().counts['navigation.bookmarkFailed']||0;

// Only the DOM surface needed to exercise the real controller's event/lifetime
// boundary. Full browser coverage checks actual buttons, diagnostics and toasts.
class Element extends EventTarget{
  children=[];attributes=new Map();textContent='';
  append(...children){this.children.push(...children)}
  appendChild(child){this.append(child)}
  replaceChildren(...children){this.children=[...children]}
  setAttribute(name,value){this.attributes.set(name,value)}
  click(){this.dispatchEvent(new Event('click'))}
}

function fixture(t,{canonical=true}={}){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Element()}});
  t.after(()=>previous?Object.defineProperty(globalThis,'document',previous):delete globalThis.document);
  const lookup=deferred(),navigation=deferred(),panel=new Element(),moves=[],messages=[];
  let closed=0,writes=0;
  const bookmark={cfi:'epubcfi(saved)',page:3,totalPages:10,pageMapFingerprint:'fixture-map',label:'Saved passage'};
  const controller=createBookmarksController({
    storage:{loadBookmarks:()=>[bookmark],saveBookmarks:()=>writes++},
    elements:{bookmarksPanel:panel},
    getPageMap:()=>({fingerprint:()=>canonical?'fixture-map':'different-map',targetForPosition:()=>lookup.promise}),
    navigate:target=>{moves.push(target);return navigation.promise},
    closeDrawers:()=>closed++,toast:message=>messages.push(message)
  });
  t.after(()=>controller.dispose());
  const open=()=>panel.children[0].children.find(child=>child.attributes.get('aria-label')==='Open bookmark 1').click();
  return{controller,lookup,navigation,panel,moves,messages,open,closed:()=>closed,writes:()=>writes};
}

for(const stage of ['lookup','navigation']){
  test(`an active bookmark ${stage} failure remains visible even when named AbortError`,async t=>{
    const f=fixture(t),before=failures();f.open();
    if(stage==='navigation'){f.lookup.resolve('epubcfi(mapped)');await tick()}
    f[stage].reject(new DOMException('Private active bookmark failure','AbortError'));await tick();
    assert.equal(failures(),before+1);assert.deepEqual(f.messages,['Could not open bookmark']);
    assert.equal(f.closed(),0);assert.equal(f.writes(),0);
    assert.ok(!JSON.stringify(getReaderDiagnostics()).includes('Private active bookmark failure'));
  });

  test(`a bookmark ${stage} failure after disposal stays quiet`,async t=>{
    const f=fixture(t),before=failures();f.open();
    if(stage==='navigation'){f.lookup.resolve('epubcfi(mapped)');await tick()}
    f.controller.dispose();f[stage].reject(Error('Private obsolete bookmark failure'));await tick();
    assert.equal(failures(),before);assert.deepEqual(f.messages,[]);assert.equal(f.closed(),0);
    assert.equal(f.moves.length,stage==='navigation'?1:0);assert.equal(f.writes(),0);
    assert.equal(f.panel.children.length,0);
  });
}

test('a late successful bookmark lookup cannot navigate after disposal',async t=>{
  const f=fixture(t);f.open();f.controller.dispose();f.lookup.resolve('epubcfi(obsolete)');await tick();
  assert.deepEqual(f.moves,[]);assert.deepEqual(f.messages,[]);assert.equal(f.closed(),0);
});

test('an active bookmark lookup survives row refresh and closes only after navigation settles',async t=>{
  const f=fixture(t);f.open();f.controller.render();f.lookup.resolve('epubcfi(mapped)');await tick();
  assert.deepEqual(f.moves,['epubcfi(mapped)']);assert.equal(f.closed(),0);
  f.navigation.resolve();await tick();assert.equal(f.closed(),1);assert.deepEqual(f.messages,[]);
});

test('an unmapped bookmark uses its saved CFI and cannot close drawers after disposal',async t=>{
  const f=fixture(t,{canonical:false});f.open();assert.deepEqual(f.moves,['epubcfi(saved)']);
  f.controller.dispose();f.navigation.resolve();await tick();assert.equal(f.closed(),0);
  assert.deepEqual(f.messages,[]);assert.equal(f.writes(),0);
});

function editableFixture(t){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Element()}});
  t.after(()=>previous?Object.defineProperty(globalThis,'document',previous):delete globalThis.document);
  const saved={cfi:'epubcfi(saved)',label:'Original bookmark',at:1000},inserted={cfi:'epubcfi(other)',label:'Another tab bookmark',at:2000};
  let records=[saved],writable=true;const messages=[],panel=new Element();
  const controller=createBookmarksController({storage:{loadBookmarks:()=>structuredClone(records),saveBookmarks:next=>{if(!writable)return false;records=structuredClone(next);return true}},elements:{bookmarksPanel:panel},getCfi:()=> 'epubcfi(current)',getPosition:()=>({cfi:'epubcfi(current)'}),toast:message=>messages.push(message)});
  t.after(()=>controller.dispose());
  return{controller,messages,records:()=>records,failWrites:()=>{writable=false},externalInsert:()=>{records=[inserted,...records]},remove:()=>panel.children[0].children.find(child=>child.attributes.get('aria-label')==='Delete bookmark 1').click()};
}

for(const action of ['add','remove'])test(`failed bookmark ${action} reports a storage failure instead of success`,t=>{
  const f=editableFixture(t);f.failWrites();
  if(action==='add')f.controller.toggle();else f.remove();
  assert.equal(f.records().length,1);assert.match(f.messages[0],/could not save bookmarks/i);
});

test('deleting a displayed bookmark cannot remove a different bookmark inserted by another tab',t=>{
  const f=editableFixture(t);f.externalInsert();f.remove();
  assert.deepEqual(f.records().map(b=>b.cfi),['epubcfi(other)']);
});
