/* Shadow Garden v2.5 — Garden Keeper motion observer.
   Canonical Keeper workflows remain the only owners of requests, persistence, dialogs, and upload state. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;

  keeper.registerWorkflow("motion",()=>{
    const motion=window.ShadowGardenMotion;
    const timers=new WeakMap();
    const busyPattern=/saving|uploading|moving|checking|loading|optimizing|creating|refreshing|normalizing|restoring|purging/i;

    function restart(node,className,duration=430){
      if(!node||motion?.reduced)return;
      const previous=timers.get(node);if(previous)window.clearTimeout(previous);
      node.classList.remove(className);void node.offsetWidth;node.classList.add(className);
      timers.set(node,window.setTimeout(()=>{node.classList.remove(className);timers.delete(node)},duration));
    }

    function signature(node){
      if(!node)return"";
      return `${String(node.textContent||"").trim()}|${node.className}|${node.dataset?.kind||""}|${node.disabled?"1":"0"}`;
    }

    function observeState(node){
      if(!node)return;
      let last=signature(node);
      new MutationObserver(()=>queueMicrotask(()=>{
        const next=signature(node);if(next===last)return;last=next;restart(node,"sg-keeper-state-changed",390);
      })).observe(node,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","data-kind"]});
    }

    function watchAction(button){
      if(!button||button.dataset.sgMotionAction==="1")return;
      button.dataset.sgMotionAction="1";
      let busy=button.disabled&&busyPattern.test(String(button.textContent||""));
      button.classList.toggle("sg-keeper-action-busy",busy);
      new MutationObserver(()=>queueMicrotask(()=>{
        const next=button.disabled&&busyPattern.test(String(button.textContent||""));
        if(next===busy)return;
        busy=next;button.classList.toggle("sg-keeper-action-busy",busy);
        if(!busy)restart(button,"sg-keeper-action-settled",450);
      })).observe(button,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["disabled"]});
    }

    [
      "authState","fileState","preflightState","uploadState","gardenHealthState","coverMaintenanceState",
      "taxonomyMaintenanceState","backupCount","trashCount","manageBannerState"
    ].map(id=>document.getElementById(id)).forEach(observeState);

    ["unlockButton","refreshLibrary","saveSeries","uploadButton","deepHealthCheck","optimizeLegacyCovers","normalizeCatalogTaxonomy","createCatalogBackup","purgeAllTrash"]
      .map(id=>document.getElementById(id)).forEach(watchAction);

    const volumes=document.getElementById("manageVolumes");
    if(volumes){
      const wireVolumeActions=()=>volumes.querySelectorAll("[data-volume-save],[data-volume-delete]").forEach(watchAction);
      new MutationObserver(()=>queueMicrotask(wireVolumeActions)).observe(volumes,{childList:true,subtree:true});wireVolumeActions();
    }

    document.querySelectorAll(".admin-dialog").forEach(dialog=>{
      new MutationObserver(()=>{
        if(dialog.open)restart(dialog.querySelector(".dialog-shell"),"sg-keeper-dialog-open",360);
      }).observe(dialog,{attributes:true,attributeFilter:["open"]});
    });

    const list=document.getElementById("seriesManagerList");
    if(list)new MutationObserver(()=>queueMicrotask(()=>restart(list,"sg-keeper-list-updated",360))).observe(list,{childList:true});

    keeper.events.addEventListener("session:unlocked",()=>restart(document.getElementById("dashboardView"),"sg-keeper-state-changed",420));
    keeper.events.addEventListener("library:changed",()=>restart(list,"sg-keeper-list-updated",360));
    keeper.events.addEventListener("maintenance:opened",()=>restart(document.querySelector("#maintenanceDialog .dialog-shell"),"sg-keeper-state-changed",360));
    keeper.events.addEventListener("upload:completed",()=>{
      restart(document.getElementById("uploadCard"),"sg-keeper-complete",560);
      restart(document.getElementById("uploadState"),"sg-keeper-state-changed",420);
    });

    return Object.freeze({restart});
  });
})();
