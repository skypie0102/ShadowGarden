import test from 'node:test';
import assert from 'node:assert/strict';
import {createSettingsController} from '../public/assets/js/reader/settings.js';

function fixture(t,{mobile,saved={},elements={}}){
  const previousMatch=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  Object.defineProperty(globalThis,'matchMedia',{value:()=>({matches:mobile}),configurable:true,writable:true});
  t.after(()=>previousMatch?Object.defineProperty(globalThis,'matchMedia',previousMatch):delete globalThis.matchMedia);
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window'),windowEvents=new EventTarget();
  Object.defineProperty(globalThis,'window',{value:windowEvents,configurable:true});
  t.after(()=>previousWindow?Object.defineProperty(globalThis,'window',previousWindow):delete globalThis.window);
  const previous=globalThis.document;
  globalThis.document={body:{classList:{remove(){},add(){},toggle(){}}}};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous});
  const resetReader=new EventTarget(),alignmentSelect=Object.assign(new EventTarget(),{value:''}),applied=[];let persisted,previousFlow,writes=0;
  const settings=createSettingsController({storage:{loadSettings:defaults=>({...defaults,...saved}),saveSettings:value=>{persisted={...value};writes++}},elements:{resetReader,alignmentSelect,...elements},onApply:value=>applied.push(value),onReset:(value,desired)=>{previousFlow=value;assert.equal(settings.get().flow,value);settings.setFlow(desired)}});
  t.after(()=>settings.dispose());
  return{settings,alignmentSelect,applied,reset:()=>resetReader.dispatchEvent(new Event('click')),persisted:()=>persisted,previousFlow:()=>previousFlow,writes:()=>writes,resize:()=>windowEvents.dispatchEvent(new Event('resize')),device:value=>{mobile=value}};
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

for(const mobile of [false,true])test(`reset explanation follows the device without changing an explicit flow (mobile=${mobile})`,t=>{
  const resetReaderDescription={textContent:''},settingsToggle=new EventTarget();
  const chosen=mobile?'paginated':'scrolled-doc';
  const f=fixture(t,{mobile,saved:{flow:chosen},elements:{resetReaderDescription,settingsToggle}});
  assert.match(resetReaderDescription.textContent,mobile?/Continuous scroll/:/Pages/);
  assert.match(resetReaderDescription.textContent,/100% text, 1.6 line height, 760px text width/);
  assert.match(resetReaderDescription.textContent,/reading position, bookmarks and Read aloud choices are kept/);
  const writes=f.writes();
  f.device(!mobile);f.resize();
  assert.match(resetReaderDescription.textContent,mobile?/Pages/:/Continuous scroll/);
  settingsToggle.dispatchEvent(new Event('click'));
  assert.equal(f.writes(),writes);assert.equal(f.settings.get().flow,chosen);
  const description=resetReaderDescription.textContent;
  f.settings.dispose();f.device(mobile);f.resize();settingsToggle.dispatchEvent(new Event('click'));
  assert.equal(resetReaderDescription.textContent,description);
});

test('mode-specific controls describe the active flow and retain inactive choices',t=>{
  const swipeTurnsToggle=new EventTarget(),textWidthSetting={},readerFlowHint={};
  const f=fixture(t,{mobile:false,saved:{flow:'paginated',swipeTurns:false,width:900},elements:{swipeTurnsToggle,textWidthSetting,readerFlowHint}});
  assert.equal(swipeTurnsToggle.disabled,false);assert.equal(textWidthSetting.hidden,true);
  assert.match(readerFlowHint.textContent,/Left\/Right arrow keys/);
  f.settings.setFlow('scrolled-doc');
  assert.equal(swipeTurnsToggle.disabled,true);assert.equal(swipeTurnsToggle.checked,false);
  assert.equal(textWidthSetting.hidden,false);assert.match(readerFlowHint.textContent,/Scroll through the book/);
  f.settings.setFlow('paginated');
  assert.equal(swipeTurnsToggle.disabled,false);assert.equal(swipeTurnsToggle.checked,false);
  assert.equal(f.persisted().width,900);
});

test('numeric controls expose units and keep their existing immediate-apply behavior',t=>{
  const input=()=>Object.assign(new EventTarget(),{attrs:{},setAttribute(name,value){this.attrs[name]=value}});
  const fontSizeRange=input(),lineHeightRange=input(),widthRange=input();
  const fontSizeValue={},lineHeightValue={},widthValue={};
  const f=fixture(t,{mobile:false,saved:{flow:'scrolled-doc'},elements:{fontSizeRange,lineHeightRange,widthRange,fontSizeValue,lineHeightValue,widthValue}});
  for(const [control,value,unit] of [[fontSizeRange,125,'125 percent'],[lineHeightRange,1.8,'1.8 times text size'],[widthRange,900,'900 pixels']]){
    control.value=value;control.dispatchEvent(new Event('input'));
    assert.equal(control.attrs['aria-valuetext'],unit);
    assert.deepEqual(f.applied.at(-1),{relayout:true,rebuildPageMap:true});
  }
  assert.equal(fontSizeValue.textContent,'125%');assert.equal(lineHeightValue.textContent,'1.8');assert.equal(widthValue.textContent,'900px');
  const writes=f.writes();f.settings.dispose();fontSizeRange.dispatchEvent(new Event('input'));
  assert.equal(f.writes(),writes);
});
