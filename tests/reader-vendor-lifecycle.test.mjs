import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {installEpubLifecyclePatch} from '../public/assets/js/reader/epub-lifecycle.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
function fixture(){
  class Book{renderTo(){}}
  class Rendition extends EventEmitter{
    requireManager(){return class Manager{}}
    afterDisplayed(){}
    afterRemoved(){}
    destroy(){this.hooks=undefined}
    triggerMarkEvent(){}
  }
  installEpubLifecyclePatch({VERSION:'0.3',Book,Rendition});
  const rendition=new Rendition(),view=new EventEmitter();
  Object.assign(view,{section:{index:1},contents:{destroy(){}}});
  return{rendition,view};
}

test('late render and content hooks cannot publish after rendition disposal',async()=>{
  for(const stage of ['render','content']){
    const {rendition,view}=fixture(),gate=deferred(),entered=deferred();let calls=0,events=0;
    rendition.hooks={
      render:{trigger:()=>{if(stage==='render'){entered.resolve();return gate.promise}return Promise.resolve()}},
      content:{trigger:()=>{calls++;entered.resolve();return gate.promise}}
    };
    rendition.on('rendered',()=>events++);
    const pending=rendition.afterDisplayed(view);await entered.promise;
    rendition.destroy();gate.resolve();await pending;
    assert.equal(calls,stage==='render'?0:1);assert.equal(events,0);
  }
});

test('a trimmed view cancels render work while a live view still emits rendered',async()=>{
  for(const trim of [false,true]){
    const {rendition,view}=fixture(),gate=deferred();let events=0;
    rendition.hooks={render:{trigger:()=>gate.promise},content:{trigger:()=>Promise.resolve()}};
    rendition.on('rendered',()=>events++);
    const pending=rendition.afterDisplayed(view);
    if(trim)view.contents.destroy();gate.resolve();await pending;
    assert.equal(events,trim?0:1);rendition.destroy();
  }
});

test('late unloaded hooks cannot emit removal on a disposed rendition',async()=>{
  const {rendition,view}=fixture(),gate=deferred();let events=0;
  rendition.hooks={unloaded:{trigger:()=>gate.promise}};rendition.on('removed',()=>events++);
  const pending=rendition.afterRemoved(view);rendition.destroy();gate.resolve();await pending;
  assert.equal(events,0);
});
