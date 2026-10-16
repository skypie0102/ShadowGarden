// Some WebKit stores accept ArrayBuffers but reject Blob/File writes. Persist
// portable bytes, then reconstruct shared image Blobs only when opening a book.
// This disposable cache version is separate from progress/bookmark storage.
export const VISUAL_CACHE_VERSION=3;

export async function serializeVisualCache(value){
  const assets=new Map();
  const visuals=await Promise.all(value.visuals.map(async({blob,...record})=>{
    if(!assets.has(blob))assets.set(blob,blob.arrayBuffer());
    return{...record,bytes:await assets.get(blob),blobType:blob.type};
  }));
  return{...value,visuals};
}

export function deserializeVisualCache(value){
  if(!value||!Array.isArray(value.visuals))return null;
  const assets=new Map();
  const visuals=value.visuals.map(({bytes,blobType,...record})=>{
    if(!assets.has(bytes))assets.set(bytes,new Blob([bytes],{type:blobType}));
    return{...record,blob:assets.get(bytes)};
  });
  return{...value,visuals};
}
