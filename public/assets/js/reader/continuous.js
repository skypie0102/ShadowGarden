import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — Continuous-mode navigation adapter. */
import {beginRenditionNavigation,runRenditionMove} from "./navigation-state.js";
import {resolveHrefTarget} from './href-target.js';
import {renditionRenderRevision,settleRenditionContent} from './epub-lifecycle.js';

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
