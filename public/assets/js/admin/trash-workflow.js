/* Shadow Garden — Trash restore and resumable media cleanup. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,client=keeper.client;
  keeper.registerWorkflow("trash",()=>{
    const list=$("#trashList");if(!list)return{};
    const cleanup=document.createElement("div");cleanup.id="trashCleanupJobs";list.after(cleanup);
    let snapshot=null,loading=false,busy=false;
    const safe=value=>esc(String(value??""));
    const fmtDate=value=>{try{return new Date(value).toLocaleString()}catch{return String(value||"")}};
    async function action(name,payload={},revision=snapshot?.revision){return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json",...(Number.isInteger(revision)?{"if-match":String(revision)}:{})},body:JSON.stringify({action:name,...payload})})}
    function render(data=snapshot){
      snapshot=data;const trash=arr(data?.trash),unreadable=data?.catalog?.readable===false;
      for(const id of ["#trashCount","#maintenanceTrashCount"])if($(id))$(id).textContent=unreadable?"—":String(trash.length);
      const purgeAll=$("#purgeAllTrash");if(purgeAll){purgeAll.disabled=busy||unreadable||!trash.length;purgeAll.textContent="Purge all Trash";purgeAll.title="Remove Trash entries; retained backups and shared media stay protected."}
      if(unreadable)list.innerHTML='<div class="maintenance-empty maintenance-bad">Trash cannot be read until a valid catalog snapshot is restored.</div>';
      else if(!trash.length)list.innerHTML='<div class="maintenance-empty maintenance-good">Trash is empty.</div>';
      else list.innerHTML=trash.map(item=>`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.title||"Deleted item")}</strong><span>${safe(item.subtitle||"")}</span><span class="trash-meta"><i>${item.type==="series"?"Series":"Volume"}</i><i>${item.scope==="adult"?"18+":"Main"}</i><i>${safe(fmtDate(item.removedAt))}</i></span></div><div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-trash="${safe(item.id)}" ${busy?"disabled":""}>Restore</button><button class="danger-button" type="button" data-purge-trash="${safe(item.id)}" ${busy?"disabled":""}>Purge</button></div></div>`).join("");
      const jobs=arr(data?.purgeJobs);
      cleanup.innerHTML=jobs.length?'<p class="maintenance-copy">Media cleanup keeps files used by the catalog, retained snapshots or active uploads. Bundled covers stay available. Continue or retry unfinished jobs here after a reload.</p>'+jobs.map(job=>`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${job.complete?"Cleanup complete":"Cleanup pending"} · ${safe(fmtDate(job.createdAt))}</strong><span>${safe(job.removedCount)} Trash entries removed · ${safe(job.deleted)} objects deleted · ${safe(job.staticAssets)} bundled assets kept · ${safe(job.retained)} protected · ${safe(job.pending)} pending · ${safe(job.failed)} failed</span>${job.error?`<span class="maintenance-bad">${safe(job.error)}</span>`:""}</div><div class="maintenance-item-actions">${job.complete?'<span class="state-pill ready">DONE</span>':`<button class="admin-secondary" type="button" data-continue-purge="${safe(job.id)}" ${busy||unreadable?"disabled":""}>${job.failed?"Retry cleanup":"Continue cleanup"}</button>`}</div></div>`).join(""):"";
    }
    async function load(){if(loading)return;loading=true;try{render(await client.request("/admin-api/maintenance",{method:"GET"}))}catch(error){list.innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`}finally{loading=false}}
    function announceChange(data){keeper.events.dispatchEvent(new CustomEvent("trash:changed",{detail:{data}}));keeper.state.management=null;keeper.events.dispatchEvent(new Event("library:invalidate"))}
    async function run(name,payload,message){
      if(busy||snapshot?.catalog?.readable===false)return;const revision=snapshot?.revision;busy=true;render();
      try{const result=await action(name,payload,revision);render(result);announceChange(result);const job=result.purge;keeper.ui.toast(job&&!job.complete?"Trash removed. Media cleanup is pending; review the cleanup jobs.":message)}
      catch(error){alert(error.message);await load()}
      finally{busy=false;render()}
    }
    async function restore(id){
      const item=arr(snapshot?.trash).find(entry=>entry.id===id);if(!item||busy)return;
      if(confirm(`Restore “${item.title}” to the ${item.scope==="adult"?"18+":"Main"} library?`))await run("restore-trash",{id},`Restored “${item.title}”.`);
    }
    async function purge(ids){
      const count=ids.length||arr(snapshot?.trash).length;if(!count||busy)return;
      if(confirm(`Permanently remove ${count} Trash ${count===1?"entry":"entries"}?\n\nUnused EPUB and cover objects will be deleted from B2. Files referenced by the catalog or retained snapshots stay protected. No new backup is created by this purge. Deleted media cannot be recovered.`))await run("purge-trash",{ids},"Trash purged. Media cleanup complete.");
    }
    list.addEventListener("click",event=>{const restoreButton=event.target.closest("[data-restore-trash]"),purgeButton=event.target.closest("[data-purge-trash]");if(restoreButton)void restore(restoreButton.dataset.restoreTrash);if(purgeButton)void purge([purgeButton.dataset.purgeTrash])});
    cleanup.addEventListener("click",event=>{const button=event.target.closest("[data-continue-purge]");if(button)void run("continue-purge",{jobId:button.dataset.continuePurge},"Media cleanup complete.")});
    $("#purgeAllTrash")?.addEventListener("click",()=>void purge([]));
    keeper.events.addEventListener("maintenance:data",event=>render(event.detail?.data));keeper.events.addEventListener("trash:changed",event=>{if(event.detail?.data)render(event.detail.data);else void load()});
    keeper.events.addEventListener("session:locked",()=>{snapshot=null;busy=false;list.innerHTML="";cleanup.innerHTML=""});
    return{load};
  });
})();
