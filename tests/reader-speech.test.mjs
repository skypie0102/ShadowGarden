import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitSpeechText} from '../public/assets/js/reader/speech-source.js';
import {speechSettings} from '../public/assets/js/reader/speech-controller.js';

test('speech chunks preserve text, bound long paragraphs and avoid broken surrogate pairs',()=>{
  for(const text of ['A short sentence.','One sentence. '.repeat(200),'漢字'.repeat(2000),'😀'.repeat(1400),'<voice> & punctuation?\nNext line.']){
    const chunks=splitSpeechText(text);
    assert.ok(chunks.every(c=>c.length>0&&c.length<=1000));
    assert.ok(chunks.every(c=>!/[\uD800-\uDBFF]$/.test(c)&&! /^[\uDC00-\uDFFF]/.test(c)));
    assert.equal(chunks.join('').replace(/\s/g,''),text.replace(/\s/g,''));
  }
  assert.deepEqual(splitSpeechText('  \n '),[]);
});
test('read aloud preferences have an Edge default, bounded speed and no autoplay state',()=>{
  assert.deepEqual(speechSettings(),{voice:'en-US-EmmaMultilingualNeural',speed:1,follow:true});
  assert.deepEqual(speechSettings({voice:'<bad>',speed:99,follow:false,playing:true}),{voice:'en-US-EmmaMultilingualNeural',speed:2,follow:false});
  assert.equal(speechSettings({speed:'bad'}).speed,1);
});
