/* Shadow Garden v1.4.3 — paginated standalone visual-page frame.
 *
 * Standalone visual pages are synthetic one-page documents from the Visual Page Cache.
 * EPUB.js still treats reflowable documents as horizontal paginated columns, so the outer
 * iframe can be expanded/scrolled like a text section. This controller owns the complete
 * Paginated view for visual-only spine items: one viewport-wide iframe, one viewport-high
 * frame, centered contained image, and no intra-page CFI scrolling.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const EDGE_INSET=18;

  function isPaginated(options,rendition){
    const flow=String(options?.flow||rendition?.settings?.flow||"");
    return !flow.startsWith("scrolled");
  }

  function cache(){return window.__sgVisualPageCache}
  function isVisualSection(section){return Boolean(section?.href&&cache()?.has?.(section.href))}
  function isVisualView(view){return isVisualSection(view?.section)}
  const positive=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;

  function viewportMetrics(rendition){
    const manager=rendition?.manager;
    const container=manager?.container;
    const viewer=document.getElementById("viewer");
    const viewerRect=viewer?.getBoundingClientRect?.();
    const stage=manager?._stageSize||{};

    const widthCandidates=[
      positive(container?.clientWidth),
      positive(stage.width),
      positive(viewerRect?.width)
    ].filter(Boolean);
    const heightCandidates=[
      positive(container?.clientHeight),
      positive(stage.height),
      positive(viewerRect?.height)
    ].filter(Boolean);

    const width=Math.max(320,Math.floor(widthCandidates[0]||widthCandidates[1]||widthCandidates[2]||window.innerWidth||720));
    const height=Math.max(240,Math.floor((heightCandidates.length?Math.min(...heightCandidates):window.innerHeight||800)-1));
    return{width,height};
  }

  function important(style,property,value){
    try{style.setProperty(property,value,"important")}catch{}
  }

  function clearColumns(element){
    if(!element?.style)return;
    const values={
      "columns":"auto",
      "column-width":"auto",
      "column-count":"1",
      "column-gap":"0px",
      "column-fill":"auto",
      "column-rule":"none",
      "-webkit-columns":"auto",
      "-webkit-column-width":"auto",
      "-webkit-column-count":"1",
      "-webkit-column-gap":"0px",
      "-webkit-column-fill":"auto",
      "-moz-columns":"auto",
      "-moz-column-width":"auto",
      "-moz-column-count":"1",
      "-moz-column-gap":"0px",
      "-moz-column-fill":"auto"
    };
    Object.entries(values).forEach(([property,value])=>important(element.style,property,value));
  }

  function setFrameGeometry(view,width,height){
    const element=view?.element,iframe=view?.iframe;
    if(!element||!iframe)return false;

    important(element.style,"position","relative");
    important(element.style,"display","block");
    important(element.style,"float","none");
    important(element.style,"margin","0");
    important(element.style,"padding","0");
    important(element.style,"left","0");
    important(element.style,"right","auto");
    important(element.style,"transform","none");
    important(element.style,"width",`${width}px`);
    important(element.style,"min-width",`${width}px`);
    important(element.style,"max-width",`${width}px`);
    important(element.style,"height",`${height}px`);
    important(element.style,"min-height",`${height}px`);
    important(element.style,"max-height",`${height}px`);
    important(element.style,"flex",`0 0 ${width}px`);
    important(element.style,"overflow","hidden");
    important(element.style,"box-sizing","border-box");

    important(iframe.style,"display","block");
    important(iframe.style,"position","relative");
    important(iframe.style,"margin","0");
    important(iframe.style,"padding","0");
    important(iframe.style,"width",`${width}px`);
    important(iframe.style,"min-width",`${width}px`);
    important(iframe.style,"max-width",`${width}px`);
    important(iframe.style,"height",`${height}px`);
    important(iframe.style,"min-height",`${height}px`);
    important(iframe.style,"max-height",`${height}px`);
    important(iframe.style,"border","0");
    important(iframe.style,"overflow","hidden");
    important(iframe.style,"box-sizing","border-box");

    view.settings.width=width;
    view.settings.height=height;
    view.settings.forceRight=false;
    view.lockedHeight=height;
    view._width=width;
    view._height=height;
    try{view.element.style.removeProperty("margin-left")}catch{}
    return true;
  }

  function setDocumentGeometry(view,width,height){
    const href=view?.section?.href||"";
    const visualCache=cache();
    try{visualCache?.applyToContents?.(view.contents,href,{width,height})}catch{}

    const doc=view?.contents?.document;
    const html=doc?.documentElement,body=doc?.body;
    const wrapper=body?.querySelector?.(".sg-synthetic-visual-page");
    const image=wrapper?.querySelector?.("img");
    if(!html||!body||body.dataset.sgSyntheticVisual!=="1"||!wrapper||!image)return false;

    const innerWidth=Math.max(1,width-(EDGE_INSET*2));
    const innerHeight=Math.max(1,height-(EDGE_INSET*2));

    clearColumns(html);
    clearColumns(body);
    clearColumns(wrapper);

    [html,body].forEach(node=>{
      important(node.style,"margin","0");
      important(node.style,"padding","0");
      important(node.style,"width",`${width}px`);
      important(node.style,"min-width",`${width}px`);
      important(node.style,"max-width",`${width}px`);
      important(node.style,"height",`${height}px`);
      important(node.style,"min-height",`${height}px`);
      important(node.style,"max-height",`${height}px`);
      important(node.style,"overflow","hidden");
      important(node.style,"box-sizing","border-box");
    });

    important(body.style,"display","flex");
    important(body.style,"align-items","center");
    important(body.style,"justify-content","center");

    important(wrapper.style,"position","relative");
    important(wrapper.style,"display","flex");
    important(wrapper.style,"align-items","center");
    important(wrapper.style,"justify-content","center");
    important(wrapper.style,"margin","0");
    important(wrapper.style,"padding","0");
    important(wrapper.style,"width",`${innerWidth}px`);
    important(wrapper.style,"height",`${innerHeight}px`);
    important(wrapper.style,"min-width",`${innerWidth}px`);
    important(wrapper.style,"min-height",`${innerHeight}px`);
    important(wrapper.style,"max-width",`${innerWidth}px`);
    important(wrapper.style,"max-height",`${innerHeight}px`);
    important(wrapper.style,"overflow","hidden");
    important(wrapper.style,"box-sizing","border-box");
    important(wrapper.style,"break-inside","avoid");
    important(wrapper.style,"page-break-inside","avoid");

    important(image.style,"display","block");
    important(image.style,"position","static");
    important(image.style,"flex","0 1 auto");
    important(image.style,"margin","0 auto");
    important(image.style,"padding","0");
    important(image.style,"width","auto");
    important(image.style,"height","auto");
    important(image.style,"max-width","100%");
    important(image.style,"max-height","100%");
    important(image.style,"object-fit","contain");
    important(image.style,"object-position","center center");

    try{
      view.contents.textWidth=()=>width;
      view.contents.textHeight=()=>height;
      view.contents.__sgSyntheticVisualHeight=height;
    }catch{}
    html.dataset.sgPaginatedVisualFrame="1";
    return true;
  }

  function fitVisualView(view,rendition){
    if(!isVisualView(view)||!view?.contents?.document)return false;
    const {width,height}=viewportMetrics(rendition);
    const documentReady=setDocumentGeometry(view,width,height);
    if(!documentReady)return false;
    try{view.reframe?.(width,height)}catch{}
    setFrameGeometry(view,width,height);
    try{
      view._needsReframe=false;
      view.stopExpanding=false;
      view.element.style.visibility="visible";
      view.iframe.style.visibility="visible";
    }catch{}
    return true;
  }

  function patchView(view,rendition){
    if(!view||view.__sgPaginatedVisualFramePatched)return view;
    view.__sgPaginatedVisualFramePatched=true;

    if(typeof view.expand==="function"){
      const rawExpand=view.expand.bind(view);
      view.expand=(force)=>{
        if(isVisualView(view)&&view.contents?.document&&fitVisualView(view,rendition))return;
        return rawExpand(force);
      };
    }

    if(view.contents)fitVisualView(view,rendition);
    return view;
  }

  function patchManager(rendition){
    const manager=rendition?.manager;
    if(!manager||manager.__sgPaginatedVisualFrameManagerPatched)return;
    manager.__sgPaginatedVisualFrameManagerPatched=true;

    if(typeof manager.createView==="function"){
      const rawCreateView=manager.createView.bind(manager);
      manager.createView=(...args)=>patchView(rawCreateView(...args),rendition);
    }

    if(typeof manager.display==="function"){
      const rawDisplay=manager.display.bind(manager);
      manager.display=(section,target)=>{
        const visual=isVisualSection(section);
        return Promise.resolve(rawDisplay(section,visual?undefined:target)).then(result=>{
          if(visual){
            const view=manager.views?.find?.(section)||manager.views?.first?.();
            if(view)fitVisualView(view,rendition);
            try{manager.scrollTo?.(0,0,true)}catch{}
          }
          return result;
        });
      };
    }

    try{manager.views?.all?.().forEach(view=>patchView(view,rendition))}catch{}
  }

  function patchRendition(rendition,options={}){
    if(!rendition||rendition.__sgPaginatedVisualFramePatched||!isPaginated(options,rendition))return rendition;
    rendition.__sgPaginatedVisualFramePatched=true;

    const install=()=>patchManager(rendition);
    install();
    try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
    try{rendition.on?.("started",install)}catch{}
    try{
      rendition.on?.("rendered",(section,view)=>{
        patchView(view,rendition);
        if(isVisualSection(section)){
          fitVisualView(view,rendition);
          requestAnimationFrame(()=>fitVisualView(view,rendition));
        }
      });
    }catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgPaginatedVisualFrameBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgPaginatedVisualFrameBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),options);
    return book;
  }

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
