/* Shadow Garden v2.8 — EPUB footnote/endnote compatibility layer.
 * Explicit noterefs open in Reader chrome instead of moving the live rendition.
 */
(()=>{
  const previousEpub=window.ePub;
  if(typeof previousEpub!=="function")return;

  const EPUB_NS="http://www.idpf.org/2007/ops";
  const NOTE_REF_CLASSES=new Set(["noteref","note-ref","footnote-ref","endnote-ref"]);
  const NOTE_MARKER_PREFIX="sg-note-";
  let activeBook=null,activeRendition=null,noteOrigin=null,noteSerial=0,markerSerial=0,markerTimer=0;

  const cleanText=value=>String(value||"").replace(/\s+/g," ").trim();
  const decode=value=>{try{return decodeURIComponent(value)}catch{return value}};
  const typeTokens=value=>cleanText(value).toLowerCase().split(/\s+/).filter(Boolean);

  function noteDialogElements(){return{
    dialog:document.getElementById("readerNoteDialog"),
    heading:document.getElementById("readerNoteHeading"),
    body:document.getElementById("readerNoteBody"),
    close:document.getElementById("readerNoteClose")
  }}

  function closeNoteDialog({restoreFocus=true}={}){
    const {dialog}=noteDialogElements();
    if(dialog){
      if(dialog.open&&typeof dialog.close==="function")dialog.close();
      else dialog.removeAttribute("open");
    }
    const origin=noteOrigin;noteOrigin=null;
    if(restoreFocus&&origin?.isConnected)requestAnimationFrame(()=>{try{origin.focus({preventScroll:true})}catch{try{origin.focus()}catch{}}});
  }

  function setupNoteDialog(){
    const {dialog,close}=noteDialogElements();
    if(!dialog||dialog.__sgNoteReady)return Boolean(dialog);
    dialog.__sgNoteReady=true;
    close?.addEventListener("click",()=>closeNoteDialog());
    dialog.addEventListener("click",event=>{if(event.target===dialog)closeNoteDialog()});
    dialog.addEventListener("close",()=>{
      const origin=noteOrigin;noteOrigin=null;
      if(origin?.isConnected)requestAnimationFrame(()=>{try{origin.focus({preventScroll:true})}catch{try{origin.focus()}catch{}}});
    });
    return true;
  }

  function showNoteDialog(note,origin){
    if(!setupNoteDialog())return false;
    const {dialog,heading,body,close}=noteDialogElements();
    noteOrigin=origin||null;
    if(heading)heading.textContent=note?.label||"Note";
    if(body){
      body.replaceChildren();
      const paragraphs=Array.isArray(note?.paragraphs)&&note.paragraphs.length?note.paragraphs:["This note could not be displayed."];
      paragraphs.forEach(text=>{const p=document.createElement("p");p.textContent=text;body.appendChild(p)});
    }
    if(typeof dialog.showModal==="function"){
      if(!dialog.open)dialog.showModal();
    }else dialog.setAttribute("open","");
    requestAnimationFrame(()=>close?.focus?.({preventScroll:true}));
    return true;
  }

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

  function originalNoteHref(anchor){
    return internalHrefValue(anchor?.dataset?.sgNoteHref||"");
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

  function sameHref(a,b){
    const clean=value=>decode(String(value||"").split("#")[0]).replace(/^\.\//,"").replace(/^\//,"");
    const left=clean(a),right=clean(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
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
    return{path,fragment,displayHref:`${path}${fragment?`#${fragment}`:""}`};
  }

  function findSection(book,path,current){
    if(!book||!path)return current||null;
    if(current&&sameHref(current.href,path))return current;
    try{const section=book.spine?.get?.(path);if(section)return section}catch{}
    return(book.spine?.spineItems||[]).find(item=>sameHref(item?.href,path))||null;
  }

  function findFragment(doc,fragment){
    if(!doc||!fragment)return null;
    const id=decode(fragment);
    const byId=doc.getElementById?.(id);if(byId)return byId;
    try{return doc.querySelector?.(`[name="${CSS.escape(id)}"]`)||null}catch{return null}
  }

  function noteLabel(target){
    const tokens=new Set([
      ...typeTokens(target?.getAttribute?.("epub:type")||target?.getAttributeNS?.(EPUB_NS,"type")||""),
      ...typeTokens(target?.getAttribute?.("role"))
    ]);
    if(tokens.has("endnote")||tokens.has("doc-endnote"))return"Endnote";
    if(tokens.has("footnote")||tokens.has("doc-footnote"))return"Footnote";
    return"Note";
  }

  function noteParagraphs(target){
    if(!target)return[];
    const clone=target.cloneNode(true);
    try{
      clone.querySelectorAll?.("a[href]").forEach(link=>{
        const tokens=refTokens(link);
        if(tokens.has("backlink")||tokens.has("doc-backlink"))link.remove();
      });
    }catch{}
    const blocks=[...(clone.querySelectorAll?.("p,li,blockquote,dd")||[])].map(node=>cleanText(node.textContent)).filter(Boolean);
    if(blocks.length)return blocks;
    const text=cleanText(clone.textContent);return text?[text]:[];
  }

  async function loadNote(contents,anchor,renderedSection){
    const book=activeBook,current=currentSectionFor(contents,renderedSection,book),href=originalNoteHref(anchor);
    if(!book||!current||!href)return null;
    const targetInfo=resolveInternalTarget(current,href);
    if(!targetInfo?.fragment)return null;
    const section=findSection(book,targetInfo.path,current);
    if(!section)return null;
    const alreadyLoaded=Boolean(section.document);
    try{
      if(!section.document)await section.load(book.load.bind(book));
      const target=findFragment(section.document,targetInfo.fragment);
      if(!target)return null;
      const paragraphs=noteParagraphs(target);
      if(!paragraphs.length)return null;
      return{label:noteLabel(target),paragraphs,targetHref:targetInfo.displayHref};
    }finally{
      if(!alreadyLoaded&&section!==current){try{section.unload?.()}catch{}}
    }
  }

  async function fallbackToTarget(contents,anchor,renderedSection){
    const current=currentSectionFor(contents,renderedSection),href=originalNoteHref(anchor),target=resolveInternalTarget(current,href);
    if(!activeRendition||!target?.displayHref)return;
    try{await activeRendition.display(target.displayHref)}catch(error){console.warn("Footnote fallback navigation failed",error)}
  }

  function activateNoteReference(contents,anchor,renderedSection){
    const serial=++noteSerial;
    (async()=>{
      try{
        const note=await loadNote(contents,anchor,renderedSection);
        if(serial!==noteSerial)return;
        if(note&&showNoteDialog(note,anchor))return;
      }catch(error){console.warn("Footnote popup unavailable",error)}
      if(serial===noteSerial)await fallbackToTarget(contents,anchor,renderedSection);
    })();
  }

  function markerFor(anchor){
    let marker=String(anchor?.dataset?.sgNoteMarker||"").trim();
    if(marker)return marker;
    marker=`${NOTE_MARKER_PREFIX}${++markerSerial}`;
    anchor.dataset.sgNoteMarker=marker;
    return marker;
  }

  function markNoteReference(anchor){
    if(!anchor?.getAttribute||!isNoteReference(anchor))return;
    const stored=internalHrefValue(anchor.dataset?.sgNoteHref||"");
    const current=String(anchor.getAttribute("href")||"").trim();
    const raw=stored||internalHrefValue(current);
    if(!raw)return;
    if(!stored)anchor.dataset.sgNoteHref=raw;

    const marker=markerFor(anchor);
    // WebKit blocks callbacks injected into EPUB.js' script-disabled srcdoc iframe. Keep
    // activation entirely native inside the child: the link only moves that same srcdoc
    // to a private marker. Parent Reader code observes the marker and opens the dialog.
    anchor.setAttribute("href",`about:srcdoc#${marker}`);
    try{anchor.onclick=null}catch{}
    anchor.classList.add("sg-note-reference");
    anchor.setAttribute("aria-haspopup","dialog");
    anchor.dataset.sgNoteReady="1";
  }

  function installNoteGuard(contents,renderedSection){
    const doc=contents?.document||contents?.contentDocument||contents;
    if(!doc?.documentElement)return;
    doc.documentElement.dataset.sgFootnotes="1";
    contents.__sgNoteSection=renderedSection||contents.__sgNoteSection||null;
    let anchors=[];
    try{anchors=[...doc.querySelectorAll("a[href],a[data-sg-note-href]")]}catch{}
    anchors.forEach(markNoteReference);
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
      if(contents.__sgConsumedNoteMarker!==marker)return;
      if(markerNameFrom(contents)!==marker)contents.__sgConsumedNoteMarker="";
    },180);
  }

  function scanNoteMarkers(){
    const rendition=activeRendition;
    if(!rendition)return;
    let all=[];
    try{all=rendition.getContents?.()||[]}catch{}
    for(const contents of all){
      const marker=markerNameFrom(contents);
      if(!marker.startsWith(NOTE_MARKER_PREFIX)||contents.__sgConsumedNoteMarker===marker)continue;
      const doc=contents?.document||contents?.contentDocument||contents;
      let anchor=null;
      try{anchor=doc?.querySelector?.(`[data-sg-note-marker="${marker}"]`)||null}catch{}
      if(!anchor)continue;
      contents.__sgConsumedNoteMarker=marker;
      resetMarker(contents,marker);
      activateNoteReference(contents,anchor,contents.__sgNoteSection);
    }
  }

  function ensureMarkerObserver(){
    if(markerTimer)return;
    markerTimer=window.setInterval(scanNoteMarkers,50);
  }

  function patchRendition(rendition){
    if(!rendition||rendition.__sgFootnotesPatched)return rendition;
    if(activeRendition&&activeRendition!==rendition)closeNoteDialog({restoreFocus:false});
    activeRendition=rendition;rendition.__sgFootnotesPatched=true;
    ensureMarkerObserver();
    try{rendition.hooks?.content?.register?.((contents,view)=>installNoteGuard(contents,view?.section))}catch(error){console.warn("EPUB note hook unavailable",error)}
    try{rendition.on?.("rendered",(section,view)=>{
      if(rendition!==activeRendition)return;
      const contents=view?.contents;
      if(contents){
        installNoteGuard(contents,section);
        setTimeout(()=>installNoteGuard(contents,section),0);
      }else setTimeout(()=>{try{rendition.getContents?.().forEach(contentsItem=>installNoteGuard(contentsItem))}catch{}},0);
    })}catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book)return book;
    activeBook=book;
    if(book.__sgFootnotesPatched)return book;
    book.__sgFootnotesPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options));
    return book;
  }

  function wrappedEpub(...args){return patchBook(previousEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,previousEpub)}catch{}
  try{wrappedEpub.prototype=previousEpub.prototype}catch{}
  window.ePub=wrappedEpub;

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupNoteDialog,{once:true});
  else setupNoteDialog();
})();
