/* Shadow Garden v1.0.4 batch editor selector. */
(()=>{
  const card=document.querySelector("#metadataCard");
  const list=document.querySelector("#batchList");
  const q=state?.batch;
  if(!card||!list||!q)return;

  const head=card.querySelector(".admin-card-head");
  if(!head)return;

  const picker=document.createElement("label");
  picker.id="batchEditorPicker";
  picker.className="admin-field batch-editor-picker hidden";
  picker.innerHTML='<span>Editing EPUB</span><select id="batchEditorSelect" aria-label="Choose EPUB to edit"></select><small id="batchEditorNote" class="batch-editor-note">Choose a queued EPUB to load its metadata, cover, and preflight report below.</small>';
  head.insertAdjacentElement("afterend",picker);

  const select=picker.querySelector("#batchEditorSelect");
  const note=picker.querySelector("#batchEditorNote");

  function itemLabel(item,index){
    const prefix=String(index+1).padStart(2,"0");
    if(item.status==="checking")return`${prefix} · Checking… · ${item.file?.name||"EPUB"}`;
    if(item.status==="failed"&&!item.metaReady)return`${prefix} · Failed · ${item.file?.name||"EPUB"}`;
    const title=item.title||item.file?.name||"Untitled EPUB";
    const volume=Number.isFinite(Number(item.number))&&Number(item.number)>0?` · Vol ${item.number}`:"";
    const status=item.status==="done"?" · Uploaded":"";
    return`${prefix} · ${title}${volume}${status}`;
  }

  function sync(){
    const items=Array.isArray(q.items)?q.items:[];
    picker.classList.toggle("hidden",items.length<2);
    if(items.length<2)return;

    const active=q.activeId||"";
    select.innerHTML=items.map((item,index)=>{
      const disabled=!item.metaReady?" disabled":"";
      const selected=item.id===active?" selected":"";
      return`<option value="${item.id}"${disabled}${selected}>${itemLabel(item,index).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</option>`;
    }).join("");

    if(active&&items.some(item=>item.id===active&&item.metaReady))select.value=active;
    const ready=items.filter(item=>item.metaReady).length;
    const waiting=items.length-ready;
    note.textContent=waiting
      ?`${ready} editable · ${waiting} still checking. Switching EPUBs saves the current edits first.`
      :`${ready} EPUBs ready to edit. Switching EPUBs saves the current edits first.`;
    select.disabled=ready===0;
  }

  select.addEventListener("change",()=>{
    const id=select.value;
    if(!id||id===q.activeId)return;
    const button=list.querySelector(`[data-batch-edit="${CSS.escape(id)}"]`);
    if(button&&!button.disabled)button.click();
    else sync();
  });

  new MutationObserver(()=>queueMicrotask(sync)).observe(list,{
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:["class","disabled","data-status"]
  });
  sync();
})();
