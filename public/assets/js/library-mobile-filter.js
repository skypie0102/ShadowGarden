/* Shadow Garden R2 — mobile-only Library Filter collapse control. */
(async()=>{
  const panel=document.querySelector('.filters');
  const toggle=document.getElementById('filterToggle');
  const head=panel?.querySelector('.filter-head');
  const clear=document.getElementById('clearFilters');
  const searchField=panel?.querySelector('.search-field');
  const searchStack=panel?.querySelector('.search-stack');
  const activeTags=document.getElementById('activeTags');
  if(!panel||!toggle||!head||!clear||!searchField||!searchStack)return;

  const mobileQuery=window.matchMedia('(max-width: 720px)');
  if(mobileQuery.matches){
    panel.classList.add('filters-collapsed');
    toggle.hidden=false;
    toggle.setAttribute('aria-expanded','false');
  }
  panel.classList.remove('filters-mobile-initial-collapsed');

  const {preferences}=await import('/assets/js/domain/index.js');
  const scope=document.body.dataset.libraryScope||'main';
  const headActions=document.createElement('span');
  headActions.className='filter-head-actions';
  clear.before(headActions);
  headActions.appendChild(clear);
  let mobileInitialized=false;

  function readCollapsed(){return preferences.mobileFiltersCollapsed(scope)}
  function writeCollapsed(collapsed){preferences.setMobileFiltersCollapsed(scope,collapsed)}

  /* Keep Search + toggle as the stable mobile anchor. Expanded controls always unfold
     below that row instead of moving the toggle between two different containers. */
  function placeStructure(){
    if(mobileQuery.matches){
      if(toggle.parentElement!==searchField)searchField.appendChild(toggle);
      if(head.previousElementSibling!==searchStack)searchStack.insertAdjacentElement('afterend',head);
    }else{
      if(head.nextElementSibling!==searchStack)panel.insertBefore(head,searchStack);
      headActions.appendChild(toggle);
    }
  }

  function placeActiveTags(collapsed){
    if(!activeTags)return;
    searchField.insertAdjacentElement('afterend',activeTags);
    activeTags.classList.toggle('mobile-collapsed-tags',mobileQuery.matches&&collapsed);
  }

  function syncToggle(collapsed){
    toggle.hidden=false;
    toggle.setAttribute('aria-expanded',collapsed?'false':'true');
    toggle.setAttribute('aria-label',collapsed?'Expand library filters':'Collapse library filters');
    toggle.title=collapsed?'Expand filters':'Collapse filters';
    toggle.textContent=collapsed?'▼':'▲';
    placeStructure();
    placeActiveTags(collapsed);
  }

  function apply(){
    placeStructure();
    if(!mobileQuery.matches){
      panel.classList.remove('filters-collapsed');
      toggle.hidden=true;
      toggle.setAttribute('aria-expanded','true');
      placeActiveTags(false);
      return;
    }
    /* Every mobile Library entry starts from the same compact baseline. This avoids a
       stale per-scope preference making Adult open while Main is collapsed. The user's
       toggle choice still persists for the lifetime of the current page and across tabs. */
    if(!mobileInitialized){
      mobileInitialized=true;
      writeCollapsed(true);
    }
    const collapsed=readCollapsed();
    panel.classList.toggle('filters-collapsed',collapsed);
    syncToggle(collapsed);
  }

  toggle.addEventListener('click',()=>{
    if(!mobileQuery.matches)return;
    const collapsed=!panel.classList.contains('filters-collapsed');
    panel.classList.toggle('filters-collapsed',collapsed);
    writeCollapsed(collapsed);
    syncToggle(collapsed);
  });

  if(typeof mobileQuery.addEventListener==='function')mobileQuery.addEventListener('change',apply);
  else mobileQuery.addListener?.(apply);
  window.addEventListener('storage',event=>{if(event.key===preferences.mobileFilterKey(scope))apply()});
  apply();
})();