/* Shadow Garden — paginated Catalog History workflow owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,client=keeper.client;
  keeper.registerWorkflow("history",()=>{
    const list=$("#backupList");if(!list)return{};
    let backups=[],history={total:0,nextCursor:null},loading=false,loadError="",loadSequence=0,loadController=null;
    let creating=false,catalogReadable=true,epoch=0;
    const restoring=new Set(),removing=new Set();
    const fmtDate=value=>{if(!value)return"Unknown time";try{return new Date(value).toLocaleString()}catch{return String(value)}};
    const safe=value=>esc(String(value??""));

    function cancelLoad(){loadSequence++;loadController?.abort();loadController=null;loading=false;}
    function applyPage(data,append=false){
      if(data?.catalog)catalogReadable=data.catalog.readable!==false;
      const next=arr(data?.backups);
      backups=append?[...new Map([...backups,...next].map(item=>[item.id,item])).values()]:next;
      history=data?.history||{total:backups.length,nextCursor:null};loadError="";
    }
    function adopt(data){cancelLoad();applyPage(data);render();}

    function render(){
      const create=$("#createCatalogBackup"),more=$("#loadMoreBackups"),refresh=$("#refreshCatalogHistory");
      const busy=Boolean(loading||creating||restoring.size||removing.size);
      if(create){create.disabled=creating||!catalogReadable;create.textContent=creating?"Creating backup…":"Create backup now";create.title=catalogReadable?"":"Restore a valid snapshot before creating another backup.";}
      if($("#backupCount"))$("#backupCount").textContent=String(history.total??backups.length);
      if(more){more.classList.toggle("hidden",!history.nextCursor);more.disabled=busy;more.textContent=loading==="older"?"Loading older snapshots…":loadError?"Retry older snapshots":"Load older snapshots";}
      if(refresh)refresh.disabled=busy;
      const status=$("#backupHistoryStatus");
      if(status)status.textContent=loadError|| (loading?"Loading catalog history…":`${backups.length} snapshots loaded · ${history.total??backups.length} retained.`);
      list.setAttribute("aria-busy",loading?"true":"false");
      if(!backups.length){list.innerHTML=`<div class="maintenance-empty">${loading?"Loading catalog snapshots…":loadError?"Catalog history could not be loaded. Use Refresh history to try again.":"No catalog snapshots have been preserved yet."}</div>`;return;}
      list.innerHTML=backups.map(item=>{
        const isRestoring=restoring.has(item.id),isRemoving=removing.has(item.id),itemBusy=isRestoring||isRemoving,damaged=item.restorable===false;
        const metadata=damaged?`<span class="maintenance-bad">Damaged snapshot · ${safe(item.integrity?.detail||"Cannot restore this snapshot.")}</span>`:`<span class="backup-meta"><i>${safe(item.counts?.mainSeries??0)} main</i><i>${safe(item.counts?.adultSeries??0)} 18+</i><i>${safe(item.counts?.volumes??0)} volumes</i></span>`;
        return `<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.reason||"Catalog backup")}</strong><span>${safe(fmtDate(item.createdAt))}</span>${metadata}</div><div class="maintenance-item-actions"><button class="admin-secondary" type="button" data-restore-backup="${safe(item.id)}" ${itemBusy||damaged?"disabled":""}>${isRestoring?"Restoring…":damaged?"Cannot restore":"Restore"}</button><button class="danger-button backup-delete-icon" type="button" data-delete-backup="${safe(item.id)}" aria-label="Delete catalog backup" title="Delete backup" ${itemBusy?"disabled":""}></button></div></div>`;
      }).join("");
    }

    async function load({append=false}={}){
      if(loading)return;const cursor=append?history.nextCursor:null;if(append&&!cursor)return;
      const sequence=++loadSequence,controller=new AbortController();loadController=controller;loading=append?"older":"refresh";loadError="";render();
      try{
        const data=await client.request("/admin-api/backup"+(cursor?"?cursor="+encodeURIComponent(cursor):""),{method:"GET",signal:controller.signal});
        if(sequence!==loadSequence)return;applyPage(data,append);
      }catch(error){if(sequence===loadSequence)loadError=error.message||"Catalog history could not be loaded.";}
      finally{if(sequence===loadSequence){loading=false;loadController=null;render();}}
    }
    async function maintenance(action,payload={}){
      return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...payload})});
    }
    async function create(){
      if(creating||!catalogReadable)return;cancelLoad();const current=epoch;creating=true;render();
      try{
        const result=await maintenance("create-backup",{reason:"manual-backup"});if(current!==epoch)return;
        adopt(result);keeper.events.dispatchEvent(new Event("history:changed"));
      }catch(error){if(current===epoch)alert(error.message);}
      finally{if(current===epoch){creating=false;render();}}
    }
    async function restore(id){
      if(!id||restoring.has(id)||removing.has(id))return;const selected=backups.find(item=>item.id===id);if(!selected||selected.restorable===false)return;
      if(!confirm(`Restore the Garden to the catalog snapshot from ${fmtDate(selected.createdAt)}?\n\nA fresh safety snapshot of the current catalogs will be preserved first. EPUB and cover files in the private vault will not change.`))return;
      cancelLoad();const current=epoch;restoring.add(id);render();
      try{
        const result=await maintenance("restore-backup",{id});if(current!==epoch)return;
        restoring.delete(id);adopt(result);keeper.state.management=null;
        keeper.events.dispatchEvent(new CustomEvent("history:changed",{detail:{data:result}}));keeper.events.dispatchEvent(new Event("library:invalidate"));keeper.ui.toast("Catalog snapshot restored.");
      }catch(error){if(current===epoch)alert(error.message);}
      finally{if(current===epoch){restoring.delete(id);render();}}
    }
    async function remove(id){
      if(!id||removing.has(id)||restoring.has(id)||!confirm("Uproot this catalog snapshot permanently?\n\nOnly this preserved snapshot will be removed. The living catalogs and all EPUB/cover files remain untouched."))return;
      cancelLoad();const current=epoch;removing.add(id);render();
      try{
        await client.request("/admin-api/backup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete",id})});if(current!==epoch)return;
        backups=backups.filter(item=>item.id!==id);history={...history,total:Math.max(0,Number(history.total)-1)};
        keeper.events.dispatchEvent(new Event("history:changed"));
      }catch(error){if(current===epoch)alert(error.message);}
      finally{if(current===epoch){removing.delete(id);render();}}
    }

    $("#createCatalogBackup")?.addEventListener("click",()=>void create());
    $("#loadMoreBackups")?.addEventListener("click",()=>void load({append:true}));
    $("#refreshCatalogHistory")?.addEventListener("click",()=>void load());
    list.addEventListener("click",event=>{
      const restoreButton=event.target.closest("[data-restore-backup]"),deleteButton=event.target.closest("[data-delete-backup]");
      if(restoreButton)void restore(restoreButton.dataset.restoreBackup);if(deleteButton)void remove(deleteButton.dataset.deleteBackup);
    });
    keeper.events.addEventListener("maintenance:data",event=>adopt(event.detail?.data));
    keeper.events.addEventListener("session:locked",()=>{
      epoch++;cancelLoad();backups=[];history={total:0,nextCursor:null};loadError="";catalogReadable=false;creating=false;restoring.clear();removing.clear();render();
    });
    return{load,loadMore:()=>load({append:true})};
  });
})();
