/* Shadow Garden v1.0.3 batch uploader + duplicate/replace handling. */
(()=>{
  const MAX_BYTES=50*1024*1024;
  const KNOWN_FONT_OBFUSCATION=new Set(["http://www.idpf.org/2008/embedding","http://ns.adobe.com/pdf/enc#RC"]);
  const readableTypes=new Set(["application/xhtml+xml","text/html","image/svg+xml"]);
  const inputIds=["seriesInput","volumeInput","yearInput","titleInput","authorInput","genresInput","tagsInput","descriptionInput","adultInput","audioAlignedInput","translationStatusInput","translatorNameInput","translatorUrlInput","translatorCoverageInput"];
  const q={items:[],activeId:null,library:null,running:false,editorSync:false,objectUrl:""};
  const taxonomyPromise=import("/assets/js/domain/catalog-taxonomy.js?v=2.11.0");

  state.batch=q;

  const fileInput=$("#epubFile");
  if(!fileInput)return;
  fileInput.multiple=true;
  fileInput.setAttribute("aria-label","Choose one or more EPUB files");
  $("#filePickerTitle").textContent="Choose EPUBs from phone";
  $("#filePickerMeta").textContent="Select one or many EPUBs · 50 MB maximum per file";

  const pickerCard=fileInput.closest(".admin-card");
  const panel=document.createElement("section");
  panel.id="batchPanel";
  panel.className="batch-panel hidden";
  panel.innerHTML=`<div class="batch-head"><div><strong>Batch queue</strong><small>Preflight runs locally, one book at a time.</small></div><span id="batchSummary" class="batch-summary"></span></div>
    <div class="batch-toolbar"><button id="batchAddMore" type="button">＋ Add more EPUBs</button><button id="batchClear" type="button">Clear queue</button></div>
    <div id="batchList" class="batch-list"></div>
    <p class="batch-note">Duplicates are never replaced automatically. Choose Replace or Add separate for each detected duplicate.</p>`;
  pickerCard?.appendChild(panel);

  /* Keep one stable picker node. Older uploader layers attached bubble-phase listeners to this
   * node before the batch controller loaded; the capture listener installed below owns selection
   * first and stops those obsolete single-file handlers without cloning the input again. */
  const replacement=fileInput;

  const oldUpload=$("#uploadButton");
  const batchUpload=oldUpload.cloneNode(true);
  oldUpload.replaceWith(batchUpload);

  function safeDecode(v){try{return decodeURIComponent(String(v||""))}catch{return String(v||"")}}
  function normalizeText(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
  function fileBase(v){return safeDecode(String(v||"").split("?")[0]).split("/").pop()?.toLowerCase()||""}
  function mediaKey(v){
    const text=String(v||"");
    if(!text.startsWith("/media/shadow-garden/books/"))return"";
    return safeDecode(text.slice("/media/".length));
  }
  function hex(buffer){return[...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,"0")).join("")}
  function uid(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
  function localElements(root,name){return root?[...root.getElementsByTagName("*")].filter(el=>el.localName===name):[]}
  function xml(text){return new DOMParser().parseFromString(String(text||""),"application/xml")}
  function broken(doc){return Boolean(doc?.querySelector?.("parsererror"))}
  function zipText(zip,path){const entry=zip.file(path);return entry?entry.async("string"):Promise.resolve(null)}
  function report(){
    return{status:"pass",fatal:[],warnings:[],checks:{container:"pending",package:"pending",spine:"pending",navigation:"pending",cover:"pending",security:"pending"},stats:{manifest:0,spine:0,brokenRefs:0,mediaOverlays:0}};
  }
  function addIssue(r,severity,message,detail=""){
    const list=severity==="fatal"?r.fatal:r.warnings;
    if(!list.some(x=>x.message===message&&x.detail===detail))list.push({message,detail});
  }
  function finish(r){r.status=r.fatal.length?"fail":r.warnings.length?"warning":"pass";return r}
  function failed(message,detail=""){const r=report();addIssue(r,"fatal",message,detail);r.checks.container="fail";r.checks.package="fail";return finish(r)}
  function resolveLocal(base,reference){
    const raw=String(reference||"").trim();
    if(!raw||raw.startsWith("#")||/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(raw))return{skip:true,path:""};
    const clean=safeDecode(raw).split("#")[0].split("?")[0];
    const stack=clean.startsWith("/")?[]:String(base||"").split("/").filter(Boolean);
    for(const part of clean.replace(/^\/+/,"").split("/")){
      if(!part||part===".")continue;
      if(part===".."){if(!stack.length)return{invalid:true,path:""};stack.pop()}else stack.push(part);
    }
    return{skip:false,invalid:false,path:stack.join("/")};
  }
  function collectRefs(doc){
    const refs=[];
    for(const [selector,attr] of [["a[href]","href"],["img[src]","src"],["link[href]","href"],["source[src]","src"],["audio[src]","src"],["video[src]","src"],["object[data]","data"]]){
      for(const el of doc.querySelectorAll?.(selector)||[]){const value=el.getAttribute(attr);if(value)refs.push(value)}
    }
    return refs;
  }

  function epubTranslatorNames(opf){
    const refinedRoles=new Map();
    for(const meta of localElements(opf,"meta")){
      if(normalizeText(meta.getAttribute("property"))!=="role")continue;
      const refines=String(meta.getAttribute("refines")||"").trim();
      if(refines.startsWith("#"))refinedRoles.set(refines.slice(1),normalizeText(meta.textContent));
    }
    const translatorRole=value=>{
      const role=normalizeText(value);if(!role)return false;
      const tail=role.split(/[:\/#]/).filter(Boolean).pop()||"";
      return role==="trl"||role==="translator"||tail==="trl"||tail==="translator";
    };
    const names=[],seen=new Set();
    for(const node of localElements(opf,"contributor")){
      const id=node.getAttribute("id")||"";
      const nsRole=typeof node.getAttributeNS==="function"?node.getAttributeNS("http://www.idpf.org/2007/opf","role"):"";
      const role=node.getAttribute("role")||node.getAttribute("opf:role")||nsRole||refinedRoles.get(id)||"";
      if(!translatorRole(role))continue;
      const name=String(node.textContent||"").trim();if(!name)continue;
      const key=normalizeText(name);if(seen.has(key))continue;seen.add(key);names.push(name);
    }
    return names;
  }
  async function inspect(file){
    if(file.size>MAX_BYTES)return{file,validation:failed("File exceeds the 50 MB mobile upload limit",fmtSize(file.size))};
    const bytes=await file.arrayBuffer();
    const digestPromise=crypto.subtle.digest("SHA-256",bytes);
    let zip;
    try{zip=await JSZip.loadAsync(bytes)}catch{return{file,validation:failed("This file is not a readable EPUB/ZIP archive.")}}
    const r=report();

    const mimetype=await zipText(zip,"mimetype");
    if(mimetype===null)addIssue(r,"warning","Missing EPUB mimetype file");
    else if(mimetype.trim()!=="application/epub+zip")addIssue(r,"warning","Unexpected EPUB mimetype",mimetype.trim());

    const containerText=await zipText(zip,"META-INF/container.xml");
    if(containerText===null)return{file,validation:failed("This EPUB is missing META-INF/container.xml.")};
    const container=xml(containerText);
    if(broken(container))return{file,validation:failed("META-INF/container.xml is malformed.")};
    const rootfile=localElements(container,"rootfile")[0]?.getAttribute("full-path")||"";
    if(!rootfile)return{file,validation:failed("The EPUB container does not identify a package document.")};
    r.checks.container="pass";

    const opfText=await zipText(zip,rootfile);
    if(opfText===null)return{file,validation:failed("The package document referenced by container.xml is missing.")};
    const opf=xml(opfText);
    if(broken(opf))return{file,validation:failed("The EPUB package document is malformed XML.")};
    r.checks.package="pass";
    const opfDir=dirName(rootfile);

    const title=firstText(opf,"title")||file.name.replace(/\.epub$/i,"");
    const author=firstText(opf,"creator"),date=firstText(opf,"date"),language=firstText(opf,"language"),publisher=firstText(opf,"publisher");
    const translatorNames=epubTranslatorNames(opf);
    const description=cleanHtml(firstText(opf,"description")),rawSubjects=[...new Set(texts(opf,"subject"))];
    const taxonomy=await taxonomyPromise,classifiedSubjects=taxonomy.classifySubjects(rawSubjects),genres=classifiedSubjects.genres,tags=classifiedSubjects.tags;
    const series=metaByName(opf,"calibre:series")||metaByProperty(opf,"belongs-to-collection")||inferSeries(title);
    const number=detectVolume(title,file.name,opf);
    if(!firstText(opf,"title"))addIssue(r,"warning","Missing title metadata","The filename will be used.");
    if(!language)addIssue(r,"warning","Missing language metadata");

    const manifestNodes=localElements(opf,"item"),manifestById=new Map(),manifest=[];
    r.stats.manifest=manifestNodes.length;
    for(const node of manifestNodes){
      const id=node.getAttribute("id")||"",href=node.getAttribute("href")||"",resolved=resolveLocal(opfDir,href);
      const item={id,href,path:resolved.path,invalid:resolved.invalid,external:resolved.skip&&/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href),mediaType:node.getAttribute("media-type")||"",properties:String(node.getAttribute("properties")||"").split(/\s+/).filter(Boolean),overlay:node.getAttribute("media-overlay")||""};
      manifest.push(item);
      if(!id)addIssue(r,"warning","Manifest item without an id",href);
      else if(manifestById.has(id))addIssue(r,"fatal","Duplicate manifest id",id);
      else manifestById.set(id,item);
      if(item.invalid)addIssue(r,"warning","Manifest path escapes the EPUB root",href);
      else if(!item.external&&item.path&&!zip.file(item.path)){addIssue(r,"warning","Manifest resource is missing",href);r.stats.brokenRefs++}
    }

    const spineNode=localElements(opf,"spine")[0],spineRefs=spineNode?localElements(spineNode,"itemref"):[];
    r.stats.spine=spineRefs.length;
    const spineItems=[];
    if(!spineRefs.length)addIssue(r,"fatal","No readable spine was found");
    for(const ref of spineRefs){
      const idref=ref.getAttribute("idref")||"",item=manifestById.get(idref);
      if(!idref){addIssue(r,"fatal","Spine entry is missing idref");continue}
      if(!item){addIssue(r,"fatal","Spine references an unknown manifest id",idref);continue}
      if(item.invalid||item.external||!item.path||!zip.file(item.path)){addIssue(r,"fatal","Spine document is missing or invalid",item.href||idref);r.stats.brokenRefs++;continue}
      if(readableTypes.has(item.mediaType)||/\.(?:xhtml?|html?|svg)$/i.test(item.path))spineItems.push(item);
      else addIssue(r,"warning","Unusual spine media type",`${item.href} (${item.mediaType||"unknown"})`);
    }
    if(!spineItems.length)addIssue(r,"fatal","The spine contains no HTML/XHTML/SVG documents");
    let parseable=0;
    for(const item of spineItems){
      const text=await zipText(zip,item.path);if(text===null)continue;
      let doc=xml(text);
      if(broken(doc)){addIssue(r,"warning","Malformed XHTML in spine",item.href);doc=new DOMParser().parseFromString(text,"text/html")}else parseable++;
      for(const href of collectRefs(doc)){
        const resolved=resolveLocal(dirName(item.path),href);
        if(resolved.invalid||(!resolved.skip&&resolved.path&&!zip.file(resolved.path))){addIssue(r,"warning","Broken internal resource reference",`${item.href} → ${href}`);r.stats.brokenRefs++}
      }
    }
    if(spineItems.length&&!parseable)addIssue(r,"fatal","None of the spine documents parsed as valid XHTML/XML");
    r.checks.spine=r.fatal.some(x=>/spine|readable|parsed/i.test(x.message))?"fail":"pass";

    const nav=manifest.filter(x=>x.properties.includes("nav"));
    const tocId=spineNode?.getAttribute("toc")||"",ncx=(tocId&&manifestById.get(tocId))||manifest.find(x=>x.mediaType==="application/x-dtbncx+xml");
    if(!nav.length&&!ncx){r.checks.navigation="warn";addIssue(r,"warning","No EPUB navigation document was found")}else r.checks.navigation="pass";

    let coverItem=manifest.find(x=>x.properties.includes("cover-image"));
    if(!coverItem){const coverId=metaByName(opf,"cover");if(coverId)coverItem=manifestById.get(coverId)}
    let coverBlob=null,coverExt=".jpg";
    if(!coverItem){r.checks.cover="warn";addIssue(r,"warning","No cover image is declared")}
    else if(coverItem.invalid||coverItem.external||!coverItem.path||!zip.file(coverItem.path)){r.checks.cover="warn";addIssue(r,"warning","Declared cover image is unavailable",coverItem.href||coverItem.id)}
    else{
      r.checks.cover="pass";coverExt=mimeExt(coverItem.mediaType,coverItem.href);
      const data=await zip.file(coverItem.path).async("arraybuffer");
      coverBlob=new Blob([data],{type:coverItem.mediaType||mimeForExt(coverExt)});
    }

    const encryptionText=await zipText(zip,"META-INF/encryption.xml");
    if(encryptionText!==null){
      const enc=xml(encryptionText);
      if(broken(enc))addIssue(r,"warning","Malformed encryption metadata");
      else{
        const algorithms=localElements(enc,"EncryptionMethod").map(n=>n.getAttribute("Algorithm")||"").filter(Boolean);
        const unknown=algorithms.filter(a=>!KNOWN_FONT_OBFUSCATION.has(a));
        if(algorithms.some(a=>KNOWN_FONT_OBFUSCATION.has(a)))addIssue(r,"warning","Obfuscated embedded fonts detected");
        if(unknown.length)addIssue(r,"fatal","Encrypted or DRM-protected resources detected",unknown.slice(0,3).join(", "));
      }
    }
    r.checks.security=r.fatal.some(x=>/DRM|Encrypted/i.test(x.message))?"fail":"pass";

    const smils=manifest.filter(x=>x.mediaType==="application/smil+xml"||/\.smil$/i.test(x.path));
    r.stats.mediaOverlays=smils.length;
    for(const item of manifest.filter(x=>x.overlay))if(!manifestById.has(item.overlay))addIssue(r,"warning","Media-overlay reference is missing",`${item.href} → ${item.overlay}`);

    const sha256=hex(await digestPromise);
    return{file,title,author,date,year:parseInt(date.slice(0,4))||"",language,publisher,description,genres,tags,rawSubjects,series,number,coverBlob,coverExt,sha256,translations:translatorNames.slice(0,1).map(name=>({name})),validation:finish(r)};
  }

  function seriesEntries(){return[
    ...arr(q.library?.main).map(series=>({series,scope:"main"})),
    ...arr(q.library?.adult).map(series=>({series,scope:"adult"}))
  ]}

  function duplicateFor(item){
    const sidBase=slug(item.series);
    const desiredScope=item.adult?"adult":"main";
    let best=null,score=0;
    for(const {series,scope} of seriesEntries()){
      const sameSeries=slug(series.title||series.id?.replace(/^adult-/,""))===sidBase||series.id===`${scope==="adult"?"adult-":""}${sidBase}`;
      for(const volume of arr(series.volumes)){
        let s=0,reasons=[];
        if(item.sha256&&volume.sha256&&item.sha256===volume.sha256){s+=100;reasons.push("same file hash")}
        if(volume.originalFilename&&normalizeText(volume.originalFilename)===normalizeText(item.file.name)){s+=45;reasons.push("same filename")}
        if(sameSeries&&Number(volume.number)===Number(item.number)){s+=70;reasons.push(`same volume ${item.number}`)}
        if(sameSeries&&normalizeText(volume.title)===normalizeText(item.title)){s+=55;reasons.push("same title")}
        if(scope!==desiredScope&&s<100)s=Math.max(0,s-35);
        if(s>score&&s>=55){score=s;best={series,volume,scope,reasons:[...new Set(reasons)],score}}
      }
    }
    return best;
  }

  function batchDuplicateFor(item){
    for(const other of q.items){
      if(other===item||!other.metaReady)continue;
      if(item.sha256&&other.sha256===item.sha256)return{batch:true,item:other,reasons:["same file hash in this batch"]};
      if(slug(other.series)===slug(item.series)&&Number(other.number)===Number(item.number))return{batch:true,item:other,reasons:[`same series and volume ${item.number} in this batch`]};
    }
    return null;
  }

  function evaluateDuplicate(item){
    const remote=duplicateFor(item),batch=remote?null:batchDuplicateFor(item);
    item.duplicate=remote||batch;
    if(item.duplicate&&!["replace","separate","skip"].includes(item.action))item.action="skip";
    if(item.duplicate&&item.action==="new")item.action="skip";
    if(!item.duplicate&&item.action==="skip"&&!item.userChoseSkip)item.action="new";
    if(!item.duplicate&&item.action==="replace")item.action="new";
  }

  function itemMetaLine(item){
    if(item.status==="checking")return"Running local preflight…";
    if(item.status==="queued")return`${item.series||"Unknown series"} · Volume ${item.number||"?"}`;
    if(item.status==="uploading")return item.progressLabel||"Uploading…";
    if(item.status==="done")return"Uploaded successfully";
    if(item.status==="failed")return item.error||"Upload failed";
    return item.file.name;
  }

  function badge(item){
    const status=item.validation?.status;
    if(item.status==="checking")return'<span class="batch-badge uploading">CHECKING</span>';
    if(item.status==="done")return'<span class="batch-badge pass">UPLOADED</span>';
    if(item.status==="failed"||status==="fail")return'<span class="batch-badge fail">FAILED</span>';
    if(status==="warning")return'<span class="batch-badge warning">WARNING</span>';
    if(status==="pass")return'<span class="batch-badge pass">PASSED</span>';
    return'<span class="batch-badge">WAITING</span>';
  }

  function duplicateText(item){
    const d=item.duplicate;if(!d)return"";
    if(d.batch)return d.reasons.join(" · ");
    return`${d.series.title} · ${d.volume.title||`Volume ${d.volume.number}`} · ${d.scope==="adult"?"18+":"Main"} · ${d.reasons.join(", ")}`;
  }

  function renderQueue(){
    panel.classList.toggle("hidden",!q.items.length);
    const ready=q.items.filter(i=>i.metaReady&&i.validation?.status!=="fail"&&i.action!=="skip"&&i.status!=="done").length;
    const failedCount=q.items.filter(i=>i.validation?.status==="fail"||i.status==="failed").length;
    const dupes=q.items.filter(i=>i.duplicate).length;
    $("#batchSummary").textContent=`${q.items.length} selected · ${ready} upload · ${dupes} duplicate${dupes===1?"":"s"}${failedCount?` · ${failedCount} failed`:""}`;
    $("#batchList").innerHTML=q.items.map(item=>{
      const d=item.duplicate,active=item.id===q.activeId;
      const choices=d
        ? d.batch
          ? `<option value="skip"${item.action==="skip"?" selected":""}>Skip</option><option value="separate"${item.action==="separate"?" selected":""}>Add separate</option>`
          : `<option value="skip"${item.action==="skip"?" selected":""}>Skip</option><option value="replace"${item.action==="replace"?" selected":""}>Replace existing</option><option value="separate"${item.action==="separate"?" selected":""}>Add separate</option>`
        : `<option value="new"${item.action==="new"?" selected":""}>Upload</option><option value="skip"${item.action==="skip"?" selected":""}>Skip</option>`;
      return `<article class="batch-item ${active?"active":""} ${item.validation?.status==="fail"||item.status==="failed"?"failed":""} ${item.status==="done"?"done":""}" data-batch-id="${item.id}" data-action="${item.action}" data-status="${item.status}" style="--batch-progress:${item.progress||0}%">
        <div class="batch-row"><div class="batch-copy"><strong>${esc(item.title||item.file.name)}</strong><span>${esc(itemMetaLine(item))}</span><div class="batch-badges">${badge(item)}${d?'<span class="batch-badge duplicate">DUPLICATE</span>':""}<span class="batch-badge">${fmtSize(item.file.size)}</span></div></div>
        <div class="batch-actions"><button class="batch-edit" type="button" data-batch-edit="${item.id}" ${item.metaReady?"":"disabled"}>${active?"Editing":"Edit"}</button></div></div>
        <div class="batch-duplicate ${item.metaReady?"":"hidden"}"><label>${d?"Duplicate action":"Queue action"}<select data-batch-action="${item.id}" ${item.status==="done"?"disabled":""}>${choices}</select></label>${d?`<p>${esc(duplicateText(item))}</p>`:""}</div>
        <div class="batch-progress"><i></i></div></article>`;
    }).join("");
    refreshUploadButton();
  }

  function refreshUploadButton(){
    if(q.running){batchUpload.disabled=true;return}
    const actionable=q.items.filter(i=>i.metaReady&&i.validation?.status!=="fail"&&i.action!=="skip"&&i.status!=="done");
    batchUpload.disabled=!actionable.length;
    batchUpload.textContent=actionable.length?`Upload ${actionable.length} ${actionable.length===1?"Book":"Books"}`:"Nothing to upload";
    $("#uploadCard")?.classList.toggle("hidden",!q.items.length);
    if(q.items.length)setUploadState(actionable.length?"READY":"WAITING",actionable.length?"ready":"");
  }

  function saveEditor(){
    if(q.editorSync)return;
    const item=q.items.find(x=>x.id===q.activeId);if(!item||!item.metaReady)return;
    item.series=$("#seriesInput").value.trim();
    item.number=Number($("#volumeInput").value);
    item.year=Number($("#yearInput").value)||"";
    item.title=$("#titleInput").value.trim();
    item.author=$("#authorInput").value.trim();
    item.genres=$("#genresInput").value.split(",").map(x=>x.trim()).filter(Boolean);
    item.tags=$("#tagsInput").value.split(",").map(x=>x.trim()).filter(Boolean);
    item.description=$("#descriptionInput").value.trim();
    item.adult=$("#adultInput").checked;
    item.audioAlignedUrl=$("#audioAlignedInput")?.value.trim()||"";
    item.translationStatus=$("#translationStatusInput")?.value||"";
    const translation={name:$("#translatorNameInput")?.value.trim()||"",url:$("#translatorUrlInput")?.value.trim()||"",coverage:$("#translatorCoverageInput")?.value.trim()||""};item.translations=translation.name?[translation]:[];
    evaluateDuplicate(item);
    renderQueue();
  }

  function renderActivePreflight(item){
    const card=$("#preflightCard");if(!card)return;
    const r=item.validation||failed("Preflight unavailable");
    card.classList.remove("hidden");card.dataset.status=r.status;
    const copy=r.status==="fail"?["FAILED","error","Upload blocked",`${r.fatal.length} blocking issue${r.fatal.length===1?"":"s"} found.`]:r.status==="warning"?["WARNING","warning","Readable with warnings",`${r.warnings.length} warning${r.warnings.length===1?"":"s"} found. Upload is allowed.`]:["PASSED","ready","Ready for the Garden","The EPUB passed the reader-focused structural checks."];
    $("#preflightState").textContent=copy[0];$("#preflightState").className=`state-pill ${copy[1]}`;$("#preflightTitle").textContent=copy[2];$("#preflightSummary").textContent=copy[3];
    const checks=[["container","Container"],["package","Package"],["spine","Spine"],["navigation","Navigation"],["cover","Cover"],["security","Security"]];
    const icon=v=>v==="pass"?"✓":v==="fail"?"×":v==="warn"?"△":"·";
    $("#preflightChecks").innerHTML=checks.map(([k,l])=>`<span class="preflight-check ${r.checks[k]||"pending"}"><b>${icon(r.checks[k])}</b>${l}</span>`).join("");
    $("#preflightStats").innerHTML=`<span><strong>${r.stats.spine||0}</strong> spine</span><span><strong>${r.stats.manifest||0}</strong> resources</span><span><strong>${r.stats.brokenRefs||0}</strong> broken refs</span>${r.stats.mediaOverlays?`<span><strong>${r.stats.mediaOverlays}</strong> SMIL</span>`:""}`;
    const issues=[...r.fatal.map(x=>({...x,severity:"fatal"})),...r.warnings.map(x=>({...x,severity:"warning"}))],list=$("#preflightIssues");
    $("#preflightDetailsSummary").textContent=issues.length?`Validation details · ${issues.length}`:"Validation details · clean";
    list.innerHTML=issues.length?issues.slice(0,80).map(x=>`<li class="${x.severity}"><span>${x.severity==="fatal"?"×":"△"}</span><div><strong>${esc(x.message)}</strong>${x.detail?`<small>${esc(x.detail)}</small>`:""}</div></li>`).join(""):'<li class="clean"><span>✓</span><div><strong>No blocking issues or warnings found.</strong></div></li>';
    $("#preflightDetails").open=r.status!=="pass";
  }

  function selectItem(id){
    saveEditor();
    const item=q.items.find(x=>x.id===id);if(!item||!item.metaReady)return;
    q.activeId=id;q.editorSync=true;
    $("#seriesInput").value=item.series;$("#volumeInput").value=item.number;$("#yearInput").value=item.year;$("#titleInput").value=item.title;$("#authorInput").value=item.author;
    $("#genresInput").value=(item.genres||[]).join(", ");$("#tagsInput").value=item.tags.join(", ");$("#descriptionInput").value=item.description;$("#adultInput").checked=item.adult;
    if($("#audioAlignedInput"))$("#audioAlignedInput").value=item.audioAlignedUrl||"";
    if($("#translationStatusInput"))$("#translationStatusInput").value=item.translationStatus||"";
    const translation=item.translations?.[0]||{};if($("#translatorNameInput"))$("#translatorNameInput").value=translation.name||"";if($("#translatorUrlInput"))$("#translatorUrlInput").value=translation.url||"";if($("#translatorCoverageInput"))$("#translatorCoverageInput").value=translation.coverage||"";
    $("#previewTitle").textContent=item.title;$("#previewSeries").textContent=`${item.series} · Volume ${item.number}`;
    if(q.objectUrl){URL.revokeObjectURL(q.objectUrl);q.objectUrl=""}
    if(item.coverBlob){q.objectUrl=URL.createObjectURL(item.coverBlob);$("#coverPreview").src=q.objectUrl;$("#coverPreview").classList.remove("hidden");$("#coverFallback").classList.add("hidden")}
    else{$("#coverPreview").classList.add("hidden");$("#coverFallback").classList.remove("hidden")}
    $("#metadataCard").classList.remove("hidden");renderActivePreflight(item);
    q.editorSync=false;renderQueue();
  }

  async function ensureLibrary(){
    if(q.library)return;
    try{
      const data=await api("/admin-api/library",{method:"GET"});
      q.library={main:arr(data.main),adult:arr(data.adult)};
      state.management=data;
    }catch(error){
      console.warn("Duplicate lookup unavailable",error);
      q.library={main:[],adult:[]};
      setStatus("Duplicate lookup unavailable",error.message,"△");
    }
  }

  async function addFiles(files){
    const chosen=Array.from(files||[]).filter(file=>/\.epub$/i.test(file.name)||file.type==="application/epub+zip");
    if(!chosen.length){
      setFileState("NO EPUB","error");
      $("#filePickerMeta").textContent="No EPUB file was received from the file picker. Please choose an .epub file.";
      return;
    }

    /* Give immediate feedback before any B2/catalog network work. Duplicate lookup runs in
     * parallel with local inspection, then every ready item is evaluated once the lookup settles. */
    panel.classList.remove("hidden");$("#metadataCard").classList.add("hidden");$("#preflightCard").classList.add("hidden");$("#uploadCard").classList.remove("hidden");$("#openSeries").classList.add("hidden");
    setFileState("CHECKING");setStatus("Preparing batch",`Running local preflight on ${chosen.length} EPUB${chosen.length===1?"":"s"}.`,"✦");
    $("#filePickerTitle").textContent=`${chosen.length} EPUB${chosen.length===1?"":"s"} selected`;
    $("#filePickerMeta").textContent="Reading EPUB metadata on this device…";
    const libraryPromise=ensureLibrary();

    for(const file of chosen){
      const sameLocal=q.items.find(x=>x.file.name===file.name&&x.file.size===file.size&&x.file.lastModified===file.lastModified);
      if(sameLocal)continue;
      const item={id:uid(),file,status:"checking",action:"new",progress:0,metaReady:false,adult:false,audioAlignedUrl:"",translationStatus:"",translations:[]};
      q.items.push(item);renderQueue();
      try{
        const meta=await inspect(file);
        Object.assign(item,meta,{file,status:"queued",metaReady:Boolean(meta.title),adult:false,audioAlignedUrl:"",translationStatus:meta.translationStatus||"",translations:arr(meta.translations)});
        if(meta.validation?.status==="fail")item.action="skip";
      }catch(error){
        console.error(error);item.validation=failed("EPUB inspection failed",error.message);item.status="failed";item.error=error.message;item.action="skip";
      }
      renderQueue();
      if(!q.activeId&&item.metaReady)selectItem(item.id);
      await new Promise(resolve=>setTimeout(resolve,0));
    }

    await libraryPromise;
    for(const item of q.items)if(item.metaReady&&item.status!=="done")evaluateDuplicate(item);
    renderQueue();

    const failedCount=q.items.filter(i=>i.validation?.status==="fail").length;
    setFileState(failedCount?"REVIEW":"READY",failedCount?"warning":"ready");
    $("#filePickerTitle").textContent=`${q.items.length} EPUB${q.items.length===1?"":"s"} in batch`;
    $("#filePickerMeta").textContent="Review duplicate actions and metadata, then upload the queue.";
    setStatus("Batch ready","Duplicates default to Skip. Review any warnings or replacements before uploading.","✓");
    refreshUploadButton();
  }

  function validateItem(item){
    if(!item.series||!item.title||!Number.isFinite(Number(item.number))||Number(item.number)<=0)throw new Error("Series, book title, and a valid volume number are required.");
    if(item.validation?.status==="fail")throw new Error("This EPUB failed structural preflight.");
  }

  async function uploadOne(item,index,total){
    validateItem(item);
    item.status="uploading";item.progress=5;item.progressLabel=`${index}/${total} · Preparing upload`;renderQueue();
    const sid=`${item.adult?"adult-":""}${slug(item.series)}`;
    const base=slug(item.file.name.replace(/\.epub$/i,""));
    let epubKey="";
    if(item.action==="replace"&&!item.duplicate?.batch)epubKey=mediaKey(item.duplicate?.volume?.file);
    if(!epubKey){
      const hashPart=(item.sha256||await hash8(item.file)).slice(0,10);
      const extra=item.action==="separate"?`-${Date.now().toString(36)}-${index}`:"";
      epubKey=`shadow-garden/books/${sid}/${base}-${hashPart}${extra}.epub`;
    }

    item.progress=18;item.progressLabel=`${index}/${total} · Uploading EPUB`;renderQueue();
    await uploadObject(epubKey,item.file,"application/epub+zip");

    let coverKey="",coverThumbKey="";
    if(item.coverBlob){
      item.progress=55;item.progressLabel=`${index}/${total} · Optimizing cover`;renderQueue();
      const variants=await optimizedCoverSet(item.coverBlob),h=await hash8(item.coverBlob),vol=String(item.number).replace(".","-");
      const detailExt=variants.detail.type==="image/webp"?".webp":item.coverExt;
      coverKey=`shadow-garden/covers/${sid}-${vol}-${h}-detail${detailExt}`;
      await uploadObject(coverKey,variants.detail,variants.detail.type||mimeForExt(detailExt));
      if(variants.thumb){coverThumbKey=`shadow-garden/covers/${sid}-${vol}-${h}-thumb.webp`;await uploadObject(coverThumbKey,variants.thumb,"image/webp")}
    }

    item.progress=82;item.progressLabel=`${index}/${total} · Updating catalog`;renderQueue();
    const replaceTargetFile=item.action==="replace"&&!item.duplicate?.batch?item.duplicate.volume.file:"";
    const result=await api("/admin-api/catalog",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
      adult:item.adult,series:item.series,title:item.title,author:item.author,number:item.number,year:item.year,description:item.description,genres:item.genres,tags:item.tags,
      audioAlignedUrl:item.audioAlignedUrl,translationStatus:item.translationStatus,translations:item.translations,date:item.date,language:item.language,publisher:item.publisher,size:item.file.size,epubKey,coverKey,coverThumbKey,
      sha256:item.sha256,originalFilename:item.file.name,duplicatePolicy:item.action==="replace"?"replace":item.action==="separate"?"separate":"reject",replaceTargetFile
    })});
    item.status="done";item.progress=100;item.progressLabel="Uploaded successfully";item.result=result;
    return result;
  }

  async function uploadBatch(){
    if(q.running||!state.unlocked)return;
    saveEditor();
    const items=q.items.filter(i=>i.metaReady&&i.validation?.status!=="fail"&&i.action!=="skip"&&i.status!=="done");
    if(!items.length)return;
    for(const item of items){try{validateItem(item)}catch(error){selectItem(item.id);alert(`${item.file.name}: ${error.message}`);return}}
    q.running=true;state.uploading=true;batchUpload.disabled=true;$("#openSeries").classList.add("hidden");setUploadState("UPLOADING");
    let wakeLock=null;try{wakeLock=await navigator.wakeLock?.request("screen")}catch{}
    let succeeded=0,failedCount=0,lastResult=null;
    try{
      for(let i=0;i<items.length;i++){
        const item=items[i];
        setStatus(`Uploading ${i+1} of ${items.length}`,item.title||item.file.name,"↑");
        try{lastResult=await uploadOne(item,i+1,items.length);succeeded++}
        catch(error){console.error(error);item.status="failed";item.error=error.message;item.progressLabel=error.message;failedCount++;renderQueue()}
      }
      state.management=null;q.library=null;
      setUploadState(failedCount?"COMPLETE WITH ERRORS":"COMPLETE",failedCount?"warning":"ready");
      setStatus(failedCount?"Batch finished with errors":"Batch upload complete",`${succeeded} uploaded${failedCount?`, ${failedCount} failed`:""}.`,failedCount?"△":"✓");
      if(lastResult?.seriesId){$("#openSeries").href=`/series.html?id=${encodeURIComponent(lastResult.seriesId)}`;$("#openSeries").classList.remove("hidden")}
    }finally{
      q.running=false;state.uploading=false;try{await wakeLock?.release()}catch{}renderQueue();
    }
  }

  function resetQueue(){
    if(q.running)return;
    if(q.objectUrl)URL.revokeObjectURL(q.objectUrl);
    q.items=[];q.activeId=null;q.library=null;q.objectUrl="";
    panel.classList.add("hidden");$("#metadataCard").classList.add("hidden");$("#preflightCard").classList.add("hidden");$("#uploadCard").classList.add("hidden");
    $("#filePickerTitle").textContent="Choose EPUBs from phone";$("#filePickerMeta").textContent="Select one or many EPUBs · 50 MB maximum per file";setFileState("WAITING");
  }

  replacement.addEventListener("change",event=>{
    const files=Array.from(event.currentTarget.files||[]);
    if(!files.length)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.currentTarget.value="";
    void addFiles(files).catch(error=>{
      console.error("Batch selection failed",error);
      setFileState("FAILED","error");
      setUploadState("BLOCKED","error");
      setStatus("Could not process selected EPUBs",error?.message||String(error),"!");
      $("#filePickerMeta").textContent=error?.message||String(error);
    });
  },true);
  $("#batchAddMore").addEventListener("click",()=>replacement.click());
  $("#batchClear").addEventListener("click",()=>{if(q.items.length&&!confirm("Clear the entire batch queue?"))return;resetQueue()});
  $("#batchList").addEventListener("click",event=>{const edit=event.target.closest("[data-batch-edit]");if(edit)selectItem(edit.dataset.batchEdit)});
  $("#batchList").addEventListener("change",event=>{
    const select=event.target.closest("[data-batch-action]");if(!select)return;
    const item=q.items.find(x=>x.id===select.dataset.batchAction);if(!item)return;
    item.action=select.value;item.userChoseSkip=select.value==="skip";
    if(item.action==="replace"&&item.duplicate&&!item.duplicate.batch)item.adult=item.duplicate.scope==="adult";
    if(item.id===q.activeId&&item.action==="replace"&&!item.duplicate?.batch){q.editorSync=true;$("#adultInput").checked=item.adult;q.editorSync=false}
    renderQueue();
  });
  inputIds.forEach(id=>document.getElementById(id)?.addEventListener(id==="adultInput"?"change":"input",()=>{if(!q.editorSync){clearTimeout(q._editTimer);q._editTimer=setTimeout(saveEditor,120)}}));
  batchUpload.addEventListener("click",uploadBatch);
})();