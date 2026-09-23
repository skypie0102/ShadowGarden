/* Shadow Garden R5 — Upload workflow replacement guard and queue guidance. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const q=keeper.state.batch,list=document.querySelector("#batchList"),upload=document.querySelector("#uploadButton");
  if(!q||!list||!upload)return;

  function sameSeries(item,duplicate){
    if(!duplicate||duplicate.batch)return false;
    const target=duplicate.series?.title||String(duplicate.series?.id||"").replace(/^adult-/,"");
    return keeper.util.slug(item.series)===keeper.util.slug(target);
  }
  function forceSafeReplacement(item,{notify=false}={}){
    if(!item||item.action!=="replace")return true;
    const duplicate=item.duplicate;
    if(!sameSeries(item,duplicate)){
      item.action="skip";const select=list.querySelector(`[data-batch-action="${CSS.escape(item.id)}"]`);if(select)select.value="skip";
      if(notify)alert("Replace is only allowed when the existing volume belongs to the same series. This item was changed to Skip.");return false;
    }
    item.adult=duplicate.scope==="adult";if(item.id===q.activeId){const adult=document.querySelector("#adultInput");if(adult)adult.checked=item.adult}return true;
  }
  function syncGuidance(){
    if(q.running||!q.items.length)return;const current=document.querySelector("#uploadState")?.textContent||"";
    if(q.items.every(item=>item.status==="done"||item.status==="failed")&&/^COMPLETE/.test(current))return;
    const checking=q.items.filter(item=>item.status==="checking").length;
    const actionable=q.items.filter(item=>item.metaReady&&item.validation?.status!=="fail"&&item.action!=="skip"&&item.status!=="done");
    const failed=q.items.filter(item=>item.validation?.status==="fail"||item.status==="failed").length;
    const skippedDuplicates=q.items.filter(item=>item.duplicate&&item.action==="skip"&&item.status!=="done").length;
    const manualSkips=q.items.filter(item=>!item.duplicate&&item.action==="skip"&&item.status!=="done").length;
    if(checking){upload.title="Waiting for local EPUB inspection to finish";if(!actionable.length){setUploadState("CHECKING");setStatus("Inspecting EPUB",`${checking} file${checking===1?" is":"s are"} still being checked locally. Upload will unlock when inspection finishes.`,"✦")}return}
    if(actionable.length){upload.removeAttribute("title");if(!/^COMPLETE/.test(current)){setUploadState("READY","ready");setStatus("Ready to upload",`${actionable.length} book${actionable.length===1?" is":"s are"} ready to send to private B2.`,"✓")}return}
    if(failed){upload.title="Upload blocked by EPUB preflight";setUploadState("BLOCKED","error");setStatus("Upload blocked",`${failed} file${failed===1?" failed":"s failed"} EPUB preflight. Open validation details to see the blocking issue.`,"!");return}
    if(skippedDuplicates){upload.title="Choose Replace existing or Add separate for the duplicate";setUploadState("ACTION NEEDED","warning");setStatus("Duplicate action required",`${skippedDuplicates} duplicate${skippedDuplicates===1?" is":"s are"} currently set to Skip. Choose Replace existing or Add separate to upload.`,"△");return}
    if(manualSkips){upload.title="All selected books are set to Skip";setUploadState("NOTHING SELECTED");setStatus("Nothing selected to upload","Change at least one queue action from Skip to Upload.","◇")}
  }

  list.addEventListener("change",event=>{
    const select=event.target.closest("[data-batch-action]");if(!select||select.value!=="replace")return;
    const item=q.items.find(entry=>entry.id===select.dataset.batchAction);if(!item)return;item.action="replace";
    if(!forceSafeReplacement(item,{notify:true})){event.preventDefault();event.stopImmediatePropagation()}
  },true);
  document.querySelector("#metadataCard")?.addEventListener("input",()=>{clearTimeout(q.__replacementGuardTimer);q.__replacementGuardTimer=setTimeout(()=>{forceSafeReplacement(q.items.find(entry=>entry.id===q.activeId));syncGuidance()},180)});
  document.querySelector("#adultInput")?.addEventListener("change",()=>setTimeout(()=>{forceSafeReplacement(q.items.find(entry=>entry.id===q.activeId));syncGuidance()},180));
  upload.addEventListener("click",()=>{for(const item of q.items)forceSafeReplacement(item);syncGuidance()},true);
  new MutationObserver(()=>queueMicrotask(syncGuidance)).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:["data-action","data-status"]});
  list.addEventListener("change",()=>queueMicrotask(syncGuidance));syncGuidance();
})();