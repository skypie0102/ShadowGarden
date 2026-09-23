/* Shadow Garden v2.5 — presentation observers only; Reader remains the progress owner. */
(()=>{
  const reduced=()=>Boolean(window.ShadowGardenMotion?.reduced||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const pulse=element=>{
    if(!element||reduced())return;
    element.classList.remove("sg-progress-updated");
    void element.offsetWidth;
    element.classList.add("sg-progress-updated");
    window.setTimeout(()=>element.classList.remove("sg-progress-updated"),280);
  };

  function observeText(element){
    if(!element)return;
    let previous=String(element.textContent||"");
    new MutationObserver(()=>{
      const next=String(element.textContent||"");
      if(next===previous)return;
      previous=next;
      pulse(element);
    }).observe(element,{childList:true,characterData:true,subtree:true});
  }

  function observeReady(){
    const loading=document.getElementById("readerLoading");
    if(!loading)return;
    const sync=()=>{
      if(!loading.classList.contains("hidden")||document.body.classList.contains("sg-reader-ready"))return;
      document.body.classList.add("sg-reader-ready");
      window.setTimeout(()=>document.body.classList.remove("sg-reader-ready"),380);
    };
    new MutationObserver(sync).observe(loading,{attributes:true,attributeFilter:["class"]});
    sync();
  }

  function boot(){
    observeText(document.getElementById("progressText"));
    observeText(document.getElementById("continuousSeekText"));
    observeReady();
    window.ShadowGardenMotion?.decorateControls?.(document.getElementById("readerApp")||document);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
