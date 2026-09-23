/* Shadow Garden v1.15.9 — deployed repo version in public library footers. */
(()=>{
  async function mount(){
    const target=document.getElementById("libraryVersion");
    if(!target)return;
    try{
      const response=await fetch("/data/version.json",{cache:"no-store"});
      if(!response.ok)throw new Error(`version metadata ${response.status}`);
      const info=await response.json();
      const version=String(info?.version||"").trim();
      if(!version)return;
      target.textContent=` · v${version}`;
      const commit=String(info?.shortCommit||"").trim();
      target.title=commit?`Shadow Garden v${version} · ${commit}`:`Shadow Garden v${version}`;
    }catch(error){
      console.warn("Library deployment version unavailable",error);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void mount(),{once:true});
  else void mount();
})();
