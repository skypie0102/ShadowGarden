/* Shadow Garden v2.6 — visual adapter around the canonical Library controller. */
(()=>{
  const root=document.documentElement;
  const replayKey="__sgMotionReplay";
  const transitionSelectors=[
    "#authorSelect","#translatorSelect","#genreSelect","#yearSelect","#volumeCountSelect","#sortSelect","#tagSelect"
  ].join(",");
  const clickSelectors=[
    ".view-switch button[data-view]","#genreChips button[data-tag]","button[data-reading-status]",
    "#activeTags button[data-remove-tag]","#activeTags button[data-clear-filter]","#activeTags button[data-clear-all-filters]",
    "#emptyActions button[data-remove-tag]","#emptyActions button[data-clear-filter]","#emptyActions button[data-clear-all-filters]",
    "#clearFilters","#pinnedNav"
  ].join(",");
  let suggestionNoticeTimer=0;

  const safeName=value=>`sg-card-${String(value||"").trim().toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"unknown"}`;
  const seriesIdFromCard=card=>{
    try{return new URL(card?.getAttribute("href")||"",location.href).searchParams.get("id")||""}catch{return ""}
  };
  const suggestionIdentity=()=>{
    const action=document.querySelector("#continuePanel [data-volume-action]");
    return action?`${action.dataset.seriesId||""}:${action.dataset.bookId||""}`:"";
  };

  function decorateCatalog(){
    document.querySelectorAll("#catalogGrid .series-card").forEach(card=>{
      const id=seriesIdFromCard(card);
      card.style.viewTransitionName=id?safeName(id):"none";
    });
  }

  function decorateDynamicControls(){window.ShadowGardenMotion?.decorateControls?.(document.querySelector("#catalogSection")||document)}

  function afterUpdate(){
    decorateCatalog();
    decorateDynamicControls();
  }

  function replay(event,target,type){
    const options={bubbles:true,cancelable:true,composed:true};
    const next=type==="click"?new MouseEvent("click",options):new Event(type,options);
    Object.defineProperty(next,replayKey,{value:true});
    target.dispatchEvent(next);
    afterUpdate();
  }

  function transitionEvent(event,target,type){
    const motion=window.ShadowGardenMotion;
    if(!motion||motion.reduced||typeof document.startViewTransition!=="function")return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    const transitionType=target.closest?.(".view-switch")?"library-layout":"library-filter";
    motion.transition(()=>replay(event,target,type),{types:[transitionType]});
    return true;
  }

  function decorateSuggestion(){
    const panel=document.querySelector("#continuePanel");
    const art=document.querySelector(".library-intro > .intro-banner-art");
    if(panel)panel.style.viewTransitionName="library-suggestion";
    if(art)art.style.viewTransitionName="library-suggestion-art";
  }

  function clearSuggestionDecoration(){
    const panel=document.querySelector("#continuePanel");
    const art=document.querySelector(".library-intro > .intro-banner-art");
    if(panel?.style.viewTransitionName==="library-suggestion")panel.style.viewTransitionName="";
    if(art?.style.viewTransitionName==="library-suggestion-art")art.style.viewTransitionName="";
  }

  function showSuggestionNotice(){
    const panel=document.querySelector("#continuePanel");
    if(!panel)return;
    let notice=panel.querySelector("#suggestionNotice");
    if(!notice){
      notice=document.createElement("div");
      notice.id="suggestionNotice";
      notice.className="suggestion-notice";
      notice.setAttribute("role","status");
      notice.setAttribute("aria-live","polite");
      notice.setAttribute("aria-atomic","true");
      panel.appendChild(notice);
    }
    notice.textContent="The Garden has no other path to suggest just now.";
    notice.classList.remove("is-visible");
    requestAnimationFrame(()=>notice.classList.add("is-visible"));
    clearTimeout(suggestionNoticeTimer);
    suggestionNoticeTimer=setTimeout(()=>notice.classList.remove("is-visible"),3200);
  }

  function finishSuggestionReroll(before,{animate=true,restoreFocus=false}={}){
    const panel=document.querySelector("#continuePanel");
    const reroll=panel?.querySelector("[data-another-suggestion]");
    const after=suggestionIdentity();
    if(restoreFocus&&reroll)reroll.focus({preventScroll:true});
    if(animate&&panel){
      panel.classList.remove("suggestion-refreshed");
      requestAnimationFrame(()=>{
        panel.classList.add("suggestion-refreshed");
        setTimeout(()=>panel.classList.remove("suggestion-refreshed"),420);
      });
    }
    if(before&&after===before)showSuggestionNotice();
  }

  function suggestionReroll(event,button){
    const motion=window.ShadowGardenMotion;
    const before=suggestionIdentity();
    const restoreFocus=document.activeElement===button;
    if(!before)return false;
    if(!motion||motion.reduced||typeof document.startViewTransition!=="function"){
      queueMicrotask(()=>finishSuggestionReroll(before,{animate:Boolean(motion&&!motion.reduced),restoreFocus}));
      return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    decorateSuggestion();
    const transition=motion.transition(()=>{
      replay(event,button,"click");
      decorateSuggestion();
      finishSuggestionReroll(before,{animate:false,restoreFocus});
    },{types:["library-suggestion"]});
    Promise.resolve(transition?.finished).then(clearSuggestionDecoration,clearSuggestionDecoration);
    return true;
  }

  document.addEventListener("change",event=>{
    if(event[replayKey])return;
    const target=event.target;
    if(!(target instanceof Element)||!target.matches(transitionSelectors))return;
    transitionEvent(event,target,"change");
  },true);

  document.addEventListener("click",event=>{
    if(event[replayKey])return;
    const raw=event.target;
    if(!(raw instanceof Element))return;
    const reroll=raw.closest("[data-another-suggestion]");
    if(reroll){suggestionReroll(event,reroll);return}
    const target=raw.closest(clickSelectors);
    if(target){transitionEvent(event,raw,"click");return}

    /* Cross-document cover continuity. The outgoing cover is named only for the
       navigation being taken, avoiding duplicate names and BFCache conflicts. */
    const card=raw.closest("#catalogGrid .series-card");
    if(!card||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    let destination;
    try{destination=new URL(card.href,location.href)}catch{return}
    if(destination.origin!==location.origin||!destination.pathname.endsWith("/series.html"))return;
    document.querySelectorAll("#catalogGrid .series-card").forEach(item=>item.style.viewTransitionName="none");
    const cover=card.querySelector(".cover");
    if(cover)cover.style.viewTransitionName="series-cover";
  },true);

  function observeHydration(){
    const grid=document.querySelector("#catalogGrid");
    if(!grid)return;
    if(grid.querySelector(".catalog-skeleton-card"))root.classList.add("sg-library-motion-loading");
    const observer=new MutationObserver(()=>{
      afterUpdate();
      if(root.classList.contains("sg-library-motion-loading")&&grid.querySelector(".series-card")&&!grid.querySelector(".catalog-skeleton-card")){
        root.classList.add("sg-library-motion-hydrated");
        setTimeout(()=>root.classList.remove("sg-library-motion-loading"),360);
      }
    });
    observer.observe(grid,{childList:true,subtree:true});
  }

  window.addEventListener("pageshow",()=>{
    document.querySelectorAll("#catalogGrid .cover").forEach(cover=>cover.style.viewTransitionName="none");
    decorateCatalog();
  });

  const boot=()=>{observeHydration();afterUpdate()};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
