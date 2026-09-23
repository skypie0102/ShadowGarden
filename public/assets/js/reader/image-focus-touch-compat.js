/* Coarse-pointer compatibility transport for reader/image-focus.js.
 * This module does not own image-focus state or presentation. It only converts a
 * short TouchEvent tap into the click activation already owned by image-focus.js
 * on browsers where EPUB iframe pointer/click delivery is unreliable.
 */

const viewer=document.getElementById("viewer");
const coarse=window.matchMedia?.("(pointer:coarse)")?.matches||Number(navigator.maxTouchPoints)>0;

if(viewer&&coarse){
  const installedDocs=new WeakSet();
  const installedFrames=new WeakSet();

  function imageTarget(target){return typeof target?.closest==="function"?target.closest("img"):null}
  function point(touch){return{x:Number(touch?.clientX)||0,y:Number(touch?.clientY)||0}}

  function installDocument(doc){
    if(!doc||installedDocs.has(doc))return;
    installedDocs.add(doc);
    let start=null;
    doc.addEventListener("touchstart",event=>{
      if(event.touches?.length!==1){start=null;return}
      const image=imageTarget(event.target),touch=event.touches[0];
      if(!image||!touch){start=null;return}
      const p=point(touch);start={image,x:p.x,y:p.y};
    },{capture:true,passive:true});
    doc.addEventListener("touchend",event=>{
      const active=start;start=null;if(!active)return;
      const touch=event.changedTouches?.[0],image=imageTarget(event.target);if(!touch||image!==active.image)return;
      const p=point(touch);if(Math.hypot(p.x-active.x,p.y-active.y)>12)return;
      event.preventDefault();
      const win=doc.defaultView;
      try{image.dispatchEvent(new win.MouseEvent("click",{bubbles:true,cancelable:true,view:win,clientX:p.x,clientY:p.y}))}
      catch{image.click?.()}
    },{capture:true,passive:false});
    doc.addEventListener("touchcancel",()=>{start=null},{capture:true,passive:true});
  }

  function installFrame(frame){
    if(!frame||installedFrames.has(frame))return;
    installedFrames.add(frame);
    const attach=()=>{try{installDocument(frame.contentDocument)}catch{}};
    frame.addEventListener("load",attach);attach();
  }

  function installParentHit(hit){
    if(!hit||hit.dataset.sgTouchReliability==="1")return;
    hit.dataset.sgTouchReliability="1";
    let start=null;
    hit.addEventListener("touchstart",event=>{
      const touch=event.touches?.[0];if(!touch){start=null;return}
      const p=point(touch);start={x:p.x,y:p.y};
    },{passive:true});
    hit.addEventListener("touchend",event=>{
      const active=start;start=null;const touch=event.changedTouches?.[0];if(!active||!touch)return;
      const p=point(touch);if(Math.hypot(p.x-active.x,p.y-active.y)>12)return;
      event.preventDefault();hit.click();
    },{passive:false});
    hit.addEventListener("touchcancel",()=>{start=null},{passive:true});
  }

  function inspect(){
    viewer.querySelectorAll("iframe").forEach(installFrame);
    document.querySelectorAll(".reader-image-focus-hit").forEach(installParentHit);
  }

  new MutationObserver(inspect).observe(document.body,{childList:true,subtree:true});
  inspect();
}
