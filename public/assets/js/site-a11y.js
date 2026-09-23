/* Shadow Garden — dynamic public-site accessibility state. */
(()=>{
  function syncViewSwitch(){
    document.querySelectorAll('.view-switch button[data-view]').forEach(button=>{
      button.setAttribute('aria-pressed',button.classList.contains('active')?'true':'false');
    });
  }

  const viewSwitch=document.querySelector('.view-switch');
  if(viewSwitch){
    syncViewSwitch();
    new MutationObserver(syncViewSwitch).observe(viewSwitch,{subtree:true,attributes:true,attributeFilter:['class']});
  }

  const gate=document.getElementById('adultGate');
  if(gate){
    const background=[document.querySelector('.site-header'),document.querySelector('main'),document.querySelector('footer')].filter(Boolean);
    let wasLocked=false;
    const syncGate=()=>{
      const locked=!gate.classList.contains('hidden');
      background.forEach(node=>{
        if(locked)node.setAttribute('inert','');
        else node.removeAttribute('inert');
      });
      if(locked&&!wasLocked)requestAnimationFrame(()=>document.getElementById('adultEnter')?.focus({preventScroll:true}));
      wasLocked=locked;
    };
    new MutationObserver(syncGate).observe(gate,{attributes:true,attributeFilter:['class']});
    syncGate();
  }

  const seriesRoot=document.getElementById('seriesRoot');
  if(seriesRoot){
    const syncBusy=()=>{
      const busy=Boolean(seriesRoot.querySelector('.loading-screen'));
      seriesRoot.setAttribute('aria-busy',busy?'true':'false');
    };
    new MutationObserver(syncBusy).observe(seriesRoot,{childList:true,subtree:true});
    syncBusy();
  }

  void import('/assets/js/site-flavor.js?v=2.11.0').catch(error=>console.warn('Shadow Garden flavor copy unavailable',error));
})();
