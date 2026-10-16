/* Deployment identity shared by the main and adult library footers. */
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
      const commit=String(info?.shortCommit||"").trim();
      target.textContent=` · v${version}${commit?` · ${commit}`:""}`;
      target.title=[`Shadow Garden v${version}`,info.commit?`Commit ${info.commit}`:"",
        info.branch?`Branch ${info.branch}`:"",info.builtAt?`Built ${info.builtAt}`:""].filter(Boolean).join(" · ");
    }catch(error){
      console.warn("Library deployment version unavailable",error);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>void mount(),{once:true});
  else void mount();
})();
