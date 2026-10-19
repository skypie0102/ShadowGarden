/* Shadow Garden Security Milestones 2–4 — signed access, opaque identities, human sessions. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  const cache=new Map();
  const initialBook=new URLSearchParams(location.search).get("book")||"";
  const ACCESS_TIMEOUT_MS=12000;
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const LEGACY_BOOK=/^\/media\/shadow-garden\/books\/.+\.epub$/i;
  const encoder=new TextEncoder();
  let renewalTimer=0;
  let humanAccessPromise=null;

  function base64Url(bytes){
    let binary="";
    for(const value of bytes)binary+=String.fromCharCode(value);
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function legacyPath(value){
    try{
      const url=new URL(String(value||""),location.href);
      return url.origin===location.origin&&LEGACY_BOOK.test(url.pathname)?url.pathname:"";
    }catch{return""}
  }
  function normalizeIdentity(book){
    const raw=String(book||"").trim();
    if(BOOK_ID.test(raw))return raw;
    return legacyPath(raw)||raw;
  }
  function requestUrl(value){
    try{return new URL(value instanceof Request?value.url:String(value||""),location.href)}catch{return null}
  }
  function isRawEpubRequest(value){
    const url=requestUrl(value);
    return Boolean(url&&url.origin===location.origin&&LEGACY_BOOK.test(url.pathname)&&!url.searchParams.has("sig"));
  }
  function opaquePseudoRequest(value){
    const url=requestUrl(value);
    if(!url||url.origin!==location.origin)return"";
    const match=url.pathname.match(/^\/(bk_[A-Za-z0-9_-]{22})$/);
    return match?.[1]||"";
  }
  async function bookIdForLegacyPath(value){
    const path=legacyPath(value);
    if(!path)return"";
    const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(`shadow-garden-book-id-v1\n${path}`)));
    return `bk_${base64Url(digest.slice(0,16))}`;
  }

  async function adultContext(){
    const {adultRoute,findSeriesContext}=await import("./domain/catalog.js");
    const params=new URLSearchParams(location.search),seriesId=params.get("series")||params.get("id")||"";
    const hint=seriesId?adultRoute(seriesId,location.search):document.body?.classList.contains("adult-library")||document.body?.classList.contains("adult-reader");
    if(seriesId&&window.ShadowGardenData?.loadCatalog){
      try{const found=await findSeriesContext(window.ShadowGardenData.loadCatalog,seriesId,{adult:hint,reuse:true});if(found)return found.adult}catch{}
    }
    return Boolean(hint);
  }

  async function ensureHumanAccess(challenge){
    if(humanAccessPromise)return humanAccessPromise;
    humanAccessPromise=import("./public/garden-pass.js").then(async({presentHumanChallenge})=>presentHumanChallenge(challenge,{
      adult:await adultContext(),
      verify:async token=>{
        const response=await nativeFetch("/human-access",{
          method:"POST",credentials:"same-origin",
          headers:{"content-type":"application/json"},body:JSON.stringify({token})
        });
        let payload=null;
        try{payload=await response.json()}catch{}
        return{ok:response.ok,status:response.status,payload};
      }
    })).finally(()=>{humanAccessPromise=null});
    return humanAccessPromise;
  }

  async function requestTicket(identity){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),ACCESS_TIMEOUT_MS);
    try{
      return await nativeFetch("/book-access",{
        method:"POST",
        credentials:"same-origin",
        signal:controller.signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify(BOOK_ID.test(identity)?{bookId:identity}:{book:identity})
      });
    }catch(error){
      if(error?.name==="AbortError")throw new Error("Book authorization timed out. Please try again.");
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  async function resolve(book,{force=false,humanRetry=false}={}){
    const identity=normalizeIdentity(book);
    if(!identity)throw new Error("No EPUB was selected.");
    const now=Math.floor(Date.now()/1000);
    const cached=cache.get(identity);
    if(!force&&cached&&Number(cached.expiresAt)-now>45)return cached;

    const response=await requestTicket(identity);
    let payload=null;
    try{payload=await response.json()}catch{}
    if(response.status===428&&payload?.code==="human_verification_required"){
      if(humanRetry)throw new Error("Human verification session was not accepted. Please try again.");
      await ensureHumanAccess(payload);
      return resolve(identity,{force:true,humanRetry:true});
    }
    if(response.status===503&&payload?.code==="human_verification_unavailable"){
      throw new Error(payload?.error||"Human verification is temporarily unavailable. Please try again later.");
    }
    if(response.status===503&&payload?.code==="ticketing_not_configured"){
      throw new Error("Signed EPUB access is unavailable because the server is not configured. Please try again later.");
    }
    if(!response.ok||!payload?.url)throw new Error(payload?.error||`Book access failed (${response.status}).`);
    const resolved=new URL(payload.url,location.href);
    const canonicalId=BOOK_ID.test(payload?.bookId||"")?payload.bookId:(BOOK_ID.test(identity)?identity:await bookIdForLegacyPath(identity));
    const result={
      url:resolved.pathname+resolved.search,
      sourcePath:resolved.pathname,
      identity:canonicalId||identity,
      requestedIdentity:identity,
      bookId:canonicalId||"",
      protected:true,
      expiresAt:Number(payload.expiresAt)||0,
      ttlSeconds:Number(payload.ttlSeconds)||0
    };
    cache.set(identity,result);
    if(canonicalId)cache.set(canonicalId,result);
    return result;
  }

  async function migrateLegacyState(bookIds=[]){
    const wanted=new Set((Array.isArray(bookIds)?bookIds:[]).filter(id=>BOOK_ID.test(String(id||""))));
    if(!wanted.size)return 0;
    const keys=[];
    for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));
    let migrated=0;
    for(const key of keys){
      const prefix=key?.startsWith("sg-progress:")?"sg-progress:":key?.startsWith("sg-bookmarks:")?"sg-bookmarks:":"";
      if(!prefix)continue;
      const oldIdentity=key.slice(prefix.length);
      if(!legacyPath(oldIdentity))continue;
      const bookId=await bookIdForLegacyPath(oldIdentity);
      if(!wanted.has(bookId))continue;
      const nextKey=`${prefix}${bookId}`;
      const raw=localStorage.getItem(key);
      if(raw===null)continue;
      if(prefix==="sg-progress:"){
        let nextRaw=raw;
        let oldUpdated=0;
        try{
          const value=JSON.parse(raw);
          oldUpdated=Number(value?.updatedAt)||0;
          if(value&&typeof value==="object")value.file=bookId;
          nextRaw=JSON.stringify(value);
        }catch{}
        let currentUpdated=0;
        try{currentUpdated=Number(JSON.parse(localStorage.getItem(nextKey)||"null")?.updatedAt)||0}catch{}
        if(localStorage.getItem(nextKey)===null||oldUpdated>currentUpdated){localStorage.setItem(nextKey,nextRaw);migrated++}
      }else if(localStorage.getItem(nextKey)===null){
        localStorage.setItem(nextKey,raw);
        migrated++;
      }
    }
    return migrated;
  }

  function scheduleRenewal(ticket){
    clearTimeout(renewalTimer);
    if(!ticket?.protected||!initialBook)return;
    const delay=Math.max(30000,(Number(ticket.expiresAt)-Math.floor(Date.now()/1000)-60)*1000);
    renewalTimer=setTimeout(()=>{
      resolve(initialBook,{force:true}).then(scheduleRenewal).catch(error=>{
        console.warn("Reader ticket renewal delayed",error);
        renewalTimer=setTimeout(()=>resolve(initialBook,{force:true}).then(scheduleRenewal).catch(()=>{}),60000);
      });
    },delay);
  }

  function fetchAuthorizedSource(input,init,path){
    if(!(input instanceof Request))return nativeFetch(path,init);
    const request=new Request(input,init);
    const options=Object.fromEntries(["method","headers","credentials","mode","cache","redirect","referrer","referrerPolicy","integrity","keepalive","signal"].map(key=>[key,request[key]]));
    if(request.body){options.body=request.body;options.duplex="half"}
    return nativeFetch(new Request(new URL(path,location.href),options));
  }

  window.fetch=async(input,init)=>{
    const opaque=opaquePseudoRequest(input);
    const raw=isRawEpubRequest(input);
    if(!opaque&&!raw)return nativeFetch(input,init);
    const signal=init&&"signal" in init?init.signal:input instanceof Request?input.signal:null;
    signal?.throwIfAborted();
    if(opaque){
      const ticket=await resolve(opaque);
      signal?.throwIfAborted();
      if(!ticket?.sourcePath)throw new Error("Authorized EPUB source is unavailable.");
      return fetchAuthorizedSource(input,init,ticket.sourcePath);
    }
    const identity=normalizeIdentity(input instanceof Request?input.url:input);
    await resolve(identity);
    signal?.throwIfAborted();
    return nativeFetch(input,init);
  };

  async function download(book,filename=""){
    const ticket=await resolve(book);
    const link=document.createElement("a");
    link.href=ticket.url;
    link.download=filename||"";
    link.rel="nofollow";
    link.dataset.sgBookAccessBypass="1";
    link.style.display="none";
    document.body.appendChild(link);
    try{link.click()}finally{link.remove()}
    return ticket;
  }

  document.addEventListener("click",event=>{
    const link=event.target.closest?.("a[download]");
    if(!link||link.dataset.sgBookAccessBypass==="1")return;
    const rawHref=String(link.getAttribute("href")||"").trim();
    const reference=link.dataset.bookId|| (BOOK_ID.test(rawHref)?rawHref:isRawEpubRequest(link.href)?link.href:"");
    if(!reference)return;
    event.preventDefault();
    if(link.dataset.sgBookAccessBusy==="1")return;
    link.dataset.sgBookAccessBusy="1";
    const original=link.textContent;
    if(original)link.textContent="Preparing…";
    download(reference,link.getAttribute("download")||"").catch(error=>{
      console.error("EPUB download authorization failed",error);
      alert(error?.message||"Could not prepare this EPUB download.");
    }).finally(()=>{
      delete link.dataset.sgBookAccessBusy;
      if(original)link.textContent=original;
    });
  });

  const initial=initialBook?resolve(initialBook):Promise.resolve(null);
  initial.then(scheduleRenewal).catch(()=>{});
  window.addEventListener("pagehide",()=>clearTimeout(renewalTimer),{once:true});
  window.ShadowGardenBookAccess={resolve,download,initial,identity:initialBook,migrateLegacyState,bookIdForLegacyPath,ensureHumanAccess};
})();
