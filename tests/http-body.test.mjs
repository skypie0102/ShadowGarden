import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedBytes,bodyJson} from '../server/http.js';

function streamed(chunks,headers={}){
  let index=0,cancelled=false;
  const body=new ReadableStream({
    pull(controller){if(index===chunks.length)controller.close();else controller.enqueue(chunks[index++]);},
    cancel(){cancelled=true;}
  },{highWaterMark:0});
  return {request:new Request('https://garden.test/upload',{method:'POST',headers,body,duplex:'half'}),cancelled:()=>cancelled};
}
const error=(status,code)=>e=>e.status===status&&e.code===code;

for(const declared of [true,false])test(`fragmented body preserves bytes and exact limit (${declared?'declared':'unknown'} length)`,async()=>{
  const source=Uint8Array.from([99,1,2,3,4,5,99]);
  const {request}=streamed([source.subarray(1,3),new Uint8Array(),source.subarray(3,6)],declared?{'content-length':'5'}:{});
  assert.deepEqual(await boundedBytes(request,5),Uint8Array.from([1,2,3,4,5]));
  assert.equal(request.body.locked,false);
});
test('declared oversized or malformed bodies are rejected before reading',async()=>{
  for(const length of ['6','invalid','-1']){
    const {request}=streamed([Uint8Array.of(1)],{'content-length':length});
    await assert.rejects(boundedBytes(request,5),error(413,'body_too_large'));
    assert.equal(request.bodyUsed,false);
  }
});
test('unknown length cannot exceed the byte budget and cancels the source',async()=>{
  const {request,cancelled}=streamed([Uint8Array.of(1,2),Uint8Array.of(3,4)]);
  await assert.rejects(boundedBytes(request,3),error(413,'body_too_large'));
  assert.equal(cancelled(),true);assert.equal(request.body.locked,false);
});
test('understated length cannot truncate the returned body and cancels the source',async()=>{
  const {request,cancelled}=streamed([Uint8Array.of(1,2),Uint8Array.of(3)],{'content-length':'2'});
  await assert.rejects(boundedBytes(request,5),error(400,'invalid_body_length'));
  assert.equal(cancelled(),true);assert.equal(request.body.locked,false);
});
test('overstated length cannot append zero-filled bytes',async()=>{
  const {request}=streamed([Uint8Array.of(1,2)],{'content-length':'3'});
  await assert.rejects(boundedBytes(request,5),error(400,'invalid_body_length'));
  assert.equal(request.body.locked,false);
});
test('a failed body stream releases its reader and preserves the source error',async()=>{
  const failure=new Error('fixture interrupted');
  const request=new Request('https://garden.test/upload',{method:'POST',headers:{'content-length':'2'},body:new ReadableStream({pull(controller){controller.error(failure)}}),duplex:'half'});
  await assert.rejects(boundedBytes(request,5),e=>e===failure);assert.equal(request.body.locked,false);
});
test('empty bodies and fragmented JSON retain their contracts',async()=>{
  for(const headers of [{},{'content-length':'0'}])assert.deepEqual(await boundedBytes(new Request('https://garden.test',{method:'POST',headers}),5),new Uint8Array());
  const {request}=streamed([new TextEncoder().encode('{"ok":'),new TextEncoder().encode('true}')],{'content-type':'application/json','content-length':'11'});
  assert.deepEqual(await bodyJson(request),{ok:true});
});
