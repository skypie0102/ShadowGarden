/* Shadow Garden R5 — Library + Series workflow owner. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,$$,arr,esc,fmtSize,normalizeSeriesStatus}=keeper.util,{state}=keeper,client=keeper.client;

  keeper.registerWorkflow("library",()=>{
    const list=$("#seriesManagerList"),dialog=$("#seriesEditor");if(!list||!dialog)return{};
    let bannerChoices=[],bannerSeriesId="",bannerSerial=0,bannerRandomChoice=null;

    function installEditorFields(){
      const status=$("#manageStatus");
      if(status&&status.tagName!=="SELECT"){
        const select=document.createElement("select");select.id="manageStatus";select.name=status.name||"series-status";select.setAttribute("aria-label","Series status");select.innerHTML=["Complete","Ongoing","Hiatus","Dropped"].map(value=>`<option value="${value}">${value}</option>`).join("");status.replaceWith(select);
      }
      const manageDescription=$("#manageDescription")?.closest("label");
      if(manageDescription&&!$("#manageAudioAlignedUrl")){
        const field=document.createElement("label");field.className="admin-field wide";field.innerHTML='<span>Audio-aligned EPUB folder URL (optional)</span><input id="manageAudioAlignedUrl" type="url" inputmode="url" placeholder="https://example.com/series-audio-epubs/"><small class="field-note">One external folder link for the entire series.</small>';manageDescription.before(field);
      }
      if(manageDescription&&!$("#manageBannerField")){
        const field=document.createElement("label");field.id="manageBannerField";field.className="admin-field wide manage-banner-field";field.innerHTML='<span>Series banner</span><select id="manageBanner" aria-describedby="manageBannerState"><option value="">Loading volume covers…</option></select><div class="manage-banner-preview"><img id="manageBannerPreview" class="hidden" alt="Random banner cover preview"><div class="manage-banner-preview-copy"><strong id="manageBannerPreviewTitle">Random banner</strong><small id="manageBannerState" class="manage-banner-state">Random is the default. A volume cover is chosen when the Series page opens.</small></div></div>';manageDescription.before(field);
      }
    }
    installEditorFields();

    const managementSeries=()=>state.management?[
      ...arr(state.management.main).map(series=>({series,scope:"main"})),
      ...arr(state.management.adult).map(series=>({series,scope:"adult"}))
    ]:[];
    const findManagedSeries=id=>managementSeries().find(item=>item.series.id===id)||null;
    const seriesAudioUrl=series=>series?.audioAlignedUrl||arr(series?.volumes).find(volume=>volume.audioAlignedUrl)?.audioAlignedUrl||"";

    function updateManagement(data){
      state.management={main:arr(data?.main),adult:arr(data?.adult),counts:data?.counts||{}};
      if($("#manageSeriesCount"))$("#manageSeriesCount").textContent=state.management.main.length+state.management.adult.length;
      if($("#manageVolumeCount"))$("#manageVolumeCount").textContent=managementSeries().reduce((count,item)=>count+arr(item.series.volumes).length,0);
      if($("#manageAdultCount"))$("#manageAdultCount").textContent=state.management.adult.length;
      renderManagerList();keeper.events.dispatchEvent(new Event("library:changed"));
    }

    async function loadLibrary(force=false){
      if(!client.isAuthorized())return;
      if(state.management&&!force){renderManagerList();return}
      const loading=$("#manageLoading");if(loading){loading.textContent="Loading the Garden…";loading.classList.remove("hidden")}
      $("#manageEmpty")?.classList.add("hidden");if(list)list.innerHTML="";
      try{updateManagement(await client.request("/admin-api/library",{method:"GET"}));loading?.classList.add("hidden")}
      catch(error){console.error(error);if(loading)loading.textContent=`Could not load the library: ${error.message}`}
    }

    function renderManagerList(){
      if(!state.management)return;const query=state.manageQuery.trim().toLowerCase();
      const items=managementSeries().filter(({series,scope})=>{
        if(state.manageScope!=="all"&&state.manageScope!==scope)return false;if(!query)return true;
        return[series.title,series.author,...arr(series.genres),...arr(series.tags),...arr(series.volumes).map(volume=>volume.title)].filter(Boolean).join(" ").toLowerCase().includes(query);
      }).sort((left,right)=>String(left.series.title||"").localeCompare(String(right.series.title||"")));
      $("#manageEmpty")?.classList.toggle("hidden",items.length>0);
      list.innerHTML=items.map(({series,scope})=>{
        const cover=series.coverThumb||series.cover||arr(series.volumes).find(volume=>volume.coverThumb)?.coverThumb||arr(series.volumes).find(volume=>volume.cover)?.cover||"";
        return `<article class="manager-card"><div class="manager-card-cover">${cover?`<img src="${esc(cover)}" alt="${esc(series.title)} cover" loading="lazy" decoding="async" fetchpriority="low">`:'<span>✦</span>'}</div><div class="manager-card-copy"><div class="manager-card-title"><div><strong>${esc(series.title||"Untitled")}</strong><span>${esc(series.author||"Unknown author")}</span></div><span class="manager-scope ${scope}">${scope==="adult"?"18+":"MAIN"}</span></div><div class="manager-card-meta"><span>${arr(series.volumes).length} ${arr(series.volumes).length===1?"volume":"volumes"}</span>${series.year?`<span>${esc(series.year)}</span>`:""}${(arr(series.genres)[0]||arr(series.tags)[0])?`<span>${esc(arr(series.genres)[0]||arr(series.tags)[0])}</span>`:""}${seriesAudioUrl(series)?"<span>Audio folder linked</span>":""}</div><div class="manager-card-actions"><button class="manager-add" type="button" data-manager-add="${esc(series.id)}">＋ Add book</button><button class="admin-secondary manager-open" type="button" data-manager-open="${esc(series.id)}">Manage series</button></div></div></article>`;
      }).join("");
    }

    function renderManagedVolumes(series){
      const volumes=arr(series.volumes);if($("#manageVolumeLabel"))$("#manageVolumeLabel").textContent=`${volumes.length} ${volumes.length===1?"volume":"volumes"}`;
      $("#manageVolumes").innerHTML=volumes.map((volume,index)=>`<article class="manage-volume" data-volume-index="${index}"><div class="manage-volume-summary"><div class="volume-number">${esc(volume.number??index+1)}</div><div class="volume-summary-copy"><strong>${esc(volume.title||`Volume ${index+1}`)}</strong><span>${[volume.date||"",fmtSize(volume.size)].filter(Boolean).join(" · ")||"No extra metadata"}</span></div><button class="volume-toggle" type="button" data-volume-toggle aria-label="Edit volume">Edit</button></div><div class="manage-volume-editor hidden"><div class="admin-grid"><label class="admin-field wide"><span>Volume title</span><input data-v-title type="text" value="${esc(volume.title||"")}"></label><label class="admin-field"><span>Volume number</span><input data-v-number type="number" min="0.01" step="0.01" value="${esc(volume.number??index+1)}"></label><label class="admin-field"><span>Date</span><input data-v-date type="text" value="${esc(volume.date||"")}" placeholder="YYYY-MM-DD"></label><label class="admin-field wide"><span>Publisher</span><input data-v-publisher type="text" value="${esc(volume.publisher||"")}"></label><label class="admin-field wide"><span>Description</span><textarea data-v-description rows="4">${esc(volume.description||"")}</textarea></label></div><div class="volume-actions"><button class="danger-button small-danger" type="button" data-volume-delete>Move to Trash</button><button class="admin-primary inline-button" type="button" data-volume-save>Save volume</button></div></div></article>`).join("");
    }

    function bannerLabel(choice){const number=String(choice?.number??"").trim();return`${number?`Volume ${number}`:"Volume"} — ${String(choice?.title||"Untitled")}`}
    function bannerState(message,kind=""){const node=$("#manageBannerState");if(!node)return;node.textContent=message;if(kind)node.dataset.kind=kind;else delete node.dataset.kind}
    function syncBannerPreview(){
      const select=$("#manageBanner"),image=$("#manageBannerPreview"),title=$("#manageBannerPreviewTitle");if(!select||!image||!title)return;
      const choice=select.value?bannerChoices.find(item=>item.bookId===select.value):bannerRandomChoice;title.textContent=choice?(select.value?bannerLabel(choice):`Random preview — ${bannerLabel(choice)}`):"Random banner";
      if(choice?.cover){image.src=choice.cover;image.classList.remove("hidden")}else{image.removeAttribute("src");image.classList.add("hidden")}
    }
    async function loadBannerChoices(id){
      const select=$("#manageBanner");if(!id||!select)return;const serial=++bannerSerial;select.disabled=true;select.innerHTML='<option value="">Loading volume covers…</option>';bannerState("Loading banner choices…","saving");
      try{
        const data=await client.request(`/admin-api/series-banner?id=${encodeURIComponent(id)}`);if(serial!==bannerSerial)return;bannerSeriesId=data.id||id;bannerChoices=arr(data.choices);const covered=bannerChoices.filter(choice=>choice.cover);const previewPool=covered.length?covered:bannerChoices;bannerRandomChoice=previewPool.length?previewPool[Math.floor(Math.random()*previewPool.length)]:null;select.replaceChildren();
        const defaultOption=document.createElement("option");defaultOption.value="";defaultOption.textContent="Random — any volume cover";select.append(defaultOption);
        for(const choice of bannerChoices){const option=document.createElement("option");option.value=choice.bookId;option.textContent=bannerLabel(choice);select.append(option)}
        select.value=bannerChoices.some(choice=>choice.bookId===data.current)?data.current:"";select.dataset.savedValue=select.value;select.disabled=!bannerChoices.length;syncBannerPreview();bannerState(bannerChoices.length?"Random is the default. A volume cover is chosen when the Series page opens; select a volume to pin it instead.":"This series has no volume cover available.");
      }catch(error){if(serial!==bannerSerial)return;select.disabled=true;select.innerHTML='<option value="">Banner choices unavailable</option>';bannerState(error.message,"error")}
    }
    async function saveBanner(){
      const select=$("#manageBanner");if(!bannerSeriesId||!select)return;const next=select.value,previous=select.dataset.savedValue||"";syncBannerPreview();select.disabled=true;bannerState("Saving banner selection…","saving");
      try{const data=await client.request("/admin-api/series-banner",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:bannerSeriesId,bannerBookId:next})});bannerSeriesId=data.id||bannerSeriesId;select.dataset.savedValue=next;bannerState(next?"Banner saved. This volume cover will stay pinned on the Series page.":"Random banner restored. A volume cover will be chosen when the Series page opens.","saved")}
      catch(error){select.value=previous;syncBannerPreview();bannerState(error.message,"error")}
      finally{select.disabled=!bannerChoices.length}
    }

    async function openSeriesEditor(id){
      const item=findManagedSeries(id);if(!item)return;state.activeSeriesId=id;const {series,scope}=item;
      $("#seriesEditorHeading").textContent=series.title||"Edit series";$("#manageTitle").value=series.title||"";$("#manageAuthor").value=series.author||"";$("#manageYear").value=series.year||"";$("#manageStatus").value=normalizeSeriesStatus(series.status);$("#manageGenres").value=arr(series.genres).join(", ");$("#manageTags").value=arr(series.tags).join(", ");$("#manageDescription").value=series.description||"";$("#manageAudioAlignedUrl").value=seriesAudioUrl(series);$("#manageAdult").checked=scope==="adult";
      const cover=series.cover||arr(series.volumes).find(volume=>volume.cover)?.cover||"";$("#managerCover").classList.toggle("hidden",!cover);$("#managerCoverFallback").classList.toggle("hidden",Boolean(cover));if(cover)$("#managerCover").src=cover;
      renderManagedVolumes(series);if(!dialog.open)dialog.showModal();bannerSeriesId=id;void loadBannerChoices(id);
    }

    async function saveSeries(){
      if(!state.activeSeriesId)return;const button=$("#saveSeries"),old=button.textContent,title=$("#manageTitle").value.trim()||"Series";button.disabled=true;button.textContent="Saving…";
      try{
        const translationPayload=keeper.workflows.get("translations")?.instance?.seriesPayload?.()||{};
        const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-series",id:state.activeSeriesId,title:$("#manageTitle").value,author:$("#manageAuthor").value,year:$("#manageYear").value,status:normalizeSeriesStatus($("#manageStatus").value),genres:$("#manageGenres").value.split(",").map(value=>value.trim()).filter(Boolean),tags:$("#manageTags").value.split(",").map(value=>value.trim()).filter(Boolean),description:$("#manageDescription").value,audioAlignedUrl:$("#manageAudioAlignedUrl").value.trim(),adult:$("#manageAdult").checked,...translationPayload})});
        updateManagement(result);const changed=result.changedId||state.activeSeriesId;state.activeSeriesId=null;bannerSeriesId=changed;dialog.close();keeper.ui.toast(`Saved “${title}”.`);
      }catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}
    }

    async function trashSeries(){
      const item=findManagedSeries(state.activeSeriesId);if(!item)return;const title=item.series.title||"Series";
      if(!confirm(`Move “${title}” to Trash?\n\nIt will disappear from the public library, but its EPUB and cover files remain recoverable until Trash is permanently purged.`))return;
      const button=$("#deleteSeries"),old=button.textContent;button.disabled=true;button.textContent="Moving…";
      try{const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-series",id:state.activeSeriesId})});updateManagement(result);state.activeSeriesId=null;dialog.close();keeper.ui.toast(`Moved “${title}” to Trash.`);keeper.events.dispatchEvent(new Event("trash:changed"))}
      catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}
    }

    async function saveVolume(card){
      const index=Number(card.dataset.volumeIndex);if(!findManagedSeries(state.activeSeriesId))return;const button=card.querySelector("[data-volume-save]"),old=button.textContent;button.disabled=true;button.textContent="Saving…";
      try{const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"update-volume",id:state.activeSeriesId,volumeIndex:index,title:card.querySelector("[data-v-title]").value,number:card.querySelector("[data-v-number]").value,date:card.querySelector("[data-v-date]").value,publisher:card.querySelector("[data-v-publisher]").value,description:card.querySelector("[data-v-description]").value})});updateManagement(result);openSeriesEditor(state.activeSeriesId)}
      catch(error){alert(error.message);button.textContent=old}finally{button.disabled=false}
    }

    async function trashVolume(card){
      const index=Number(card.dataset.volumeIndex),item=findManagedSeries(state.activeSeriesId),volume=arr(item?.series?.volumes)[index];if(!volume)return;
      if(!confirm(`Move “${volume.title}” to Trash?\n\nIt will disappear from the public library, but its EPUB and cover files remain recoverable until you purge Trash.`))return;
      const button=card.querySelector("[data-volume-delete]");button.disabled=true;button.textContent="Moving…";
      try{const result=await client.request("/admin-api/library",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete-volume",id:state.activeSeriesId,volumeIndex:index})});updateManagement(result);keeper.events.dispatchEvent(new Event("trash:changed"));const still=findManagedSeries(state.activeSeriesId);if(still)openSeriesEditor(state.activeSeriesId);else{dialog.close();state.activeSeriesId=null}}
      catch(error){alert(error.message);button.disabled=false;button.textContent="Move to Trash"}
    }

    $("#manageSearch")?.addEventListener("input",event=>{state.manageQuery=event.target.value;renderManagerList()});
    $(".manage-tabs")?.addEventListener("click",event=>{const button=event.target.closest("[data-manage-scope]");if(!button)return;state.manageScope=button.dataset.manageScope;$$('[data-manage-scope]').forEach(item=>item.classList.toggle("active",item===button));renderManagerList()});
    $("#refreshLibrary")?.addEventListener("click",()=>{state.management=null;void loadLibrary(true)});
    list.addEventListener("click",event=>{const open=event.target.closest("[data-manager-open]"),add=event.target.closest("[data-manager-add]");if(open)void openSeriesEditor(open.dataset.managerOpen);if(add)keeper.events.dispatchEvent(new CustomEvent("upload:open-for-series",{detail:{id:add.dataset.managerAdd}}))});
    $("#manageVolumes")?.addEventListener("click",event=>{const card=event.target.closest(".manage-volume");if(!card)return;if(event.target.closest("[data-volume-toggle]"))card.querySelector(".manage-volume-editor")?.classList.toggle("hidden");if(event.target.closest("[data-volume-save]"))void saveVolume(card);if(event.target.closest("[data-volume-delete]"))void trashVolume(card)});
    $("#saveSeries")?.addEventListener("click",()=>void saveSeries());$("#deleteSeries")?.addEventListener("click",()=>void trashSeries());$("#manageBanner")?.addEventListener("change",()=>void saveBanner());
    dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()});
    keeper.events.addEventListener("session:unlocked",()=>void loadLibrary());keeper.events.addEventListener("session:locked",()=>{state.management=null;list.innerHTML=""});keeper.events.addEventListener("upload:completed",()=>{state.management=null;void loadLibrary(true)});

    Object.assign(window,{managementSeries,findManagedSeries,updateManagement,loadLibrary,renderManagerList,renderManagedVolumes,openSeriesEditor});
    return{load:loadLibrary,refresh:()=>loadLibrary(true),findSeries:findManagedSeries,openSeries:openSeriesEditor};
  });
})();