/* Shadow Garden v2.8 — Reader startup failure presentation. */

const damagedPattern=/zip|central directory|container\.xml|package document|\bopf\b|archive|corrupt|unexpected end|end of data|invalid[^\n]*epub|unsupported[^\n]*epub/i;
const contentPattern=/spine|section|manifest|resource|render|display|no[^\n]*(readable|content|section)/i;

function errorMessage(error){
  return String(error?.message||error||"").trim();
}

export function readerFailureCopy(error,{phase="open"}={}){
  const message=errorMessage(error);
  if(phase==="authorization"){
    if(/no epub file was selected/i.test(message))return{
      title:"No EPUB was selected.",
      detail:"Return to the library and choose a volume to read."
    };
    return{
      title:"Shadow Garden could not authorize this EPUB.",
      detail:"The protected book link could not be prepared. Try again; if the problem continues, return to the series and reopen the volume."
    };
  }
  if(damagedPattern.test(message))return{
    title:"This EPUB appears incomplete or damaged.",
    detail:"Shadow Garden could not read the book package safely. Re-upload or replace the EPUB, then try the volume again."
  };
  if(contentPattern.test(message))return{
    title:"This EPUB has no readable content Shadow Garden can open.",
    detail:"The book package was found, but its reading order or content could not be rendered. Rebuilding the EPUB usually fixes this kind of structure problem."
  };
  return{
    title:"Shadow Garden could not open this EPUB.",
    detail:"The Reader stopped before showing book content. Try again; if the same volume still fails, replace or rebuild its EPUB file."
  };
}

export function showReaderFailure({container,error,phase="open",returnHref="/",returnLabel="Return to library",retry}={}){
  if(!container)return null;
  const copy=readerFailureCopy(error,{phase});
  const retryAction=typeof retry==="function"?retry:()=>location.reload();
  const mark=document.createElement("span");mark.setAttribute("aria-hidden","true");mark.textContent="✦";
  const panel=document.createElement("div");panel.className="reader-failure";
  const title=document.createElement("h2");title.textContent=copy.title;
  const detail=document.createElement("p");detail.textContent=copy.detail;
  const actions=document.createElement("div");actions.className="reader-failure-actions";
  const retryButton=document.createElement("button");retryButton.type="button";retryButton.className="reader-failure-action";retryButton.textContent="Try again";retryButton.addEventListener("click",retryAction);
  const returnLink=document.createElement("a");returnLink.className="reader-failure-action reader-failure-return";returnLink.href=String(returnHref||"/");returnLink.textContent=String(returnLabel||"Return to library");
  actions.append(retryButton,returnLink);panel.append(title,detail,actions);
  container.replaceChildren(mark,panel);container.classList.remove("hidden");container.setAttribute("role","alert");container.setAttribute("aria-live","assertive");
  requestAnimationFrame(()=>retryButton.focus?.({preventScroll:true}));
  return{...copy,retryButton,returnLink};
}
