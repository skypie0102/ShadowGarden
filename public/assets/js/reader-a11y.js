/* Shadow Garden — accessibility bridge around the existing reader UI. */
(()=>{
  const $=selector=>document.querySelector(selector);
  const tocToggle=$('#tocToggle'),settingsToggle=$('#settingsToggle');
  const tocDrawer=$('#tocDrawer'),settingsDrawer=$('#settingsDrawer');
  const drawers=[tocDrawer,settingsDrawer].filter(Boolean);
  let returnTarget=null;

  const triggerFor=drawer=>drawer===tocDrawer?tocToggle:drawer===settingsDrawer?settingsToggle:null;
  const focusable=drawer=>{
    if(drawer===tocDrawer&&drawer.querySelector('.toc-search-toggle[aria-expanded="true"]')){
      const search=drawer.querySelector('.toc-search');
      if(search)return search;
    }
    return drawer?.querySelector('button:not([disabled]),a[href],select,input,[tabindex]:not([tabindex="-1"])');
  };

  function syncDrawers(){
    let openDrawer=null;
    drawers.forEach(drawer=>{
      const open=drawer.classList.contains('open');
      drawer.setAttribute('aria-hidden',open?'false':'true');
      triggerFor(drawer)?.setAttribute('aria-expanded',open?'true':'false');
      if(open)openDrawer=drawer;
    });
    if(openDrawer){
      if(!returnTarget)returnTarget=triggerFor(openDrawer);
      if(!openDrawer.contains(document.activeElement))requestAnimationFrame(()=>focusable(openDrawer)?.focus({preventScroll:true}));
    }else if(returnTarget&&document.contains(returnTarget)){
      const target=returnTarget;returnTarget=null;
      requestAnimationFrame(()=>target.focus({preventScroll:true}));
    }
  }

  tocToggle?.addEventListener('click',()=>{returnTarget=tocToggle},{capture:true});
  settingsToggle?.addEventListener('click',()=>{returnTarget=settingsToggle},{capture:true});
  drawers.forEach(drawer=>new MutationObserver(syncDrawers).observe(drawer,{attributes:true,attributeFilter:['class']}));
  syncDrawers();

  const tabs=$('.drawer-tabs');
  if(tabs){
    tabs.setAttribute('role','tablist');
    const syncTabs=()=>{
      tabs.querySelectorAll('button[data-panel]').forEach(button=>{
        const selected=button.classList.contains('active');
        const panel=document.getElementById(button.dataset.panel==='toc'?'tocPanel':'bookmarksPanel');
        button.setAttribute('role','tab');
        button.setAttribute('aria-selected',selected?'true':'false');
        if(panel?.id)button.setAttribute('aria-controls',panel.id);
        if(panel){panel.setAttribute('role','tabpanel');panel.setAttribute('aria-hidden',panel.classList.contains('hidden')?'true':'false')}
      });
    };
    tabs.addEventListener('click',()=>requestAnimationFrame(syncTabs));
    new MutationObserver(syncTabs).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class']});
    syncTabs();
  }

  const fullscreen=$('#fullscreenButton');
  const syncFullscreen=()=>fullscreen?.setAttribute('aria-pressed',document.fullscreenElement?'true':'false');
  document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();

  const chapter=$('#chapterTitle');
  chapter?.setAttribute('aria-live','polite');
  chapter?.setAttribute('aria-atomic','true');

  // Progress semantics are owned by reader/progress-controller.js and mirrored by
  // reader-continuous-rail.js. This bridge must not write progress aria state.

  void import('/assets/js/site-flavor.js?v=2.11.0').catch(error=>console.warn('Shadow Garden flavor copy unavailable',error));
})();
