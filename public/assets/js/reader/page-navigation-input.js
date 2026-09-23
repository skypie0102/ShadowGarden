/* Shadow Garden R4.2 — Pages-mode swipe and desktop wheel input only. */

function interactiveTarget(target){
  return typeof target?.closest==="function"&&Boolean(target.closest("a,button,input,select,textarea,label,[contenteditable=true],[role=button],[role=slider]"));
}
function hasSelection(doc){try{return Boolean(doc?.getSelection?.()?.toString().trim())}catch{return false}}
function normalizeWheel(event){
  let y=Number(event?.deltaY)||0,x=Number(event?.deltaX)||0;
  if(event?.deltaMode===1){x*=18;y*=18}else if(event?.deltaMode===2){x*=window.innerWidth;y*=window.innerHeight}
  return{x,y};
}
function gesturePoint(point){
  return{
    x:Number(point?.clientX ?? point?.screenX)||0,
    y:Number(point?.clientY ?? point?.screenY)||0
  };
}

export function pageSwipeDirection({dx=0,dy=0,elapsed=0}={}){
  const horizontal=Math.abs(dx)>=48&&Math.abs(dx)>Math.abs(dy)*1.18;
  if(elapsed>=1000||!horizontal)return 0;
  return dx<0?1:-1;
}

export function createPageNavigationInput({getFlow,getSwipeTurns,turn}={}){
  const desktop=window.matchMedia?.("(min-width:900px)");
  const state={swipe:null,suppressClickUntil:0,wheelAccumulated:0,lastWheelTurn:0};

  function reset(){state.swipe=null;state.wheelAccumulated=0}
  function shouldSuppressClick(){return Date.now()<state.suppressClickUntil}

  function beginGesture(point,target,doc,id="touch"){
    if(getFlow?.()!=="paginated"||getSwipeTurns?.()===false||interactiveTarget(target))return;
    const start=gesturePoint(point);
    state.swipe={x:start.x,y:start.y,at:performance.now(),doc,id};
  }

  function finishGesture(point,event,doc,id="touch"){
    const swipe=state.swipe;state.swipe=null;
    if(!swipe||swipe.id!==id||getFlow?.()!=="paginated"||getSwipeTurns?.()===false||hasSelection(doc))return;
    const end=gesturePoint(point);
    const direction=pageSwipeDirection({dx:end.x-swipe.x,dy:end.y-swipe.y,elapsed:performance.now()-swipe.at});
    if(!direction)return;
    state.suppressClickUntil=Date.now()+420;
    try{event.preventDefault()}catch{}
    turn?.(direction);
  }

  function beginTouch(event,doc){
    const touches=event.touches||[];
    if(touches.length!==1)return;
    beginGesture(touches[0],event.target,doc,"touch");
  }
  function finishTouch(event,doc){
    const touch=event.changedTouches?.[0];if(!touch){state.swipe=null;return}
    finishGesture(touch,event,doc,"touch");
  }

  function beginPointer(event,doc){
    if(event.pointerType&&event.pointerType!=="touch"||event.isPrimary===false)return;
    beginGesture(event,event.target,doc,`pointer:${Number(event.pointerId)||1}`);
  }
  function finishPointer(event,doc){
    if(event.pointerType&&event.pointerType!=="touch"||event.isPrimary===false){state.swipe=null;return}
    finishGesture(event,event,doc,`pointer:${Number(event.pointerId)||1}`);
  }

  function handleWheel(event){
    if(getFlow?.()!=="paginated"||desktop?.matches===false)return;
    const delta=normalizeWheel(event);
    if(Math.abs(delta.y)<Math.abs(delta.x))return;
    try{event.preventDefault()}catch{}
    const now=performance.now();
    if(now-state.lastWheelTurn<190)return;
    state.wheelAccumulated+=delta.y;
    if(Math.abs(state.wheelAccumulated)<48)return;
    const direction=state.wheelAccumulated>0?1:-1;
    state.wheelAccumulated=0;state.lastWheelTurn=now;
    turn?.(direction);
  }

  function installDocument(doc){
    if(!doc?.documentElement||doc.documentElement.dataset.sgReaderPageInput==="1")return;
    doc.documentElement.dataset.sgReaderPageInput="1";
    const win=doc.defaultView;
    if(typeof win?.PointerEvent==="function"){
      doc.documentElement.dataset.sgReaderSwipeInput="pointer";
      doc.addEventListener("pointerdown",event=>beginPointer(event,doc),{capture:true,passive:true});
      doc.addEventListener("pointercancel",()=>{state.swipe=null},{capture:true,passive:true});
      doc.addEventListener("pointerup",event=>finishPointer(event,doc),{capture:true,passive:false});
    }else{
      doc.documentElement.dataset.sgReaderSwipeInput="touch";
      doc.addEventListener("touchstart",event=>beginTouch(event,doc),{capture:true,passive:true});
      doc.addEventListener("touchcancel",()=>{state.swipe=null},{capture:true,passive:true});
      doc.addEventListener("touchend",event=>finishTouch(event,doc),{capture:true,passive:false});
    }
    try{doc.defaultView?.addEventListener("wheel",handleWheel,{capture:true,passive:false})}catch(error){console.warn("Reader page wheel input unavailable",error)}
  }

  function attachRendition(rendition){
    if(!rendition||rendition.__sgR42PageInput)return;
    rendition.__sgR42PageInput=true;
    try{rendition.hooks?.content?.register?.(contents=>installDocument(contents?.document||contents?.contentDocument))}catch(error){console.warn("Reader page input hook unavailable",error)}
    try{rendition.on?.("rendered",(_section,view)=>installDocument(view?.contents?.document||view?.contents?.contentDocument))}catch{}
    try{rendition.getContents?.().forEach(contents=>installDocument(contents?.document||contents?.contentDocument))}catch{}
  }

  return{attachRendition,installDocument,reset,shouldSuppressClick};
}
