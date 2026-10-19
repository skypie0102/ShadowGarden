/* Image-focus touch input. The controller owns each listener's lifetime, including
 * WebKit's parent hit surfaces. Touches never synthesize mouse clicks: one physical
 * tap must enter the double-tap recognizer exactly once. */

export function createDoubleTapActivation(){
  let previous=null;
  return{
    reset(){previous=null},
    tap(target,point,now=Date.now()){
      const current={target,x:Number(point?.clientX)||0,y:Number(point?.clientY)||0,time:now};
      const matched=previous&&previous.target===target&&now>=previous.time&&now-previous.time<=350&&Math.hypot(current.x-previous.x,current.y-previous.y)<=24;
      previous=matched?null:current;
      return Boolean(matched);
    }
  };
}

export function installImageFocusTapTransport(scope,node,{targetForEvent,onTap,onCancel}){
  let start=null;
  const cancel=()=>{start=null;onCancel?.()};
  scope.listen(node,'touchstart',event=>{
    const target=targetForEvent(event),touch=event.touches?.[0];
    if(!target||event.touches?.length!==1){cancel();return}
    start={target,id:touch.identifier,x:touch.clientX,y:touch.clientY,time:Date.now()};
  },{capture:true,passive:true});
  scope.listen(node,'touchmove',event=>{
    const touch=event.touches?.[0];
    if(start&&(event.touches?.length!==1||touch.identifier!==start.id||Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>12))cancel();
  },{capture:true,passive:true});
  scope.listen(node,'touchend',event=>{
    const tap=start;start=null;
    const touch=event.changedTouches?.[0];
    if(!tap)return;
    if(event.touches?.length||!touch||touch.identifier!==tap.id||targetForEvent(event)!==tap.target||Date.now()-tap.time>300||Math.hypot(touch.clientX-tap.x,touch.clientY-tap.y)>12){cancel();return}
    // Cancel native double-tap zoom and the compatibility click. Native scrolling
    // and pinch zoom remain available because start/move are passive.
    event.preventDefault();onTap(tap.target,touch,event);
  },{capture:true,passive:false});
  scope.listen(node,'touchcancel',cancel,{capture:true,passive:true});
  scope.listen(node,'scroll',cancel,{capture:true,passive:true});
}
