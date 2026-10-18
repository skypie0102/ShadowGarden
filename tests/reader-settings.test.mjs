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
  const resetReader=new EventTarget();let persisted,previousFlow;
  const settings=createSettingsController({storage:{loadSettings:defaults=>({...defaults,...saved}),saveSettings:value=>{persisted={...value}}},elements:{resetReader},onReset:value=>{previousFlow=value}});
  t.after(()=>settings.dispose());
  return{settings,reset:()=>resetReader.dispatchEvent(new Event('click')),persisted:()=>persisted,previousFlow:()=>previousFlow};
}

for(const mobile of [false,true])test(`reset uses ${mobile?'mobile Continuous':'desktop Pages'} defaults after an explicit flow choice`,t=>{
  const chosen=mobile?'paginated':'scrolled-doc';
  const f=fixture(t,{mobile,saved:{flow:chosen,fontSize:140,theme:'paper'}});
  assert.equal(f.settings.get().flow,chosen);
  f.reset();
  assert.equal(f.settings.get().flow,mobile?'scrolled-doc':'paginated');
  assert.equal(f.persisted().flow,mobile?'scrolled-doc':'paginated');
  assert.equal(f.persisted().fontSize,100);assert.equal(f.persisted().theme,'garden');
  assert.equal(f.previousFlow(),chosen);
});

for(const mobile of [false,true])for(const flow of [undefined,'invalid'])test(`missing/invalid flow uses device defaults (mobile=${mobile}, flow=${flow})`,t=>{
  const f=fixture(t,{mobile,saved:{flow}});
  assert.equal(f.settings.get().flow,mobile?'scrolled-doc':'paginated');
});
