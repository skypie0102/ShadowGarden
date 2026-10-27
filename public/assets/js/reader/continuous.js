import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — Continuous-mode navigation adapter. */
import {beginRenditionNavigation,runRenditionMove} from "./navigation-state.js";
import {withSectionSource} from './section-source.js';
import {recordReaderDiagnostic} from './diagnostics.js';
import {renditionRenderRevision,settleRenditionContent} from './epub-lifecycle.js';

const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};

async function resolveHrefTarget(book,target){
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

export function createContinuousController({getRendition,getBook,beforeNavigate,settleNavigation}={}){
  const scope=createReaderScope();
  async function display(target,{settle=true,resolve=true,operation}={}){
    if(scope.disposed)return false;
    const rendition=getRendition?.();if(!rendition||!target)return false;
    operation=operation||beginRenditionNavigation(rendition);
    const current=()=>!scope.disposed&&rendition===getRendition?.()&&operation.isCurrent();
    if(!current())return false;
    beforeNavigate?.();
    const exact=resolve?await resolveHrefTarget(getBook?.(),target):target;
    const revision=renditionRenderRevision(rendition);
    if(!current()||!await runRenditionMove(rendition,operation,()=>rendition.display(exact)))return false;
    if(settle){
      await settleNavigation?.(rendition);
      // Buffer growth finishes view.display before asynchronous content hooks.
      // Complete their styles before positioning the requested CFI again.
      await settleRenditionContent(rendition,revision);
      if(!current())return false;
      await scope.paint();
      if(current()){
        const correctionRevision=renditionRenderRevision(rendition);
        if(!await runRenditionMove(rendition,operation,()=>rendition.display(exact)))return false;
        await settleNavigation?.(rendition);
        const changed=await settleRenditionContent(rendition,correctionRevision);
        if(changed&&current()&&!await runRenditionMove(rendition,operation,()=>rendition.display(exact)))return false;
        /* EPUB.js schedules reportLocation() from display before WebKit has always committed
           the final Continuous view geometry. Give the second display one more paint, then
           request an authoritative location report so Reader chapter/progress chrome cannot
           remain on the immediately preceding section while the requested content is visible. */
        await scope.paint();
        if(current())await rendition.reportLocation?.();
      }
    }
    return current();
  }
  return{dispose:()=>scope.dispose(),display,resolveTarget:target=>scope.disposed?Promise.resolve(""):resolveHrefTarget(getBook?.(),target)};
}
