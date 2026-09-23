/* Shadow Garden v2.1 — Garden Keeper fan-translation metadata workflow. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$,arr,esc}=keeper.util,{state}=keeper,client=keeper.client;

  keeper.registerWorkflow("translations",()=>{
    const dialog=$("#seriesEditor"),volumeRoot=$("#manageVolumes");
    if(!dialog||!volumeRoot)return{};
    const statuses=["","Complete","Ongoing","Stalled","Partial"];

    function managementSeries(){
      if(!state.management)return[];
      return[...arr(state.management.main),...arr(state.management.adult)];
    }
    const currentSeries=()=>managementSeries().find(series=>series.id===state.activeSeriesId)||null;

    function creditRow(credit={}){
      return `<div class="keeper-translation-row" data-translation-row>
        <label class="wide"><span>Translator</span><input data-t-name type="text" value="${esc(credit.name||"")}" placeholder="Translator name"></label>
        <label class="wide"><span>Source URL</span><input data-t-url type="url" inputmode="url" value="${esc(credit.url||"")}" placeholder="https://translator.example/"></label>
        <label class="wide"><span>Coverage</span><input data-t-coverage type="text" value="${esc(credit.coverage||"")}" placeholder="e.g. Chapters 1–627 or Volumes 1–4"></label>
        <button class="translation-remove" data-translation-remove type="button" aria-label="Remove translation credit">×</button>
      </div>`;
    }

    function serialize(root){
      return[...(root?.querySelectorAll("[data-translation-row]")||[])].map(row=>({
        name:row.querySelector("[data-t-name]")?.value.trim()||"",
        url:row.querySelector("[data-t-url]")?.value.trim()||"",
        coverage:row.querySelector("[data-t-coverage]")?.value.trim()||""
      })).filter(item=>item.name);
    }

    function installSeriesEditor(){
      if($("#manageTranslationSection"))return;
      const volumeHead=$("#manageVolumeLabel")?.closest(".dialog-section-head");
      if(!volumeHead)return;
      const section=document.createElement("section");
      section.id="manageTranslationSection";
      section.className="keeper-translation-section";
      section.innerHTML=`<div class="keeper-translation-head">
        <div><span>FAN TRANSLATION</span><h3>Translation provenance</h3></div>
        <label><span>Translation status</span><select id="manageTranslationStatus">${statuses.map(value=>`<option value="${value}">${value||"Not set"}</option>`).join("")}</select></label>
      </div>
      <p class="field-note">Credit fan translators and record chapter/volume coverage. Multiple rows support hand-offs between translators. Changes are saved with <strong>Save series</strong>.</p>
      <div id="manageTranslations" class="keeper-translation-list"></div>
      <div class="keeper-translation-actions"><button id="addTranslationCredit" class="admin-secondary" type="button">＋ Add translator</button></div>`;
      volumeHead.before(section);
    }
    installSeriesEditor();

    function renderSeriesCredits(){
      const series=currentSeries();if(!series)return;
      $("#manageTranslationStatus").value=series.translationStatus||"";
      const list=$("#manageTranslations");
      list.innerHTML=arr(series.translations).map(creditRow).join("")||creditRow();
    }

    function installVolumeEditor(series,card,index){
      const editor=card.querySelector(".manage-volume-editor");
      if(!editor||editor.querySelector("[data-volume-translation-editor]"))return;
      const own=arr(series.volumes?.[index]?.translations);
      const block=document.createElement("section");
      block.className="volume-translation-editor";
      block.dataset.volumeTranslationEditor="1";
      block.innerHTML=`<div class="volume-translation-head"><div><strong>Translation override</strong><small>Leave empty to inherit the series credits.</small></div></div>
        <div class="keeper-translation-list" data-volume-translations>${own.map(creditRow).join("")}</div>
        <div class="keeper-translation-actions"><button class="admin-secondary" data-add-volume-translation type="button">＋ Add override</button><button class="admin-secondary" data-save-volume-translation type="button">Save translation override</button></div>`;
      editor.querySelector(".volume-actions")?.before(block);
    }

    function renderVolumeEditors(){
      const series=currentSeries();if(!series)return;
      [...volumeRoot.querySelectorAll(".manage-volume")].forEach(card=>installVolumeEditor(series,card,Number(card.dataset.volumeIndex)));
    }

    function sync(){if(!dialog.open)return;renderSeriesCredits();renderVolumeEditors()}
    new MutationObserver(()=>queueMicrotask(sync)).observe(dialog,{attributes:true,attributeFilter:["open"]});
    new MutationObserver(()=>{if(dialog.open)queueMicrotask(renderVolumeEditors)}).observe(volumeRoot,{childList:true});

    $("#addTranslationCredit")?.addEventListener("click",()=>$("#manageTranslations").insertAdjacentHTML("beforeend",creditRow()));
    dialog.addEventListener("click",event=>{
      const remove=event.target.closest("[data-translation-remove]");
      if(remove){remove.closest("[data-translation-row]")?.remove();return}
      const add=event.target.closest("[data-add-volume-translation]");
      if(add)add.closest("[data-volume-translation-editor]")?.querySelector("[data-volume-translations]")?.insertAdjacentHTML("beforeend",creditRow());
    });

    function seriesPayload(){
      return{translationStatus:$("#manageTranslationStatus")?.value||"",translations:serialize($("#manageTranslations"))};
    }

    volumeRoot.addEventListener("click",async event=>{
      const button=event.target.closest("[data-save-volume-translation]");if(!button)return;
      const card=button.closest(".manage-volume"),series=currentSeries();if(!card||!series)return;
      const index=Number(card.dataset.volumeIndex),old=button.textContent;button.disabled=true;button.textContent="Saving…";
      try{
        await client.request("/admin-api/translations",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:series.id,target:"volume",volumeIndex:index,translations:serialize(card.querySelector("[data-volume-translations]"))})});
        keeper.ui.toast(`Volume ${series.volumes?.[index]?.number??index+1} translation override saved.`);keeper.events.dispatchEvent(new Event("library:invalidate"));
      }catch(error){alert(error.message)}finally{button.disabled=false;button.textContent=old}
    });

    keeper.events.addEventListener("library:changed",()=>{if(dialog.open)queueMicrotask(sync)});
    return{sync,seriesPayload};
  });
})();
