import {createReaderScope} from "./lifecycle.js";
/* Coarse-pointer compatibility transport for reader/image-focus.js.
 * This module does not own image-focus state or presentation. It only converts a
 * short TouchEvent tap into the click activation already owned by image-focus.js
 * on browsers where EPUB iframe pointer/click delivery is unreliable.
 */

export function installImageFocusTouchCompatibility(){
const scope=createReaderScope(),nodes=new Map();
const viewer=document.getElementById("viewer");
const coarse=window.matchMedia?.("(pointer:coarse)")?.matches||Number(navigator.maxTouchPoints)>0;

if(viewer&&coarse){
  const installedDocs=new WeakSet();
  const installedFrames=new WeakSet();

  function imageTarget(target){return typeof target?.closest==="function"?target.closest("img"):null}
  function point(touch){return{x:Number(touch?.clientX)||0,y:Number(touch?.clientY)||0}}

  function installDocument(doc,owner){
    if(!doc||installedDocs.has(doc))return;
    installedDocs.add(doc);
    const lifetime=owner.child();lifetime.add(()=>installedDocs.delete(doc));
    let start=null;
    lifetime.listen(doc,"touchstart",event=>{
      if(event.touches?.length!==1){start=null;return}
      const image=imageTarget(event.target),touch=event.touches[0];
      if(!image||!touch){start=null;return}
      const p=point(touch);start={image,x:p.x,y:p.y};
    },{capture:true,passive:true});
    lifetime.listen(doc,"touchend",event=>{
      const active=start;start=null;if(!active)return;
      const touch=event.changedTouches?.[0],image=imageTarget(event.target);if(!touch||image!==active.image)return;
      const p=point(touch);if(Math.hypot(p.x-active.x,p.y-active.y)>12)return;
      event.preventDefault();
      const win=doc.defaultView;
      try{image.dispatchEvent(new win.MouseEvent("click",{bubbles:true,cancelable:true,view:win,clientX:p.x,clientY:p.y}))}
      catch{image.click?.()}
    },{capture:true,passive:false});
    lifetime.listen(doc,"touchcancel",()=>{start=null},{capture:true,passive:true});
    return lifetime;
  }

  function installFrame(frame){
    if(!frame||installedFrames.has(frame))return;
    installedFrames.add(frame);
    const lifetime=scope.child();nodes.set(frame,lifetime);
    lifetime.add(()=>{installedFrames.delete(frame);nodes.delete(frame)});
    let content=null;
    const attach=()=>{content?.dispose();try{content=installDocument(frame.contentDocument,lifetime)}catch{}};
    lifetime.listen(frame,"load",attach);attach();
  }

  function installParentHit(hit){
    if(!hit||hit.dataset.sgTouchReliability==="1")return;
    const lifetime=scope.child();nodes.set(hit,lifetime);
    lifetime.add(()=>{nodes.delete(hit);delete hit.dataset.sgTouchReliability});
    hit.dataset.sgTouchReliability="1";
    let start=null;
    lifetime.listen(hit,"touchstart",event=>{
      const touch=event.touches?.[0];if(!touch){start=null;return}
      const p=point(touch);start={x:p.x,y:p.y};
    },{passive:true});
    lifetime.listen(hit,"touchend",event=>{
      const active=start;start=null;const touch=event.changedTouches?.[0];if(!active||!touch)return;
      const p=point(touch);if(Math.hypot(p.x-active.x,p.y-active.y)>12)return;
      event.preventDefault();hit.click();
    },{passive:false});
    lifetime.listen(hit,"touchcancel",()=>{start=null},{passive:true});
  }

  function inspect(){
    for(const [node,owner] of nodes)if(!node.isConnected)owner.dispose();
    viewer.querySelectorAll("iframe").forEach(installFrame);
    document.querySelectorAll(".reader-image-focus-hit").forEach(installParentHit);
  }

  scope.observe(new MutationObserver(scope.guard(inspect)),document.body,{childList:true,subtree:true});
  inspect();
}

return{dispose:()=>scope.dispose()};
}
