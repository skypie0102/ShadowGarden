import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as storage from '../public/assets/js/domain/storage.js';
import * as progress from '../public/assets/js/domain/progress.js';
import * as bookmarks from '../public/assets/js/domain/bookmarks.js';
import * as reading from '../public/assets/js/domain/reading-state.js';
import {createReaderStorage} from '../public/assets/js/reader/storage.js';
import {resetFinishedVolume} from '../public/assets/js/public/volume-actions.js';

const book='bk_0123456789012345678901',path='/media/shadow-garden/books/storage-fixture.epub';
const aliases=[book,path,'series:fixture:volume:1'];
const encoded=JSON.stringify;

function fixture(t,seed={}){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const data=new Map(Object.entries(seed)),events=[];let failure=()=>false;
  const target={
    getItem:key=>data.get(String(key))??null,
    setItem(key,value){if(failure('set',key,value))throw new DOMException('Fixture quota','QuotaExceededError');data.set(String(key),String(value));},
    removeItem(key){if(failure('remove',key))throw new DOMException('Fixture blocked','SecurityError');data.delete(String(key));},
    key:index=>[...data.keys()][index]??null,get length(){return data.size}
  };
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:target});
  t.after(()=>previous?Object.defineProperty(globalThis,'localStorage',previous):delete globalThis.localStorage);
  t.mock.method(console,'warn',()=>{});
  const previousDispatch=Object.getOwnPropertyDescriptor(globalThis,'dispatchEvent');
  Object.defineProperty(globalThis,'dispatchEvent',{configurable:true,value:event=>{events.push(event);return true}});
  t.after(()=>previousDispatch?Object.defineProperty(globalThis,'dispatchEvent',previousDispatch):delete globalThis.dispatchEvent);
  return {data,target,events,fail:predicate=>{failure=predicate},once(predicate){let failed=false;failure=(...args)=>!failed&&predicate(...args)&&(failed=true)}};
}
function snapshot(data){return Object.fromEntries([...data].sort(([a],[b])=>a.localeCompare(b)))}
const progressSeed=()=>Object.fromEntries(aliases.map(id=>[progress.progressKey(id),encoded({file:book,page:9,updatedAt:10})]));
const finishedSeed=()=>({[reading.KEY]:encoded(Object.fromEntries([...aliases.map(id=>[id,10]),['unrelated',11]])),...Object.fromEntries(aliases.map(id=>[reading.MARKER_PREFIX+id,'1']))});

