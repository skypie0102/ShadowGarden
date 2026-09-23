/* Shadow Garden R4 — Reader-facing bookmark controller over canonical storage. */
export function createBookmarksController({storage,elements,getPosition,getCfi,getChapter,getPageMap,navigate,closeDrawers,toast}={}){
  const list=()=>storage.loadBookmarks();

  function samePosition(bookmark,position=getPosition?.()){
    if(!bookmark||!position)return false;
    if(bookmark.cfi&&position.cfi&&bookmark.cfi===position.cfi)return true;
    const pageMap=getPageMap?.();
    const fingerprint=pageMap?.fingerprint?.();
    if(fingerprint&&bookmark.pageMapFingerprint===fingerprint&&Number(bookmark.page)>0&&Number(position.page)>0)return Number(bookmark.page)===Number(position.page);
    if(Number(bookmark.sectionIndex)===Number(position.sectionIndex)&&Number(bookmark.localPage)>0&&Number(position.localPage)>0){
      return Number(bookmark.localPage)===Number(position.localPage);
    }
    return false;
  }

  function currentIndex(){
    if(!getCfi?.()&&!getPosition?.())return-1;
    return list().findIndex(item=>samePosition(item));
  }

  function syncButton(){
    const button=elements.bookmarkButton;if(!button)return;
    const saved=currentIndex()>=0;
    button.textContent=saved?"◆":"◇";
    button.classList.toggle("bookmarked",saved);
    button.setAttribute("aria-pressed",saved?"true":"false");
    button.title=saved?"Remove bookmark":"Bookmark this location";
    button.setAttribute("aria-label",saved?"Remove bookmark at this location":"Bookmark this location");
  }

  function render(){
    const panel=elements.bookmarksPanel;if(!panel)return;
    const bookmarks=list();panel.replaceChildren();
    if(!bookmarks.length){
      const empty=document.createElement("p");empty.className="bookmark-empty";empty.textContent="No bookmarks yet.";panel.appendChild(empty);return;
    }
    bookmarks.forEach((bookmark,index)=>{
      const row=document.createElement("div");row.className="bookmark-row";
      const copy=document.createElement("div");
      const label=document.createElement("div");label.className="bookmark-label";label.textContent=bookmark.label||"Saved location";
      const meta=document.createElement("div");meta.className="bookmark-meta";
      const parts=[];
      if(Number(bookmark.page)>0&&Number(bookmark.totalPages)>0)parts.push(`Page ${bookmark.page} of ${bookmark.totalPages}`);
      else if(Number(bookmark.localPage)>0)parts.push(`Section page ${bookmark.localPage}`);
      if(bookmark.at)parts.push(new Date(bookmark.at).toLocaleString());
      meta.textContent=parts.join(" · ")||"Saved bookmark";copy.append(label,meta);
      const open=document.createElement("button");open.type="button";open.textContent="↗";open.setAttribute("aria-label",`Open bookmark ${index+1}`);
      open.addEventListener("click",async()=>{
        try{
          const pageMap=getPageMap?.(),fingerprint=pageMap?.fingerprint?.();
          const canonical=fingerprint&&bookmark.pageMapFingerprint===fingerprint;
          const target=canonical?await pageMap.targetForPosition(bookmark,{includeFraction:true}):bookmark.cfi;
          await navigate?.(target||bookmark.cfi);closeDrawers?.();
        }catch(error){console.error("Bookmark navigation failed",error);toast?.("Could not open bookmark")}
      });
      const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label",`Delete bookmark ${index+1}`);
      remove.addEventListener("click",()=>{
        const next=list();next.splice(index,1);storage.saveBookmarks(next);render();syncButton();toast?.("Bookmark removed");
      });
      row.append(copy,open,remove);panel.appendChild(row);
    });
  }

  function toggle(){
    if(!getCfi?.()&&!getPosition?.())return;
    const bookmarks=list(),index=bookmarks.findIndex(item=>samePosition(item));
    if(index>=0){bookmarks.splice(index,1);storage.saveBookmarks(bookmarks);render();syncButton();toast?.("Bookmark removed");return}
    const position=getPosition?.()||{},pageMap=getPageMap?.();
    bookmarks.push({
      cfi:getCfi?.()||position.cfi||"",
      page:position.page||null,totalPages:position.totalPages||null,pageFraction:position.pageFraction||0,
      sectionIndex:position.sectionIndex??null,localPage:position.localPage||null,
      pageMapFingerprint:pageMap?.fingerprint?.()||null,
      label:getChapter?.()||elements.bookTitle?.textContent||"Saved location",at:Date.now()
    });
    storage.saveBookmarks(bookmarks);render();syncButton();toast?.("Bookmark saved");
  }

  elements.bookmarkButton?.addEventListener("click",toggle);
  render();syncButton();
  return{render,syncButton,toggle,samePosition};
}
