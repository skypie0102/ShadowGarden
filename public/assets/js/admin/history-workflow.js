/* Shadow Garden R5 — Catalog History workflow owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,client=keeper.client;
  keeper.registerWorkflow("history",()=>{
    const list=$("#backupList");if(!list)return{};
    let backups=[],loading=false,creating=false;
    const restoring=new Set(),removing=new Set();
    const fmtDate=value=>{if(!value)return"Unknown time";try{return new Date(value).toLocaleString()}catch{return String(value)}};
    const safe=value=>esc(String(value??""));
    const actionButton=(attribute,id)=>[...list.querySelectorAll(`[${attribute}]`)].find(button=>button.getAttribute(attribute)===id)||null;
    async function maintenance(action,payload={}){return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...payload})})}
    function render(data){
      backups=arr(data?.backups);if($("#backupCount"))$("#backupCount").textContent=String(backups.length);
      if(!backups.length){list.innerHTML='<div class="maintenance-empty">No catalog backups yet.</div>';return}
      list.innerHTML=backups.map(item=>{
        const isRestoring=restoring.has(item.id),isRemoving=removing.has(item.id),busy=isRestoring||isRemoving;
        return `<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.reason||"Catalog backup")}</strong><span>${safe(fmtDate(item.createdAt))}</span><span class="backup-meta"><i>${safe(item.counts?.mainSeries??0)} main</i><i>${safe(item.counts?.adultSeries??0)} 18+</i><i>${safe(item.counts?.volumes??0)} volumes</i></span></div><div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-backup="${safe(item.id)}" ${busy?"disabled":""}>${isRestoring?"Restoring…":"Restore"}</button><button class="danger-button backup-delete-icon" type="button" data-delete-backup="${safe(item.id)}" aria-label="Delete catalog backup" title="Delete backup" ${busy?"disabled":""}></button></div></div>`;
      }).join("");
    }
    async function load(){if(loading)return;loading=true;try{render(await client.request("/admin-api/maintenance",{method:"GET"}))}catch(error){list.innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`}finally{loading=false}}
    async function create(){
      if(creating)return;const button=$("#createCatalogBackup");if(!button)return;const old=button.textContent;creating=true;button.disabled=true;button.textContent="Creating backup…";
      try{const result=await maintenance("create-backup",{reason:"manual-backup"});render(result);keeper.events.dispatchEvent(new Event("history:changed"))}catch(error){alert(error.message)}finally{creating=false;button.disabled=false;button.textContent=old}
    }
    async function restore(id){
      if(!id||restoring.has(id)||removing.has(id))return;const backup=backups.find(item=>item.id===id);if(!backup)return;
      if(!confirm(`Restore the catalog snapshot from ${fmtDate(backup.createdAt)}?\n\nA safety backup of the current catalogs will be created first. EPUB and cover files in B2 are not changed.`))return;
      restoring.add(id);const button=actionButton("data-restore-backup",id);if(button){button.disabled=true;button.textContent="Restoring…"}const removeButton=actionButton("data-delete-backup",id);if(removeButton)removeButton.disabled=true;
      try{const result=await maintenance("restore-backup",{id});restoring.delete(id);render(result);keeper.state.management=null;keeper.events.dispatchEvent(new Event("history:changed"));keeper.events.dispatchEvent(new Event("library:invalidate"));keeper.ui.toast("Catalog snapshot restored.")}catch(error){alert(error.message)}finally{restoring.delete(id);const next=actionButton("data-restore-backup",id);if(next){next.disabled=false;next.textContent="Restore"}const nextRemove=actionButton("data-delete-backup",id);if(nextRemove)nextRemove.disabled=false}
    }
    async function remove(id){
      if(!id||removing.has(id)||restoring.has(id)||!confirm("Delete this catalog backup permanently?\n\nThis removes only the selected backup snapshot. Current catalogs and EPUB/cover files are not changed."))return;
      removing.add(id);const button=actionButton("data-delete-backup",id);if(button){button.disabled=true;button.setAttribute("aria-busy","true")}const restoreButton=actionButton("data-restore-backup",id);if(restoreButton)restoreButton.disabled=true;
      try{await client.request("/admin-api/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete",id})});removing.delete(id);await load();keeper.events.dispatchEvent(new Event("history:changed"))}catch(error){alert(error.message)}finally{removing.delete(id);const next=actionButton("data-delete-backup",id);if(next){next.disabled=false;next.removeAttribute("aria-busy")}const nextRestore=actionButton("data-restore-backup",id);if(nextRestore)nextRestore.disabled=false}
    }
    $("#createCatalogBackup")?.addEventListener("click",()=>void create());list.addEventListener("click",event=>{const restoreButton=event.target.closest("[data-restore-backup]"),deleteButton=event.target.closest("[data-delete-backup]");if(restoreButton)void restore(restoreButton.dataset.restoreBackup);if(deleteButton)void remove(deleteButton.dataset.deleteBackup)});
    keeper.events.addEventListener("maintenance:data",event=>render(event.detail?.data));keeper.events.addEventListener("session:locked",()=>{backups=[];restoring.clear();removing.clear();creating=false;list.innerHTML=""});
    return{load};
  });
})();
