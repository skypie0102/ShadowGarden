import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cacheEvictions,createReaderCache} from '../public/assets/js/reader/cache-store.js';

const entry=(key,createdAt=1000,book=key,bytes=10,version=2)=>({key,createdAt,book,bytes,version});
const limits={version:2,maxEntries:3,maxPerBook:2,maxBytes:40,maxAgeMs:500,now:1000};

test('cache retention removes old versions and expired records',()=>{
  assert.deepEqual(cacheEvictions([entry('current'),entry('old-version',1000,'old',10,1),entry('expired',499)],limits),['old-version','expired']);
});
test('cache retention keeps newest layouts within a publication bound',()=>{
  assert.deepEqual(cacheEvictions([entry('old',800,'book'),entry('middle',900,'book'),entry('new',1000,'book')],limits),['old']);
});
test('cache retention bounds the global publication count',()=>{
  assert.deepEqual(cacheEvictions([entry('a',700),entry('b',800),entry('c',900),entry('d',1000)],limits),['a']);
});
test('cache retention bounds payload bytes and can retain smaller older records',()=>{
  assert.deepEqual(cacheEvictions([entry('large',1000,'a',30),entry('medium',900,'b',20),entry('small',800,'c',10)],limits),['medium']);
});
test('oversized or invalid records cannot displace usable cached data',()=>{
  assert.deepEqual(cacheEvictions([entry('too-big',1000,'a',41),entry('bad-bytes',1000,'b',NaN),entry('valid',900),entry('invalid',NaN)],limits),['too-big','bad-bytes','invalid']);
  assert.deepEqual(cacheEvictions([entry('old',700),entry('invalid',NaN),entry('new',1000)],{...limits,maxEntries:1}),['old','invalid']);
});
test('unavailable IndexedDB remains a non-fatal cache miss',async()=>{
  const cache=createReaderCache({database:'fixture',store:'fixture',...limits});
  assert.equal(await cache.get('key'),null);assert.equal(await cache.put({key:'key'}),false);
});
