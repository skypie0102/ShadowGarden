import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createContinuousController} from '../public/assets/js/reader/continuous.js';

test('fragment navigation gives EPUB.js a text-node CFI rather than an element character offset',async()=>{
  const text={nodeType:3,textContent:'Chapter four'},heading={},range={setStart(node,offset){this.node=node;this.offset=offset;},collapse(value){this.collapsed=value;}};
  const document={getElementById:id=>id==='heading'?heading:null,createTreeWalker:(element,filter)=>{assert.equal(element,heading);assert.equal(filter,4);return{nextNode:()=>text};},createRange:()=>range};
  const section={document,cfiFromRange:value=>{assert.equal(value.node,text);assert.equal(value.offset,0);assert.equal(value.collapsed,true);return'epubcfi(fragment-text)';},cfiFromElement(){throw Error('Element CFI can be misread as a character offset');}};
  const controller=createContinuousController({getBook:()=>({spine:{get:()=>section}})});
  assert.equal(await controller.resolveTarget('chapter.xhtml#heading'),'epubcfi(fragment-text)');
});

test('non-text fragment targets retain element navigation',async()=>{
  const image={},section={document:{getElementById:()=>image,createTreeWalker:()=>({nextNode:()=>null})},cfiFromElement:node=>{assert.equal(node,image);return'epubcfi(image-anchor)';}};
  const controller=createContinuousController({getBook:()=>({spine:{get:()=>section}})});
  assert.equal(await controller.resolveTarget('chapter.xhtml#image'),'epubcfi(image-anchor)');
});
