import {createReaderScope} from './lifecycle.js';
import {readText,writeText} from '../domain/storage.js';

const seenKey='sg-reader-image-focus-tip-seen';

// First-use copy belongs to the parent UI, never to publication markup or
// image activation. Only a visible illustration can start its eight-second tip.
export function createImageFocusGuidance({element,text,dismissButton}={}){
  if(!element||!text||!dismissButton)return{observeDocument(){},acknowledge(){},dispose(){}};
  const scope=createReaderScope(),observations=scope.child(),visible=new Set();
  let finished=readText(seenKey)==='1',timer=0;
  element.hidden=true;
  const fine=matchMedia('(pointer: fine)'),coarse=matchMedia('(pointer: coarse)');

  function hide(){
    scope.clearTimeout(timer);timer=0;element.hidden=true;
  }
  function acknowledge(persist=true){
    if(finished)return;
    finished=true;hide();visible.clear();observations.dispose();
    if(persist)writeText(seenKey,'1');
  }
  function refresh(){
    if(scope.disposed||finished)return;
    const loading=document.getElementById('readerLoading');
    const blocked=document.hidden||(loading&&!loading.classList.contains('hidden'))
      ||document.body.classList.contains('reader-image-focused')
      ||document.querySelector('.reader-drawer.open,dialog[open]');
    if(blocked||![...visible].some(image=>image.isConnected)){hide();return}
    const copy=fine.matches&&!coarse.matches?'Double-click an illustration to zoom.':'Double-tap an illustration to zoom.';
    if(text.textContent!==copy)text.textContent=copy;
    if(element.hidden){element.hidden=false;timer=scope.timeout(()=>acknowledge(),8000)}
  }

  // Zero-area edge contact is already "intersecting" during frame startup.
  // A positive threshold ensures later visible artwork generates a fresh entry.
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
    for(const entry of entries){
      const image=entry.target,rect=entry.boundingClientRect;
      if(entry.intersectionRatio>=.1&&rect.width>=48&&rect.height>=48&&image.naturalWidth>=100&&image.naturalHeight>=100)visible.add(image);
      else visible.delete(image);
    }
    refresh();
  },{threshold:.1}):null;
  observations.add(()=>observer?.disconnect());
  if(!finished){
    // Drawing/closing a drawer can reveal an image without another intersection
    // event. Observe only parent UI attributes; no publication mutation is made.
    observations.observe(new MutationObserver(refresh),document.body,{subtree:true,attributes:true,attributeFilter:['class','open']});
    observations.listen(document,'visibilitychange',refresh);
    observations.listen(fine,'change',refresh);
    observations.listen(coarse,'change',refresh);
    observations.listen(window,'storage',event=>{if(event.key===seenKey&&event.newValue==='1')acknowledge(false)});
    scope.listen(dismissButton,'click',()=>acknowledge());
  }
  scope.add(hide);

  function observeDocument(doc,owner){
    if(scope.disposed||finished||!observer||owner.disposed)return;
    const images=new Map(),lifetime=observations.child().link(owner);
    lifetime.add(refresh);
    function syncImages(){
      if(scope.disposed||finished)return;
      const current=new Set(doc.querySelectorAll('img'));
      for(const [image,resources] of images)if(!current.has(image))resources.dispose();
      for(const image of current){
        if(images.has(image))continue;
        const resources=lifetime.child();images.set(image,resources);
        observer.observe(image);
        resources.listen(image,'load',()=>{observer.unobserve(image);observer.observe(image)});
        resources.add(()=>{observer.unobserve(image);visible.delete(image);images.delete(image)});
      }
      refresh();
    }
    // Visual-page preparation can replace the original image after content hooks
    // run. Observe the live replacement, releasing the removed image's resources.
    lifetime.observe(new MutationObserver(syncImages),doc.body,{childList:true,subtree:true});
    syncImages();
  }
  return{observeDocument,acknowledge:()=>acknowledge(),dispose:()=>scope.dispose()};
}
