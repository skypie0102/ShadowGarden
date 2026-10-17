import {test} from 'node:test';
import assert from 'node:assert/strict';
import {continuousContentHeight,ownContinuousContentHeight} from '../public/assets/js/reader/continuous-height.js';

function fixture(){
  let bottom=1367.09,scroll=0;
  const document={defaultView:{get scrollY(){return scroll}},documentElement:{scrollHeight:1367},
    body:{get scrollHeight(){return Math.round(bottom)},getBoundingClientRect:()=>({top:-scroll,bottom:bottom-scroll})}};
  const contents={document,textHeight(){assert.equal(this,contents);return Math.round(bottom-56-scroll)}};
  return{contents,setBottom:value=>{bottom=value},setScroll:value=>{scroll=value}};
}

test('vendor and adapter share intrinsic height including trailing body space',()=>{
  const f=fixture();ownContinuousContentHeight(f.contents);
  assert.equal(f.contents.textHeight(),1367);assert.equal(continuousContentHeight(f.contents),1367);
  const measure=f.contents.textHeight;ownContinuousContentHeight(f.contents);
  assert.equal(f.contents.textHeight,measure);
});

test('intrinsic height grows and shrinks despite the old iframe viewport floor',()=>{
  const f=fixture();ownContinuousContentHeight(f.contents);
  for(const height of [1687,1047,1367]){
    f.setBottom(height);assert.equal(f.contents.textHeight(),height);assert.equal(continuousContentHeight(f.contents),height);
  }
});

test('iframe scrolling does not change document height',()=>{
  const f=fixture();ownContinuousContentHeight(f.contents);f.setScroll(56);
  assert.equal(f.contents.textHeight(),1367);assert.equal(continuousContentHeight(f.contents),1367);
});

test('overflow beyond the body box remains in the measurement',()=>{
  const f=fixture();f.contents.textHeight=()=>1600;ownContinuousContentHeight(f.contents);
  assert.equal(f.contents.textHeight(),1600);
});

test('unowned layouts retain their existing scroll-extent fallback',()=>{
  const f=fixture();assert.equal(f.contents.textHeight(),1311);
  assert.equal(continuousContentHeight(f.contents),1367);
});
