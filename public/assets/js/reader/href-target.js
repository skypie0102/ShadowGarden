import {withSectionSource} from './section-source.js';
import {recordReaderDiagnostic} from './diagnostics.js';

const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};

export async function resolveHrefTarget(book,target){
  const text=String(target||"");
  if(!text||text.startsWith("epubcfi("))return text;
  let section=null;
  try{section=book?.spine?.get?.(text)}catch{}
  if(!section){try{section=book?.spine?.get?.(text.split("#")[0])}catch{}}
  if(!section)return text;
  try{return await withSectionSource(section,book.load?.bind(book),()=>{
    const hash=text.indexOf("#"),fragment=hash>=0?decode(text.slice(hash+1)):"";
    let element=null;
    if(fragment){
      element=section.document?.getElementById?.(fragment)||null;
      if(!element){try{element=section.document?.querySelector?.(`[name="${CSS.escape(fragment)}"]`)||null}catch{}}
    }
    element=element||section.document?.body||section.document?.documentElement;
    // EPUB.js locationOf() assumes collapsed text CFIs have text-node offsets.
    // A fragment heading's element CFI can make it apply a character offset to
    // an element's child list. Preserve the precise text point when available.
    if(fragment&&element&&typeof section.cfiFromRange==="function"){
      const node=section.document.createTreeWalker(element,4).nextNode();
      if(node){
        const range=section.document.createRange();range.setStart(node,0);range.collapse(true);
        const cfi=section.cfiFromRange(range);if(cfi)return cfi;
      }
    }
    return element&&typeof section.cfiFromElement==="function"?(section.cfiFromElement(element)||text):text;
  });
  }catch{recordReaderDiagnostic('navigation.targetFallback');return text}
}
