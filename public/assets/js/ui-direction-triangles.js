/* Shadow Garden v1.7.5 — normalize directional UI glyphs to filled triangles. */
(()=>{
  const interactiveSelector='a,button,summary,[role="button"],[role="link"]';
  const replacements=new Map([
    ['←','◀'],['↩','◀'],['⇐','◀'],['⇦','◀'],['⟵','◀'],['‹','◀'],
    ['→','▶'],['↪','▶'],['⇒','▶'],['⇨','▶'],['⟶','▶'],['›','▶'],
    ['↑','▲'],['⇑','▲'],['⇧','▲'],
    ['↓','▼'],['⇓','▼'],['⇩','▼']
  ]);
  const pattern=/[←↩⇐⇦⟵‹→↪⇒⇨⟶›↑⇑⇧↓⇓⇩]/g;

  function normalizeText(node){
    if(!node?.nodeValue||!pattern.test(node.nodeValue)){pattern.lastIndex=0;return}
    pattern.lastIndex=0;
    node.nodeValue=node.nodeValue.replace(pattern,glyph=>replacements.get(glyph)||glyph);
  }

  function normalizeInteractive(element){
    if(!(element instanceof Element))return;
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode()))normalizeText(node);
  }

  function normalizeRoot(root){
    if(!(root instanceof Element||root instanceof Document||root instanceof DocumentFragment))return;
    if(root instanceof Element&&root.matches(interactiveSelector))normalizeInteractive(root);
    root.querySelectorAll?.(interactiveSelector).forEach(normalizeInteractive);
  }

  function start(){
    normalizeRoot(document);
    if(!document.body)return;
    new MutationObserver(mutations=>{
      for(const mutation of mutations){
        if(mutation.type==='characterData'){
          if(mutation.target.parentElement?.closest(interactiveSelector))normalizeText(mutation.target);
          continue;
        }
        for(const node of mutation.addedNodes){
          if(node.nodeType===Node.TEXT_NODE){
            if(node.parentElement?.closest(interactiveSelector))normalizeText(node);
          }else if(node.nodeType===Node.ELEMENT_NODE){
            normalizeRoot(node);
          }
        }
      }
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
