/* Shadow Garden R5 — Trash & Recovery workflow owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,client=keeper.client;
  keeper.registerWorkflow("trash",()=>{
    const list=$("#trashList");if(!list)return{};
    let trash=[],loading=false,purgeAllRunning=false;
    const restoring=new Set(),purging=new Set();
    const safe=value=>esc(String(value??""));
    const fmtDate=value=>{try{return new Date(value).toLocaleString()}catch{return String(value||"")}};
    const actionButton=(attribute,id)=>[...list.querySelectorAll(`[${attribute}]`)].find(button=>button.getAttribute(attribute)===id)||null;
    async function action(name,payload={}){return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:name,...payload})})}
    function render(data){
      trash=arr(data?.trash);if($("#trashCount"))$("#trashCount").textContent=String(trash.length);if($("#maintenanceTrashCount"))$("#maintenanceTrashCount").textContent=String(trash.length);
      const purgeAll=$("#purgeAllTrash");if(purgeAll){purgeAll.disabled=true;purgeAll.textContent="Permanent purge unavailable during recovery";purgeAll.title="Original retention rules have not been recovered. Restore remains available."}
      if(!trash.length){list.innerHTML='<div class="maintenance-empty maintenance-good">Trash is empty.</div>';return}
      list.innerHTML=trash.map(item=>{
        const isRestoring=restoring.has(item.id),isPurging=purging.has(item.id),busy=purgeAllRunning||isRestoring||isPurging;
        return `<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.title||"Deleted item")}</strong><span>${safe(item.subtitle||"")}</span><span class="trash-meta"><i>${item.type==="series"?"Series":"Volume"}</i><i>${item.scope==="adult"?"18+":"Main"}</i><i>${safe(fmtDate(item.removedAt))}</i></span></div><div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-trash="${safe(item.id)}" ${busy?"disabled":""}>${isRestoring?"Restoring…":"Restore"}</button><button class="danger-button" type="button" data-purge-trash="${safe(item.id)}" ${busy?"disabled":""}>${isPurging?"Purging…":"Purge"}</button></div></div>`;
      }).join("");
      for(const button of list.querySelectorAll("[data-purge-trash]")){button.disabled=true;button.textContent="Purge unavailable";button.title="Original retention rules have not been recovered."}
    }
    async function load(){if(loading)return;loading=true;try{render(await client.request("/admin-api/maintenance",{method:"GET"}))}catch(error){list.innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`}finally{loading=false}}
    function announceChange(data){keeper.events.dispatchEvent(new CustomEvent("trash:changed",{detail:{data}}))}
    async function restore(id){
      if(!id||purgeAllRunning||restoring.has(id)||purging.has(id))return;const item=trash.find(entry=>entry.id===id);if(!item)return;if(!confirm(`Restore “${item.title}” to the ${item.scope==="adult"?"18+":"Main"} library?`))return;
      restoring.add(id);const button=actionButton("data-restore-trash",id);if(button){button.disabled=true;button.textContent="Restoring…"}const purgeButton=actionButton("data-purge-trash",id);if(purgeButton)purgeButton.disabled=true;
      try{const result=await action("restore-trash",{id});restoring.delete(id);render(result);keeper.state.management=null;announceChange(result);keeper.events.dispatchEvent(new Event("library:invalidate"));keeper.ui.toast(`Restored “${item.title}”.`)}catch(error){alert(error.message)}finally{restoring.delete(id);const next=actionButton("data-restore-trash",id);if(next){next.disabled=false;next.textContent="Restore"}const nextPurge=actionButton("data-purge-trash",id);if(nextPurge)nextPurge.disabled=false}
    }
    async function purge(ids){
      const all=!ids?.length,count=all?trash.length:ids.length;if(!count||purgeAllRunning||(!all&&ids.some(id=>purging.has(id)||restoring.has(id))))return;
      if(!confirm(`Permanently purge ${all?"all Trash":count===1?"this Trash item":`${count} Trash items`}?\n\nAny EPUB and cover objects used only by the selected Trash entries will be deleted from B2. This cannot be undone.`))return;
      if(all)purgeAllRunning=true;else ids.forEach(id=>purging.add(id));render({trash});
      try{const result=await action("purge-trash",{ids:ids||[]});purgeAllRunning=false;ids?.forEach(id=>purging.delete(id));render(result);announceChange(result);keeper.ui.toast(all?"Trash purged.":"Trash item purged.")}catch(error){alert(error.message)}finally{purgeAllRunning=false;ids?.forEach(id=>purging.delete(id));render({trash})}
    }
    list.addEventListener("click",event=>{const restoreButton=event.target.closest("[data-restore-trash]"),purgeButton=event.target.closest("[data-purge-trash]");if(restoreButton)void restore(restoreButton.dataset.restoreTrash);if(purgeButton)void purge([purgeButton.dataset.purgeTrash])});$("#purgeAllTrash")?.addEventListener("click",()=>void purge([]));
    keeper.events.addEventListener("maintenance:data",event=>render(event.detail?.data));keeper.events.addEventListener("trash:changed",event=>{if(event.detail?.data)render(event.detail.data);else void load()});keeper.events.addEventListener("session:locked",()=>{trash=[];restoring.clear();purging.clear();purgeAllRunning=false;list.innerHTML=""});
    return{load};
  });
})();
