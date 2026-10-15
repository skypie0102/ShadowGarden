/* Shadow Garden R4 — shared Reader navigation barrier for async rendition moves. */
const barriers=new WeakMap();
const navigators=new WeakMap();

// Content extensions delegate explicit navigation to the active application
// owner so chapter state, input reset and Continuous settling stay together.
export function registerRenditionNavigator(rendition,navigate){
  if(!rendition||typeof navigate!=="function")throw new TypeError("A rendition navigation owner is required");
  navigators.set(rendition,navigate);
  return()=>{if(navigators.get(rendition)===navigate)navigators.delete(rendition);};
}

export function navigateRendition(rendition,target){
  if(!rendition||!target)return Promise.resolve(false);
  const navigate=navigators.get(rendition);
  return Promise.resolve(navigate?navigate(target):rendition.display(target));
}

export function holdRenditionNavigation(rendition,promise){
  if(!rendition||!promise?.then)return Promise.resolve();
  let barrier;
  barrier=Promise.resolve(promise).catch(error=>{
    console.warn("Reader navigation barrier released after a failed move",error);
  }).finally(()=>{
    if(barriers.get(rendition)===barrier)barriers.delete(rendition);
  });
  barriers.set(rendition,barrier);
  return barrier;
}

export function waitForRenditionNavigation(rendition){
  return barriers.get(rendition)||Promise.resolve();
}
