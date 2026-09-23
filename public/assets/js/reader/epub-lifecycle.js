/* Shadow Garden R4.1 — EPUB.js 0.3.93 lifecycle compatibility patch.
   Carries upstream Default/Continuous listener cleanup
   (futurepress/epub.js#326238c + #5daac43), closes the long-lived Book.spine
   rendition hook, and releases Section source DOM after its final live view is
   removed. tools/build.mjs pins the exact npm package revision; the bundle itself
   exposes only the coarse runtime API version below. */

const PATCHED_RUNTIME_VERSION="0.3";
const renditionPatchMarker=Symbol.for("shadow-garden.epubjs.rendition-lifecycle.v2");
const managerPatchMarker=Symbol.for("shadow-garden.epubjs.manager-lifecycle.v2");
const bookPatchMarker=Symbol.for("shadow-garden.epubjs.book-rendition-lifecycle.v2");
const instancePatchMarker=Symbol.for("shadow-garden.epubjs.rendition-instance-lifecycle.v2");
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);

function managerViews(manager){
  try{return manager?.views?.all?.()||[]}catch{return[]}
}

function managerSections(manager){
  return[...new Set(managerViews(manager).map(view=>view?.section).filter(Boolean))];
}

function sectionStillViewed(manager,section){
  return managerViews(manager).some(view=>view?.section===section);
}

function unloadSection(section){
  try{section?.unload?.()}catch(error){console.warn("EPUB.js section cache release skipped",error)}
}

function patchDefaultManagerListeners(prototype){
  prototype.addEventListeners=function(){
    const scroller=this.settings?.fullsize===true?window:this.container;
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=this.destroy.bind(this);
    window.addEventListener("unload",this._onUnload);
    if(this._onScroll&&scroller)scroller.removeEventListener("scroll",this._onScroll);
    this._onScroll=this.onScroll.bind(this);
    scroller?.addEventListener("scroll",this._onScroll);
  };

  prototype.removeEventListeners=function(){
    const scroller=this.settings?.fullsize===true?window:this.container;
    if(this._onScroll&&scroller)scroller.removeEventListener("scroll",this._onScroll);
    this._onScroll=undefined;
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=undefined;
  };
}

function patchContinuousManagerListeners(prototype){
  prototype.addEventListeners=function(){
    /* Shadow Garden creates Continuous renditions only as vertical scrolled-doc managers
       with EPUB.js snap disabled. Preserve EPUB.js's native Continuous scroll/debounce
       setup and carry upstream 5daac43's named unload listener exactly. */
    if(this.isPaginated&&this.settings?.snap)throw new Error("Unsupported EPUB.js Continuous snap lifecycle configuration");
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=function(){
      this.ignore=true;
      this.destroy();
    }.bind(this);
    window.addEventListener("unload",this._onUnload);
    this.addScrollListeners();
  };

  prototype.removeEventListeners=function(){
    const scroller=this.settings?.fullsize===true?window:this.container;
    if(this._onScroll&&scroller)scroller.removeEventListener("scroll",this._onScroll);
    this._onScroll=undefined;
    if(this._onUnload)window.removeEventListener("unload",this._onUnload);
    this._onUnload=undefined;
  };
}

function patchContinuousErase(prototype){
  const originalErase=prototype.erase;
  if(typeof originalErase!=="function")return;
  prototype.erase=function(view,...args){
    const section=view?.section||null;
    const result=originalErase.call(this,view,...args);
    /* Section.load() caches parsed source DOM on the long-lived Book spine. A trimmed
       IframeView destroys its rendered Contents but EPUB.js 0.3.93 does not unload that
       source cache. Release it only after the last live view for the section is gone. */
    if(section&&!sectionStillViewed(this,section))unloadSection(section);
    return result;
  };
}

function patchManagerClass(Manager){
  const prototype=Manager?.prototype;
  /* ContinuousViewManager inherits from DefaultViewManager. The marker therefore must be
     checked as an own property; otherwise patching Default first incorrectly suppresses
     the separate Continuous lifecycle fix. */
  if(!prototype||own(prototype,managerPatchMarker))return Manager;

  const originalDestroy=prototype.destroy;
  const continuous=own(prototype,"addScrollListeners");
  if(continuous){
    patchContinuousManagerListeners(prototype);
    patchContinuousErase(prototype);
  }else patchDefaultManagerListeners(prototype);

  prototype.destroy=function(...args){
    /* DefaultViewManager.destroy() clears every live view. Capture its source sections first
       so the shared Book cannot retain parsed chapter DOM after a flow switch. Continuous
       calls super.destroy(), so the patched Default method owns the section release once. */
    const sections=continuous?[]:managerSections(this);
    const orientationListener=this.stage?.orientationChangeFunc;
    if(orientationListener)window.removeEventListener("orientationchange",orientationListener);
    const result=originalDestroy?.apply(this,args);
    for(const section of sections)unloadSection(section);
    return result;
  };

  Object.defineProperty(prototype,managerPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return Manager;
}

function patchRenditionInstance(rendition,bookContentHooks,registeredHooks){
  if(!rendition||rendition[instancePatchMarker]||!registeredHooks.length)return rendition;
  const originalDestroy=rendition.destroy;
  rendition.destroy=function(...args){
    for(const hook of registeredHooks.splice(0)){
      try{bookContentHooks?.deregister?.(hook)}catch{}
    }
    return originalDestroy?.apply(this,args);
  };
  Object.defineProperty(rendition,instancePatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return rendition;
}

function patchBookRenderTo(Book){
  const prototype=Book?.prototype;
  if(!prototype||prototype[bookPatchMarker]||typeof prototype.renderTo!=="function")return Boolean(prototype?.[bookPatchMarker]);
  const renderTo=prototype.renderTo;
  prototype.renderTo=function(...args){
    const bookContentHooks=this.spine?.hooks?.content;
    const before=new Set(bookContentHooks?.list?.()||[]);
    const rendition=renderTo.apply(this,args);
    const added=(bookContentHooks?.list?.()||[]).filter(hook=>!before.has(hook));
    return patchRenditionInstance(rendition,bookContentHooks,added);
  };
  Object.defineProperty(prototype,bookPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  return true;
}

export function installEpubLifecyclePatch(epub=globalThis.ePub){
  if(String(epub?.VERSION||"")!==PATCHED_RUNTIME_VERSION)return false;
  const prototype=epub?.Rendition?.prototype;
  if(!prototype)return false;

  if(!prototype[renditionPatchMarker]){
    const requireManager=prototype.requireManager;
    if(typeof requireManager!=="function")return false;
    prototype.requireManager=function(manager){
      return patchManagerClass(requireManager.call(this,manager));
    };
    Object.defineProperty(prototype,renditionPatchMarker,{value:true,configurable:false,enumerable:false,writable:false});
  }

  if(!patchBookRenderTo(epub?.Book))return false;
  return true;
}
