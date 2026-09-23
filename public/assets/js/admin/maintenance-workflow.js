/* Shadow Garden R5 — Maintenance workflow: Garden Health + cover optimization. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc,slug,hash8,optimizedCoverSet}=keeper.util,client=keeper.client;

  keeper.registerWorkflow("maintenance",()=>{
    const view=$("#maintenanceView");if(!view)return{};
    let snapshot=null,loading=false,optimizing=false,deepChecking=false,normalizingTaxonomy=false,activeOperation=null,operationSequence=0;
    const operationQueue=[],operationHistory=[];
    const safe=value=>esc(String(value??""));
    const setPill=(element,text,kind="")=>keeper.ui.setPill(element,text,kind);
    const metric=(label,value)=>`<div class="maintenance-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`;
    const setProgress=(element,text,percent)=>{if(!element)return;element.classList.remove("hidden");element.style.setProperty("--maintenance-progress",`${Math.max(0,Math.min(100,Number(percent)||0))}%`);element.innerHTML=`<span>${safe(text)}</span>`};

    async function action(name,payload={}){return client.request("/admin-api/maintenance",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:name,...payload})})}

    function operationState(kind){return activeOperation?.kind===kind?"running":operationQueue.some(item=>item.kind===kind)?"queued":""}
    function ensureOperationSurface(){
      let card=$("#maintenanceOperationCard");if(card)return card;
      card=document.createElement("section");card.id="maintenanceOperationCard";card.className="admin-card maintenance-card maintenance-operation-card";
      card.innerHTML='<div class="admin-card-head"><div><span>QUEUE</span><h2>Maintenance Operations</h2></div><strong id="maintenanceOperationState" class="state-pill ready">IDLE</strong></div><p class="maintenance-copy">Long maintenance work runs one at a time in this tab. Queued work can be removed before it starts; running work is not cancelled mid-write. Reloading this page does not create background jobs.</p><div id="maintenanceOperationList" class="maintenance-list"><div class="maintenance-empty maintenance-good">No long maintenance work is pending.</div></div>';
      const backup=$("#backupMaintenanceCard");if(backup)backup.before(card);else view.appendChild(card);return card;
    }
    function renderOperationQueue(){
      ensureOperationSurface();const state=$("#maintenanceOperationState"),list=$("#maintenanceOperationList"),items=[...(activeOperation?[activeOperation]:[]),...operationQueue,...operationHistory.slice(0,3)];
      if(activeOperation)setPill(state,"RUNNING");else if(operationQueue.length)setPill(state,`${operationQueue.length} QUEUED`);else setPill(state,"IDLE","ready");
      if(!list)return;if(!items.length){list.innerHTML='<div class="maintenance-empty maintenance-good">No long maintenance work is pending.</div>';return}
      list.innerHTML=items.map(item=>{const status=item.status==="running"?"RUNNING":item.status==="queued"?"QUEUED":item.status==="done"?"DONE":"FAILED",kind=item.status==="failed"?"error":item.status==="done"?"ready":"",remove=item.status==="queued"?`<button type="button" class="admin-secondary compact-button" data-remove-maintenance-operation="${safe(item.id)}">Remove</button>`:"";return `<div class="maintenance-item maintenance-operation-item" data-operation-status="${safe(item.status)}"><div class="maintenance-item-copy"><strong>${safe(item.label)}</strong><span>${safe(item.detail||(item.status==="queued"?"Waiting for the current maintenance operation.":"Ready."))}</span></div><div class="maintenance-item-actions"><span class="state-pill ${kind}">${status}</span>${remove}</div></div>`}).join("");
    }
    function renderDeepCheckControl(){const button=$("#deepHealthCheck"),state=operationState("deep");if(!button)return;button.disabled=Boolean(state)||!snapshot;button.textContent=state==="running"?"Checking B2…":state==="queued"?"Deep B2 check queued":"Deep B2 check"}
    function renderOperationControls(){renderDeepCheckControl();if(snapshot){renderTaxonomy(snapshot);renderCovers(snapshot)}}
    function updateOperationDetail(kind,detail){if(activeOperation?.kind!==kind)return;activeOperation.detail=String(detail||"");renderOperationQueue()}
    function enqueueOperation(kind,label,run){
      if(operationState(kind))return false;const operation={id:`maintenance-operation-${++operationSequence}`,kind,label,status:"queued",detail:activeOperation?"Waiting for the current maintenance operation.":"Ready to start.",run};operationQueue.push(operation);renderOperationQueue();renderOperationControls();queueMicrotask(()=>void drainOperations());return true;
    }
    async function drainOperations(){
      if(activeOperation||!operationQueue.length)return;const operation=operationQueue.shift();activeOperation=operation;operation.status="running";operation.detail="Starting…";renderOperationQueue();renderOperationControls();
      try{await operation.run();operation.status="done";if(!operation.detail||operation.detail==="Starting…")operation.detail="Completed."}
      catch(error){operation.status="failed";operation.detail=error?.message||String(error);console.error("Maintenance operation failed",error)}
      finally{delete operation.run;operationHistory.unshift(operation);operationHistory.splice(4);activeOperation=null;renderOperationQueue();renderOperationControls();if(operationQueue.length)queueMicrotask(()=>void drainOperations())}
    }
    function clearQueuedOperations(){if(!operationQueue.length)return;operationQueue.length=0;renderOperationQueue();renderOperationControls()}

    function renderSummary(data){
      const health=data?.health||{},counts=health.counts||{},metrics=health.metrics||{};
      if($("#maintenanceSeries"))$("#maintenanceSeries").textContent=counts.series??0;if($("#maintenanceVolumes"))$("#maintenanceVolumes").textContent=counts.volumes??0;if($("#maintenanceLegacyCovers"))$("#maintenanceLegacyCovers").textContent=metrics.missingThumbs??0;if($("#maintenanceTrashCount"))$("#maintenanceTrashCount").textContent=metrics.trashItems??0;
    }
    function renderHealth(data,deep=null){
      const health=data?.health||{},metrics=health.metrics||{},issues=[...arr(health.issues)];
      if(deep?.missing?.length)for(const item of deep.missing)issues.unshift({severity:"error",title:"B2 object missing",detail:item.key,code:"missing-object"});
      const status=deep?.missing?.length?"attention":health.status||"healthy";setPill($("#gardenHealthState"),status==="healthy"?"HEALTHY":status==="warning"?"CHECK":"ATTENTION",status==="attention"?"error":"ready");
      $("#gardenHealthMetrics").innerHTML=[metric("Referenced objects",metrics.referencedObjects??0),metric("Missing covers",metrics.missingCovers??0),metric("Missing thumbnails",metrics.missingThumbs??0),metric("Legacy identity data",metrics.legacyIdentity??0),...(deep?[metric("B2 checked",deep.checked??0),metric("B2 missing",deep.missing?.length??0)]:[])].join("");
      const list=$("#gardenHealthIssues");if(!issues.length){list.innerHTML='<div class="maintenance-empty maintenance-good">No catalog health issues found.</div>';return}
      const rank={error:0,warning:1,info:2},sorted=issues.sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)).slice(0,100);
      list.innerHTML=sorted.map(issue=>`<div class="maintenance-item health-issue" data-severity="${safe(issue.severity||"info")}"><span class="health-mark">${issue.severity==="error"?"!":issue.severity==="warning"?"△":"i"}</span><div class="maintenance-item-copy"><strong>${safe(issue.title||issue.code||"Health note")}</strong><span>${safe(issue.detail||"")}</span></div></div>`).join("")+(issues.length>100?`<div class="maintenance-empty">${issues.length-100} additional health notes are not shown.</div>`:"");
    }
    function renderTaxonomy(data){
      const audit=data?.taxonomy||{},stateEl=$("#taxonomyMaintenanceState"),detail=$("#taxonomyMaintenanceDetail"),preview=$("#taxonomyMaintenancePreview"),button=$("#normalizeCatalogTaxonomy"),count=Number(audit.affectedSeries)||0,queued=operationState("taxonomy");
      setPill(stateEl,count?`${count} REVIEW`:"CURRENT",count?"":"ready");
      if(detail)detail.textContent=count?`${count} of ${audit.totalSeries||0} series will be normalized into ${audit.canonicalGenreCount||35} canonical genres plus descriptive tags. A backup is created before changes are written.`:`All ${audit.totalSeries||0} series already follow the canonical genre/tag taxonomy.`;
      if(preview)preview.innerHTML=arr(audit.preview).map(item=>`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(item.title)}</strong><span>${safe([...arr(item.beforeGenres),...arr(item.beforeTags)].join(" · ")||"No taxonomy")} → ${safe([...arr(item.genres),...arr(item.tags)].join(" · ")||"No taxonomy")}</span></div></div>`).join("")||(count?'<div class="maintenance-empty">No preview rows available.</div>':'<div class="maintenance-empty maintenance-good">No taxonomy changes are pending.</div>');
      if(button){button.disabled=Boolean(queued)||!count;button.textContent=queued==="running"?"Normalizing…":queued==="queued"?"Taxonomy normalization queued":count?`Normalize ${count} series`:"Taxonomy is current"}
    }
    function renderCovers(data){
      const candidates=arr(data?.health?.optimizationCandidates),stateEl=$("#coverMaintenanceState"),detail=$("#coverMaintenanceDetail"),button=$("#optimizeLegacyCovers"),queued=operationState("covers");
      if(!candidates.length){setPill(stateEl,"CURRENT","ready");if(detail)detail.innerHTML='<span class="maintenance-good">All cataloged covers already have lightweight thumbnails.</span>';if(button){button.disabled=true;button.textContent="Covers are current"}return}
      setPill(stateEl,`${candidates.length} FOUND`);if(detail)detail.textContent=`${candidates.length} legacy cover${candidates.length===1?"":"s"} can be upgraded to a ~1000px WebP detail image plus a 480px WebP thumbnail.`;if(button){button.disabled=Boolean(queued);button.textContent=queued==="running"?"Optimizing…":queued==="queued"?"Cover optimization queued":`Optimize ${candidates.length} legacy cover${candidates.length===1?"":"s"}`}
    }
    function render(data){snapshot=data;renderSummary(data);renderHealth(data);renderTaxonomy(data);renderCovers(data);renderDeepCheckControl();renderOperationQueue();keeper.events.dispatchEvent(new CustomEvent("maintenance:data",{detail:{data}}))}

    async function load(force=false){
      if(loading)return;if(snapshot&&!force){render(snapshot);return}loading=true;setPill($("#gardenHealthState"),"LOADING");
      try{render(await client.request("/admin-api/maintenance",{method:"GET"}))}
      catch(error){console.error("Garden Maintenance load failed",error);setPill($("#gardenHealthState"),"FAILED","error");$("#gardenHealthIssues").innerHTML=`<div class="maintenance-empty maintenance-bad">${safe(error.message)}</div>`}
      finally{loading=false}
    }
    function invalidate(){snapshot=null;renderDeepCheckControl()}

    function deepCheck(){
      if(operationState("deep")||!snapshot)return;const available=arr(snapshot.health?.objectKeys);if(!available.length){alert("There are no cataloged B2 objects to check.");return}
      enqueueOperation("deep","Deep B2 check",async()=>{
        const keys=arr(snapshot?.health?.objectKeys);if(!keys.length)throw new Error("There are no cataloged B2 objects to check.");deepChecking=true;renderDeepCheckControl();const progress=$("#deepHealthProgress"),missing=[];let checked=0;
        try{for(let index=0;index<keys.length;index+=25){const batch=keys.slice(index,index+25),text=`Checking B2 objects ${checked+1}–${Math.min(keys.length,checked+batch.length)} of ${keys.length}…`;setProgress(progress,text,checked/keys.length*100);updateOperationDetail("deep",text);const result=await action("check-objects",{keys:batch});checked+=Number(result.checked)||batch.length;missing.push(...arr(result.missing))}const text=missing.length?`${missing.length} missing B2 object${missing.length===1?"":"s"} found.`:`All ${checked} referenced B2 objects were found.`;setProgress(progress,text,100);updateOperationDetail("deep",text);renderHealth(snapshot,{checked,missing})}
        catch(error){const text=`Deep check failed: ${error.message}`;setProgress(progress,text,0);updateOperationDetail("deep",text);throw error}finally{deepChecking=false;renderDeepCheckControl()}
      });
    }

    function normalizeTaxonomy(){
      if(operationState("taxonomy")||!snapshot?.taxonomy?.affectedSeries)return;const count=Number(snapshot.taxonomy.affectedSeries)||0;
      if(!confirm(`Normalize genre/tag metadata for ${count} series?\n\nShadow Garden will create a catalog backup first. Recognized EPUB/publisher aliases move into canonical Genres; unknown descriptive values remain Tags.`))return;
      enqueueOperation("taxonomy",`Normalize taxonomy for ${count} series`,async()=>{
        normalizingTaxonomy=true;renderTaxonomy(snapshot);try{const result=await action("normalize-taxonomy");render(result);keeper.state.management=null;keeper.events.dispatchEvent(new Event("library:invalidate"));const normalized=result.normalizedTaxonomy||count,text=`Normalized taxonomy for ${normalized} series.`;updateOperationDetail("taxonomy",text);keeper.ui.toast(text)}catch(error){updateOperationDetail("taxonomy",`Taxonomy normalization failed: ${error.message}`);alert(error.message);throw error}finally{normalizingTaxonomy=false;renderTaxonomy(snapshot)}
      });
    }

    function optimizeCovers(){
      if(operationState("covers")||!snapshot)return;const candidates=arr(snapshot.health?.optimizationCandidates);if(!candidates.length)return;
      if(!confirm(`Optimize ${candidates.length} legacy cover${candidates.length===1?"":"s"}? New WebP derivatives will be uploaded and the catalogs will be backed up before they are applied.`))return;
      enqueueOperation("covers",`Optimize ${candidates.length} legacy cover${candidates.length===1?"":"s"}`,async()=>{
        const current=arr(snapshot?.health?.optimizationCandidates);if(!current.length){updateOperationDetail("covers","No legacy covers remain to optimize.");return}optimizing=true;renderCovers(snapshot);const progress=$("#coverMaintenanceProgress"),updates=[],cache=new Map(),failures=[];let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
        try{
          for(let index=0;index<current.length;index++){
            const candidate=current[index],text=`Optimizing ${index+1}/${current.length}: ${candidate.seriesTitle} — ${candidate.volumeTitle}`;setProgress(progress,text,index/current.length*100);updateOperationDetail("covers",text);
            try{
              let uploaded=cache.get(candidate.source);
              if(!uploaded){const response=await fetch(candidate.source,{cache:"no-store"});if(!response.ok)throw new Error(`Could not fetch source cover (${response.status})`);const sourceBlob=await response.blob(),variants=await optimizedCoverSet(sourceBlob);if(!variants?.thumb||variants.detail?.type!=="image/webp")throw new Error("This browser could not create WebP cover derivatives");const hash=await hash8(sourceBlob),seriesPart=slug(candidate.seriesId||candidate.seriesTitle),part=candidate.volumeIndex===null?"series":`v${candidate.volumeIndex+1}`,coverKey=`shadow-garden/covers/${seriesPart}-${part}-${hash}-maintenance-detail.webp`,coverThumbKey=`shadow-garden/covers/${seriesPart}-${part}-${hash}-maintenance-thumb.webp`;await client.uploadObject(coverKey,variants.detail,"image/webp");await client.uploadObject(coverThumbKey,variants.thumb,"image/webp");uploaded={coverKey,coverThumbKey};cache.set(candidate.source,uploaded)}
              updates.push({scope:candidate.scope,seriesId:candidate.seriesId,volumeIndex:candidate.volumeIndex,volumeFile:candidate.volumeFile||"",...uploaded});
            }catch(error){console.error("Legacy cover optimization failed",candidate,error);failures.push(`${candidate.seriesTitle} — ${candidate.volumeTitle}: ${error.message}`)}
          }
          if(updates.length){const applying=`Applying ${updates.length} optimized cover update${updates.length===1?"":"s"} to the catalogs…`;setProgress(progress,applying,96);updateOperationDetail("covers",applying);const result=await action("apply-cover-optimizations",{updates});render(result);keeper.state.management=null;keeper.events.dispatchEvent(new Event("library:invalidate"));const text=`Optimized ${result.optimized||updates.length} cover${(result.optimized||updates.length)===1?"":"s"}${failures.length?`; ${failures.length} skipped`:""}.`;setProgress(progress,text,100);updateOperationDetail("covers",text)}else throw new Error(failures[0]||"No covers could be optimized");
        }catch(error){const text=`Cover maintenance failed: ${error.message}`;setProgress(progress,text,0);updateOperationDetail("covers",text);throw error}finally{optimizing=false;renderCovers(snapshot);try{await wakeLock?.release()}catch{}}
      });
    }

    view.addEventListener("click",event=>{const button=event.target.closest("[data-remove-maintenance-operation]");if(!button)return;const index=operationQueue.findIndex(item=>item.id===button.dataset.removeMaintenanceOperation);if(index<0)return;operationQueue.splice(index,1);renderOperationQueue();renderOperationControls()});
    $("#refreshMaintenance")?.addEventListener("click",()=>{invalidate();void load(true)});$("#deepHealthCheck")?.addEventListener("click",deepCheck);$("#normalizeCatalogTaxonomy")?.addEventListener("click",normalizeTaxonomy);$("#optimizeLegacyCovers")?.addEventListener("click",optimizeCovers);
    keeper.events.addEventListener("maintenance:opened",()=>void load(true));keeper.events.addEventListener("trash:changed",invalidate);keeper.events.addEventListener("history:changed",invalidate);keeper.events.addEventListener("session:locked",()=>{invalidate();clearQueuedOperations()});
    renderOperationQueue();
    return{load,refresh:()=>load(true),invalidate,get snapshot(){return snapshot}};
  });
})();
