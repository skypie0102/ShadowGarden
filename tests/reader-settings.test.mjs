import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsController} from '../public/assets/js/reader/settings.js';

function fixture(t,{mobile,saved={}}){
  const previousMatch=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  Object.defineProperty(globalThis,'matchMedia',{value:()=>({matches:mobile}),configurable:true,writable:true});
  t.after(()=>previousMatch?Object.defineProperty(globalThis,'matchMedia',previousMatch):delete globalThis.matchMedia);
  const previous=globalThis.document;
  globalThis.document={body:{classList:{remove(){},add(){},toggle(){}}}};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous});
  const resetReader=new EventTarget(),alignmentSelect=Object.assign(new EventTarget(),{value:''}),applied=[];let persisted,previousFlow;
  const settings=createSettingsController({storage:{loadSettings:defaults=>({...defaults,...saved}),saveSettings:value=>{persisted={...value}}},elements:{resetReader,alignmentSelect},onApply:value=>applied.push(value),onReset:value=>{previousFlow=value}});
  t.after(()=>settings.dispose());
  return{settings,alignmentSelect,applied,reset:()=>resetReader.dispatchEvent(new Event('click')),persisted:()=>persisted,previousFlow:()=>previousFlow};
}

for(const mobile of [false,true])test(`reset uses ${mobile?'mobile Continuous':'desktop Pages'} defaults after an explicit flow choice`,t=>{
  const chosen=mobile?'paginated':'scrolled-doc';
  const f=fixture(t,{mobile,saved:{flow:chosen,fontSize:140,theme:'paper',alignment:'right'}});
  assert.equal(f.settings.get().flow,chosen);
  f.reset();
  assert.equal(f.settings.get().flow,mobile?'scrolled-doc':'paginated');
  assert.equal(f.persisted().flow,mobile?'scrolled-doc':'paginated');
  assert.equal(f.persisted().fontSize,100);assert.equal(f.persisted().theme,'garden');
  assert.equal(f.persisted().alignment,'default');assert.equal(f.alignmentSelect.value,'default');
  assert.equal(f.previousFlow(),chosen);
});

test('alignment accepts only the offered values and migrates missing/invalid preferences to Default',t=>{
  const f=fixture(t,{mobile:false});
  for(const alignment of [undefined,null,'center','LEFT',{},'default','left','justify','right']){
    const expected=['left','justify','right'].includes(alignment)?alignment:'default';
    f.settings.replace({alignment});
    assert.equal(f.settings.get().alignment,expected);
    assert.equal(f.persisted().alignment,expected);
    assert.equal(f.alignmentSelect.value,expected);
  }
});

test('alignment changes persist and request semantic reflow and a fresh page map',t=>{
  const f=fixture(t,{mobile:true});
  for(const alignment of ['left','justify','right','default']){
    f.alignmentSelect.value=alignment;
    f.alignmentSelect.dispatchEvent(new Event('change'));
    assert.equal(f.persisted().alignment,alignment);
    assert.deepEqual(f.applied.at(-1),{relayout:true,rebuildPageMap:true});
  }
});

for(const mobile of [false,true])for(const flow of [undefined,'invalid'])test(`missing/invalid flow uses device defaults (mobile=${mobile}, flow=${flow})`,t=>{
  const f=fixture(t,{mobile,saved:{flow}});
  assert.equal(f.settings.get().flow,mobile?'scrolled-doc':'paginated');
});
