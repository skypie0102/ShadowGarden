const DAY=86400000;

export function cacheEvictions(entries,{version,maxEntries,maxPerBook=maxEntries,maxBytes=Infinity,maxAgeMs=30*DAY,now=Date.now()}){
  const discarded=[],books=new Map();let count=0,bytes=0;
  const timestamp=entry=>Number.isFinite(entry.createdAt)?entry.createdAt:-Infinity;
  for(const entry of [...entries].sort((a,b)=>timestamp(b)-timestamp(a))){
    const perBook=books.get(entry.book)||0;
    const expired=!Number.isFinite(entry.createdAt)||entry.createdAt<now-maxAgeMs;
    const invalidSize=!Number.isFinite(entry.bytes)||entry.bytes<0;
    if(entry.version!==version||expired||invalidSize||count>=maxEntries||perBook>=maxPerBook||entry.bytes>maxBytes-bytes){
      discarded.push(entry.key);continue;
    }
    count++;bytes+=entry.bytes;books.set(entry.book,perBook+1);
  }
  return discarded;
}

// Existing stores and keys are preserved. Cache maintenance is atomic with a
// read/write, and never touches reading progress, bookmarks or provider data.
export function createReaderCache({database,store:storeName,version,...limits}){
  function metadata(value,key=value?.key){
    let bytes=NaN;
    try{
      const blobs=Array.isArray(value.visuals)?value.visuals.map(record=>record?.blob).filter(Boolean):null;
      bytes=blobs?[...new Set(blobs)].reduce((total,blob)=>total+blob.size,0):new Blob([JSON.stringify(value)]).size;
    }catch{/* A damaged disposable cache record is selected for eviction. */}
    return{key,book:value?.bookUrl||key,version:value?.version,createdAt:Number(value?.createdAt),bytes};
  }

  function open(){
    if(!globalThis.indexedDB)return Promise.resolve(null);
    return new Promise(resolve=>{
      let blocked=false;
      try{
        const request=indexedDB.open(database,1);
        request.onupgradeneeded=()=>{
          if(!request.result.objectStoreNames.contains(storeName))request.result.createObjectStore(storeName,{keyPath:'key'});
        };
        request.onblocked=()=>{blocked=true;resolve(null)};
        request.onerror=()=>resolve(null);
        request.onsuccess=()=>{if(blocked)request.result.close();else resolve(request.result)};
      }catch{resolve(null)}
    });
  }

  async function access(key,incoming){
    const db=await open();if(!db)return incoming?false:null;
    return new Promise(resolve=>{
      let result=incoming?false:null;
      try{
        const tx=db.transaction(storeName,'readwrite'),store=tx.objectStore(storeName);
        const entries=incoming?[metadata(incoming)]:[];
        const request=store.openCursor();
        request.onsuccess=()=>{try{
          const cursor=request.result;
          if(cursor){
            if(cursor.key!==incoming?.key)entries.push(metadata(cursor.value,cursor.primaryKey));
            if(!incoming&&cursor.key===key)result=cursor.value;
            cursor.continue();return;
          }
          const discarded=cacheEvictions(entries,{version,...limits});
          for(const oldKey of discarded)store.delete(oldKey);
          if(incoming){
            result=!discarded.includes(incoming.key);
            if(result)store.put(incoming);
          }else if(discarded.includes(key))result=null;
        }catch{tx.abort()}};
        tx.oncomplete=()=>{db.close();resolve(result)};
        tx.onerror=tx.onabort=()=>{db.close();resolve(incoming?false:null)};
      }catch{db.close();resolve(incoming?false:null)}
    });
  }
  return{get:key=>access(key),put:value=>access(value.key,value)};
}
