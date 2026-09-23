/* Shadow Garden v2.8 — sandbox-safe internal EPUB link bridge.
 * Keeps EPUB.js as the navigation owner while avoiding native iframe navigation
 * in script-disabled WebKit srcdoc frames.
 */
(()=>{
  const previousEpub=window.ePub;
  if(typeof previousEpub!=="function")return;

  const EPUB_NS="http://www.idpf.org/2007/ops";
  const MARKER_PREFIX="sg-nav-";
  const NOTE_REF_CLASSES=new Set(["noteref","note-ref","footnote-ref","endnote-ref"]);
  let activeBook=null,activeRendition=null,markerSerial=0,markerTimer=0;

  const cleanText=value=>String(value||"").replace(/\s+/g," ").trim();
  const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};
  const typeTokens=value=>cleanText(value).toLowerCase().split(/\s+/).filter(Boolean);

  function refTokens(anchor){
    const tokens=[];
    const epubType=anchor?.getAttribute?.("epub:type")||anchor?.getAttributeNS?.(EPUB_NS,"type")||"";
    tokens.push(...typeTokens(epubType));
    tokens.push(...typeTokens(anchor?.getAttribute?.("role")));
    tokens.push(...typeTokens(anchor?.getAttribute?.("rel")));
    tokens.push(...typeTokens(anchor?.getAttribute?.("type")));
    try{for(const value of anchor?.classList||[])tokens.push(String(value).toLowerCase())}catch{}
    return new Set(tokens);
  }

  function isNoteReference(anchor){
    if(!anchor?.getAttribute)return false;
    const tokens=refTokens(anchor);
    if(tokens.has("noteref")||tokens.has("doc-noteref")||tokens.has("footnote")||tokens.has("endnote"))return true;
    for(const token of NOTE_REF_CLASSES)if(tokens.has(token))return true;
    return false;
  }

  function internalHrefValue(value){
    const raw=String(value||"").trim();
    if(!raw||/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(raw))return"";
    return raw;
  }

  function sameHref(a,b){
    const clean=value=>decode(String(value||"").split("#")[0]).replace(/^\.\//,"").replace(/^\//,"");
    const left=clean(a),right=clean(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  }

  function currentSectionFor(contents,renderedSection,book=activeBook){
    if(renderedSection?.href)return renderedSection;
    const index=Number(contents?.sectionIndex);
    const items=book?.spine?.spineItems||[];
    if(Number.isInteger(index)&&index>=0&&items[index])return items[index];
    const canonical=contents?.document?.querySelector?.("link[rel='canonical']")?.getAttribute?.("href")||"";
    if(canonical){
      const found=items.find(item=>sameHref(item?.href,canonical));
      if(found)return found;
    }
    return null;
  }

  function resolveInternalTarget(section,href){
    const text=String(href||"").trim();
    if(!section||!text)return null;
    const hash=text.indexOf("#");
    const rawPath=hash>=0?text.slice(0,hash):text;
    const fragment=hash>=0?decode(text.slice(hash+1)):"";
    let path=section.href||"";
    if(rawPath){
      try{
        const base=new URL(path,"https://shadow-garden.invalid/");
        path=decode(new URL(rawPath,base).pathname.replace(/^\//,""));
      }catch{path=decode(rawPath.replace(/^\.\//,""))}
    }
    return{displayHref:`${path}${fragment?`#${fragment}`:""}`};
  }

  function markerFor(anchor){
    let marker=String(anchor?.dataset?.sgNavMarker||"").trim();
    if(marker)return marker;
    marker=`${MARKER_PREFIX}${++markerSerial}`;
    anchor.dataset.sgNavMarker=marker;
    return marker;
  }

  function markInternalReference(anchor){
    if(!anchor?.getAttribute||isNoteReference(anchor))return;
    const stored=internalHrefValue(anchor.dataset?.sgNavHref||"");
    const current=String(anchor.getAttribute("href")||"").trim();
    const raw=stored||internalHrefValue(current);
    if(!raw)return;
    if(!stored)anchor.dataset.sgNavHref=raw;

    const marker=markerFor(anchor);
    // EPUB.js normally injects a click callback into rendition contents. WebKit does not
    // execute that callback in our script-disabled srcdoc iframe, so the native relative
    // URL escapes to /OEBPS/... and 404s. A same-srcdoc marker is safe in the child; the
    // parent observes it and delegates the actual move back to EPUB.js via display().
    anchor.setAttribute("href",`about:srcdoc#${marker}`);
    try{anchor.onclick=null}catch{}
    anchor.dataset.sgNavReady="1";
  }

  function installInternalLinkGuard(contents,renderedSection){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!doc?.documentElement)return;
    contents.__sgNavSection=renderedSection||contents.__sgNavSection||null;
    let anchors=[];
    try{anchors=[...doc.querySelectorAll("a[href],a[data-sg-nav-href]")]}catch{}
    anchors.forEach(markInternalReference);
  }

  function markerNameFrom(contents){
    const doc=contents?.document||contents?.contentDocument||contents;
    const win=doc?.defaultView;
    try{return decode(String(win?.location?.hash||"").replace(/^#/,""))}catch{return""}
  }

  function resetMarker(contents,marker){
    const doc=contents?.document||contents?.contentDocument||contents;
    const win=doc?.defaultView;
    try{if(win?.location?.hash)win.location.hash=""}catch{}
    setTimeout(()=>{
      if(contents.__sgConsumedNavMarker!==marker)return;
      if(markerNameFrom(contents)!==marker)contents.__sgConsumedNavMarker="";
    },180);
  }

  async function activateInternalReference(contents,anchor,renderedSection){
    const href=internalHrefValue(anchor?.dataset?.sgNavHref||"");
    const current=currentSectionFor(contents,renderedSection),target=resolveInternalTarget(current,href);
    if(!activeRendition||!target?.displayHref)return;
    try{await activeRendition.display(target.displayHref)}
    catch(error){console.warn("Internal EPUB navigation failed",error)}
  }

  function scanNavigationMarkers(){
    const rendition=activeRendition;
    if(!rendition)return;
    let all=[];
    try{all=rendition.getContents?.()||[]}catch{}
    for(const contents of all){
      const marker=markerNameFrom(contents);
      if(!marker.startsWith(MARKER_PREFIX)||contents.__sgConsumedNavMarker===marker)continue;
      const doc=contents?.document||contents?.contentDocument||contents;
      let anchor=null;
      try{anchor=doc?.querySelector?.(`[data-sg-nav-marker="${marker}"]`)||null}catch{}
      if(!anchor)continue;
      contents.__sgConsumedNavMarker=marker;
      resetMarker(contents,marker);
      activateInternalReference(contents,anchor,contents.__sgNavSection);
    }
  }

  function ensureMarkerObserver(){
    if(markerTimer)return;
    markerTimer=window.setInterval(scanNavigationMarkers,50);
  }

  function patchRendition(rendition){
    if(!rendition||rendition.__sgInternalLinksPatched)return rendition;
    activeRendition=rendition;
    rendition.__sgInternalLinksPatched=true;
    ensureMarkerObserver();
    try{rendition.hooks?.content?.register?.((contents,view)=>installInternalLinkGuard(contents,view?.section))}
    catch(error){console.warn("EPUB internal-link hook unavailable",error)}
    try{rendition.on?.("rendered",(section,view)=>{
      if(rendition!==activeRendition)return;
      const contents=view?.contents;
      if(contents){
        installInternalLinkGuard(contents,section);
        setTimeout(()=>installInternalLinkGuard(contents,section),0);
      }else setTimeout(()=>{try{rendition.getContents?.().forEach(item=>installInternalLinkGuard(item))}catch{}},0);
    })}catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book)return book;
    activeBook=book;
    if(book.__sgInternalLinksPatched)return book;
    book.__sgInternalLinksPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options));
    return book;
  }

  function wrappedEpub(...args){return patchBook(previousEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,previousEpub)}catch{}
  try{wrappedEpub.prototype=previousEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
