import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { createSpeechStream } from '../public/assets/js/reader/speech-stream.js';

async function until(check) {
  for (let i=0;i<40;i++) { if(check())return; await setImmediate(); }
  assert.ok(check(), 'stream did not reach the expected state');
}
function mediaType(t, Type) {
  const original=Object.getOwnPropertyDescriptor(globalThis,'MediaSource');
  Object.defineProperty(globalThis,'MediaSource',{configurable:true,writable:true,value:Type});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'MediaSource',original);else delete globalThis.MediaSource;});
}
function fixture(t, { count=10, failAt=-1, hold=false }={}) {
  const state={urls:[],revoked:[],appends:0,removes:[],ended:0,selected:[],reads:[]};
  class Source extends EventTarget {
    start=0; end=0; updating=false; mode='segments';
    buffered={length:0,start:()=>this.start,end:()=>this.end};
    appendBuffer() {
      assert.equal(this.updating,false);this.updating=true;state.appends++;
      queueMicrotask(()=>{this.end+=3;this.buffered.length=1;this.updating=false;this.dispatchEvent(new Event('updateend'));});
    }
    remove(start,end) {
      assert.equal(this.updating,false);this.updating=true;state.removes.push([start,end]);
      queueMicrotask(()=>{this.start=end;this.updating=false;this.dispatchEvent(new Event('updateend'));});
    }
    abort(){this.updating=false;}
  }
  class Media extends EventTarget {
    static isTypeSupported(type){assert.equal(type,'audio/mpeg');return true;}
    readyState='closed'; source=new Source();
    addSourceBuffer(type){assert.equal(type,'audio/mpeg');return this.source;}
    endOfStream(){assert.equal(this.source.updating,false);this.readyState='ended';state.ended++;}
  }
  mediaType(t,Media);
  t.mock.method(URL,'createObjectURL',media=>{state.media=media;state.urls.push('blob:stream');return 'blob:stream';});
  t.mock.method(URL,'revokeObjectURL',url=>state.revoked.push(url));
  class Audio extends EventTarget {
    currentTime=0; changes=0;
    set src(value){assert.equal(value,'blob:stream');this.changes++;if(!hold)queueMicrotask(()=>{state.media.readyState='open';state.media.dispatchEvent(new Event('sourceopen'));});}
  }
  const audio=new Audio(),controller=new AbortController();
  const cursor=index=>({index,spineIndex:index<4?1:3,entries:[{text:'Original test passage'}]});
  const stream=createSpeechStream({audio,signal:controller.signal,
    readNext:async(from,signal)=>{signal.throwIfAborted();const index=from.index+1;state.reads.push(index);if(index===failAt)return {cursor:cursor(index),error:new Error('Provider unavailable')};return index<count?{cursor:cursor(index),blob:new Blob(['tone'])}:null;},
    onPassage:next=>state.selected.push(next.index),
  });
  t.after(()=>stream.dispose());
  return {state,audio,controller,stream,start:()=>stream.start(cursor(0),new Blob(['tone']))};
}
test('one native timeline appends only four future passages and advances by media time across chapters',async t=>{
  const f=fixture(t);await f.start();await until(()=>f.state.appends===5);
  assert.equal(f.state.media.source.mode,'sequence');assert.equal(f.audio.changes,1);
  assert.deepEqual(f.state.reads,[1,2,3,4]);
  f.audio.currentTime=9.2;f.audio.dispatchEvent(new Event('timeupdate'));
  await until(()=>f.state.appends===8);
  assert.deepEqual(f.state.selected,[3]);assert.equal(f.audio.changes,1);
  assert.deepEqual(f.state.removes,[[0,8]]);
  f.audio.currentTime=18.2;f.audio.dispatchEvent(new Event('timeupdate'));
  await until(()=>f.state.ended===1);
  assert.equal(f.state.appends,10);assert.equal(f.stream.error,null);
  f.audio.currentTime=27.2;f.audio.dispatchEvent(new Event('timeupdate'));
  assert.deepEqual(f.state.selected,[3,6,9]);
});
test('a future preparation error lets appended speech finish and retains the error for Retry',async t=>{
  const f=fixture(t,{failAt:3});await f.start();await until(()=>f.state.ended===1);
  assert.equal(f.state.appends,3);assert.equal(f.stream.error.message,'Provider unavailable');
  assert.equal(f.stream.failedCursor.index,3);
  assert.deepEqual(f.state.reads,[1,2,3]);
});
test('disposal aborts source opening and late media events cannot advance or refill',async t=>{
  const f=fixture(t,{hold:true}),starting=f.start();f.stream.dispose();
  await assert.rejects(starting,{name:'AbortError'});
  f.audio.currentTime=30;f.audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(f.state.appends,0);assert.deepEqual(f.state.reads,[]);
  assert.deepEqual(f.state.revoked,['blob:stream']);
});
test('unsupported MPEG streaming leaves the audio element untouched for clip fallback',t=>{
  mediaType(t,class{static isTypeSupported(){return false;}});
  assert.equal(createSpeechStream({}),null);
});
