/* Shadow Garden v1.15.13 — shared thematic copy layer.
   Functional labels stay plain; atmosphere lives in headings, helper copy, empty states,
   progress messages, and confirmations. Destructive warnings always keep consequences explicit. */
(()=>{
  if(window.__sgFlavorInstalled)return;
  window.__sgFlavorInstalled=true;

  const exact=new Map([
    ["A quiet archive of EPUBs, arranged beneath the shadows.","A moonlit archive of stories, cultivated beneath quiet shadows."],
    ["Multiple words narrow results together. Tag filters are exact.","Follow any thread—title, author, tag, or volume. Each added word narrows the path."],
    ["The shelves are quiet.","No shelf answers that search."],
    ["No series match these filters.","No shelf answers the current path."],
    ["A separate shelf for NSFW and adult EPUBs, kept out of the main archive.","A secluded wing for mature works, sheltered beyond the main Garden."],
    ["This section contains adult or sexually explicit books. Continue only if you are of legal age to view this material in your jurisdiction.","Beyond this gate are adult and sexually explicit works. Enter only if you are of legal age to view them where you live."],
    ["Your acknowledgement is stored only in this browser. No account is created.","Your acknowledgement rests only in this browser. No account is planted."],
    ["No books in the Night Garden.","The Night Garden is quiet."],
    ["Sow new forbidden knowledge beneath the shadows.","No mature works answer the current path."],
    ["Opening the shelf…","Parting the leaves…"],
    ["SHELF NOT FOUND","PATH LOST"],
    ["This series is missing.","This shelf has slipped into shadow."],
    ["The catalog entry could not be opened.","The Garden could not find this series among its living shelves."],
    ["Opening EPUB…","Opening the volume…"],
    ["Opening the book…","Parting the pages…"],
    ["The next path through the Garden is ready.","This volume rests complete. Another path waits beyond its final page."],
    ["No bookmarks yet.","No bookmarks are pressed between these pages yet."],
    ["PRIVATE STORAGE CONSOLE","KEEPER'S GATE"],
    ["Pick up your tools before entering the Garden.","The Keeper's gate is sealed. Present your key before tending the shelves."],
    ["Unlock the Garden","Open the Keeper's Gate"],
    ["Kept only on this page while it remains open. It is never written to an EPUB or catalog.","Your Keeper token remains only in this open tab. It is never planted in an EPUB or catalog."],
    ["Manage Library","Tend the Garden"],
    ["Edit series, add volumes, search the archive, or open the Garden's maintenance tools.","Tend series, plant new volumes, search the shelves, or inspect the Garden's deeper roots."],
    ["Loading the Garden…","Walking the rows…"],
    ["No series match this view.","No shelf answers this view."],
    ["Plant new seeds","Plant new volumes"],
    ["Select new seeds","Choose books to plant"],
    ["Choose EPUBs from phone","Choose EPUBs from this device"],
    ["Reader-focused checks run locally before anything is uploaded.","The volume is inspected on this device before it ever reaches the private vault."],
    ["Temper the selected seed","Shape the selected volume"],
    ["Keep this title out of the main archive.","Shelve this title in the restricted wing, away from the main Garden."],
    ["Let the batch take root beneath the shadows","Set the new growth into the Garden"],
    ["The bucket remains private. Readers receive files through Cloudflare.","The private vault stays sealed. Readers receive protected copies through Cloudflare."],
    ["Keep the roots healthy","Tend the Garden's roots"],
    ["Inspect catalog structure immediately, then optionally verify every referenced EPUB and cover against private B2 storage.","Inspect the living catalogs, then trace every referenced EPUB and cover into the private vault when a deeper check is needed."],
    ["Upgrade pre-v0.8 covers that do not have lightweight thumbnails. Processing is sequential on this device to keep memory use low.","Refine older covers that still lack lightweight thumbnails. Work proceeds one at a time on this device to keep memory use low."],
    ["Loading cover inventory…","Surveying the cover beds…"],
    ["Shadow Garden snapshots both catalogs before uploads, replacements, metadata edits, Trash moves, cover maintenance, and restores. The newest 30 snapshots are retained.","Before major changes, Shadow Garden preserves a snapshot of both catalogs. The newest 30 are kept as stepping stones back."],
    ["Removing a series or volume no longer deletes its B2 files. Restore it here, or purge it permanently when you are certain it is no longer needed.","Removed series and volumes rest here without losing their files. Return them to the shelves, or uproot them permanently only when you are certain."],
    ["Review persistent tripwire activations and significant Garden Keeper cooldowns. Network identities are HMAC-derived; raw IP addresses are never stored.","Watch the Garden's gate for persistent tripwires and significant Keeper cooldowns. Network identities are HMAC-derived; raw IP addresses are never stored."],
    ["Loading security telemetry…","Reading the gate ledger…"],
    ["No recent abuse tripwires or significant Keeper cooldowns.","The gate has been quiet; no recent tripwires or significant Keeper cooldowns."],
    ["No catalog health issues found.","The Garden's roots show no catalog health issues."],
    ["All cataloged covers already have lightweight thumbnails.","Every cataloged cover is already carrying a lightweight thumbnail."],
    ["No catalog backups yet.","No catalog snapshots have been preserved yet."],
    ["Trash is empty.","Nothing is resting in Trash."],
    ["Confirm you’re human","Pass the Garden Gate"],
    ["One quick check opens protected books for the next 12 hours on this browser. Reading, page turns, and normal navigation stay uninterrupted.","One brief check grants this browser a Garden Pass for the next 12 hours. Once inside, reading and page turns remain undisturbed."],
    ["Preparing verification…","Preparing the gate…"],
    ["Complete the verification to continue.","Complete the check to open the Garden."],
    ["Verifying your Garden Pass…","Presenting your Garden Pass…"],
    ["Verified. Opening the Garden…","The gate recognizes you. Opening the Garden…"],
    ["Keeper verification","Keeper's gate"],
    ["Preparing Keeper verification…","Waking the Keeper's gate…"],
    ["Complete the verification to unlock Garden Keeper.","Complete the check to open the Keeper's gate."],
    ["Checking your Garden Pass and keeper token…","Checking your Garden Pass and Keeper key…"],
    ["Verified. Opening Garden Keeper…","The gate yields. Opening Garden Keeper…"],
    ["Complete the verification to try again.","Complete the check when the gate is ready again."],
    ["START OVER","RETURN TO THE FIRST PAGE"],
    ["Read this volume again?","Walk this volume from the beginning?"],
    ["Start from Page 1","Begin Again"],
    ["Your reading progress for this volume will reset to page 1 and its Finished mark will be removed. Bookmarks will be kept.","The reading trail for this volume will be cleared and its Finished mark lifted. You will return to page 1; bookmarks remain untouched."],
    ["The garden ends here.","The path fades into shadow."],
    ["The page you followed does not exist.","No shelf, gate, or footpath answers this address."],
    ["Return to the archive","Return to the Garden"]
  ]);

  function themedDynamic(value){
    const text=String(value||"");
    let match=text.match(/^Too many failed unlock attempts\. Try again in (\d+) second(s?)\.$/);
    if(match)return`The Keeper's gate has closed after repeated failed keys. Try again in ${match[1]} second${match[2]}.`;
    match=text.match(/^Could not load the library: (.+)$/);
    if(match)return`The Garden could not open its catalog: ${match[1]}`;
    return exact.get(text)||text;
  }

  function rewriteTextNode(node){
    if(!node||node.nodeType!==Node.TEXT_NODE)return;
    const parent=node.parentElement;
    if(!parent||/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|OPTION)$/.test(parent.tagName))return;
    const raw=node.nodeValue;
    const trimmed=raw.trim();
    if(!trimmed)return;
    const next=themedDynamic(trimmed);
    if(next===trimmed)return;
    const lead=raw.match(/^\s*/)?.[0]||"";
    const tail=raw.match(/\s*$/)?.[0]||"";
    node.nodeValue=`${lead}${next}${tail}`;
  }

  function rewriteTree(root=document.body){
    if(!root)return;
    if(root.nodeType===Node.TEXT_NODE){rewriteTextNode(root);return}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode()))rewriteTextNode(node);
  }

  function rewriteAttributes(root=document){
    root.querySelectorAll?.('[placeholder="Password"]').forEach(el=>el.setAttribute("placeholder","Keeper token"));
  }

  const nativeConfirm=window.confirm.bind(window);
  function themedConfirm(message){
    const text=String(message||"");
    let match=text.match(/^Delete “(.+)” and every EPUB\/cover stored for this series\? This cannot be undone\.$/);
    if(match)return`Move “${match[1]}” and all of its volumes to Trash?\n\nThe shelf will disappear from the Library, but its EPUB and cover files will remain in the private vault and can be restored from Garden Maintenance.`;
    match=text.match(/^Remove “(.+)” from Shadow Garden and delete its EPUB from B2\? This cannot be undone\.$/);
    if(match)return`Move “${match[1]}” to Trash?\n\nThe volume will leave the Library, but its EPUB and cover files will remain in the private vault and can be restored from Garden Maintenance.`;
    match=text.match(/^Optimize (\d+) legacy cover(s?)\? New WebP derivatives will be uploaded and the catalogs will be backed up before they are applied\.$/);
    if(match)return`Refine ${match[1]} legacy cover${match[2]}?\n\nShadow Garden will preserve a catalog snapshot first, then create and apply new WebP cover derivatives.`;
    match=text.match(/^Restore the catalog snapshot from (.+)\?\n\nA safety backup of the current catalogs will be created first\. EPUB and cover files in B2 are not changed\.$/);
    if(match)return`Restore the Garden to the catalog snapshot from ${match[1]}?\n\nA fresh safety snapshot of the current catalogs will be preserved first. EPUB and cover files in the private vault will not change.`;
    match=text.match(/^Restore “(.+)” to the (18\+|Main) library\?$/);
    if(match)return`Return “${match[1]}” to the ${match[2]} shelves?`;
    match=text.match(/^Permanently purge (.+)\?\n\nAny EPUB and cover objects used only by the selected Trash entries will be deleted from B2\. This cannot be undone\.$/);
    if(match)return`Uproot ${match[1]} permanently?\n\nAny EPUB and cover objects used only by the selected Trash entries will be deleted from the private vault. This cannot be undone.`;
    if(text==="Delete this catalog backup permanently?\n\nThis removes only the selected backup snapshot. Current catalogs and EPUB/cover files are not changed.")return"Uproot this catalog snapshot permanently?\n\nOnly this preserved snapshot will be removed. The living catalogs and all EPUB/cover files remain untouched.";
    if(text==="Release this public access cooldown? This does not erase the recorded event.")return"Open this public gate early?\n\nThe active cooldown will be released, but its entry in the gate ledger will remain.";
    match=text.match(/^Read (.+) again\?\n\nThis resets reading progress to page 1 and removes the Finished mark\. Bookmarks will be kept\.$/);
    if(match)return`Walk ${match[1]} from the beginning?\n\nIts reading trail will be cleared, the Finished mark lifted, and the book reopened at page 1. Bookmarks remain untouched.`;
    return text;
  }
  window.confirm=message=>nativeConfirm(themedConfirm(message));

  const nativeAlert=window.alert.bind(window);
  function themedAlert(message){
    const text=String(message||"");
    if(text==="There are no cataloged B2 objects to check.")return"There are no cataloged objects in the private vault to trace.";
    if(text==="Cover optimizer is unavailable. Reload Garden Keeper and try again.")return"The cover tools are asleep. Reload Garden Keeper and try again.";
    if(text==="Series, book title, and a valid volume number are required.")return"A series name, book title, and valid volume number are needed before this volume can be planted.";
    return text;
  }
  window.alert=message=>nativeAlert(themedAlert(message));

  function apply(){rewriteTree(document.body);rewriteAttributes(document)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});
  else apply();

  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==="characterData")rewriteTextNode(record.target);
      for(const node of record.addedNodes){
        rewriteTree(node);
        if(node.nodeType===Node.ELEMENT_NODE)rewriteAttributes(node);
      }
    }
  });
  const startObserver=()=>document.body&&observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  if(document.body)startObserver();else document.addEventListener("DOMContentLoaded",startObserver,{once:true});
})();
