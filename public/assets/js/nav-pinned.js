/* Shadow Garden R2 — shelf-scoped collapsible pinned-series sidebar and library indicators. */
(async()=>{
  const nav=document.querySelector('#siteNav')||document.querySelector('.site-nav-drawer')||document.querySelector('.site-header nav');
  if(!nav||!window.ShadowGardenData)return;

  const {preferences,format,urls}=await import('/assets/js/domain/index.js?v=2.11.0');
  const esc=format.escapeHtml;
  const arr=format.asArray;

  nav.querySelector('#pinnedNav')?.remove();

  const section=document.createElement('section');
  section.className='nav-pinned-section';
  section.innerHTML=`<button class="nav-pinned-toggle" type="button" data-nav-keep-open aria-expanded="true"><strong>Pinned series</strong><span aria-hidden="true">▲</span></button><div class="nav-pinned-list"></div>`;
  nav.appendChild(section);
  const toggle=section.querySelector('.nav-pinned-toggle');
  const list=section.querySelector('.nav-pinned-list');

  function setCollapsed(collapsed,save=true){
    section.classList.toggle('is-collapsed',collapsed);
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.querySelector('span').textContent=collapsed?'▼':'▲';
    if(save)preferences.setPinnedNavCollapsed(collapsed);
  }
  setCollapsed(preferences.pinnedNavCollapsed(),false);
  toggle.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    setCollapsed(!section.classList.contains('is-collapsed'));
  });

  const requestedSeries=new URLSearchParams(location.search).get('id')||'';
  const currentAdult=document.body.dataset.libraryScope==='nsfw'||document.body.classList.contains('adult-library')||requestedSeries.startsWith('adult-');
  const currentScope=currentAdult?'adult':'main';
  const catalogPromise=window.ShadowGardenData.loadCatalog(currentAdult,{reuse:true,shareNext:true})
    .catch(()=>({series:[]}))
    .then(catalog=>arr(catalog?.series).map(series=>({...series,__scope:currentScope})));

  function markCards(){
    const pins=preferences.pinnedIds();
    document.querySelectorAll('.series-card').forEach(card=>{
      let id='';
      try{id=new URL(card.getAttribute('href')||'',location.href).searchParams.get('id')||''}catch{}
      const cover=card.querySelector('.cover');
      if(!cover)return;
      let badge=cover.querySelector('.pinned-indicator');
      if(pins.has(id)){
        if(!badge){badge=document.createElement('span');badge.className='pinned-indicator';badge.textContent='◆ Pinned';cover.appendChild(badge)}
      }else badge?.remove();
    });
  }

  async function render(){
    const pins=preferences.pinnedIds();
    const shelf=await catalogPromise;
    const pinned=shelf.filter(series=>pins.has(series.id)).sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));
    if(!pinned.length){
      list.innerHTML=`<div class="nav-pinned-empty">No pinned ${currentAdult?'18+ ':''}series yet.</div>`;
    }else{
      list.innerHTML=pinned.map(series=>`<a class="nav-pinned-entry" href="${urls.seriesUrl(series.id)}"><span class="pin-mark" aria-hidden="true">◆</span><span class="pin-title">${esc(series.title||'Untitled series')}</span>${currentAdult?'<span class="pin-scope">18+</span>':''}</a>`).join('');
    }
    markCards();
  }

  const observer=new MutationObserver(markCards);
  const grid=document.querySelector('#catalogGrid');
  if(grid)observer.observe(grid,{childList:true,subtree:true});

  document.addEventListener('click',event=>{
    if(event.target.closest('#pinButton'))window.setTimeout(()=>void render(),0);
  });
  window.addEventListener('storage',event=>{if(event.key===preferences.PINNED_KEY||event.key===preferences.PINNED_NAV_COLLAPSED_KEY){setCollapsed(preferences.pinnedNavCollapsed(),false);void render()}});
  void render();
})();