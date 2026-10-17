import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookSearchController} from '../public/assets/js/reader/book-search.js';
import {getReaderDiagnostics} from '../public/assets/js/reader/diagnostics.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
const failures=()=>getReaderDiagnostics().counts['search.sectionFailed']||0;

function fixture(){
  const pending=deferred();let unloaded=0;
  const section={index:0,href:'chapter.xhtml',document:null,load:()=>pending.promise,
    unload(){unloaded++;this.document=null}};
  const controller=createBookSearchController({getBook:()=>({spine:{spineItems:[section]},load(){}})});
  return{pending,section,controller,unloaded:()=>unloaded};
}

for(const action of ['cancel','dispose','supersede'])test(`${action} keeps a late search load failure quiet and releases its source`,async()=>{
  const f=fixture(),before=failures(),progress=[];
  const old=f.controller.search('older query',{onProgress:value=>progress.push(value)});
  let latest;
  if(action==='supersede')latest=f.controller.search('latest query');
  else f.controller[action]();
  // A partially loaded source must still be released on rejection.
  f.section.document={};f.pending.reject(Error('private obsolete source failure'));
  assert.equal((await old).cancelled,true);
  if(latest){assert.equal((await latest).cancelled,undefined);assert.equal(failures(),before+1)}
  else assert.equal(failures(),before);
  assert.equal(progress.length,1);assert.equal(f.unloaded(),1);
  assert.equal(f.controller.isBusy(),false);
});

test('an active search reports a failed section and continues to the next source',async()=>{
  const before=failures(),loaded=[];
  const controller=createBookSearchController({getBook:()=>({load(){},spine:{spineItems:[
    {index:0,load(){throw new DOMException('private active failure','AbortError')}},
    {index:1,load(){loaded.push(1);return Promise.resolve()},unload(){}}
  ]}})});
  const result=await controller.search('active query');
  assert.deepEqual(loaded,[1]);assert.equal(result.totalSections,2);
  assert.equal(result.cancelled,undefined);assert.equal(failures(),before+1);
  assert.equal(controller.isBusy(),false);
  assert.ok(!JSON.stringify(getReaderDiagnostics()).includes('private active failure'));
});
