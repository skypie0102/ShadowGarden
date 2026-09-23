/* Shadow Garden R4.1 — isolated focused-image viewing, pinch zoom and pan. */

const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0));
const distance=(a,b)=>Math.hypot((Number(a?.clientX)||0)-(Number(b?.clientX)||0),(Number(a?.clientY)||0)-(Number(b?.clientY)||0));

function imageTarget(target){return typeof target?.closest==="function"?target.closest("img"):null}
function imageSource(image,doc){
  const raw=String(image?.currentSrc||image?.src||image?.getAttribute?.("src")||"").trim();
  if(!raw)return"";
  try{return new URL(raw,doc?.baseURI||location.href).href}catch{return raw}
}
function normalizeWheel(event){
  let y=Number(event?.deltaY)||0,x=Number(event?.deltaX)||0;
  if(event?.deltaMode===1){x*=18;y*=18}else if(event?.deltaMode===2){x*=window.innerWidth;y*=window.innerHeight}
  return{x,y};
}
function needsParentHitTargets(doc){
  const ua=String(doc?.defaultView?.navigator?.userAgent||navigator.userAgent||"");
  return /AppleWebKit/i.test(ua)&&!/(?:Chrome|Chromium|Edg|OPR)\//i.test(ua);
}
function intersectRect(a,b){
  const left=Math.max(Number(a?.left)||0,Number(b?.left)||0),top=Math.max(Number(a?.top)||0,Number(b?.top)||0);
  const right=Math.min(Number(a?.right)||0,Number(b?.right)||0),bottom=Math.min(Number(a?.bottom)||0,Number(b?.bottom)||0);
  return{left,top,right,bottom,width:Math.max(0,right-left),height:Math.max(0,bottom-top)};
}

export function imagePanBounds({imageWidth=0,imageHeight=0,viewportWidth=0,viewportHeight=0,scale=1}={}){
  const safeScale=Math.max(1,Number(scale)||1);
  return{
    x:Math.max(0,((Math.max(0,Number(imageWidth)||0)*safeScale)-Math.max(0,Number(viewportWidth)||0))/2),
    y:Math.max(0,((Math.max(0,Number(imageHeight)||0)*safeScale)-Math.max(0,Number(viewportHeight)||0))/2)
  };
}

