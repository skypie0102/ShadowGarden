import test from 'node:test';
import assert from 'node:assert/strict';
import {applyParagraphAlignment} from '../public/assets/js/reader/paragraph-alignment.js';

function paragraph(initial={},text='Original paragraph'){
  const values=new Map(Object.entries(initial).map(([key,value])=>[key,[...value]]));
  let writes=0,hadStyle=values.size>0;
  return{textContent:text,values,writes:()=>writes,hasAttribute:()=>hadStyle,
    removeAttribute(){hadStyle=false},
    style:{get length(){return values.size},getPropertyValue:key=>values.get(key)?.[0]||'',getPropertyPriority:key=>values.get(key)?.[1]||'',
      setProperty(key,value,priority=''){writes++;values.set(key,[value,priority]);hadStyle=true},
      removeProperty(key){writes++;values.delete(key)}}};
}

test('Default leaves authored declarations untouched, including unrecognized preference values',()=>{
  const p=paragraph({'text-align':['center','important']});
  const contents={document:{querySelectorAll:()=>[p]}};
  applyParagraphAlignment(contents,'default');applyParagraphAlignment(contents,'center');
  assert.equal(p.writes(),0);assert.deepEqual(p.values.get('text-align'),['center','important']);
});

test('override cycles restore original values/priorities, preserve other styles and ignore artwork-only paragraphs',()=>{
  const authored=paragraph({'text-align':['center','important'],'text-align-last':['right','important'],color:['red','']}),
    inherited=paragraph(),art=paragraph({'text-align':['center','important']},'  '),
    contents={document:{querySelectorAll:selector=>{assert.equal(selector,'p');return[authored,inherited,art]}}};
  for(const alignment of ['left','justify','right']){
    applyParagraphAlignment(contents,alignment);
    for(const p of [authored,inherited]){
      assert.deepEqual(p.values.get('text-align'),[alignment,'important']);
      assert.deepEqual(p.values.get('text-align-last'),['auto','important']);
    }
  }
  applyParagraphAlignment(contents,'default');
  assert.deepEqual([...authored.values],[['text-align',['center','important']],['text-align-last',['right','important']],['color',['red','']]]);
  assert.equal(inherited.values.size,0);assert.equal(inherited.hasAttribute('style'),false);assert.equal(art.writes(),0);
  authored.style.setProperty('text-align','justify');
  applyParagraphAlignment(contents,'right');applyParagraphAlignment(contents,'default');
  assert.deepEqual(authored.values.get('text-align'),['justify','']);
});
