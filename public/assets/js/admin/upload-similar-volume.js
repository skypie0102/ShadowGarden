/* Shadow Garden v2.9 — non-blocking similar-volume upload warnings. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {arr,slug}=keeper.util,{state}=keeper;
  const list=document.querySelector('#batchList');
  if(!list)return;

  const MAX_NUMBER_DELTA=1;
  const MAX_SIZE_DELTA=.02;
  let decorating=false;

  function normalized(value){
    return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\.(?:epub|zip)$/i,'').replace(/\b(?:volume|vol|book|part)\s*[#.:_-]?\s*\d+(?:\.\d+)?\b/gi,' ').replace(/\b\d+(?:\.\d+)?\b/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
  }
  function stemMatch(left,right){
    const a=normalized(left),b=normalized(right);
    return Boolean(a&&b&&a.length>=4&&a===b);
  }
  function relativeSizeDelta(left,right){
    const a=Number(left),b=Number(right);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a<=0||b<=0)return Infinity;
    return Math.abs(a-b)/Math.max(a,b);
  }
  function sameSeries(series,item){
    const target=slug(item.series);
    return slug(series?.title||String(series?.id||'').replace(/^adult-/,''))===target||series?.id===`${item.adult?'adult-':''}${target}`;
  }
  function candidate(item,series,scope,volume,batchItem=null){
    if(scope!==(item.adult?'adult':'main'))return null;
    const incoming=Number(item.number),existing=Number(volume?.number);
    if(!Number.isFinite(incoming)||!Number.isFinite(existing))return null;
    const numberDelta=Math.abs(incoming-existing);
    if(numberDelta<=0||numberDelta>MAX_NUMBER_DELTA)return null;
    const sizeDelta=relativeSizeDelta(item.file?.size,volume?.size??batchItem?.file?.size);
    if(sizeDelta>MAX_SIZE_DELTA)return null;
    const titleMatch=stemMatch(item.title,volume?.title??batchItem?.title);
    const filenameMatch=stemMatch(item.file?.name,volume?.originalFilename??batchItem?.file?.name);
    if(!titleMatch&&!filenameMatch)return null;
    return{
      batch:Boolean(batchItem),
      series,
      volume,
      item:batchItem,
      numberDelta,
      sizeDelta,
      reasons:[
        `adjacent volume ${existing}`,
        `file size within ${(sizeDelta*100).toFixed(sizeDelta<.001?2:1)}%`,
        titleMatch?'matching title pattern':'matching filename pattern'
      ]
    };
  }
  function remoteSimilar(item){
    const management=state.management;if(!management)return null;
    let best=null;
    for(const [scope,shelf] of [['main',arr(management.main)],['adult',arr(management.adult)]]){
      for(const series of shelf){
        if(!sameSeries(series,item))continue;
        for(const volume of arr(series.volumes)){
          const match=candidate(item,series,scope,volume);
          if(match&&(!best||match.sizeDelta<best.sizeDelta))best=match;
        }
      }
    }
    return best;
  }
  function batchSimilar(item){
    for(const other of arr(state.batch?.items)){
      if(other===item||!other?.metaReady||other?.duplicate)continue;
      if(slug(other.series)!==slug(item.series)||Boolean(other.adult)!==Boolean(item.adult))continue;
      const match=candidate(item,{title:other.series},item.adult?'adult':'main',{number:other.number,title:other.title,size:other.file?.size,originalFilename:other.file?.name},other);
      if(match)return match;
    }
    return null;
  }
  function similarFor(item){
    if(!item?.metaReady||item.duplicate)return null;
    return remoteSimilar(item)||batchSimilar(item);
  }
  function warningText(match){
    const label=match.batch?(match.item?.title||match.item?.file?.name||`Volume ${match.volume?.number}`):`${match.series?.title||'Existing series'} · ${match.volume?.title||`Volume ${match.volume?.number}`}`;
    return `Possible similar volume: ${label} · ${match.reasons.join(' · ')}. Review the volume number and title before upload. Upload remains allowed.`;
  }
  function syncCard(item,match){
    const card=list.querySelector(`[data-batch-id="${CSS.escape(String(item.id))}"]`);if(!card)return;
    const badge=card.querySelector('[data-similar-volume-badge]'),note=card.querySelector('[data-similar-volume-warning]');
    if(!match){badge?.remove();note?.remove();return}
    if(!badge){
      const next=document.createElement('span');next.className='batch-badge warning';next.dataset.similarVolumeBadge='1';next.textContent='SIMILAR';card.querySelector('.batch-badges')?.appendChild(next);
    }
    const text=warningText(match);
    if(note){if(note.textContent!==text)note.textContent=text}
    else{
      const next=document.createElement('p');next.dataset.similarVolumeWarning='1';next.textContent=text;card.querySelector('.batch-duplicate')?.appendChild(next);
    }
  }
  function decorate(){
    if(decorating)return;decorating=true;
    try{
      const items=arr(state.batch?.items),warnings=[];
      for(const item of items){
        const match=similarFor(item);item.similarVolume=match;syncCard(item,match);if(match)warnings.push(item);
      }
      const liveIds=new Set(items.map(item=>String(item.id)));
      for(const card of list.querySelectorAll('[data-batch-id]')){
        if(liveIds.has(String(card.dataset.batchId)))continue;
        card.querySelector('[data-similar-volume-badge]')?.remove();card.querySelector('[data-similar-volume-warning]')?.remove();
      }
      const summary=document.querySelector('#batchSummary');
      if(summary){
        const base=summary.textContent.replace(/ · \d+ similar warning(?:s)?$/,'');
        const next=warnings.length?`${base} · ${warnings.length} similar warning${warnings.length===1?'':'s'}`:base;
        if(summary.textContent!==next)summary.textContent=next;
      }
    }finally{decorating=false}
  }

  new MutationObserver(()=>queueMicrotask(decorate)).observe(list,{childList:true,subtree:true});
  keeper.events.addEventListener('library:changed',()=>queueMicrotask(decorate));
  document.addEventListener('input',event=>{if(event.target?.closest?.('#metadataCard'))queueMicrotask(decorate)});
  document.addEventListener('change',event=>{if(event.target?.closest?.('#metadataCard'))queueMicrotask(decorate)});
  queueMicrotask(decorate);
})();