test('failed bookmark alias save restores every original record',t=>{
  const seed=Object.fromEntries([path,book].map(id=>[bookmarks.bookmarkKey(id),encoded([{cfi:'old',at:1}])])),f=fixture(t,seed);
  f.once((op,key)=>op==='set'&&key===bookmarks.bookmarkKey(book));
  assert.equal(createReaderStorage(path,{publicIdentity:book}).saveBookmarks([{cfi:'new',at:2}]),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));
});
for(const action of ['save','clear'])test(`failed progress alias ${action} restores the old reading position`,t=>{
  const seed=progressSeed(),f=fixture(t,seed);
  f.once((op,key)=>op===(action==='save'?'set':'remove')&&key===progress.progressKey(path));
  const ok=action==='save'?progress.writeProgressAliases(aliases,{page:2,updatedAt:20}):progress.clearProgressAliases(aliases);
  assert.equal(ok,false);assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
for(const finished of [true,false])test(`failed Finished=${finished} save restores the map and compatibility markers`,t=>{
  const seed=finished?{[reading.KEY]:encoded({unrelated:11})}:finishedSeed(),f=fixture(t,seed);
  f.once((op,key)=>key===reading.MARKER_PREFIX+path);
  assert.equal(reading.setAliasesFinished(aliases,finished),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
test('failed settings compatibility write restores both preference records',t=>{
  const seed={'sg-reader-settings':encoded({theme:'night',swipeTurns:true}),'sg-reader-polish-settings':encoded({swipeTurns:true})},f=fixture(t,seed);
  f.once((op,key)=>key==='sg-reader-polish-settings');
  assert.equal(createReaderStorage(path).saveSettings({theme:'paper',swipeTurns:false}),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));
});
test('Read Again restores Finished status when removing progress fails',async t=>{
  const seed={...finishedSeed(),...progressSeed()},f=fixture(t,seed);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:{ShadowGardenData:{loadCatalog:async()=>({series:[{id:'fixture',volumes:[{bookId:book,file:book,number:1}]}]})}}});
  t.after(()=>previous?Object.defineProperty(globalThis,'window',previous):delete globalThis.window);
  f.once((op,key)=>op==='remove'&&key===progress.progressKey(path));
  // The protected source path is included in this fixture's volume identity.
  window.ShadowGardenData.loadCatalog=async()=>({series:[{id:'fixture',volumes:[{bookId:book,file:path,number:1}]}]});
  assert.equal(await resetFinishedVolume('fixture',book),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
test('unavailable storage cannot report a successful save or removal',t=>{
  fixture(t);Object.defineProperty(globalThis,'localStorage',{configurable:true,value:undefined});
  assert.equal(storage.writeJson('key',{}),false);assert.equal(storage.writeText('key','value'),false);assert.equal(storage.removeKey('key'),false);
});

for(const finished of [true,false])for(let failureIndex=0;failureIndex<=aliases.length;failureIndex++)test(`Finished=${finished} rolls back failure at write ${failureIndex+1}`,t=>{
  const seed=finished?{[reading.KEY]:encoded({unrelated:11})}:finishedSeed(),f=fixture(t,seed);let writes=0;
  f.once(()=>writes++===failureIndex);
  assert.equal(reading.setAliasesFinished(aliases,finished),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
test('successful reset preserves bookmarks and unrelated Finished entries, then publishes consistent events',t=>{
  const bookmarkKey=bookmarks.bookmarkKey(book),seed={...finishedSeed(),...progressSeed(),[bookmarkKey]:encoded([{cfi:'saved'}])},f=fixture(t,seed);
  assert.equal(reading.resetReadingAliases(aliases),true);
  for(const id of aliases){assert.equal(reading.isFinished(id),false);assert.equal(progress.readProgress(id),null)}
  assert.equal(reading.isFinished('unrelated'),true);assert.deepEqual(bookmarks.readBookmarks(book),[{cfi:'saved'}]);
  assert.deepEqual(f.events.map(e=>e.type),[reading.EVENT,progress.PROGRESS_EVENT]);
});
test('failed initial snapshot read cannot overwrite other Finished entries',t=>{
  const seed=finishedSeed(),f=fixture(t,seed),before=snapshot(f.data);
  t.mock.method(f.target,'getItem',()=>{throw new DOMException('Fixture blocked read','SecurityError')});
  assert.equal(reading.setAliasesFinished(aliases,false),false);
  assert.deepEqual(snapshot(f.data),before);assert.equal(f.events.length,0);
});
test('a later snapshot read failure is detected before any earlier key is written',t=>{
  const seed=progressSeed(),f=fixture(t,seed),original=f.target.getItem;
  t.mock.method(f.target,'getItem',key=>{if(key===progress.progressKey(path))throw new DOMException('Fixture blocked read','SecurityError');return original(key)});
  assert.equal(progress.writeProgressAliases(aliases,{page:2,updatedAt:20}),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
test('malformed shared Finished state is retained rather than replaced by an empty map',t=>{
  const f=fixture(t,{[reading.KEY]:'{broken'});
  assert.equal(reading.setAliasesFinished(aliases,true),false);
  assert.deepEqual(snapshot(f.data),{[reading.KEY]:'{broken'});
});
test('unserializable progress cannot leave a partial alias save or throw',t=>{
  const seed=progressSeed(),f=fixture(t,seed),value={};value.cycle=value;
  assert.equal(progress.writeProgressAliases(aliases,value),false);
  assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
});
test('rollback preserves a later value from another tab',t=>{
  const keyA=bookmarks.bookmarkKey(path),keyB=bookmarks.bookmarkKey(book),f=fixture(t,{[keyA]:'[]',[keyB]:'[]'});
  const external=encoded([{cfi:'other-tab'}]);
  f.once((op,key)=>{if(key!==keyB)return false;f.data.set(keyA,external);return true});
  assert.equal(bookmarks.writeBookmarksAliases([path,book],[{cfi:'attempt'}]),false);
  assert.equal(f.data.get(keyA),external);assert.equal(f.data.get(keyB),'[]');
});
test('a change observed before the next write aborts that stale write',t=>{
  const f=fixture(t,{first:'old',second:'old'}),original=f.target.setItem;
  t.mock.method(f.target,'setItem',(key,value)=>{original(key,value);if(key==='first'&&value==='new')f.data.set('second','other-tab')});
  assert.equal(storage.writeChanges([{key:'first',value:'new'},{key:'second',value:'new'}]),false);
  assert.deepEqual(snapshot(f.data),{first:'old',second:'other-tab'});
});
test('rollback refusal reports failure without publishing success',t=>{
  const seed=progressSeed(),f=fixture(t,seed);
  f.fail((op,key,value)=>key===progress.progressKey(path)||key===progress.progressKey(book)&&JSON.parse(value).page===9);
  assert.equal(progress.writeProgressAliases(aliases,{page:2,updatedAt:20}),false);
  assert.equal(f.events.length,0);assert.equal(progress.readProgress(book).page,2);
  assert.ok(console.warn.mock.calls.some(call=>String(call.arguments[0]).includes('restore all browser data')));
});
test('Finished migration rolls back a rejected compatibility write and preserves unrelated entries on success',t=>{
  const seed={[reading.KEY]:encoded({[path]:10,unrelated:11}),[reading.MARKER_PREFIX+path]:'1'},f=fixture(t,seed);
  f.once((op,key)=>key===reading.MARKER_PREFIX+book);
  assert.equal(reading.migrateFinished(path,book),false);assert.deepEqual(snapshot(f.data),snapshot(new Map(Object.entries(seed))));assert.equal(f.events.length,0);
  f.fail(()=>false);assert.equal(reading.migrateFinished(path,book),true);
  assert.equal(reading.isFinished(path),false);assert.equal(reading.isFinished(book),true);assert.equal(reading.isFinished('unrelated'),true);
  assert.equal(f.events.length,1);
});
test('legacy Finished arrays retain other identities when a successful update writes the supported object map',t=>{
  const f=fixture(t,{[reading.KEY]:encoded([path,'unrelated'])});
  assert.equal(reading.setAliasesFinished([book],true),true);
  for(const id of [path,book,'unrelated'])assert.equal(reading.isFinished(id),true);
  assert.equal(Array.isArray(JSON.parse(f.data.get(reading.KEY))),false);
});
