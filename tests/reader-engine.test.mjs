import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getReaderEngine,initializeReaderEngine} from '../public/assets/js/reader/engine.js';

function runtimeFixture(t){
  const listeners=[],calls=[];
  class Surface extends EventTarget{
    addEventListener(type,...args){listeners.push(type);super.addEventListener(type,...args);}
  }
  const window=new Surface(),document=Object.assign(new Surface(),{readyState:'loading'});
  class Book{renderTo(){return {};}}
  class Rendition{requireManager(){return class Manager{};}}
  function epub(...args){calls.push(args);return new Book();}
  Object.assign(epub,{VERSION:'0.3',Book,Rendition});
  window.ePub=epub;
  for(const [name,value] of Object.entries({window,document,ePub:epub,location:{href:'https://reader.test/reader.html',search:''}})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});
    t.after(()=>previous?Object.defineProperty(globalThis,name,previous):delete globalThis[name]);
  }
  return{epub,window,document,listeners,calls};
}

test('opening through the engine requires explicit initialization',()=>{
  assert.throws(()=>getReaderEngine(),/has not initialized/);
});

test('engine initialization is idempotent and leaves the vendor factory intact',t=>{
  const f=runtimeFixture(t),engine=initializeReaderEngine();
  const count=f.listeners.length;
  assert.equal(initializeReaderEngine(),engine);
  assert.equal(f.listeners.length,count);
  assert.equal(f.window.ePub,f.epub);assert.equal(globalThis.ePub,f.epub);
  assert.equal(getReaderEngine(),engine);
  assert.deepEqual(engine.extensions,['compatibility','footnotes','internal-links','visual-cache','paginated-visual-fit','continuous-core']);
  assert.ok(Object.isFrozen(engine));assert.ok(Object.isFrozen(engine.extensions));
});

test('one vendor call creates a book with every ordered reader extension',t=>{
  const f=runtimeFixture(t),engine=initializeReaderEngine();
  const options={openAs:'epub'},book=engine.createBook('/media/fixture.epub',options);
  assert.deepEqual(f.calls,[['/media/fixture.epub',options]]);
  for(const marker of ['__sgAdapterPatched','__sgFootnotesPatched','__sgInternalLinksPatched','__sgVisualCacheBookPatched','__sgPaginatedVisualFrameBookPatched','__sgContinuousCoreBookPatched'])assert.equal(book[marker],true,marker);
  assert.equal(f.window.ePub,f.epub);
});

test('unsupported runtimes fail before installing reader listeners or patches',t=>{
  const f=runtimeFixture(t);
  for(const invalid of [null,{},Object.assign(()=>{}, {VERSION:'0.4'}),Object.assign(()=>{}, {VERSION:'0.3'})]){
    assert.throws(()=>initializeReaderEngine(invalid),/Unsupported EPUB.js runtime/);
  }
  assert.equal(f.listeners.length,0);
});
