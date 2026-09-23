(()=>{
  const query="(prefers-reduced-motion: reduce)";
  const preference=window.matchMedia?.(query);
  const root=document.documentElement;
  const navigationKey="sg-motion-navigation";

  const reduced=()=>Boolean(preference?.matches);
  const syncPreference=()=>{
    root.dataset.sgMotion=reduced()?"reduced":"full";
    window.dispatchEvent(new CustomEvent("sg:motionchange",{detail:{reduced:reduced()}}));
  };

  const skippedTransition=error=>error?.name==="AbortError"||/transition was skipped/i.test(String(error?.message||error||""));
  const observeTransitionPromise=promise=>{
    if(!promise||typeof promise.catch!=="function")return;
    promise.catch(error=>{if(!skippedTransition(error))console.warn("View transition promise rejected",error)});
  };
  const guardTransition=transition=>{
    observeTransitionPromise(transition?.ready);
    observeTransitionPromise(transition?.finished);
    observeTransitionPromise(transition?.updateCallbackDone);
    return transition;
  };
  const observeCrossDocumentFinished=transition=>{
    guardTransition(transition);
    return transition?.finished;
  };
  const skipTraverseTransition=event=>{
    const transition=event?.viewTransition;
    if(!transition||event?.activation?.navigationType!=="traverse")return false;
    try{transition.skipTransition()}catch{}
    return true;
  };

  const fallbackTransition=update=>{
    let result;
    try{result=update?.()}catch(error){return guardTransition({finished:Promise.reject(error),ready:Promise.reject(error),updateCallbackDone:Promise.reject(error),skipTransition(){}})}
    const done=Promise.resolve(result);
    return guardTransition({finished:done,ready:Promise.resolve(),updateCallbackDone:done,skipTransition(){}});
  };

  const transition=(update,{types=[]}={})=>{
    if(reduced()||typeof document.startViewTransition!=="function")return fallbackTransition(update);
    try{
      if(types.length){
        try{return guardTransition(document.startViewTransition({update,types}))}catch{}
      }
      return guardTransition(document.startViewTransition(update));
    }catch{
      return fallbackTransition(update);
    }
  };

  const routeDepth=pathname=>{
    const path=String(pathname||"").toLowerCase();
    if(path.endsWith("/reader.html"))return 3;
    if(path.endsWith("/series.html")||path.endsWith("/admin.html"))return 2;
    return 1;
  };
  const normalizeDirection=value=>["forward","backward","lateral"].includes(value)?value:"lateral";
  const directionFor=(url,anchor)=>{
    if(anchor?.classList?.contains("header-back")||anchor?.classList?.contains("reader-return"))return"backward";
    if(anchor?.id==="openSeries")return"forward";
    const from=routeDepth(location.pathname),to=routeDepth(url.pathname);
    return to>from?"forward":to<from?"backward":"lateral";
  };
  const writeNavigationHint=detail=>{
    const direction=normalizeDirection(detail?.direction);
    root.dataset.sgNavDirection=direction;
    try{sessionStorage.setItem(navigationKey,JSON.stringify({direction,target:String(detail?.target||""),at:Date.now()}))}catch{}
    return direction;
  };
  const restoreNavigationHint=()=>{
    try{
      const raw=sessionStorage.getItem(navigationKey);if(!raw)return;
      const hint=JSON.parse(raw);if(Date.now()-Number(hint?.at||0)>5000){sessionStorage.removeItem(navigationKey);return}
      root.dataset.sgNavDirection=normalizeDirection(hint?.direction);
      sessionStorage.removeItem(navigationKey);
    }catch{}
  };
  const clearNavigationHint=()=>{delete root.dataset.sgNavDirection};

  const decorateControls=(scope=document)=>{
    const selector="button,[role='button'],a.reader-icon,a.reader-return,.volume-action,.header-back,.recent-view-all,.footer-button";
    scope.querySelectorAll?.(selector).forEach(element=>element.classList.add("sg-motion-control"));
  };

  const observeNavigation=()=>{
    document.addEventListener("click",event=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.target?.closest?.("a[href]");if(!anchor||anchor.hasAttribute("download")||anchor.target==="_blank")return;
      let url;try{url=new URL(anchor.href,location.href)}catch{return}
      if(url.origin!==location.origin)return;
      writeNavigationHint({direction:directionFor(url,anchor),target:url.pathname});
    },true);
    window.addEventListener("sg:navigationintent",event=>writeNavigationHint(event.detail||{}));
    window.addEventListener("pageswap",event=>{
      if(skipTraverseTransition(event))return;
      observeCrossDocumentFinished(event.viewTransition);
    });
    window.addEventListener("pagereveal",event=>{
      if(skipTraverseTransition(event)){clearNavigationHint();return}
      const finished=observeCrossDocumentFinished(event.viewTransition);
      if(finished&&typeof finished.then==="function")finished.then(clearNavigationHint,clearNavigationHint);
      else window.setTimeout(clearNavigationHint,520);
    });
    window.addEventListener("pageshow",()=>window.setTimeout(clearNavigationHint,720),{once:true});
  };

  const boot=()=>{
    syncPreference();
    decorateControls();
    document.documentElement.classList.add("sg-motion-ready");
    if("MutationObserver" in window){
      const observer=new MutationObserver(records=>{
        records.forEach(record=>record.addedNodes.forEach(node=>{
          if(node.nodeType!==1)return;
          if(node.matches?.("button,[role='button'],a.reader-icon,a.reader-return,.volume-action,.header-back,.recent-view-all,.footer-button"))node.classList.add("sg-motion-control");
          decorateControls(node);
        }));
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
  };

  restoreNavigationHint();
  observeNavigation();
  preference?.addEventListener?.("change",syncPreference);
  window.ShadowGardenMotion=Object.freeze({
    get reduced(){return reduced()},
    transition,
    decorateControls,
    navigationIntent:(direction,target="")=>writeNavigationHint({direction,target})
  });

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
