/* Shadow Garden R4 — Continuous-mode navigation adapter. */
const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};

async function resolveHrefTarget(book,target){
  const text=String(target||"");
  if(!text||text.startsWith("epubcfi("))return text;
  let section=null;
  try{section=book?.spine?.get?.(text)}catch{}
  if(!section){try{section=book?.spine?.get?.(text.split("#")[0])}catch{}}
  if(!section)return text;
  try{
    if(!section.document)await section.load(book.load.bind(book));
    const hash=text.indexOf("#"),fragment=hash>=0?decode(text.slice(hash+1)):"";
    let element=null;
    if(fragment){
      element=section.document?.getElementById?.(fragment)||null;
      if(!element){try{element=section.document?.querySelector?.(`[name="${CSS.escape(fragment)}"]`)||null}catch{}}
    }
    element=element||section.document?.body||section.document?.documentElement;
    return element&&typeof section.cfiFromElement==="function"?(section.cfiFromElement(element)||text):text;
  }catch{return text}
}

export function createContinuousController({getRendition,getBook,beforeNavigate}={}){
  async function display(target,{settle=true,resolve=true}={}){
    const rendition=getRendition?.();if(!rendition||!target)return false;
    beforeNavigate?.();
    const exact=resolve?await resolveHrefTarget(getBook?.(),target):target;
    await rendition.display(exact);
    if(settle){
      await nextPaint();
      if(rendition===getRendition?.()){
        await rendition.display(exact);
        /* EPUB.js schedules reportLocation() from display before WebKit has always committed
           the final Continuous view geometry. Give the second display one more paint, then
           request an authoritative location report so Reader chapter/progress chrome cannot
           remain on the immediately preceding section while the requested content is visible. */
        await nextPaint();
        if(rendition===getRendition?.())await rendition.reportLocation?.();
      }
    }
    return true;
  }
  return{display,resolveTarget:target=>resolveHrefTarget(getBook?.(),target)};
}
