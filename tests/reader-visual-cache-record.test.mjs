import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VISUAL_CACHE_VERSION,serializeVisualCache,deserializeVisualCache} from '../public/assets/js/reader/visual-cache-record.js';

test('portable image cache records preserve bytes, type, page metadata and shared assets',async()=>{
  const blob=new Blob(['Original technical SVG bytes'],{type:'image/svg+xml'});
  const record={version:VISUAL_CACHE_VERSION,key:'fixture',visuals:[{href:'cover.xhtml',blob},{href:'plate.xhtml',blob}]};
  const stored=await serializeVisualCache(record);
  assert.equal(stored.visuals[0].blob,undefined);
  assert.ok(stored.visuals[0].bytes instanceof ArrayBuffer);
  assert.equal(stored.visuals[0].bytes,stored.visuals[1].bytes);
  const restored=deserializeVisualCache(structuredClone(stored));
  assert.equal(restored.visuals[0].href,'cover.xhtml');assert.equal(restored.visuals[1].href,'plate.xhtml');
  assert.equal(restored.visuals[0].blob,restored.visuals[1].blob);
  assert.equal(restored.visuals[0].blob.type,blob.type);
  assert.equal(await restored.visuals[0].blob.text(),await blob.text());
  assert.equal(restored.visuals[0].bytes,undefined);
});

test('different images and MIME types retain distinct assets through the portable cache',async()=>{
  const record={visuals:[{blob:new Blob(['one'],{type:'image/webp'})},{blob:new Blob(['two'],{type:'image/png'})}]};
  const restored=deserializeVisualCache(structuredClone(await serializeVisualCache(record)));
  assert.notEqual(restored.visuals[0].blob,restored.visuals[1].blob);
  assert.deepEqual(await Promise.all(restored.visuals.map(row=>row.blob.text())),['one','two']);
  assert.deepEqual(restored.visuals.map(row=>row.blob.type),['image/webp','image/png']);
  assert.equal(deserializeVisualCache(null),null);
});
