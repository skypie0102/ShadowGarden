/* Shadow Garden v2.9 — aggregate, presentation-only upload preflight report. */
(()=>{
  const keeper=window.ShadowGardenKeeper;if(!keeper)return;
  const {arr,esc}=keeper.util;
  const runWhenReady=callback=>window.ShadowGardenKeeperReady?callback():keeper.events.addEventListener("app:ready",callback,{once:true});

  function install(){
    const q=keeper.state.batch,list=document.querySelector("#batchList"),preflight=document.querySelector("#preflightCard"),uploadCard=document.querySelector("#uploadCard");
    if(!q||!list||!uploadCard)return;
    if(!document.querySelector('link[href="/assets/css/admin-import-report.css?v=2.11.0"]')){
      const link=document.createElement("link");link.rel="stylesheet";link.href="/assets/css/admin-import-report.css?v=2.11.0";document.head.appendChild(link);
    }

    function mount(review){
      if(!review||review.dataset.importReportReady==="1")return;
      review.dataset.importReportReady="1";
      let decorating=false,lastSignature="";
      const titleOf=item=>String(item?.title||item?.file?.name||"EPUB").trim()||"EPUB";
      const detailOf=issue=>String(issue?.detail||"").trim();
      const messageOf=issue=>String(issue?.message||"").trim();

      function recommendation(message,severity){
        const text=String(message||"").toLowerCase();
        if(severity==="blocked")return"Upload is blocked. Locate this queue row and replace or repair the EPUB before retrying.";
        if(text.includes("title metadata"))return"Review the detected title and series metadata; the filename fallback is currently being used.";
        if(text.includes("language metadata"))return"Confirm the book language; add language metadata to the source EPUB when practical.";
        if(text.includes("navigation document"))return"Upload is allowed. Verify Contents/chapter navigation after import.";
        if(text.includes("cover image"))return"Upload is allowed. Add or replace artwork in Keeper after import if this book needs a cover.";
        if(text.includes("mimetype"))return"Confirm the source EPUB opens normally before upload; its package marker is non-standard.";
        if(text.includes("font")&&text.includes("obfuscat"))return"Upload is allowed. Confirm embedded fonts render correctly in Reader.";
        if(text.includes("xhtml")||text.includes("resource")||text.includes("reference")||text.includes("spine media"))return"Upload is allowed, but inspect the affected content in Reader after import.";
        if(text.includes("media-overlay"))return"Upload is allowed. Verify any synchronized media behavior after import.";
        return"Review the EPUB before upload and verify the affected content after import.";
      }

      function entryFor(item){
        const validation=item.validation||{},fatal=arr(validation.fatal),warnings=arr(validation.warnings);
        if(validation.status==="fail"||item.status==="failed"){
          const issue=fatal[0]||{message:item.error||"EPUB preflight failed",detail:""};
          return{item,kind:"blocked",label:"BLOCKED",message:messageOf(issue)||"EPUB preflight failed",detail:detailOf(issue),recommendation:recommendation(messageOf(issue),"blocked")};
        }
        if(item.duplicate&&item.action==="skip"&&item.status!=="done"){
          return{item,kind:"decision",label:"ACTION",message:"Duplicate is currently set to Skip",detail:"",recommendation:"Choose Replace existing or Add separate if this book should be imported; leaving Skip keeps the library unchanged."};
        }
        if(item.similarVolume){
          const match=item.similarVolume,label=match.batch?(match.item?.title||match.item?.file?.name||"another queued volume"):`${match.series?.title||"Existing series"} · ${match.volume?.title||`Volume ${match.volume?.number??"?"}`}`;
          return{item,kind:"warning",label:"WARNING",message:`Possible similar volume: ${label}`,detail:arr(match.reasons).join(" · "),recommendation:"Review the volume number and title before upload. This warning does not block import."};
        }
        if(warnings.length){
          const issue=warnings[0];
          return{item,kind:"warning",label:"WARNING",message:messageOf(issue)||"EPUB preflight warning",detail:detailOf(issue),recommendation:recommendation(messageOf(issue),"warning"),extra:Math.max(0,warnings.length-1)};
        }
        return null;
      }

      function metrics(items,entries){
        const blocked=entries.filter(entry=>entry.kind==="blocked").length,decisions=entries.filter(entry=>entry.kind==="decision").length,warnings=entries.filter(entry=>entry.kind==="warning").length;
        const ready=items.filter(item=>item.metaReady&&item.validation?.status!=="fail"&&item.action!=="skip"&&item.status!=="done").length;
        const checking=items.filter(item=>item.status==="checking").length;
        return{blocked,decisions,warnings,ready,checking};
      }

      function reportHtml(items){
        const entries=items.map(entryFor).filter(Boolean),counts=metrics(items,entries),attention=counts.blocked+counts.decisions+counts.warnings;
        const rows=entries.slice(0,12).map(entry=>`<article class="import-report-item ${entry.kind}" data-import-report-item="${esc(entry.item.id)}"><div class="import-report-item-copy"><div class="import-report-item-head"><span>${entry.label}</span><strong>${esc(titleOf(entry.item))}</strong></div><p>${esc(entry.message)}</p>${entry.detail?`<small>${esc(entry.detail)}</small>`:""}${entry.extra?`<small>+ ${entry.extra} more validation warning${entry.extra===1?"":"s"}</small>`:""}<em>${esc(entry.recommendation)}</em></div><button type="button" data-import-review="${esc(entry.item.id)}">Review</button></article>`).join("");
        const overflow=entries.length>12?`<p class="import-report-overflow">+ ${entries.length-12} more item${entries.length-12===1?"":"s"} need review. Use the queue above to inspect them.</p>`:"";
        const clean=!attention&&!counts.checking?'<div class="import-report-clean"><span>✓</span><div><strong>No validation warnings or blocked files.</strong><small>The queue still uses its normal metadata and duplicate review before upload.</small></div></div>':"";
        return `<section class="import-preflight-report" data-import-preflight-report><div class="import-report-head"><div><span>IMPORT REPORT</span><strong>Preflight & actions</strong></div><b>${attention?`${attention} need review`:counts.checking?`${counts.checking} checking`:"Clear"}</b></div><div class="import-report-metrics"><span>${counts.ready} ready</span>${counts.checking?`<span>${counts.checking} checking</span>`:""}${counts.warnings?`<span class="warning">${counts.warnings} warning${counts.warnings===1?"":"s"}</span>`:""}${counts.decisions?`<span class="decision">${counts.decisions} decision${counts.decisions===1?"":"s"}</span>`:""}${counts.blocked?`<span class="blocked">${counts.blocked} blocked</span>`:""}</div>${rows?`<div class="import-report-items">${rows}</div>`:""}${overflow}${clean}</section>`;
      }

      function signature(items){
        return JSON.stringify(items.map(item=>[item.id,item.status,item.action,item.validation?.status,arr(item.validation?.fatal).map(issue=>[issue.message,issue.detail]),arr(item.validation?.warnings).map(issue=>[issue.message,issue.detail]),Boolean(item.duplicate),item.similarVolume?arr(item.similarVolume.reasons):null]));
      }

      function decorate(){
        if(decorating||!review.isConnected)return;decorating=true;
        try{
          const items=arr(q.items),sig=signature(items);let report=review.querySelector("[data-import-preflight-report]");
          if(!items.length){report?.remove();lastSignature="";return}
          if(report&&sig===lastSignature)return;
          const template=document.createElement("template");template.innerHTML=reportHtml(items);const next=template.content.firstElementChild;
          if(report)report.replaceWith(next);else review.appendChild(next);lastSignature=sig;
        }finally{decorating=false}
      }

      review.addEventListener("click",event=>{
        const button=event.target.closest("[data-import-review]");if(!button)return;
        const id=button.dataset.importReview,article=list.querySelector(`[data-batch-id="${CSS.escape(id)}"]`),edit=article?.querySelector("[data-batch-edit]");
        if(edit&&!edit.disabled){
          edit.click();
          requestAnimationFrame(()=>{
            const toggle=preflight?.querySelector(".preflight-collapse-toggle");if(toggle?.getAttribute("aria-expanded")==="false")toggle.click();
            preflight?.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
            toggle?.focus({preventScroll:true});
          });
          return;
        }
        if(article){
          article.tabIndex=-1;article.scrollIntoView({block:"nearest",behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});article.focus({preventScroll:true});
        }
      });

      new MutationObserver(()=>queueMicrotask(decorate)).observe(review,{childList:true,subtree:false});
      new MutationObserver(()=>queueMicrotask(decorate)).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:["data-action","data-status"]});
      document.addEventListener("input",event=>{if(event.target.closest?.("#addBooksDialog"))queueMicrotask(decorate)});
      document.addEventListener("change",event=>{if(event.target.closest?.("#addBooksDialog"))queueMicrotask(decorate)});
      keeper.events.addEventListener("library:changed",()=>queueMicrotask(decorate));
      queueMicrotask(decorate);
    }

    const review=document.querySelector("#uploadReviewSummary");
    if(review){mount(review);return}
    const observer=new MutationObserver(()=>{
      const next=document.querySelector("#uploadReviewSummary");
      if(!next)return;
      observer.disconnect();mount(next);
    });
    observer.observe(uploadCard,{childList:true,subtree:true});
  }

  runWhenReady(install);
})();
