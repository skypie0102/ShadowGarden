/* Shadow Garden Security Milestones 2–4 — signed access, opaque identities, human sessions. */
(()=>{
  const nativeFetch=window.fetch.bind(window);
  const cache=new Map();
  const initialBook=new URLSearchParams(location.search).get("book")||"";
  const ACCESS_TIMEOUT_MS=12000;
  const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
  const LEGACY_BOOK=/^\/media\/shadow-garden\/books\/.+\.epub$/i;
  const TURNSTILE_SCRIPT="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  const encoder=new TextEncoder();
  let renewalTimer=0;
  let humanAccessPromise=null;
  let turnstileScriptPromise=null;

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

  function whenBody(){
    if(document.body)return Promise.resolve();
    return new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
  }

  function installHumanAccessStyles(){
    if(document.getElementById("sg-human-access-style"))return;
    const style=document.createElement("style");
    style.id="sg-human-access-style";
    style.textContent=`
      .sg-human-gate{position:fixed;z-index:10000;inset:0;padding:20px;display:grid;place-items:center;background:rgba(4,5,5,.74);backdrop-filter:blur(12px)}
      .sg-human-card{width:min(460px,100%);padding:24px;border:1px solid rgba(180,210,190,.20);border-radius:18px;color:#edf2ed;background:linear-gradient(155deg,rgba(19,28,22,.98),rgba(8,11,9,.99));box-shadow:0 28px 90px rgba(0,0,0,.58);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
      .sg-human-gate.adult .sg-human-card{border-color:rgba(214,137,160,.24);background:linear-gradient(155deg,rgba(31,16,23,.98),rgba(14,8,11,.99))}
      .sg-human-mark{width:44px;height:44px;display:grid;place-items:center;margin-bottom:14px;border:1px solid rgba(180,210,190,.22);border-radius:13px;color:#b4d9bd;background:rgba(145,189,157,.06)}
      .sg-human-gate.adult .sg-human-mark{color:#e0a8b8;border-color:rgba(214,137,160,.25);background:rgba(201,130,153,.07)}
      .sg-human-kicker{margin:0 0 7px;color:#91bd9d;font-size:.66rem;font-weight:800;letter-spacing:.20em;text-transform:uppercase}
      .sg-human-gate.adult .sg-human-kicker{color:#c98299}
      .sg-human-card h2{margin:0;font:500 1.75rem/1.08 Georgia,"Times New Roman",serif;letter-spacing:-.025em}
      .sg-human-copy{margin:10px 0 18px;color:#9aa69d;font-size:.82rem;line-height:1.6}
      .sg-human-gate.adult .sg-human-copy{color:#b89aa4}
      .sg-human-widget{min-height:66px;display:grid;align-items:center;overflow:hidden}
      .sg-human-status{min-height:1.4em;margin:12px 0 0;color:#7f8d82;font-size:.72rem;line-height:1.45}
      .sg-human-status.error{color:#cf8181}
      .sg-human-actions{margin-top:16px;display:flex;justify-content:flex-end}
      .sg-human-cancel{min-height:38px;padding:0 12px;border:1px solid rgba(180,210,190,.16);border-radius:9px;color:#9aa69d;background:rgba(255,255,255,.025);cursor:pointer}
      .sg-human-gate.adult .sg-human-cancel{border-color:rgba(214,137,160,.18);color:#b89aa4}
      .sg-human-cancel:hover,.sg-human-cancel:focus-visible{color:#edf2ed;border-color:rgba(180,210,190,.30);outline:none}
      @media(max-width:520px){.sg-human-gate{padding:12px}.sg-human-card{padding:20px;border-radius:15px}}
      @media(prefers-reduced-motion:reduce){.sg-human-gate{backdrop-filter:none}}
    `;
    document.head.appendChild(style);
  }

  function loadTurnstile(){
    if(window.turnstile?.render)return Promise.resolve(window.turnstile);
    if(turnstileScriptPromise)return turnstileScriptPromise;
    turnstileScriptPromise=new Promise((resolve,reject)=>{
      const ready=()=>window.turnstile?.render?resolve(window.turnstile):reject(new Error("Human verification did not initialize."));
      const existing=document.querySelector('script[data-sg-turnstile]');
      if(existing){
        existing.addEventListener("load",ready,{once:true});
        existing.addEventListener("error",()=>reject(new Error("Human verification could not be loaded.")),{once:true});
        if(window.turnstile?.render)resolve(window.turnstile);
        return;
      }
      const script=document.createElement("script");
      script.src=TURNSTILE_SCRIPT;
      script.async=true;
      script.defer=true;
      script.dataset.sgTurnstile="1";
      script.addEventListener("load",ready,{once:true});
      script.addEventListener("error",()=>reject(new Error("Human verification could not be loaded.")),{once:true});
      document.head.appendChild(script);
    }).catch(error=>{turnstileScriptPromise=null;throw error});
    return turnstileScriptPromise;
  }

  function adultContext(){
    if(document.body?.classList.contains("adult-library")||document.body?.classList.contains("adult-reader"))return true;
    return String(new URLSearchParams(location.search).get("series")||"").startsWith("adult-");
  }

  async function presentHumanChallenge(challenge){
    await whenBody();
    installHumanAccessStyles();
    const turnstile=await loadTurnstile();
    if(!challenge?.siteKey)throw new Error("Human verification is unavailable because the site key is missing.");

    return new Promise((resolve,reject)=>{
      const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
      const overlay=document.createElement("div");
      overlay.className=`sg-human-gate${adultContext()?" adult":""}`;
      overlay.setAttribute("role","dialog");
      overlay.setAttribute("aria-modal","true");
      overlay.setAttribute("aria-labelledby","sgHumanTitle");
      overlay.innerHTML=`
        <section class="sg-human-card">
          <div class="sg-human-mark" aria-hidden="true">✦</div>
          <p class="sg-human-kicker">GARDEN PASS</p>
          <h2 id="sgHumanTitle">Confirm you’re human</h2>
          <p class="sg-human-copy">One quick check opens protected books for the next 12 hours on this browser. Reading, page turns, and normal navigation stay uninterrupted.</p>
          <div class="sg-human-widget" data-sg-human-widget></div>
          <p class="sg-human-status" data-sg-human-status aria-live="polite">Preparing verification…</p>
          <div class="sg-human-actions"><button class="sg-human-cancel" type="button">Cancel</button></div>
        </section>`;
      document.body.appendChild(overlay);
      const host=overlay.querySelector("[data-sg-human-widget]");
      const status=overlay.querySelector("[data-sg-human-status]");
      const cancel=overlay.querySelector(".sg-human-cancel");
      let widgetId=null;
      let settled=false;
      let verifying=false;

      const setStatus=(message,error=false)=>{
        status.textContent=message;
        status.classList.toggle("error",Boolean(error));
      };
      const cleanup=()=>{
        try{if(widgetId!==null)turnstile.remove(widgetId)}catch{}
        overlay.remove();
        previousFocus?.focus?.();
      };
      const finish=(error=null)=>{
        if(settled)return;
        settled=true;
        cleanup();
        error?reject(error):resolve(true);
      };
      const reset=message=>{
        verifying=false;
        setStatus(message,true);
        try{if(widgetId!==null)turnstile.reset(widgetId)}catch{}
      };

      const submit=async token=>{
        if(verifying||settled)return;
        verifying=true;
        setStatus("Verifying your Garden Pass…");
        try{
          const response=await nativeFetch("/human-access",{
            method:"POST",
            credentials:"same-origin",
            headers:{"content-type":"application/json"},
            body:JSON.stringify({token})
          });
          let payload=null;
          try{payload=await response.json()}catch{}
          if(response.ok&&payload?.ok){
            setStatus("Verified. Opening the Garden…");
            finish();
            return;
          }
          if(response.status===403&&payload?.code==="human_verification_failed"){
            reset(payload?.error||"Verification was not accepted. Please try again.");
            return;
          }
          finish(new Error(payload?.error||`Human verification failed (${response.status}).`));
        }catch(error){
          finish(error);
        }
      };

      cancel.addEventListener("click",()=>finish(new Error("Human verification was cancelled.")));
      overlay.addEventListener("keydown",event=>{
        if(event.key==="Escape"){event.preventDefault();finish(new Error("Human verification was cancelled."))}
      });

      try{
        widgetId=turnstile.render(host,{
          sitekey:challenge.siteKey,
          action:challenge.action||"book_access",
          theme:"dark",
          size:"flexible",
          callback:token=>void submit(token),
          "expired-callback":()=>reset("Verification expired. Please try again."),
          "error-callback":()=>{reset("Verification could not complete. Please try again.");return true},
          "timeout-callback":()=>reset("Verification timed out. Please try again.")
        });
        setStatus("Complete the verification to continue.");
        cancel.focus();
      }catch(error){
        finish(new Error(error?.message||"Human verification could not start."));
      }
    });
  }

  async function ensureHumanAccess(challenge){
    if(humanAccessPromise)return humanAccessPromise;
    humanAccessPromise=presentHumanChallenge(challenge).finally(()=>{humanAccessPromise=null});
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

  window.fetch=async(input,init)=>{
    const opaque=opaquePseudoRequest(input);
    if(opaque){
      const ticket=await resolve(opaque);
      if(!ticket?.sourcePath)throw new Error("Authorized EPUB source is unavailable.");
      return nativeFetch(ticket.sourcePath,init);
    }
    if(!isRawEpubRequest(input))return nativeFetch(input,init);
    const identity=normalizeIdentity(input instanceof Request?input.url:input);
    await resolve(identity);
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
