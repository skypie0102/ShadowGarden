import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withSectionSource,retainSectionSource,ownViewSource,ownLocationSources} from '../public/assets/js/reader/section-source.js';

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const request=deferred();let loads=0,unloads=0;
  const section={
    load(){loads++;return request.promise.then(doc=>{this.document=doc;this.contents=doc.root;return this.contents})},
    unload(){unloads++;this.document=undefined;this.contents=undefined;this.output=undefined}
  };
  return{section,request,get loads(){return loads},get unloads(){return unloads}};
}

test('overlapping source readers share one load and release after the final reader finishes',async()=>{
  const f=fixture(),hold=deferred(),doc={root:{}};
  const first=withSectionSource(f.section,null,async document=>{assert.equal(document,doc);await hold.promise;assert.equal(f.section.document,doc)});
  const second=withSectionSource(f.section,null,document=>assert.equal(document,doc));
  assert.equal(f.loads,1);f.request.resolve(doc);await second;
  assert.equal(f.unloads,0);hold.resolve();await first;
  assert.equal(f.unloads,1);assert.equal(f.section.document,undefined);
});

test('view replacement releases its source after rendered contents are destroyed',async()=>{
  const f=fixture(),doc={root:{}},order=[];
  const view=ownViewSource({destroy(){assert.equal(f.section.document,doc);order.push('contents')}},f.section);
  const read=withSectionSource(f.section,null,()=>{});f.request.resolve(doc);await read;
  assert.equal(f.unloads,0);view.destroy();assert.deepEqual(order,['contents']);assert.equal(f.unloads,1);
});

test('different views of one section keep the source until both are gone',async()=>{
  const f=fixture(),doc={root:{}};
  const first=ownViewSource({destroy(){}},f.section),second=ownViewSource({destroy(){}},f.section);
  assert.equal(ownViewSource(first,f.section),first);
  const read=withSectionSource(f.section,null,()=>{});f.request.resolve(doc);await read;
  first.destroy();first.destroy();f.section.unload();assert.equal(f.unloads,0);
  second.destroy();assert.equal(f.unloads,1);
});

test('a view created during a pending search load survives the search release',async()=>{
  const f=fixture(),doc={root:{}};
  const search=withSectionSource(f.section,null,()=>{});
  const view=ownViewSource({destroy(){}},f.section);
  const rendering=f.section.load();assert.equal(f.loads,1);
  f.request.resolve(doc);await search;await rendering;
  assert.equal(f.section.document,doc);assert.equal(f.unloads,0);
  view.destroy();assert.equal(f.unloads,1);
});

test('location generation cannot unload source leased by a live view',async()=>{
  const f=fixture(),doc={root:{}},view=ownViewSource({destroy(){}},f.section);
  const book={locations:{async process(section){await section.load();section.unload();assert.equal(section.document,doc)}}};
  ownLocationSources(book);
  const generating=book.locations.process(f.section);await tick();f.request.resolve(doc);await generating;
  assert.equal(f.unloads,0);view.destroy();assert.equal(f.unloads,1);
});

test('a failed load can retry and a failed callback releases its source',async()=>{
  let attempts=0,unloads=0;const doc={root:{}};
  const section={async load(){if(++attempts===1)throw Error('fixture failure');this.document=doc;this.contents=doc.root},
    unload(){unloads++;this.document=undefined;this.contents=undefined}};
  await assert.rejects(withSectionSource(section,null,()=>{}),/fixture failure/);
  await assert.rejects(withSectionSource(section,null,document=>{assert.equal(document,doc);throw Error('callback failure')}),/callback failure/);
  assert.equal(attempts,2);assert.equal(unloads,1);assert.equal(section.document,undefined);
});

test('a partially loaded document is not read until vendor content hooks finish',async()=>{
  const hooks=deferred(),doc={root:{}};let reads=0,loads=0;
  const section={async load(){loads++;this.document=doc;this.contents=doc.root;await hooks.promise},unload(){this.document=undefined;this.contents=undefined}};
  const first=withSectionSource(section,null,()=>reads++);
  const second=withSectionSource(section,null,()=>reads++);
  await tick();assert.equal(reads,0);assert.equal(loads,1);
  hooks.resolve();await Promise.all([first,second]);assert.equal(reads,2);assert.equal(section.document,undefined);
});

