/* Shared explicit-widget loader; callers own their verification policy and UI. */
const TURNSTILE_SCRIPT="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise=null;

export function loadTurnstile(){
  if(window.turnstile?.render)return Promise.resolve(window.turnstile);
  if(turnstileScriptPromise)return turnstileScriptPromise;
  turnstileScriptPromise=new Promise((resolve,reject)=>{
    const ready=()=>window.turnstile?.render?resolve(window.turnstile):reject(new Error("Human verification did not initialize."));
    const existing=document.querySelector('script[data-sg-turnstile]');
    if(existing){
      existing.addEventListener("load",ready,{once:true});
      existing.addEventListener("error",()=>reject(new Error("Human verification could not be loaded.")),{once:true});
      if(window.turnstile?.render)resolve(window.turnstile);
      return;
    }
    const script=document.createElement("script");
    script.src=TURNSTILE_SCRIPT;
    script.async=true;
    script.defer=true;
    script.dataset.sgTurnstile="1";
    script.addEventListener("load",ready,{once:true});
    script.addEventListener("error",()=>reject(new Error("Human verification could not be loaded.")),{once:true});
    document.head.appendChild(script);
  }).catch(error=>{turnstileScriptPromise=null;throw error});
  return turnstileScriptPromise;
}

