import {recordReaderDiagnostic} from './diagnostics.js';
import {createReaderScope} from "./lifecycle.js";
/* Shadow Garden R4 — Reader-facing bookmark controller over canonical storage. */
export function createBookmarksController({storage,elements,getPosition,getCfi,getChapter,getPageMap,navigate,closeDrawers,toast}={}){
  const scope=createReaderScope();
  let rows=scope.child();
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
    if(scope.disposed)return;
    const button=elements.bookmarkButton;if(!button)return;
    const saved=currentIndex()>=0;
    const icon=saved?"◆":"◇";
    // WebKit cancels a native click if a relocation replaces its pressed text
    // node between down/up. Routine position updates must preserve that node.
    if(button.textContent!==icon)button.textContent=icon;
    button.classList.toggle("bookmarked",saved);
    button.setAttribute("aria-pressed",saved?"true":"false");
    button.title=saved?"Remove bookmark":"Bookmark this location";
    button.setAttribute("aria-label",saved?"Remove bookmark at this location":"Bookmark this location");
  }

  function render(){
    if(scope.disposed)return;
    const panel=elements.bookmarksPanel;if(!panel)return;
    rows.dispose();rows=scope.child();
    const bookmarks=list();panel.replaceChildren();
    if(!bookmarks.length){
      const empty=document.createElement("p");empty.className="bookmark-empty";empty.textContent="No bookmarks are pressed between these pages yet.";panel.appendChild(empty);return;
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
      rows.listen(open,"click",async()=>{
        try{
          const pageMap=getPageMap?.(),fingerprint=pageMap?.fingerprint?.();
          const canonical=fingerprint&&bookmark.pageMapFingerprint===fingerprint;
          const target=canonical?await pageMap.targetForPosition(bookmark,{includeFraction:true}):bookmark.cfi;
          if(scope.disposed)return;
          await navigate?.(target||bookmark.cfi);if(!scope.disposed)closeDrawers?.();
        }catch(error){
          if(scope.disposed)return;
          recordReaderDiagnostic('navigation.bookmarkFailed');toast?.("Could not open bookmark");
        }
      });
      const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label",`Delete bookmark ${index+1}`);
      rows.listen(remove,"click",()=>{
        const next=list();next.splice(index,1);storage.saveBookmarks(next);render();syncButton();toast?.("Bookmark removed");
      });
      row.append(copy,open,remove);panel.appendChild(row);
    });
  }

  function toggle(){
    if(scope.disposed)return;
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

  scope.listen(elements.bookmarkButton,"click",toggle);
  render();syncButton();
  return{dispose(){scope.dispose();elements.bookmarksPanel?.replaceChildren()},render,syncButton,toggle,samePosition};
}