export function createImageFocusController({
  overlay,
  viewport,
  layer,
  image,
  closeButton,
  hint,
  shouldSuppressOpen
}={}){
  const state={active:false,scale:1,x:0,y:0,maxScale:4,gesture:null,suppressCloseClickUntil:0,returnFocus:null};
  const parentHits=new Map();
  let parentHitFrame=0;
  /* v2.6.6 owner request (#160 follow-up family): desktop focus gets wheel-zoom +
     pointer-drag pan + double-click return with a fine-pointer hint variant, and the
     control hint fades after three seconds on every platform. */
  const fineQuery=typeof matchMedia==="function"?matchMedia("(pointer: fine)"):null;
  const coarseQuery=typeof matchMedia==="function"?matchMedia("(pointer: coarse)"):null;
  const isFinePointer=()=>Boolean(fineQuery?.matches)&&!Boolean(coarseQuery?.matches);
  let finePointer=isFinePointer();
  let hintFadeTimer=0;
  function applyHintCopy(){
    if(!hint)return;
    const fineCopy=hint.dataset?.hintFine||"";
    const coarseCopy=hint.dataset?.hintCoarse||"Pinch to zoom · drag to inspect · tap again to return";
    hint.textContent=finePointer&&fineCopy?fineCopy:(hint.textContent||coarseCopy).includes("tap again")?coarseCopy:hint.textContent;
    if(!finePointer&&!hint.textContent.includes("Pinch"))hint.textContent=coarseCopy;
  }
  function showHint(){
    if(!hint)return;
    applyHintCopy();
    clearTimeout(hintFadeTimer);hint.classList.remove("reader-image-focus-hint-faded");
    hintFadeTimer=setTimeout(()=>{if(state.active)hint.classList.add("reader-image-focus-hint-faded")},3000);
  }
  function hideHintInstant(){clearTimeout(hintFadeTimer);hint?.classList.add("reader-image-focus-hint-faded")}
  if(hint&&fineQuery?.addEventListener){
    try{
      const updatePointerMode=()=>{const was=finePointer;finePointer=isFinePointer();applyHintCopy();void was;hideHintInstant()};
      fineQuery.addEventListener("change",updatePointerMode);
      coarseQuery?.addEventListener("change",updatePointerMode);
    }catch{}
  }

  function viewportSize(){return{width:Math.max(1,Number(viewport?.clientWidth)||Number(window.innerWidth)||1),height:Math.max(1,Number(viewport?.clientHeight)||Number(window.innerHeight)||1)}}
  function pointInViewport(clientX,clientY){const rect=viewport?.getBoundingClientRect?.()||{left:0,top:0};return{x:(Number(clientX)||0)-rect.left,y:(Number(clientY)||0)-rect.top}}
  function clampPan(x,y,scale=state.scale){
    if(scale<=1.001)return{x:0,y:0};
    const size=viewportSize();
    const bounds=imagePanBounds({imageWidth:image?.clientWidth,imageHeight:image?.clientHeight,viewportWidth:size.width,viewportHeight:size.height,scale});
    return{x:clamp(x,-bounds.x,bounds.x),y:clamp(y,-bounds.y,bounds.y)};
  }
  function render(){
    if(image)image.style.transform=`translate3d(${state.x}px,${state.y}px,0) scale(${state.scale})`;
    const zoomed=state.active&&state.scale>1.001;
    overlay?.classList.toggle("reader-image-focus-zoomed",zoomed);
    document.body.classList.toggle("reader-image-focused",state.active);
    if(zoomed&&document.activeElement===closeButton)overlay?.focus?.({preventScroll:true});
  }
  function setTransform(scale,x=state.x,y=state.y){
    state.scale=clamp(scale,1,state.maxScale);
    const pan=clampPan(x,y,state.scale);state.x=pan.x;state.y=pan.y;
    if(state.scale<=1.001){state.scale=1;state.x=0;state.y=0}
    render();return state.scale;
  }
  function zoomAt(scale,point){
    const size=viewportSize();
    const anchor=point||{x:size.width/2,y:size.height/2};
    const next=clamp(scale,1,state.maxScale),old=Math.max(1,state.scale);
    const centerX=size.width/2,centerY=size.height/2;
    const contentX=(anchor.x-centerX-state.x)/old,contentY=(anchor.y-centerY-state.y)/old;
    return setTransform(next,anchor.x-centerX-contentX*next,anchor.y-centerY-contentY*next);
  }

  function openImageFocus(sourceImage,doc){
    const src=imageSource(sourceImage,doc);if(!src||!overlay||!image)return false;
    state.returnFocus=document.activeElement;
    state.active=true;state.scale=1;state.x=0;state.y=0;state.gesture=null;
    image.src=src;image.alt=String(sourceImage?.alt||"Book image");
    overlay.classList.remove("hidden","reader-image-focus-zoomed");overlay.setAttribute("aria-hidden","false");
    render();showHint();requestAnimationFrame(()=>closeButton?.focus?.({preventScroll:true}));
    return true;
  }
  function closeImageFocus({restoreFocus=true}={}){
    if(!state.active)return false;
    state.active=false;state.scale=1;state.x=0;state.y=0;state.gesture=null;
    hideHintInstant();
    if(image){image.style.transform="";image.removeAttribute("src");image.alt=""}
    overlay?.classList.add("hidden");overlay?.classList.remove("reader-image-focus-zoomed");overlay?.setAttribute("aria-hidden","true");
    document.body.classList.remove("reader-image-focused");
    if(restoreFocus&&state.returnFocus&&document.contains(state.returnFocus))requestAnimationFrame(()=>state.returnFocus?.focus?.({preventScroll:true}));
    state.returnFocus=null;return true;
  }

  function createParentHit(sourceImage,doc){
    const hit=document.createElement("span");
    hit.className="reader-image-focus-hit";hit.setAttribute("aria-hidden","true");hit.dataset.sgReaderImageHit="1";hit.hidden=true;
    hit.addEventListener("click",event=>{
      event.preventDefault();event.stopPropagation();
      if(state.active||shouldSuppressOpen?.())return;
      openImageFocus(sourceImage,doc);
    });
    document.body.appendChild(hit);return hit;
  }
  function removeHitList(hitList){hitList?.forEach?.(hit=>hit.remove())}
  function removeParentHits(doc){
    const entry=parentHits.get(doc);if(!entry)return;
    entry.hits.forEach(removeHitList);parentHits.delete(doc);
  }
  function refreshParentHits(){
    parentHitFrame=0;
    parentHits.forEach((entry,doc)=>{
      const frame=doc?.defaultView?.frameElement;
      if(!frame?.isConnected){removeParentHits(doc);return}
      const frameRect=frame.getBoundingClientRect(),shellRect=frame.closest?.("#viewerShell")?.getBoundingClientRect?.()||frameRect;
      entry.hits.forEach((hitList,sourceImage)=>{
        if(!sourceImage?.isConnected){removeHitList(hitList);entry.hits.delete(sourceImage);return}
        // In WebKit multicol pagination, getBoundingClientRect() can return the union
        // of disjoint image fragments. That union can span unrelated text/links.
        // Mirror each fragment instead so the parent hit surface matches painted pixels.
        const rects=Array.from(sourceImage.getClientRects?.()||[]);
        const candidates=rects.length?rects:[sourceImage.getBoundingClientRect()];
        const visibleRects=candidates.map(rect=>{
          const mapped={left:frameRect.left+rect.left,top:frameRect.top+rect.top,right:frameRect.left+rect.right,bottom:frameRect.top+rect.bottom};
          return intersectRect(mapped,shellRect);
        }).filter(rect=>rect.width>=2&&rect.height>=2);
        while(hitList.length<visibleRects.length)hitList.push(createParentHit(sourceImage,doc));
        hitList.forEach((hit,index)=>{
          const visible=visibleRects[index];
          if(!visible){hit.hidden=true;return}
          hit.hidden=false;hit.style.left=`${visible.left}px`;hit.style.top=`${visible.top}px`;hit.style.width=`${visible.width}px`;hit.style.height=`${visible.height}px`;
        });
      });
    });
  }
  function scheduleParentHitRefresh(){if(parentHitFrame)return;parentHitFrame=requestAnimationFrame(refreshParentHits)}
  function installParentHits(doc){
    if(!needsParentHitTargets(doc)||parentHits.has(doc))return;
    const hits=new Map();parentHits.set(doc,{hits});
    // WebKit parent-owned hit targets use fixed parent coordinates. Any scroll
    // inside the EPUB iframe invalidates those coordinates until they are remapped.
    doc.addEventListener?.("scroll",scheduleParentHitRefresh,true);
    doc.defaultView?.addEventListener?.("scroll",scheduleParentHitRefresh,{passive:true});
    doc.querySelectorAll?.("img").forEach(sourceImage=>{
      hits.set(sourceImage,[createParentHit(sourceImage,doc)]);
      sourceImage.addEventListener?.("load",scheduleParentHitRefresh,{once:false});
    });
    scheduleParentHitRefresh();
  }

  function installDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgReaderImageFocus==="1")return;
    doc.documentElement.dataset.sgReaderImageFocus="1";
    try{const style=doc.createElement("style");style.id="sg-reader-image-focus-style";style.textContent="img{cursor:zoom-in}";doc.head?.appendChild(style)}catch{}
    installParentHits(doc);
    let pointerStart=null;
    const activate=(sourceImage,event)=>{
      if(!sourceImage||state.active)return false;
      if(shouldSuppressOpen?.()){event?.preventDefault?.();event?.stopImmediatePropagation?.();return false}
      event?.preventDefault?.();event?.stopImmediatePropagation?.();return openImageFocus(sourceImage,doc);
    };
    doc.addEventListener("pointerdown",event=>{
      const sourceImage=imageTarget(event.target);
      if(!sourceImage||Number(event.button)>0){pointerStart=null;return}
      pointerStart={id:event.pointerId,image:sourceImage,x:Number(event.clientX)||0,y:Number(event.clientY)||0};
    },true);
    doc.addEventListener("pointerup",event=>{
      const start=pointerStart;pointerStart=null;
      const sourceImage=imageTarget(event.target);
      if(!start||start.id!==event.pointerId||!sourceImage||sourceImage!==start.image)return;
      if(Math.hypot((Number(event.clientX)||0)-start.x,(Number(event.clientY)||0)-start.y)>12)return;
      setTimeout(()=>{if(!state.active&&!shouldSuppressOpen?.())openImageFocus(sourceImage,doc)},0);
    },true);
    doc.addEventListener("pointercancel",()=>{pointerStart=null},true);
    doc.addEventListener("click",event=>{
      const sourceImage=imageTarget(event.target);if(!sourceImage)return;
      activate(sourceImage,event);
    },true);
  }
  function attachRendition(rendition){
    if(!rendition||rendition.__sgR41ImageFocus)return;
    rendition.__sgR41ImageFocus=true;
    try{rendition.hooks?.content?.register?.(contents=>installDocument(contents?.document||contents?.contentDocument))}catch(error){console.warn("Reader image focus hook unavailable",error)}
    try{rendition.on?.("rendered",(_section,view)=>{installDocument(view?.contents?.document||view?.contents?.contentDocument);scheduleParentHitRefresh()})}catch{}
    try{rendition.on?.("relocated",scheduleParentHitRefresh);rendition.on?.("resized",scheduleParentHitRefresh);rendition.on?.("removed",(_section,view)=>removeParentHits(view?.contents?.document||view?.contents?.contentDocument))}catch{}
    try{rendition.getContents?.().forEach(contents=>installDocument(contents?.document||contents?.contentDocument))}catch{}
  }

  function beginTouch(event){
    if(!state.active)return;
    const touches=event.touches||[];
    if(touches.length>=2){
      const a=touches[0],b=touches[1];
      const midpoint=pointInViewport(((Number(a.clientX)||0)+(Number(b.clientX)||0))/2,((Number(a.clientY)||0)+(Number(b.clientY)||0))/2);
      state.gesture={mode:"pinch",distance:Math.max(1,distance(a,b)),scale:state.scale,x:state.x,y:state.y,midpoint};
      event.preventDefault();return;
    }
    const touch=touches[0];if(!touch)return;
    if(state.scale>1.001)state.gesture={mode:"pan",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0,x:state.x,y:state.y,moved:false};
    else state.gesture={mode:"tap",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0};
    event.preventDefault();
  }
  function moveTouch(event){
    const gesture=state.gesture,touches=event.touches||[];if(!gesture)return;
    if(gesture.mode==="pinch"&&touches.length>=2){
      const a=touches[0],b=touches[1],ratio=distance(a,b)/gesture.distance;
      const midpoint=pointInViewport(((Number(a.clientX)||0)+(Number(b.clientX)||0))/2,((Number(a.clientY)||0)+(Number(b.clientY)||0))/2);
      const next=clamp(gesture.scale*ratio,1,state.maxScale);
      const size=viewportSize(),centerX=size.width/2,centerY=size.height/2;
      const contentX=(gesture.midpoint.x-centerX-gesture.x)/gesture.scale,contentY=(gesture.midpoint.y-centerY-gesture.y)/gesture.scale;
      setTransform(next,midpoint.x-centerX-contentX*next,midpoint.y-centerY-contentY*next);event.preventDefault();return;
    }
    if(gesture.mode==="pan"&&touches.length){
      const touch=touches[0],dx=(Number(touch.clientX)||0)-gesture.clientX,dy=(Number(touch.clientY)||0)-gesture.clientY;
      if(Math.hypot(dx,dy)>6)gesture.moved=true;
      setTransform(state.scale,gesture.x+dx,gesture.y+dy);event.preventDefault();return;
    }
    if(gesture.mode==="tap"&&touches.length){
      const touch=touches[0];if(Math.hypot((Number(touch.clientX)||0)-gesture.clientX,(Number(touch.clientY)||0)-gesture.clientY)>12)gesture.mode="moved";
      event.preventDefault();
    }
  }
  function endTouch(event){
    const gesture=state.gesture;if(!gesture)return;
    if(gesture.mode==="pinch"&&event.touches?.length===1){
      const touch=event.touches[0];state.gesture={mode:"pan",clientX:Number(touch.clientX)||0,clientY:Number(touch.clientY)||0,x:state.x,y:state.y,moved:true};event.preventDefault();return;
    }
    state.gesture=null;
    if(gesture.mode==="tap"||(gesture.mode==="pan"&&!gesture.moved)){
      state.suppressCloseClickUntil=Date.now()+400;event.preventDefault();closeImageFocus();return;
    }
    if(gesture.mode==="pinch"||gesture.mode==="pan"||gesture.mode==="moved"){
      state.suppressCloseClickUntil=Date.now()+300;event.preventDefault();
    }
  }
  function handleWheel(event){
    if(!state.active)return;
    event.preventDefault();const delta=normalizeWheel(event);
    /* v2.6.6 desktop contract: plain wheel zooms (cursor-anchored); ctrl/meta stays a
       zoom alias for trackpad pinch-reporting; horizontal wheel pans when zoomed. */
    if(!finePointer&&!(event.ctrlKey||event.metaKey)){
      if(state.scale>1.001)setTransform(state.scale,state.x-delta.x,state.y-delta.y);
      return;
    }
    const point=pointInViewport(event.clientX,event.clientY);
    zoomAt(state.scale*Math.exp(-delta.y*.0016),point);
  }
  let pointerDrag=null;
  function handlePointerDown(event){
    if(!state.active||!finePointer||event.pointerType==="touch"||Number(event.button)>0){pointerDrag=null;return}
    pointerDrag={id:event.pointerId,x:Number(event.clientX)||0,y:Number(event.clientY)||0,ox:state.x,oy:state.y,moved:false};
    try{viewport?.setPointerCapture?.(event.pointerId)}catch{}
    event.preventDefault();
  }
  function handlePointerMove(event){
    if(!pointerDrag||pointerDrag.id!==event.pointerId||!state.active||state.scale<=1.001)return;
    const dx=(Number(event.clientX)||0)-pointerDrag.x,dy=(Number(event.clientY)||0)-pointerDrag.y;
    if(Math.hypot(dx,dy)>4)pointerDrag.moved=true;
    setTransform(state.scale,pointerDrag.ox+dx,pointerDrag.oy+dy);
    event.preventDefault();
  }
  function handlePointerUp(event){
    if(pointerDrag&&pointerDrag.id===event.pointerId&&pointerDrag.moved)state.suppressCloseClickUntil=Date.now()+300;
    pointerDrag=null;
  }

  viewport?.addEventListener("touchstart",beginTouch,{passive:false});
  viewport?.addEventListener("touchmove",moveTouch,{passive:false});
  viewport?.addEventListener("touchend",endTouch,{passive:false});
  viewport?.addEventListener("touchcancel",()=>{state.gesture=null},{passive:true});
  viewport?.addEventListener("wheel",handleWheel,{passive:false});
  viewport?.addEventListener("pointerdown",handlePointerDown);
  viewport?.addEventListener("pointermove",handlePointerMove);
  viewport?.addEventListener("pointerup",handlePointerUp,{passive:true});
  viewport?.addEventListener("pointercancel",()=>{pointerDrag=null},{passive:true});
  viewport?.addEventListener("dblclick",event=>{
    if(!finePointer||!state.active)return;
    event.preventDefault();closeImageFocus();
  });
  viewport?.addEventListener("click",event=>{
    if(Date.now()<state.suppressCloseClickUntil)return;
    /* fine-pointer devices return via double-click or the close button; accidental
       single clicks must not dismiss the focused image */
    if(finePointer)return;
    event.preventDefault();closeImageFocus();
  });
  closeButton?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();closeImageFocus()});
  image?.addEventListener("load",()=>{if(state.active)setTransform(state.scale,state.x,state.y)});
  window.addEventListener("resize",()=>{if(state.active)setTransform(state.scale,state.x,state.y);scheduleParentHitRefresh()});
  document.addEventListener("scroll",scheduleParentHitRefresh,true);
  render();

  return{attachRendition,installDocument,openImageFocus,closeImageFocus,isFocused:()=>state.active,isZoomed:()=>state.scale>1.001,scale:()=>state.scale};
}
