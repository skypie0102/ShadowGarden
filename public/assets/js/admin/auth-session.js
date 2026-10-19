/* Shadow Garden R5 — Garden Keeper authentication/session owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$}=keeper.util,{state}=keeper,{setAuthState}=keeper.ui,client=keeper.client;

  keeper.registerWorkflow("session",()=>{
    const unlockButton=$("#unlockButton"),tokenInput=$("#adminToken"),authCard=$("#authCard"),lockButton=$("#lockButton");
    if(!unlockButton||!tokenInput||!authCard)return{};
    let widgetId=null,challenge=null,submitting=false,cooldownTimer=0,generation=0,initializing=false;

    function panel(){
      let host=$("#adminSecurityPanel");if(host)return host;
      host=document.createElement("section");host.id="adminSecurityPanel";host.className="admin-security-panel hidden";host.setAttribute("aria-label","Garden Keeper human verification");
      host.innerHTML='<p class="admin-security-label">Keeper&#39;s gate</p><div class="admin-security-widget" data-admin-security-widget></div><p class="admin-security-status" data-admin-security-status aria-live="polite"></p>';
      unlockButton.insertAdjacentElement("beforebegin",host);return host;
    }
    function setPanelStatus(message,error=false){const status=panel().querySelector("[data-admin-security-status]");status.textContent=message;status.classList.toggle("error",Boolean(error))}

    const loadTurnstile=()=>import("../public/turnstile.js").then(module=>module.loadTurnstile());

    function stopCooldown(){clearInterval(cooldownTimer);cooldownTimer=0;panel().dataset.cooldown="false"}
    function beginCooldown(seconds){
      stopCooldown();let remaining=Math.max(1,Math.ceil(Number(seconds)||1));const host=panel();host.classList.remove("hidden");host.dataset.cooldown="true";unlockButton.disabled=true;
      const tick=()=>{setAuthState(`WAIT ${remaining}s`,"error");setPanelStatus(`The Keeper's gate has closed after repeated failed keys. Try again in ${remaining} second${remaining===1?"":"s"}.`,true);remaining--;if(remaining<0){stopCooldown();unlockButton.disabled=false;setAuthState("LOCKED");try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}setPanelStatus("Complete the check when the gate is ready again.")}};
      tick();if(remaining>=0)cooldownTimer=setInterval(tick,1000);
    }

    async function getChallenge(){
      const response=await fetch("/admin-access",{method:"GET",credentials:"same-origin",cache:"no-store"});let data=null;try{data=await response.json()}catch{}
      if(!response.ok||!data?.siteKey)throw new Error(data?.error||"Garden Keeper verification is unavailable.");return data;
    }

    function showUnlocked(){
      state.unlocked=true;client.markUnlocked();setAuthState("UNLOCKED","ready");$("#lockedView")?.classList.add("hidden");$("#dashboardView")?.classList.remove("hidden");panel().classList.add("hidden");keeper.events.dispatchEvent(new Event("session:unlocked"));
    }
    function showLocked(){
      state.unlocked=false;client.markLocked();state.management=null;state.activeSeriesId=null;state.addBookTarget=null;tokenInput.value="";setAuthState("LOCKED");$("#dashboardView")?.classList.add("hidden");$("#lockedView")?.classList.remove("hidden");
      for(const dialog of document.querySelectorAll("dialog[open]")){try{dialog.close()}catch{}}
      keeper.events.dispatchEvent(new Event("session:locked"));
    }

    async function establishSession(turnstileToken,epoch=generation){
      if(epoch!==generation||submitting||cooldownTimer)return;submitting=true;unlockButton.disabled=true;setAuthState("VERIFYING");setPanelStatus("Checking your Garden Pass and Keeper key…");
      try{
        const response=await fetch("/admin-access",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({adminToken:tokenInput.value,turnstileToken})});
        let data=null;try{data=await response.json()}catch{}if(epoch!==generation)return;const retryAfter=Number(response.headers.get("Retry-After")||0);
        if(response.ok&&data?.ok){
          stopCooldown();setPanelStatus("The gate yields. Opening Garden Keeper…");
          try{await client.verifySession()}catch(error){if(epoch===generation)await client.closeSession();throw error}
          if(epoch!==generation)return;
          showUnlocked();return;
        }
        if(retryAfter>0)beginCooldown(retryAfter);else{setAuthState("DENIED","error");setPanelStatus(data?.error||"Access denied. Please try again.",true);try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}unlockButton.disabled=false}
      }catch(error){if(epoch!==generation)return;setAuthState("UNAVAILABLE","error");setPanelStatus(error?.message||"Garden Keeper verification is temporarily unavailable.",true);unlockButton.disabled=false;try{if(widgetId!==null)window.turnstile?.reset(widgetId)}catch{}}
      finally{if(epoch===generation)submitting=false}
    }

    async function beginUnlock(){
      if(submitting||initializing||cooldownTimer)return;if(!tokenInput.value.trim()){setAuthState("TOKEN NEEDED","error");tokenInput.focus();return}
      const epoch=generation;initializing=true;
      const live=callback=>(...args)=>{if(epoch===generation)return callback(...args)};
      unlockButton.disabled=true;setAuthState("CHECKING");const host=panel();host.classList.remove("hidden");setPanelStatus("Waking the Keeper's gate…");
      try{
        if(!challenge){const next=await getChallenge();if(epoch!==generation)return;challenge=next}const turnstile=await loadTurnstile();if(epoch!==generation)return;
        if(widgetId===null){const widgetHost=host.querySelector("[data-admin-security-widget]");widgetId=turnstile.render(widgetHost,{sitekey:challenge.siteKey,action:challenge.action||"admin_access",theme:"dark",size:"flexible",callback:token=>void establishSession(token,epoch),"expired-callback":live(()=>setPanelStatus("Verification expired. Complete it again.",true)),"error-callback":live(()=>{setPanelStatus("Verification could not complete. Please try again.",true);return true}),"timeout-callback":live(()=>setPanelStatus("Verification timed out. Please try again."))})}
        setPanelStatus("Complete the check to open the Keeper's gate.");unlockButton.disabled=false;
      }catch(error){if(epoch!==generation)return;setAuthState("UNAVAILABLE","error");setPanelStatus(error?.message||"Garden Keeper verification is unavailable.",true);unlockButton.disabled=false}
      finally{if(epoch===generation)initializing=false}
    }

    async function lock(){
      const epoch=++generation;initializing=false;submitting=false;stopCooldown();challenge=null;
      try{if(widgetId!==null)window.turnstile?.remove(widgetId)}catch{}widgetId=null;
      showLocked();unlockButton.disabled=false;
      await client.closeSession();if(epoch===generation)panel().classList.add("hidden");
    }
    unlockButton.addEventListener("click",event=>{event.preventDefault();void beginUnlock()});
    tokenInput.addEventListener("keydown",event=>{if(event.key!=="Enter")return;event.preventDefault();void beginUnlock()});
    lockButton?.addEventListener("click",event=>{event.preventDefault();void lock()});
    keeper.events.addEventListener("session:rejected",()=>{if(client.isAuthorized())void lock()});
    showLocked();
    return{beginUnlock,lock,isUnlocked:()=>client.isAuthorized()};
  });
})();