test('disposal during a load releases the late document instead of retaining it',async()=>{
  const f=fixture(),release=retainSectionSource(f.section),loading=f.section.load();
  release();release();f.request.resolve({root:{}});await loading;await tick();
  assert.equal(f.section.document,undefined);assert.equal(f.unloads,1);
});

test('Section destruction preserves pending vendor hooks until the last read lease settles',async()=>{
  const request=deferred(),hold=deferred();let hooks=0,destroys=0;
  const section={
    hooks:{content(){hooks++}},
    async load(){this.document=await request.promise;this.hooks.content();return this.document},
    unload(){this.document=undefined},
    destroy(){destroys++;this.unload();this.hooks=undefined}
  };
  const reading=withSectionSource(section,null,async document=>{assert.deepEqual(document,{root:{}});await hold.promise});
  section.destroy();section.destroy();assert.equal(destroys,0);
  await assert.rejects(section.load(),{name:'AbortError'});
  request.resolve({root:{}});await tick();assert.equal(hooks,1);assert.equal(destroys,0);
  hold.resolve();await reading;assert.equal(destroys,1);assert.equal(section.document,undefined);
  await assert.rejects(withSectionSource(section,null,()=>{}),{name:'AbortError'});
});

test('a rejected pending Section load still completes requested destruction exactly once',async()=>{
  const request=deferred();let destroys=0;
  const section={load:()=>request.promise,unload(){},destroy(){destroys++}};
  const reading=withSectionSource(section,null,()=>{});
  section.destroy();request.reject(Error('fixture load rejected'));
  await assert.rejects(reading,/fixture load rejected/);await tick();
  section.destroy();assert.equal(destroys,1);
});

function locationFixture(sections){
  let parsed=0;
  const locations={
    _locations:[],pause:0,spine:{each:fn=>sections.forEach(fn)},q:{stop(){}},
    generate(){throw Error('obsolete vendor generate')},process(){throw Error('obsolete vendor process')},
    parse(root){parsed++;return[root.id]},
    destroy(){this._locations=undefined;this.spine=undefined}
  };
  const book={locations,destroy(){locations.destroy()}};ownLocationSources(book);
  return{book,locations,get parsed(){return parsed}};
}

test('owned location generation retains vendor parsing and processes linear sections once',async()=>{
  const sections=[1,2,3].map(id=>({linear:id!==2,cfiBase:'fixture',async load(){this.document={documentElement:{id}}},unload(){this.document=undefined}}));
  const f=locationFixture(sections),generating=f.locations.generate(1200);
  assert.equal(f.locations.generate(1200),generating);
  assert.deepEqual(await generating,[1,3]);assert.equal(f.locations.total,1);assert.equal(f.parsed,2);
  assert.equal(f.locations.break,1200);f.book.destroy();
});

test('closing a book during a location source load prevents late parsing or array writes',async()=>{
  const request=deferred(),section={linear:true,async load(){this.document=await request.promise},unload(){this.document=undefined}};
  const f=locationFixture([section]),generating=f.locations.generate(1200);
  f.book.destroy();await assert.rejects(generating,{name:'AbortError'});
  request.resolve({documentElement:{id:1}});await tick();
  assert.equal(f.parsed,0);assert.equal(section.document,undefined);
  await assert.rejects(f.locations.generate(1200),{name:'AbortError'});
});

test('closing locations after parsing cancels their pending pacing timer',async()=>{
  const entered=deferred(),section={linear:true,async load(){this.document={documentElement:{id:1}}},unload(){this.document=undefined}};
  const f=locationFixture([section]),parse=f.locations.parse;
  f.locations.pause=10000;f.locations.parse=function(...args){entered.resolve();return parse.apply(this,args)};
  const generating=f.locations.generate(1200);await entered.promise;f.book.destroy();
  await assert.rejects(generating,{name:'AbortError'});assert.equal(f.parsed,1);
});
