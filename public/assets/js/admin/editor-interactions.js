/* Shadow Garden v2.4 — Garden Keeper editor interaction layer. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,$$,arr,esc}=keeper.util;
  let taxonomy=null;

  const runWhenReady=callback=>{
    if(window.ShadowGardenKeeperReady)callback();
    else keeper.events.addEventListener("app:ready",callback,{once:true});
  };

  function installFocusReturn(){
    const returnTargets=new WeakMap();
    const describeTarget=target=>{
      if(target?.matches?.("[data-manager-open]"))return{element:target,kind:"manager-open",value:target.dataset.managerOpen||""};
      if(target?.matches?.("[data-manager-add]"))return{element:target,kind:"manager-add",value:target.dataset.managerAdd||""};
      if(target?.id)return{element:target,kind:"id",value:target.id};
      return{element:target,kind:"element",value:""};
    };
    const resolveTarget=remembered=>{
      if(remembered?.element&&document.contains(remembered.element))return remembered.element;
      if(remembered?.kind==="id")return document.getElementById(remembered.value);
      const attribute=remembered?.kind==="manager-open"?"data-manager-open":remembered?.kind==="manager-add"?"data-manager-add":"";
      if(!attribute||!remembered?.value)return null;
      return[...document.querySelectorAll(`[${attribute}]`)].find(node=>node.getAttribute(attribute)===remembered.value)||null;
    };
    const remember=(dialog,target)=>{if(dialog&&target)returnTargets.set(dialog,describeTarget(target))};
    document.addEventListener("click",event=>{
      const target=event.target.closest?.("#openNewBooks,#openMaintenance,[data-manager-open],[data-manager-add]");
      if(!target)return;
      if(target.matches("#openNewBooks,[data-manager-add]"))remember($("#addBooksDialog"),target);
      else if(target.id==="openMaintenance")remember($("#maintenanceDialog"),target);
      else if(target.matches("[data-manager-open]"))remember($("#seriesEditor"),target);
    },{capture:true});
    for(const dialog of $$("dialog"))dialog.addEventListener("close",()=>{
      const remembered=returnTargets.get(dialog);returnTargets.delete(dialog);
      if(!remembered)return;
      requestAnimationFrame(()=>{
        const target=resolveTarget(remembered);
        if(target&&!target.disabled&&target.getClientRects().length)target.focus({preventScroll:true});
      });
    });
  }

  function parseGenres(value){
    const raw=String(value||"").split(",").map(item=>item.trim()).filter(Boolean);
    return taxonomy?.normalizeGenres?.(raw)||raw;
  }

  function installGenrePicker(input,label){
    if(!input||input.dataset.genrePickerReady==="1"||!taxonomy)return;
    input.dataset.genrePickerReady="1";
    input.classList.add("keeper-genre-source");
    input.readOnly=true;
    input.placeholder="Choose canonical genres below";
    const field=input.closest(".admin-field");
    const picker=document.createElement("div");picker.className="keeper-genre-picker wide";picker.dataset.genrePicker=input.id;picker.setAttribute("role","group");picker.setAttribute("aria-label",`${label} canonical genres`);
    picker.innerHTML=`<div class="keeper-genre-picker-head"><span>Canonical Novel Updates genres</span><small data-genre-count>0 selected</small></div><div class="keeper-genre-chip-grid">${taxonomy.CANONICAL_GENRES.map(genre=>`<button type="button" data-genre-value="${esc(genre)}" aria-pressed="false">${esc(genre)}</button>`).join("")}</div>`;
    field?.after(picker);

    const render=()=>{
      const selected=new Set(parseGenres(input.value));
      picker.querySelectorAll("[data-genre-value]").forEach(button=>{const active=selected.has(button.dataset.genreValue);button.classList.toggle("active",active);button.setAttribute("aria-pressed",active?"true":"false")});
      const count=picker.querySelector("[data-genre-count]");if(count)count.textContent=`${selected.size} selected`;
    };
    const commit=selected=>{
      input.value=taxonomy.CANONICAL_GENRES.filter(genre=>selected.has(genre)).join(", ");
      input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));render();
    };
    picker.addEventListener("click",event=>{
      const button=event.target.closest("[data-genre-value]");if(!button)return;
      const selected=new Set(parseGenres(input.value)),genre=button.dataset.genreValue;
      selected.has(genre)?selected.delete(genre):selected.add(genre);commit(selected);
    });
    input.addEventListener("input",render);input.addEventListener("change",render);
    picker.addEventListener("focusin",render);render();
    input.__sgRenderGenrePicker=render;
  }

  function installGenrePickers(){
    installGenrePicker($("#manageGenres"),"Series");
    installGenrePicker($("#genresInput"),"Upload");
    const metadata=$("#metadataCard"),editor=$("#seriesEditor");
    if(metadata)new MutationObserver(()=>queueMicrotask(()=>$("#genresInput")?.__sgRenderGenrePicker?.())).observe(metadata,{attributes:true,attributeFilter:["class"]});
    if(editor)new MutationObserver(()=>{if(editor.open)setTimeout(()=>$("#manageGenres")?.__sgRenderGenrePicker?.(),0)}).observe(editor,{attributes:true,attributeFilter:["open"]});
    document.addEventListener("click",event=>{if(event.target.closest?.("[data-batch-edit],#batchEditorSelect"))setTimeout(()=>$("#genresInput")?.__sgRenderGenrePicker?.(),0)});
  }

  function installSeriesDirtyState(){
    const dialog=$("#seriesEditor"),form=$("#seriesEditorForm"),save=$("#saveSeries"),trash=$("#deleteSeries");if(!dialog||!form||!save)return;
    const actions=save.closest(".dialog-actions");
    let stateNode=$("#seriesSaveState");
    if(!stateNode){stateNode=document.createElement("span");stateNode.id="seriesSaveState";stateNode.className="series-editor-save-state";stateNode.setAttribute("role","status");stateNode.setAttribute("aria-live","polite");actions?.insertBefore(stateNode,save)}
    let baseline="",dirty=false,saveRequested=false,arming=false;

    const trackedFields=()=>[...form.querySelectorAll("input,textarea,select")].filter(field=>!field.closest("#manageVolumes")&&field.id!=="manageBanner");
    const signature=()=>JSON.stringify(trackedFields().map((field,index)=>[field.id||field.name||`${field.tagName}:${index}`,field.type==="checkbox"?Boolean(field.checked):String(field.value??"")]));
    const render=(label=null)=>{
      dialog.classList.toggle("series-editor-dirty",dirty);
      save.dataset.dirty=dirty?"1":"0";
      if(!saveRequested)save.disabled=!dirty;
      if(stateNode)stateNode.textContent=label||(dirty?"Unsaved changes":"No changes");
    };
    const captureBaseline=()=>{baseline=signature();dirty=false;saveRequested=false;arming=false;render()};
    const evaluate=()=>{if(!dialog.open||arming||!baseline)return;dirty=signature()!==baseline;render()};
    const arm=()=>{arming=true;baseline="";dirty=false;saveRequested=false;render("Loading series…");setTimeout(captureBaseline,80)};
    const discard=()=>{dirty=false;baseline="";render();return true};
    const confirmDiscard=()=>!dirty||confirm("Discard unsaved series changes?");

    form.addEventListener("input",event=>{if(event.target.id!=="manageBanner")queueMicrotask(evaluate)});
    form.addEventListener("change",event=>{if(event.target.id!=="manageBanner")queueMicrotask(evaluate)});
    new MutationObserver(mutations=>{
      if(!dialog.open||arming)return;
      if(mutations.some(mutation=>mutation.target.closest?.("#manageTranslations")||[...mutation.addedNodes].some(node=>node.nodeType===1&&node.closest?.("#manageTranslations"))))queueMicrotask(evaluate);
    }).observe(form,{childList:true,subtree:true});
    new MutationObserver(()=>{if(dialog.open)arm()}).observe(dialog,{attributes:true,attributeFilter:["open"]});

    save.addEventListener("click",()=>{if(!dirty)return;saveRequested=true;if(stateNode)stateNode.textContent="Saving…"},{capture:true});
    const closeButton=form.querySelector('.dialog-close[value="cancel"]');
    closeButton?.addEventListener("click",event=>{
      if(!dirty)return;if(!confirmDiscard()){event.preventDefault();event.stopImmediatePropagation();return}
      event.preventDefault();event.stopImmediatePropagation();discard();dialog.close("cancel");
    },{capture:true});
    dialog.addEventListener("cancel",event=>{
      if(!dirty)return;if(!confirmDiscard()){event.preventDefault();return}event.preventDefault();discard();dialog.close("cancel");
    },{capture:true});
    dialog.addEventListener("click",event=>{
      if(event.target!==dialog||!dirty)return;
      event.preventDefault();event.stopImmediatePropagation();if(confirmDiscard()){discard();dialog.close("cancel")}
    },{capture:true});
    dialog.addEventListener("close",()=>{
      const saved=saveRequested;dirty=false;baseline="";saveRequested=false;render();
      if(saved)setTimeout(()=>{const toasts=$$(".admin-toast");const latest=toasts[toasts.length-1];if(latest&&/^Saved\b/.test(latest.textContent||""))latest.textContent=`✓ ${latest.textContent}`},0);
    });
    window.addEventListener("beforeunload",event=>{if(!dirty)return;event.preventDefault();event.returnValue=""});
    trash?.setAttribute("title","Recoverable from Maintenance → Trash until permanently purged");
    render();
  }

  function installUploadReview(){
    const card=$("#uploadCard"),button=$("#uploadButton"),list=$("#batchList"),q=keeper.state.batch;if(!card||!button||!q)return;
    let review=$("#uploadReviewSummary");
    if(!review){review=document.createElement("section");review.id="uploadReviewSummary";review.className="upload-review-summary hidden";review.setAttribute("aria-live","polite");button.before(review)}
    const actionable=item=>item.metaReady&&item.validation?.status!=="fail"&&item.action!=="skip"&&item.status!=="done";
    function render(){
      const items=arr(q.items),ready=items.filter(actionable);if(!items.length){review.classList.add("hidden");review.replaceChildren();return}
      const main=ready.filter(item=>!item.adult).length,adult=ready.filter(item=>item.adult).length,duplicates=items.filter(item=>item.duplicate).length,skipped=items.filter(item=>item.action==="skip").length,failed=items.filter(item=>item.validation?.status==="fail"||item.status==="failed").length;
      const series=[...new Set(ready.map(item=>String(item.series||"").trim()).filter(Boolean))];
      const seriesPreview=series.slice(0,3).map(value=>`<span>${esc(value)}</span>`).join("");
      review.innerHTML=`<div class="upload-review-head"><div><span>REVIEW</span><strong>Upload summary</strong></div><b>${ready.length} ready</b></div><div class="upload-review-metrics"><span>${main} Main</span><span>${adult} 18+</span><span>${series.length} ${series.length===1?"series":"series"}</span>${duplicates?`<span>${duplicates} duplicate${duplicates===1?"":"s"}</span>`:""}${skipped?`<span>${skipped} skipped</span>`:""}${failed?`<span class="warn">${failed} need attention</span>`:""}</div>${seriesPreview?`<div class="upload-review-series">${seriesPreview}${series.length>3?`<small>+${series.length-3} more</small>`:""}</div>`:""}<p>${ready.length?"Review the destination and metadata above before planting this batch.":"Nothing is ready to upload yet. Resolve failed or skipped entries first."}</p>`;
      review.classList.remove("hidden");
    }
    list&&new MutationObserver(()=>queueMicrotask(render)).observe(list,{childList:true,subtree:false});
    $("#uploadState")&&new MutationObserver(()=>queueMicrotask(render)).observe($("#uploadState"),{childList:true,subtree:true,characterData:true});
    document.addEventListener("input",event=>{if(event.target.closest?.("#addBooksDialog"))queueMicrotask(render)});
    document.addEventListener("change",event=>{if(event.target.closest?.("#addBooksDialog"))queueMicrotask(render)});
    keeper.events.addEventListener("upload:completed",render);render();
  }

  runWhenReady(async()=>{
    try{taxonomy=await import("/assets/js/domain/catalog-taxonomy.js?v=2.11.0")}catch(error){console.warn("Keeper genre chips unavailable",error)}
    installFocusReturn();installSeriesDirtyState();if(taxonomy)installGenrePickers();installUploadReview();
  });
})();
