/* Shadow Garden R5 — Garden Keeper application shell. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$}=keeper.util,{state}=keeper;

  keeper.registerWorkflow("shell",()=>{
    const manageView=$("#manageView"),addDialog=$("#addBooksDialog"),maintenanceDialog=$("#maintenanceDialog");
    if(!manageView||!addDialog||!maintenanceDialog)return{};

    const dialogOpeners=new WeakMap();
    const focusableSelector='a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusablesIn=dialog=>[...dialog.querySelectorAll(focusableSelector)].filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=="hidden");
    function rememberDialogOpener(dialog,fallback){
      const active=document.activeElement;
      if(active instanceof HTMLElement&&active!==document.body&&!dialog.contains(active))dialogOpeners.set(dialog,active);
      else if(fallback instanceof HTMLElement)dialogOpeners.set(dialog,fallback);
    }
    function containDialogFocus(dialog,event){
      if(event.key!=="Tab"||!dialog.open)return;
      const focusables=focusablesIn(dialog);
      if(!focusables.length){event.preventDefault();dialog.focus({preventScroll:true});return}
      const first=focusables[0],last=focusables[focusables.length-1],active=document.activeElement;
      if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus({preventScroll:true});return}
      if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus({preventScroll:true})}
    }
    function showKeeperDialog(dialog,fallback){
      if(dialog.open)return;
      rememberDialogOpener(dialog,fallback);dialog.showModal();
    }
    function restoreDialogFocus(dialog){
      const opener=dialogOpeners.get(dialog);dialogOpeners.delete(dialog);if(!opener)return;
      requestAnimationFrame(()=>{if(opener.isConnected&&!opener.disabled&&opener.getClientRects().length)opener.focus({preventScroll:true})});
    }
    for(const dialog of [addDialog,maintenanceDialog]){
      dialog.addEventListener("keydown",event=>containDialogFocus(dialog,event));
      dialog.addEventListener("close",()=>restoreDialogFocus(dialog));
    }

    function resetUploadContext(){
      const q=state.batch;if(!q||q.running)return false;
      if(q.objectUrl){try{URL.revokeObjectURL(q.objectUrl)}catch{}}
      q.items.splice(0,q.items.length);q.activeId=null;q.library=null;q.objectUrl="";
      $("#batchPanel")?.classList.add("hidden");if($("#batchList"))$("#batchList").innerHTML="";
      $("#metadataCard")?.classList.add("hidden");$("#preflightCard")?.classList.add("hidden");$("#uploadCard")?.classList.add("hidden");$("#openSeries")?.classList.add("hidden");
      if($("#epubFile"))$("#epubFile").value="";if($("#filePickerTitle"))$("#filePickerTitle").textContent="Choose EPUBs from phone";if($("#filePickerMeta"))$("#filePickerMeta").textContent="Select one or many EPUBs · 50 MB maximum per file";
      setFileState("WAITING");setUploadState("WAITING");setStatus("Ready to upload","Choose one or more EPUBs to begin.","✦");return true;
    }

    function targetKey(target){return target?.id||""}
    function applyTargetToEditor(){
      const target=state.addBookTarget,seriesInput=$("#seriesInput"),adultInput=$("#adultInput");
      addDialog.classList.toggle("keeper-targeted",Boolean(target));$("#addSeriesTarget")?.classList.toggle("hidden",!target);
      if(target){
        if($("#addBooksHeading"))$("#addBooksHeading").textContent=`Add books to ${target.title}`;
        if($("#addSeriesTargetTitle"))$("#addSeriesTargetTitle").textContent=target.title;
        if($("#addSeriesTargetMeta"))$("#addSeriesTargetMeta").textContent=`${target.scope==="adult"?"18+ / Adult Library":"Main Library"} · New books inherit this series library automatically.`;
        if(seriesInput){seriesInput.value=target.title;seriesInput.readOnly=true}if(adultInput){adultInput.checked=target.scope==="adult";adultInput.disabled=true}
        const q=state.batch,item=q?.items?.find(entry=>entry.id===q.activeId&&entry.metaReady);if(item){item.series=target.title;item.adult=target.scope==="adult";item.targetSeriesId=target.id;if(!String(item.author||"").trim()&&target.author)item.author=target.author}
        if($("#previewSeries")&&item)$("#previewSeries").textContent=`${target.title} · Volume ${item.number||"?"}`;
      }else{
        if($("#addBooksHeading"))$("#addBooksHeading").textContent="Plant new seeds";if(seriesInput)seriesInput.readOnly=false;if(adultInput)adultInput.disabled=false;
      }
    }

    function setUploadTarget(target){
      const q=state.batch,previous=targetKey(state.addBookTarget),next=targetKey(target);
      if(q?.running){keeper.ui.toast("Finish the current upload before changing the New Books window.","info");return false}
      if(q?.items?.length&&previous!==next){if(!confirm("Start a new upload session? The current New Books queue will be cleared."))return false;resetUploadContext()}
      state.addBookTarget=target||null;applyTargetToEditor();return true;
    }

    function openNewBooks(target=null){
      if(!keeper.client.isAuthorized())return;if(!setUploadTarget(target))return;
      $("#addView")?.classList.remove("hidden");showKeeperDialog(addDialog,$("#openNewBooks"));requestAnimationFrame(()=>$("#epubFile")?.focus({preventScroll:true}));
    }
    function openNewBooksForSeries(id){
      const library=keeper.workflows.get("library")?.instance,found=library?.findSeries?.(id);if(!found)return;
      openNewBooks({id:found.series.id,title:found.series.title||"Untitled",author:found.series.author||"",scope:found.scope});
    }
    function openMaintenance(){
      if(!keeper.client.isAuthorized())return;$("#maintenanceView")?.classList.remove("hidden");showKeeperDialog(maintenanceDialog,$("#openMaintenance"));keeper.events.dispatchEvent(new Event("maintenance:opened"));
    }
    function closeNewBooks(){if(state.batch?.running){keeper.ui.toast("The upload is still running. Keep the New Books window open until it finishes.","info");return}addDialog.close()}
    function closeMaintenance(){maintenanceDialog.close()}

    $("#openNewBooks")?.addEventListener("click",()=>openNewBooks(null));$("#openMaintenance")?.addEventListener("click",openMaintenance);$("#closeAddBooks")?.addEventListener("click",closeNewBooks);$("#closeMaintenance")?.addEventListener("click",closeMaintenance);
    addDialog.addEventListener("cancel",event=>{if(state.batch?.running){event.preventDefault();keeper.ui.toast("The upload is still running.","info")}});
    keeper.events.addEventListener("upload:open-for-series",event=>openNewBooksForSeries(event.detail?.id));
    keeper.events.addEventListener("session:locked",()=>{if(addDialog.open)addDialog.close();if(maintenanceDialog.open)maintenanceDialog.close()});

    /* Targeted uploads are a shell-to-Upload integration contract. The Upload engine owns queue
       rendering; the shell only reapplies immutable series context after an editor switch/render. */
    const batchList=$("#batchList");if(batchList)new MutationObserver(()=>queueMicrotask(applyTargetToEditor)).observe(batchList,{childList:true,subtree:false});
    batchList?.addEventListener("click",event=>{if(event.target.closest("[data-batch-edit]"))queueMicrotask(applyTargetToEditor)});
    $("#batchEditorSelect")?.addEventListener("change",()=>queueMicrotask(applyTargetToEditor));
    addDialog.addEventListener("close",()=>{if(!state.batch?.running){state.addBookTarget=null;applyTargetToEditor()}});

    keeper.events.addEventListener("session:unlocked",()=>{manageView.classList.remove("hidden");window.scrollTo({top:0,behavior:"smooth"})});
    return{openNewBooks,openNewBooksForSeries,openMaintenance,closeNewBooks,closeMaintenance,applyTargetToEditor};
  });
})();
