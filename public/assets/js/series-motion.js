/* Shadow Garden v2.5 — observes canonical Series rendering; never computes reading state. */
(()=>{
  const root=document.getElementById("seriesRoot");
  if(!root)return;
  const previous=new Map();
  let hydrated=false;

  const reduced=()=>Boolean(window.ShadowGardenMotion?.reduced||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const cardsIn=node=>{
    if(!(node instanceof Element))return[];
    const cards=[];
    if(node.matches?.(".volume-card"))cards.push(node);
    cards.push(...node.querySelectorAll?.(".volume-card")||[]);
    return cards;
  };
  const progressOf=card=>{
    const span=card?.querySelector?.(".cover-reading-progress>span");
    if(!span)return 0;
    const value=Number.parseFloat(span.style.width||"0");
    return Number.isFinite(value)?Math.max(0,Math.min(100,value)):0;
  };
  const snapshot=card=>({
    state:String(card?.dataset?.readingState||""),
    progress:progressOf(card)
  });
  const keyOf=card=>String(card?.dataset?.volumeIndex||"");

  function rememberRemoved(records){
    records.forEach(record=>record.removedNodes.forEach(node=>cardsIn(node).forEach(card=>{
      const key=keyOf(card);if(key)previous.set(key,snapshot(card));
    })));
  }

  function animateProgress(card,before){
    const bar=card.querySelector(".cover-reading-progress>span");
    if(!bar||reduced()||typeof bar.animate!=="function")return;
    const after=progressOf(card);
    if(!Number.isFinite(before)||Math.abs(after-before)<.25)return;
    const fromScale=after>0?before/after:1;
    if(after<=0)return;
    bar.animate([
      {transform:`scaleX(${Math.max(0,fromScale)})`},
      {transform:"scaleX(1)"}
    ],{duration:390,easing:"cubic-bezier(.16,1,.3,1)"});
  }

  function animateAdded(records){
    let sawHydratedContent=false;
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node instanceof Element&&(node.matches?.(".series-hero,.series-body")||node.querySelector?.(".series-hero,.series-body")))sawHydratedContent=true;
      cardsIn(node).forEach(card=>{
        const key=keyOf(card);if(!key)return;
        const before=previous.get(key);
        if(before){
          const after=snapshot(card);
          animateProgress(card,before.progress);
          if(before.state!==after.state&&!reduced()){
            card.classList.add("sg-reading-state-changed");
            window.setTimeout(()=>card.classList.remove("sg-reading-state-changed"),430);
          }
          previous.delete(key);
        }
      });
    }));
    if(!hydrated&&sawHydratedContent){
      hydrated=true;
      root.classList.add("sg-series-hydrated");
      window.setTimeout(()=>root.classList.remove("sg-series-hydrated"),430);
      window.ShadowGardenMotion?.decorateControls?.(root);
    }
  }

  const observer=new MutationObserver(records=>{
    rememberRemoved(records);
    animateAdded(records);
  });
  observer.observe(root,{childList:true,subtree:true});
})();
