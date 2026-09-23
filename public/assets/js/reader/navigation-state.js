/* Shadow Garden R4 — shared Reader navigation barrier for async rendition moves. */
const barriers=new WeakMap();

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
