import test from 'node:test';import assert from 'node:assert/strict';
import {readLibraryLocation,writeLibraryLocation,activeLibraryFilterCount} from '../public/assets/js/public/library-location.js';

test('URL state preserves repeated tags, search text and explicit choices over preferences',()=>{
 const state=readLibraryLocation('https://example.test/nsfw?q=two+words&tag=Magic&tag=Magic&tag=Fanfic&sort=title&view=compact&pinned=1&reading=finished',{sort:'year',view:'grid'});
 assert.equal(state.query,'two words');assert.deepEqual([...state.tags],['Magic','Fanfic']);assert.equal(state.sort,'title');assert.equal(state.view,'compact');assert.equal(activeLibraryFilterCount(state),5);
});
test('unknown choices fall back to preferences and do not become filters',()=>{
 const state=readLibraryLocation('https://example.test/?sort=unknown&view=invalid&reading=invalid',{sort:'year',view:'compact'});
 assert.equal(state.sort,'year');assert.equal(state.view,'compact');assert.equal(state.readingStatus,'');assert.equal(activeLibraryFilterCount(state),0);
});
test('writing filters keeps age-gate return and unknown parameters/hash intact',()=>{
 const url='https://example.test/nsfw?return=%2Fseries%3Fid%3Dadult-fixture&future=1&q=old&tag=old#catalog';
 const state=readLibraryLocation(url);Object.assign(state,{query:'  new words  ',tags:new Set(['z','a']),view:'compact',pinnedOnly:true});
 const result=writeLibraryLocation(url,state),parsed=new URL(result,'https://example.test');
 assert.equal(parsed.searchParams.get('return'),'/series?id=adult-fixture');assert.equal(parsed.searchParams.get('future'),'1');assert.equal(parsed.hash,'#catalog');assert.deepEqual(parsed.searchParams.getAll('tag'),['a','z']);assert.equal(parsed.searchParams.get('q'),'new words');
 assert.equal(writeLibraryLocation(parsed.href,readLibraryLocation(parsed.href)),result);
});
