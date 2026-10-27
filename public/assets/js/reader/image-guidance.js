import {createReaderScope} from './lifecycle.js';
import {readText,writeText} from '../domain/storage.js';

const seenKey='sg-reader-image-focus-tip-seen';

// First-use copy belongs to the parent UI, never to publication markup or
// image activation. Only a visible illustration can start its eight-second tip.
export function createImageFocusGuidance({element,text,dismissButton}={}){
  if(!element||!text||!dismissButton)return{observeDocument(){},acknowledge(){},dispose(){}};
  const scope=createReaderScope(),observations=scope.child(),images=new Set();
  let finished=readText(seenKey)==='1',timer=0,frame=0;
  element.hidden=true;
  const fine=matchMedia('(pointer: fine)'),coarse=matchMedia('(pointer: coarse)');

  function hide(){
    scope.clearTimeout(timer);timer=0;element.hidden=true;
  }
  function acknowledge(persist=true){
    if(finished)return;
    finished=true;hide();images.clear();observations.dispose();
    scope.cancelFrame(frame);frame=0;
    if(persist)writeText(seenKey,'1');
  }
  function refresh(){
    if(scope.disposed||finished)return;
    const loading=document.getElementById('readerLoading');
    const blocked=document.hidden||(loading&&!loading.classList.contains('hidden'))
      ||document.body.classList.contains('reader-image-focused')
      ||document.querySelector('.reader-drawer.open,dialog[open]');
    if(blocked||![...images].some(imageVisible)){hide();return}
    const copy=fine.matches&&!coarse.matches?'Double-click an illustration to zoom.':'Double-tap an illustration to zoom.';
    if(text.textContent!==copy)text.textContent=copy;
    if(element.hidden){element.hidden=false;timer=scope.timeout(()=>acknowledge(),8000)}
  }

  function imageVisible(image){
    if(!image.isConnected||image.naturalWidth<100||image.naturalHeight<100)return false;
    const iframe=image.ownerDocument.defaultView?.frameElement;
    if(!iframe?.isConnected)return false;
    const outer=iframe.getBoundingClientRect(),canvas=document.getElementById('viewer')?.getBoundingClientRect();
    if(!canvas)return false;
    return [...image.getClientRects()].some(rect=>{
      const width=Math.min(outer.left+rect.right,outer.right,canvas.right,window.innerWidth)-Math.max(outer.left+rect.left,outer.left,canvas.left,0);
      const height=Math.min(outer.top+rect.bottom,outer.bottom,canvas.bottom,window.innerHeight)-Math.max(outer.top+rect.top,outer.top,canvas.top,0);
      return width>=48&&height>=48;
    });
  }
  // WebKit does not reliably report cross-document image intersections. Read
  // the same parent-coordinate fragments used by image activation, once per
  // frame after relevant events. No polling or publication style writes occur.
  function schedule(){
    if(scope.disposed||finished)return;
    if(!images.size){hide();return}
    if(!frame)frame=scope.frame(()=>{frame=0;refresh()});
  }
  if(!finished){
    observations.observe(new MutationObserver(schedule),document.body,{subtree:true,attributes:true,attributeFilter:['class','open','style']});
    observations.listen(document,'scroll',schedule,{capture:true,passive:true});
    observations.listen(window,'resize',schedule,{passive:true});
    observations.listen(document,'visibilitychange',()=>document.hidden?hide():schedule());
    observations.listen(fine,'change',schedule);
    observations.listen(coarse,'change',schedule);
    observations.listen(window,'storage',event=>{if(event.key===seenKey&&event.newValue==='1')acknowledge(false)});
    scope.listen(dismissButton,'click',()=>acknowledge());
  }
  scope.add(hide);

  function observeDocument(doc,owner){
    if(scope.disposed||finished||owner.disposed)return;
    const tracked=new Map(),lifetime=observations.child().link(owner);
    lifetime.add(schedule);
    lifetime.listen(doc,'scroll',schedule,{capture:true,passive:true});
    function syncImages(){
      if(scope.disposed||finished)return;
      const current=new Set(doc.querySelectorAll('img'));
      for(const [image,resources] of tracked)if(!current.has(image))resources.dispose();
      for(const image of current){
        if(tracked.has(image))continue;
        const resources=lifetime.child();tracked.set(image,resources);images.add(image);
        resources.listen(image,'load',schedule);
        const Resize=doc.defaultView?.ResizeObserver;
        if(Resize)resources.observe(new Resize(schedule),image);
        resources.add(()=>{images.delete(image);tracked.delete(image)});
      }
      schedule();
    }
    // Visual-page preparation can replace the original image after content hooks
    // run. Observe the live replacement, releasing the removed image's resources.
    lifetime.observe(new MutationObserver(syncImages),doc.body,{childList:true,subtree:true});
    syncImages();
  }
  return{observeDocument,acknowledge:()=>acknowledge(),dispose:()=>scope.dispose()};
}
