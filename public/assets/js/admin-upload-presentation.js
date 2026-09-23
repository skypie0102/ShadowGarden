/* Shadow Garden R10 — Upload editor restoration and completion-series presentation. */
(()=>{
  const dialog=document.querySelector('#addBooksDialog');
  const batchList=document.querySelector('#batchList');
  const metadata=document.querySelector('#metadataCard');
  const preflight=document.querySelector('#preflightCard');
  const stage=document.querySelector('#uploadWorkflowStage');
  const q=state?.batch;

  /* Local EPUB inspection is authoritative. Restore the previously active editor only after every
     checking item has settled, so presentation never fights the validator's intentional hide/show. */
  let editorRestoreTimer=0;
  function scheduleEditorRestore(){
    clearTimeout(editorRestoreTimer);
    editorRestoreTimer=setTimeout(()=>{
      if(!q||!dialog?.open||q.running||dialog.classList.contains('sg-workflow-stage'))return;
      if(q.items?.some(item=>item.status==='checking'))return;
      const active=q.items?.find(item=>item.id===q.activeId&&item.metaReady);
      if(!active)return;
      metadata?.classList.remove('hidden');
      preflight?.classList.remove('hidden');
      const picker=document.querySelector('#batchEditorPicker');
      if(picker&&q.items.length>1)picker.classList.remove('hidden');
    },120);
  }
  if(batchList){
    new MutationObserver(scheduleEditorRestore).observe(batchList,{childList:true,subtree:false});
  }
  dialog?.addEventListener('close',()=>clearTimeout(editorRestoreTimer));

  /* Enrich the multi-series completion chooser with the freshly updated catalog covers. */
  let libraryPromise=null;
  async function getLibrary(){
    if(!libraryPromise){
      libraryPromise=(typeof api==='function'?api('/admin-api/library',{method:'GET'}):Promise.resolve(null))
        .catch(error=>{console.warn('Uploaded series cover lookup failed',error);return null})
        .finally(()=>{libraryPromise=null});
    }
    return libraryPromise;
  }

  async function enhanceSeriesChooser(){
    const grid=stage?.querySelector('.upload-series-grid');
    if(!grid||grid.dataset.coverCards)return;
    grid.dataset.coverCards='loading';
    const data=await getLibrary();
    const seriesMap=new Map([
      ...((Array.isArray(data?.main)?data.main:[]).map(series=>[series.id,series])),
      ...((Array.isArray(data?.adult)?data.adult:[]).map(series=>[series.id,series]))
    ]);

    for(const button of grid.querySelectorAll('[data-open-uploaded-series]')){
      const id=button.dataset.openUploadedSeries||'';
      const existingTitle=button.querySelector('strong')?.textContent||'Uploaded series';
      const existingMeta=button.querySelector('span')?.textContent||'';
      const series=seriesMap.get(id);
      const cover=series?.coverThumb||series?.cover||series?.volumes?.find(volume=>volume.coverThumb||volume.cover)?.coverThumb||series?.volumes?.find(volume=>volume.cover)?.cover||'';
      const coverBox=document.createElement('span');
      coverBox.className='upload-series-card-cover';
      if(cover){
        const img=document.createElement('img');
        img.src=cover;
        img.alt='';
        img.loading='lazy';
        img.decoding='async';
        coverBox.appendChild(img);
      }else{
        const fallback=document.createElement('span');
        fallback.className='upload-series-card-fallback';
        fallback.textContent='✦';
        coverBox.appendChild(fallback);
      }
      const copy=document.createElement('span');
      copy.className='upload-series-card-copy';
      const title=document.createElement('strong');
      title.textContent=series?.title||existingTitle;
      const meta=document.createElement('small');
      meta.textContent=existingMeta;
      copy.append(title,meta);
      button.classList.add('upload-series-card');
      button.replaceChildren(coverBox,copy);
    }
    grid.dataset.coverCards='ready';
  }

  if(stage){
    new MutationObserver(()=>queueMicrotask(()=>void enhanceSeriesChooser())).observe(stage,{childList:true,subtree:true});
    void enhanceSeriesChooser();
  }
})();
