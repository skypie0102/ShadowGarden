/* Garden Pass dialog owns widget loading, presentation and dialog lifetime.
 Book access supplies verification; signed-ticket policy stays in book-access.js. */
import {loadTurnstile} from "./turnstile.js";

function whenBody(){
  if(document.body)return Promise.resolve();
  return new Promise(resolve=>document.addEventListener("DOMContentLoaded",resolve,{once:true}));
}

export async function presentHumanChallenge(challenge,{verify,adult=false}){
  await whenBody();
  const turnstile=await loadTurnstile();
  if(!challenge?.siteKey)throw new Error("Human verification is unavailable because the site key is missing.");

  return new Promise((resolve,reject)=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const overlay=document.createElement("dialog");
    overlay.className=`sg-human-gate${adult?" adult":""}`;
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-labelledby","sgHumanTitle");
    overlay.innerHTML=`
      <section class="sg-human-card">
        <div class="sg-human-mark" aria-hidden="true">✦</div>
        <p class="sg-human-kicker">GARDEN PASS</p>
        <h2 id="sgHumanTitle">Pass the Garden Gate</h2>
        <p class="sg-human-copy">One brief check grants this browser a Garden Pass for the next 12 hours. Once inside, reading and page turns remain undisturbed.</p>
        <div class="sg-human-widget" data-sg-human-widget></div>
        <p class="sg-human-status" data-sg-human-status aria-live="polite">Preparing the gate…</p>
        <div class="sg-human-actions"><button class="sg-human-cancel" type="button">Cancel</button></div>
      </section>`;
    document.body.appendChild(overlay);
    const host=overlay.querySelector("[data-sg-human-widget]");
    const status=overlay.querySelector("[data-sg-human-status]");
    const cancel=overlay.querySelector(".sg-human-cancel");
    let widgetId=null;
    let settled=false;
    let verifying=false;

    const setStatus=(message,error=false)=>{
      status.textContent=message;
      status.classList.toggle("error",Boolean(error));
    };
    const cleanup=()=>{
      try{if(widgetId!==null)turnstile.remove(widgetId)}catch{}
      if(overlay.open)overlay.close();
      overlay.remove();
      previousFocus?.focus?.({preventScroll:true});
    };
    const finish=(error=null)=>{
      if(settled)return;
      settled=true;
      cleanup();
      error?reject(error):resolve(true);
    };
    const reset=message=>{
      verifying=false;
      setStatus(message,true);
      try{if(widgetId!==null)turnstile.reset(widgetId)}catch{}
    };

    const submit=async token=>{
      if(verifying||settled)return;
      verifying=true;
      setStatus("Presenting your Garden Pass…");
      try{
        const {ok,status:statusCode,payload}=await verify(token);
        if(ok&&payload?.ok){
          setStatus("The gate recognizes you. Opening the Garden…");
          finish();
          return;
        }
        if(statusCode===403&&payload?.code==="human_verification_failed"){
          reset(payload?.error||"Verification was not accepted. Please try again.");
          return;
        }
        finish(new Error(payload?.error||`Human verification failed (${statusCode}).`));
      }catch(error){
        finish(error);
      }
    };

    cancel.addEventListener("click",()=>finish(new Error("Human verification was cancelled.")));
    overlay.addEventListener("cancel",event=>{
      event.preventDefault();
      finish(new Error("Human verification was cancelled."));
    });

    try{
      // Native modality covers closed shadow roots and cross-origin widget
      // frames without inspecting their controls or changing page tabindexes.
      overlay.showModal();
      widgetId=turnstile.render(host,{
        sitekey:challenge.siteKey,
        action:challenge.action||"book_access",
        theme:"dark",
        size:"flexible",
        callback:token=>void submit(token),
        "expired-callback":()=>reset("Verification expired. Please try again."),
        "error-callback":()=>{reset("Verification could not complete. Please try again.");return true},
        "timeout-callback":()=>reset("Verification timed out. Please try again.")
      });
      setStatus("Complete the check to open the Garden.");
      cancel.focus();
    }catch(error){
      finish(new Error(error?.message||"Human verification could not start."));
    }
  });
}

