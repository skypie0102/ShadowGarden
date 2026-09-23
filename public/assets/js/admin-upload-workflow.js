/* Shadow Garden — reviewed stateful New Books workflow. */
(()=>{
  const dialog=document.querySelector('#addBooksDialog'),addView=document.querySelector('#addView');
  const q=state?.batch,list=document.querySelector('#batchList'),panel=document.querySelector('#batchPanel');
  const uploadState=document.querySelector('#uploadState'),uploadButton=document.querySelector('#uploadButton');
  const fileInput=document.querySelector('#epubFile'),preflight=document.querySelector('#preflightCard');
  if(!dialog||!addView||!q||!list||!panel||!uploadState||!uploadButton||!fileInput||!preflight)return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const arr=v=>Array.isArray(v)?v:[];
  const trashSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M9 7V4h6v3"></path><path d="M7 7l1 13h8l1-13"></path><path d="M10 11v5M14 11v5"></path></svg>';
  let mode='edit',sessionIds=[],completedSeries=[],completionSnapshot={successes:[],failures:[]},finishing=false;

  if(!document.querySelector('link[href*="/assets/css/admin-components.css?v=2.11.0"]')){
    const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/css/admin-components.css?v=2.11.0';link.dataset.adminComponents='1';document.head.appendChild(link);
  }
  document.querySelector('#openSeries')?.classList.add('sg-legacy-open-series');

  const stage=document.createElement('section');
  stage.id='uploadWorkflowStage';stage.className='upload-workflow-stage hidden';stage.setAttribute('aria-live','polite');addView.before(stage);

  const actionable=()=>q.items.filter(i=>i.metaReady&&i.validation?.status!=='fail'&&i.action!=='skip'&&i.status!=='done');

  function queueSummary(){
    const ready=actionable().length,failed=q.items.filter(i=>i.validation?.status==='fail'||i.status==='failed').length,dupes=q.items.filter(i=>i.duplicate).length;
    const summary=document.querySelector('#batchSummary');
    if(summary)summary.textContent=q.items.length?`${q.items.length} selected · ${ready} upload · ${dupes} duplicate${dupes===1?'':'s'}${failed?` · ${failed} failed`:''}`:'';
    panel.classList.toggle('hidden',!q.items.length);
    if(!q.running){uploadButton.disabled=!ready;uploadButton.textContent=ready?`Upload ${ready} ${ready===1?'Book':'Books'}`:'Nothing to upload';document.querySelector('#uploadCard')?.classList.toggle('hidden',!q.items.length)}
    if(q.items.length){
      const title=document.querySelector('#filePickerTitle'),meta=document.querySelector('#filePickerMeta');
      if(title)title.textContent=`${q.items.length} EPUB${q.items.length===1?'':'s'} in batch`;
      if(meta)meta.textContent='Review duplicates and metadata, then upload the queue.';
    }
  }

  function batchReasons(a,b){
    const reasons=[];
    if(a.sha256&&b.sha256&&a.sha256===b.sha256)reasons.push('same file hash');
    if(typeof slug==='function'&&slug(a.series)===slug(b.series)&&Number(a.number)===Number(b.number))reasons.push(`same series volume ${a.number}`);
    if(typeof slug==='function'&&slug(a.series)===slug(b.series)&&String(a.title||'').trim().toLowerCase()===String(b.title||'').trim().toLowerCase())reasons.push('same title');
    return [...new Set(reasons)];
  }

  function reconcileBatchDuplicates(){
    q.items.forEach(i=>{if(i.duplicate?.batch)i.duplicate=null});
    for(let a=0;a<q.items.length;a++)for(let b=a+1;b<q.items.length;b++){
      const left=q.items[a],right=q.items[b];if(!left.metaReady||!right.metaReady)continue;
      const reasons=batchReasons(left,right);if(!reasons.length)continue;
      if(!left.duplicate)left.duplicate={batch:true,reasons};if(!right.duplicate)right.duplicate={batch:true,reasons};
    }
    q.items.forEach(i=>{if(i.duplicate?.batch&&i.action==='new')i.action='skip';else if(!i.duplicate&&i.action==='skip'&&i.validation?.status!=='fail'&&i.status!=='failed')i.action='new'});
  }

  function duplicateCopy(item){
    const d=item.duplicate;if(!d)return'';if(d.batch)return arr(d.reasons).join(' · ');
    return`${d.series?.title||'Existing series'} · ${d.volume?.title||`Volume ${d.volume?.number??'?'}`} · ${d.scope==='adult'?'18+':'Main'} · ${arr(d.reasons).join(', ')}`;
  }

  function decorateDuplicate(article,item){
    const block=article.querySelector('.batch-duplicate');if(!block)return;
    if(!item.duplicate){article.classList.remove('has-duplicate');block.hidden=true;return}
    article.classList.add('has-duplicate');block.hidden=false;
    const options=item.duplicate.batch
      ? `<option value="skip"${item.action==='skip'?' selected':''}>Skip</option><option value="separate"${item.action==='separate'?' selected':''}>Add separate</option>`
      : `<option value="skip"${item.action==='skip'?' selected':''}>Skip</option><option value="replace"${item.action==='replace'?' selected':''}>Replace existing</option><option value="separate"${item.action==='separate'?' selected':''}>Add separate</option>`;
    block.innerHTML=`<label>Duplicate action<select data-batch-action="${esc(item.id)}" ${item.status==='done'?'disabled':''}>${options}</select></label><p>${esc(duplicateCopy(item))}</p>`;
  }

  function enhanceQueue(){
    for(const article of list.querySelectorAll(':scope > .batch-item')){
      const item=q.items.find(i=>i.id===article.dataset.batchId);if(!item)continue;
      const actions=article.querySelector('.batch-actions');
      if(actions&&!actions.querySelector('[data-batch-remove]')){
        const remove=document.createElement('button');remove.className='batch-remove';remove.type='button';remove.dataset.batchRemove=item.id;remove.innerHTML=trashSvg;remove.title='Remove from upload queue';remove.setAttribute('aria-label','Remove EPUB from upload queue');actions.appendChild(remove);
      }
      const remove=actions?.querySelector('[data-batch-remove]');if(remove)remove.disabled=q.running||item.status==='uploading';
      decorateDuplicate(article,item);
    }
    queueSummary();
  }

  function emptyEditor(){
    document.querySelector('#metadataCard')?.classList.add('hidden');preflight.classList.add('hidden');document.querySelector('#uploadCard')?.classList.add('hidden');document.querySelector('#batchEditorPicker')?.classList.add('hidden');
    if(typeof setFileState==='function')setFileState('WAITING');fileInput.value='';
    const title=document.querySelector('#filePickerTitle'),meta=document.querySelector('#filePickerMeta');if(title)title.textContent='Choose EPUBs from phone';if(meta)meta.textContent='Select one or many EPUBs · 50 MB maximum per file';
  }

  function removeItem(id){
    if(q.running)return;const index=q.items.findIndex(i=>i.id===id);if(index<0)return;
    const active=q.activeId===id;q.items.splice(index,1);if(active){q.activeId=null;if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}q.objectUrl=''}}
    list.querySelector(`[data-batch-id="${CSS.escape(id)}"]`)?.remove();reconcileBatchDuplicates();enhanceQueue();
    if(!q.items.length){emptyEditor();return}
    if(active){const next=q.items.find(i=>i.metaReady);if(next)queueMicrotask(()=>list.querySelector(`[data-batch-edit="${CSS.escape(next.id)}"]`)?.click())}
  }
  list.addEventListener('click',event=>{const button=event.target.closest('[data-batch-remove]');if(!button)return;event.preventDefault();event.stopPropagation();removeItem(button.dataset.batchRemove)},true);

  const pHead=preflight.querySelector('.admin-card-head'),pToggle=document.createElement('button');
  pToggle.className='preflight-collapse-toggle';pToggle.type='button';pToggle.setAttribute('aria-controls','preflightChecks');pHead?.appendChild(pToggle);
  function collapsePreflight(collapsed=true){
    preflight.classList.toggle('sg-preflight-collapsed',collapsed);pToggle.setAttribute('aria-expanded',String(!collapsed));pToggle.title=collapsed?'Show preflight details':'Hide preflight details';pToggle.setAttribute('aria-label',pToggle.title);pToggle.innerHTML=`<span aria-hidden="true">${collapsed?'▼':'▲'}</span><b>Details</b>`;
  }
  collapsePreflight(true);pToggle.addEventListener('click',()=>collapsePreflight(!preflight.classList.contains('sg-preflight-collapsed')));
  list.addEventListener('click',e=>{if(e.target.closest('[data-batch-edit]'))queueMicrotask(()=>collapsePreflight(true))},true);
  document.querySelector('#batchEditorSelect')?.addEventListener('change',()=>queueMicrotask(()=>collapsePreflight(true)));

  const showStage=()=>{dialog.classList.add('sg-workflow-stage');stage.classList.remove('hidden')};
  function showEditor(){
    mode='edit';dialog.classList.remove('sg-workflow-stage');stage.classList.add('hidden');stage.innerHTML='';
    if(!q.items.length){emptyEditor();if(typeof setUploadState==='function')setUploadState('WAITING');if(typeof setStatus==='function')setStatus('Ready to upload','Choose one or more EPUBs to begin.','✦')}
    else if(typeof setUploadState==='function'){const ready=actionable().length;setUploadState(ready?'READY':'WAITING',ready?'ready':'')}
  }

  function renderUploading(){
    showStage();stage.innerHTML=`<div class="upload-state-card upload-state-uploading"><div class="upload-state-mark" aria-hidden="true">✦</div><p class="kicker">PLANTING BOOKS</p><h2>Uploading to the Garden</h2><p id="uploadStageDetail">Preparing the batch for private storage…</p><div class="upload-stage-progress" aria-hidden="true"><i></i></div><div class="upload-stage-meta"><span id="uploadStagePercent">0%</span><span id="uploadStageCount">0 / ${sessionIds.length}</span></div></div>`;updateUploading();
  }

  function updateUploading(){
    if(mode!=='uploading')return;const items=sessionIds.map(id=>q.items.find(i=>i.id===id)).filter(Boolean),total=Math.max(1,items.length);
    const progress=items.reduce((n,i)=>n+Math.max(0,Math.min(100,Number(i.progress)||0)),0)/total,done=items.filter(i=>i.status==='done').length,current=items.find(i=>i.status==='uploading')||items.find(i=>i.status!=='done'&&i.status!=='failed');
    const track=stage.querySelector('.upload-stage-progress');track?.style.setProperty('--upload-stage-progress',`${progress.toFixed(1)}%`);
    const pct=stage.querySelector('#uploadStagePercent'),count=stage.querySelector('#uploadStageCount'),detail=stage.querySelector('#uploadStageDetail');if(pct)pct.textContent=`${Math.round(progress)}%`;if(count)count.textContent=`${done} / ${items.length} uploaded`;if(detail)detail.textContent=current?.progressLabel?`${current.title||current.file?.name||'EPUB'} — ${current.progressLabel}`:done===items.length?'Finishing catalog updates…':'Preparing the next EPUB…';
  }

  function seriesFrom(items){
    const map=new Map();for(const item of items){const id=item.result?.seriesId;if(!id)continue;if(!map.has(id))map.set(id,{id,title:item.series||item.result?.seriesTitle||'Uploaded series',adult:Boolean(item.adult),books:0});map.get(id).books++}return[...map.values()];
  }

  function clearSuccessfulQueue(){
    q.items.splice(0);q.activeId=null;q.library=null;if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}q.objectUrl=''}list.innerHTML='';panel.classList.add('hidden');fileInput.value='';
    const summary=document.querySelector('#batchSummary');if(summary)summary.textContent='';document.querySelector('#metadataCard')?.classList.add('hidden');preflight.classList.add('hidden');document.querySelector('#uploadCard')?.classList.add('hidden');document.querySelector('#batchEditorPicker')?.classList.add('hidden');
  }

  function renderComplete(successes,failures){
    const success=failures.length===0&&successes.length===sessionIds.length;mode=success?'complete':'partial';completedSeries=seriesFrom(successes);showStage();
    stage.innerHTML=`<div class="upload-state-card ${success?'upload-state-complete':'upload-state-partial'}"><div class="upload-state-mark" aria-hidden="true">${success?'✓':'△'}</div><p class="kicker">${success?'UPLOAD COMPLETE':'BATCH FINISHED'}</p><h2>${success?'The new books have taken root.':'Some books need attention.'}</h2><p>${success?`${successes.length} book${successes.length===1?' was':'s were'} uploaded successfully and the upload queue has been cleared.`:`${successes.length} uploaded · ${failures.length} failed. Failed/reviewable entries remain in the queue so they can be corrected or retried.`}</p><div class="upload-state-actions">${completedSeries.length?'<button id="workflowOpenSeries" class="admin-primary" type="button">Open uploaded series</button>':''}<button id="workflowNextBatch" class="admin-secondary" type="button">${success?'Upload another batch':'Review upload queue'}</button></div></div>`;
    if(success)clearSuccessfulQueue();
    stage.querySelector('#workflowOpenSeries')?.addEventListener('click',()=>completedSeries.length===1?location.assign(`/series.html?id=${encodeURIComponent(completedSeries[0].id)}`):renderChooser());stage.querySelector('#workflowNextBatch')?.addEventListener('click',showEditor);
  }

  function renderChooser(){
    mode='chooser';showStage();stage.innerHTML=`<div class="upload-state-card upload-state-complete"><div class="upload-state-mark" aria-hidden="true">✦</div><p class="kicker">UPLOADED SERIES</p><h2>Choose a series to open</h2><p>This batch added books to ${completedSeries.length} series.</p><div class="upload-series-grid">${completedSeries.map(s=>`<button class="upload-series-choice" type="button" data-open-uploaded-series="${esc(s.id)}"><strong>${esc(s.title)}</strong><span>${s.adult?'18+ Library':'Main Library'} · ${s.books} uploaded book${s.books===1?'':'s'}</span></button>`).join('')}</div><div class="upload-state-actions"><button id="workflowChooserBack" class="admin-secondary" type="button">◀ Back</button><button id="workflowChooserNext" class="admin-secondary" type="button">Upload another batch</button></div></div>`;
    stage.querySelectorAll('[data-open-uploaded-series]').forEach(b=>b.addEventListener('click',()=>location.assign(`/series.html?id=${encodeURIComponent(b.dataset.openUploadedSeries)}`)));stage.querySelector('#workflowChooserBack')?.addEventListener('click',()=>renderComplete(completionSnapshot.successes,completionSnapshot.failures));stage.querySelector('#workflowChooserNext')?.addEventListener('click',showEditor);
  }

  function beginUpload(){if(mode==='uploading')return;const items=actionable();if(!items.length)return;sessionIds=items.map(i=>i.id);completedSeries=[];finishing=false;mode='uploading';renderUploading()}
  function finishUpload(){
    if(mode!=='uploading'||finishing)return;finishing=true;const items=sessionIds.map(id=>q.items.find(i=>i.id===id)).filter(Boolean),successes=items.filter(i=>i.status==='done'),failures=items.filter(i=>i.status==='failed'||i.validation?.status==='fail');completionSnapshot={successes:[...successes],failures:[...failures]};renderComplete(successes,failures);finishing=false;
  }
  function finishSettledBatch(){
    if(mode!=='uploading'||q.running)return false;
    const items=sessionIds.map(id=>q.items.find(i=>i.id===id)).filter(Boolean);
    if(!items.length||items.length!==sessionIds.length||items.some(i=>i.status!=='done'&&i.status!=='failed'&&i.validation?.status!=='fail'))return false;
    const failures=items.filter(i=>i.status==='failed'||i.validation?.status==='fail');
    if(typeof setUploadState==='function')setUploadState(failures.length?'COMPLETE WITH ERRORS':'COMPLETE',failures.length?'warning':'ready');
    finishUpload();return true;
  }
  function syncState(){
    const text=String(uploadState.textContent||'').trim().toUpperCase();
    if(text==='UPLOADING'){beginUpload();updateUploading();return}
    if(text.startsWith('COMPLETE')){finishUpload();return}
    finishSettledBatch();
  }

  /* The base uploader replaces direct queue rows on every real progress/status render. Observe
     only those direct replacements, never descendant markup that this layer decorates. */
  const queueObserver=new MutationObserver(()=>queueMicrotask(()=>{enhanceQueue();updateUploading();syncState()}));
  queueObserver.observe(list,{childList:true,subtree:false});
  new MutationObserver(()=>queueMicrotask(syncState)).observe(uploadState,{childList:true,subtree:true,characterData:true});
  dialog.addEventListener('close',()=>{if(mode!=='uploading')showEditor()});dialog.addEventListener('cancel',e=>{if(mode==='uploading')e.preventDefault()});
  enhanceQueue();
})();