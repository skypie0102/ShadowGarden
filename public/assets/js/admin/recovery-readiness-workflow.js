/* Shadow Garden v2.9 — on-demand Recovery Readiness presentation. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,esc}=keeper.util,client=keeper.client;

  keeper.registerWorkflow("recoveryReadiness",()=>{
    const view=$("#maintenanceView");if(!view)return{};
    let report=null,loading=false,checkSequence=0;
    const safe=value=>esc(String(value??""));
    const setPill=(element,text,kind="")=>keeper.ui.setPill(element,text,kind);
    const metric=(label,value)=>`<div class="maintenance-metric"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`;

    function ensureCard(){
      let card=$("#recoveryReadinessCard");if(card)return card;
      card=document.createElement("section");card.id="recoveryReadinessCard";card.className="admin-card maintenance-card";
      card.innerHTML='<div class="admin-card-head"><div><span>RECOVERY</span><h2>Recovery Readiness</h2></div><strong id="recoveryReadinessState" class="state-pill">NOT CHECKED</strong></div><p class="maintenance-copy">Run an on-demand recovery audit before destructive maintenance. READY requires readable live catalogs plus a checksum-verified, object-complete retained snapshot; this check does not restore or delete anything.</p><div id="recoveryReadinessMetrics" class="maintenance-metrics"></div><div id="recoveryReadinessDetail" class="maintenance-callout">Recovery readiness has not been checked in this session.</div><div class="maintenance-actions"><button id="checkRecoveryReadiness" class="admin-primary inline-button" type="button">Check recovery readiness</button></div><div id="recoveryReadinessList" class="maintenance-list"></div>';
      const backup=$("#backupMaintenanceCard");if(backup)backup.before(card);else view.appendChild(card);return card;
    }

    function idle(){
      ensureCard();setPill($("#recoveryReadinessState"),"NOT CHECKED");
      const metrics=$("#recoveryReadinessMetrics"),detail=$("#recoveryReadinessDetail"),list=$("#recoveryReadinessList"),button=$("#checkRecoveryReadiness");
      if(metrics)metrics.innerHTML=[metric("Retained","—"),metric("Verified","—"),metric("Damaged","—"),metric("Anchor objects","—")].join("");
      if(detail)detail.textContent="Recovery readiness has not been checked in this session.";
      if(list)list.innerHTML="";
      if(button){button.disabled=false;button.removeAttribute("aria-busy");button.textContent="Check recovery readiness"}
    }

    function render(data){
      ensureCard();report=data;const readiness=data?.readiness||{},summary=data?.summary||{},live=data?.live||{},anchor=readiness.anchor||null,status=String(readiness.status||"check-required");
      const state=$("#recoveryReadinessState");
      if(status==="ready")setPill(state,"READY","ready");
      else if(status==="recovery-required")setPill(state,"RECOVER NOW","error");
      else if(status==="not-ready")setPill(state,"NOT READY","error");
      else setPill(state,"CHECK");
      const metrics=$("#recoveryReadinessMetrics");if(metrics)metrics.innerHTML=[metric("Retained",summary.total??0),metric("Verified",summary.verified??0),metric("Damaged",summary.damaged??0),metric("Anchor objects",anchor?.objectCount??"—")].join("");
      const detail=$("#recoveryReadinessDetail");if(detail)detail.textContent=readiness.detail||"Recovery readiness check completed.";
      const rows=[];
      for(const entry of Array.isArray(live.entries)?live.entries:[]){const label=entry.scope==="adult"?"Adult catalog":"Main catalog",stateText=entry.readable?"Readable":String(entry.status||"Needs recovery").replaceAll("-"," ");rows.push(`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>${safe(label)}</strong><span>${safe(stateText)} · ${safe(entry.detail||"")}</span></div><span class="state-pill ${entry.readable?"ready":"error"}">${entry.readable?"OK":"CHECK"}</span></div>`)}
      if(anchor){const verified=Boolean(anchor.verified);rows.push(`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>Object-complete recovery anchor</strong><span>${safe(anchor.reason||"Catalog snapshot")} · ${safe(anchor.id)} · ${safe(verified?"SHA-256 verified":"Legacy unverified")} · ${safe(anchor.objectCount??0)} referenced objects present</span></div><span class="state-pill ${verified?"ready":""}">${verified?"AVAILABLE":"LEGACY"}</span></div>`)}
      else rows.push(`<div class="maintenance-item"><div class="maintenance-item-copy"><strong>Object-complete recovery anchor</strong><span>No usable anchor was proven. ${safe(readiness.staleSnapshots||0)} stale and ${safe(readiness.uncertainSnapshots||0)} uncertain snapshot checks were encountered.</span></div><span class="state-pill error">MISSING</span></div>`);
      const list=$("#recoveryReadinessList");if(list)list.innerHTML=rows.join("");
      const button=$("#checkRecoveryReadiness");if(button){button.disabled=false;button.removeAttribute("aria-busy");button.textContent="Check again"}
    }

    async function check(){
      if(loading)return;ensureCard();const sequence=++checkSequence,button=$("#checkRecoveryReadiness"),state=$("#recoveryReadinessState"),detail=$("#recoveryReadinessDetail");loading=true;
      if(button){button.disabled=true;button.setAttribute("aria-busy","true");button.textContent="Checking recovery…"}setPill(state,"CHECKING");if(detail)detail.textContent="Verifying live catalogs, retained snapshots, and referenced recovery media…";
      try{const next=await client.request("/admin-api/recovery-readiness",{method:"GET"});if(sequence!==checkSequence)return;render(next)}
      catch(error){if(sequence!==checkSequence)return;report=null;setPill(state,"FAILED","error");if(detail)detail.textContent=error.message;const list=$("#recoveryReadinessList");if(list)list.innerHTML=""}
      finally{if(sequence!==checkSequence)return;loading=false;if(button&&button.isConnected&&button.disabled){button.disabled=false;button.removeAttribute("aria-busy");button.textContent=report?"Check again":"Retry recovery check"}}
    }

    function invalidate(){checkSequence+=1;loading=false;report=null;idle()}
    ensureCard();idle();
    $("#checkRecoveryReadiness")?.addEventListener("click",()=>void check());
    keeper.events.addEventListener("maintenance:opened",()=>{ensureCard();if(!report&&!loading)idle()});
    keeper.events.addEventListener("history:changed",invalidate);keeper.events.addEventListener("trash:changed",invalidate);keeper.events.addEventListener("library:invalidate",invalidate);keeper.events.addEventListener("session:locked",invalidate);
    return{check,invalidate,get report(){return report}};
  });
})();
