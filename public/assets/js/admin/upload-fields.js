/* Shadow Garden R5 — fields required by the Upload workflow before its engine initializes. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {$}=keeper.util;
  const description=$("#descriptionInput")?.closest("label");
  if(description&&!$("#translationStatusInput")){
    const fields=[
      ["translationStatusInput","Translation status","select"],
      ["translatorNameInput","Fan translator","text"],
      ["translatorUrlInput","Translator source URL","url"],
      ["translatorCoverageInput","Translation coverage","text"]
    ];
    for(const [id,label,type] of fields){const field=document.createElement("label");field.className="admin-field"+(id==="translationStatusInput"?"":" wide");if(type==="select")field.innerHTML=`<span>${label}</span><select id="${id}"><option value="">Not set</option><option>Complete</option><option>Ongoing</option><option>Stalled</option><option>Partial</option></select>`;else{const placeholder=id==="translatorCoverageInput"?"Chapters 1–627 or Volumes 1–4":id==="translatorUrlInput"?"https://translator.example/":"Optional";field.innerHTML=`<span>${label}</span><input id="${id}" type="${type}" ${type==="url"?'inputmode="url"':""} placeholder="${placeholder}">`}description.before(field)}
  }
  if(description&&!$("#audioAlignedInput")){
    const field=document.createElement("label");field.className="admin-field wide";
    field.innerHTML='<span>Audio-aligned EPUB folder URL (series, optional)</span><input id="audioAlignedInput" type="url" inputmode="url" placeholder="https://example.com/series-audio-epubs/">';
    description.before(field);
  }
})();
