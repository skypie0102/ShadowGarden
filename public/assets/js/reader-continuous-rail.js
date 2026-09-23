/* Dedicated Continuous-mode seek rail.
 * This is only a vertical UI proxy for the normal #progressRange control.
 * It writes the same value and fires the same input/change events, so Pages and
 * Continuous modes use exactly the same canonical progress seek path.
 * Presentation is supplied explicitly by reader/progress-controller.js.
 */
(()=>{
  let activePointer=null;
  let rail=null,track=null,label=null,range=null;

  const clamp01=value=>Math.min(1,Math.max(0,Number(value)||0));

  function isContinuous(){
    return document.body?.classList.contains("reader-flow-scrolled")===true;
  }

  function init(){
    rail=document.getElementById("continuousSeek");
    track=document.getElementById("continuousSeekTrack");
    label=document.getElementById("continuousSeekText");
    range=document.getElementById("progressRange");
    if(!rail||!track||!label||!range)return;

    syncFromCore();
    document.addEventListener("sg:reader-progress",progressChanged);
    track.addEventListener("pointerdown",pointerDown);
    rail.addEventListener("keydown",keyDown);
  }

  function render(percentage){
    const p=clamp01(percentage);
    rail.style.setProperty("--sg-progress",`${p*100}%`);
    rail.setAttribute("aria-valuenow",String(Math.round(p*100)));
    label.textContent=`${Math.round(p*100)}%`;
  }

  function applyPresentation(presentation){
    if(!rail||!label||!presentation)return;
    render(presentation.value);
    label.textContent=String(presentation.rail||presentation.percent||label.textContent);
    const accessible=String(presentation.accessible||`${Math.round(clamp01(presentation.value)*100)}% of volume`);
    rail.setAttribute("aria-valuetext",accessible);
    rail.title=accessible;
  }

  function progressChanged(event){
    if(activePointer===null)applyPresentation(event.detail);
  }

  function syncFromCore(){
    if(!range||!rail)return;
    const p=clamp01(Number(range.value||0)/1000);
    render(p);
    const accessible=range.getAttribute("aria-valuetext")||`${Math.round(p*100)}% of volume`;
    rail.setAttribute("aria-valuetext",accessible);
    rail.title=accessible;
  }

  function valueFromY(clientY){
    const rect=track?.getBoundingClientRect();
    if(!rect||!rect.height)return clamp01(Number(range?.value||0)/1000);
    return clamp01((clientY-rect.top)/rect.height);
  }

  function forwardToCore(percentage,type){
    const p=clamp01(percentage);
    range.value=String(Math.round(p*1000));
    render(p);
    range.dispatchEvent(new Event(type,{bubbles:true}));
  }

  function pointerDown(event){
    if(!isContinuous())return;
    event.preventDefault();
    activePointer=event.pointerId;
    try{track.setPointerCapture?.(event.pointerId)}catch{}
    forwardToCore(valueFromY(event.clientY),"input");
    track.addEventListener("pointermove",pointerMove);
    track.addEventListener("pointerup",pointerUp);
    track.addEventListener("pointercancel",pointerCancel);
  }

  function pointerMove(event){
    if(event.pointerId!==activePointer)return;
    event.preventDefault();
    forwardToCore(valueFromY(event.clientY),"input");
  }

  function finishPointer(event,shouldCommit){
    if(event.pointerId!==activePointer)return;
    event.preventDefault();
    const percentage=valueFromY(event.clientY);
    activePointer=null;
    try{track.releasePointerCapture?.(event.pointerId)}catch{}
    track.removeEventListener("pointermove",pointerMove);
    track.removeEventListener("pointerup",pointerUp);
    track.removeEventListener("pointercancel",pointerCancel);
    if(shouldCommit)forwardToCore(percentage,"change");
    else syncFromCore();
  }

  function pointerUp(event){finishPointer(event,true)}
  function pointerCancel(event){finishPointer(event,false)}

  function keyDown(event){
    if(!isContinuous())return;
    let p=clamp01(Number(range.value||0)/1000),handled=true;
    if(event.key==="ArrowUp")p-=.01;
    else if(event.key==="ArrowDown")p+=.01;
    else if(event.key==="PageUp")p-=.1;
    else if(event.key==="PageDown")p+=.1;
    else if(event.key==="Home")p=0;
    else if(event.key==="End")p=1;
    else handled=false;
    if(!handled)return;
    event.preventDefault();
    forwardToCore(clamp01(p),"change");
  }

  function initWhenParsed(){
    if(document.readyState==="loading")return;
    document.removeEventListener("readystatechange",initWhenParsed);
    init();
  }
  if(document.readyState==="loading")document.addEventListener("readystatechange",initWhenParsed);
  else init();
})();
