/* Shadow Garden R5 — deployment version component. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  keeper.registerWorkflow("version",async()=>{
    let footer=document.querySelector(".admin-version-footer");
    if(!footer){footer=document.createElement("footer");footer.className="admin-version-footer";footer.setAttribute("aria-label","Deployment version");footer.innerHTML='<span id="adminVersion" class="admin-version">Version …</span>';document.body.appendChild(footer)}
    const label=footer.querySelector("#adminVersion");
    try{const response=await fetch("/data/version.json",{cache:"no-store"});if(!response.ok)throw new Error(`version metadata ${response.status}`);const info=await response.json(),version=String(info?.version||"unknown"),commit=String(info?.shortCommit||"");label.textContent=`Shadow Garden v${version}${commit?` · ${commit}`:""}`;label.title=[`Shadow Garden v${version}`,commit?`Commit ${info.commit||commit}`:"",info?.builtAt?`Built ${new Date(info.builtAt).toLocaleString()}`:""].filter(Boolean).join(" · ")}
    catch(error){console.warn("Deployment version metadata unavailable",error);label.textContent="Shadow Garden · version unavailable"}
    return{footer};
  });
})();