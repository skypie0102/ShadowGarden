/* Shadow Garden v1.3.0 — first-run standalone visual-page cache.
 *
 * Scans EPUB spine documents once, identifies genuinely standalone cover/illustration pages,
 * stores a normalized local image asset in IndexedDB, then replaces those XHTML/SVG bodies
 * with a deterministic synthetic image page before EPUB.js measures either reading flow.
 */
(()=>{
  const baseEpub=window.ePub;
  if(typeof baseEpub!=="function")return;

  const CACHE_DB="shadow-garden-visual-pages";
  const CACHE_STORE="books";
  const CACHE_VERSION=1;
  const DB_VERSION=1;
  const MAX_WEBP_EDGE=2600;
  const TEXT_LIMIT=4;
  const VISUAL_HINT=/(?:cover|illustration|illustrated|insert|plate|frontispiece|full[-_ ]?page|image[-_ ]?page|artwork|map)/i;
  const RASTER_MIME=/^image\/(?:jpeg|png|webp|avif|gif)$/i;
  const CONVERT_MIME=/^image\/(?:jpeg|png|avif|svg\+xml)$/i;

  const current={
    key:"",bookUrl:"",ready:false,preparing:null,records:new Map(),objectUrls:new Map(),summary:null
  };

  const cleanHref=value=>{
    let href=String(value||"").split("#")[0].split("?")[0];
    try{href=decodeURIComponent(href)}catch{}
    return href.replace(/^\.\//,"").replace(/^\//,"");
  };
  const hrefMatches=(a,b)=>{
    const left=cleanHref(a),right=cleanHref(b);
    return Boolean(left&&right&&(left===right||left.endsWith(`/${right}`)||right.endsWith(`/${left}`)));
  };
  const dirName=path=>{const parts=String(path||"").split("/");parts.pop();return parts.join("/")};
  const resolvePath=(base,relative)=>{
    const raw=String(relative||"").trim();
    if(!raw||raw.startsWith("#")||/^(?:data:|blob:|https?:|\/\/)/i.test(raw))return raw;
    const clean=raw.split("#")[0].split("?")[0];
    const stack=String(base||"").split("/").filter(Boolean);
    for(const part of clean.split("/")){
      if(!part||part===".")continue;
      if(part==="..")stack.pop();else stack.push(part);
    }
    return stack.join("/");
  };
  const localElements=(root,name)=>root?[...root.getElementsByTagName("*")].filter(node=>node.localName===name):[];
  const firstLocal=(root,name)=>localElements(root,name)[0]||null;
  const parseXml=text=>new DOMParser().parseFromString(String(text||""),"application/xml");
  const parseHtml=text=>new DOMParser().parseFromString(String(text||""),"text/html");
  const broken=doc=>Boolean(doc?.querySelector?.("parsererror"));
  const cacheKey=bookUrl=>`${CACHE_VERSION}::${new URL(bookUrl,location.href).href}`;

  function openDb(){
    if(!window.indexedDB)return Promise.resolve(null);
    return new Promise(resolve=>{
      try{
        const request=indexedDB.open(CACHE_DB,DB_VERSION);
        request.onupgradeneeded=()=>{
          const db=request.result;
          if(!db.objectStoreNames.contains(CACHE_STORE))db.createObjectStore(CACHE_STORE,{keyPath:"key"});
        };
        request.onsuccess=()=>resolve(request.result);
        request.onerror=()=>resolve(null);
        request.onblocked=()=>resolve(null);
      }catch{resolve(null)}
    });
  }

  async function cacheGet(key){
    const db=await openDb();if(!db)return null;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(CACHE_STORE,"readonly"),request=tx.objectStore(CACHE_STORE).get(key);
        request.onsuccess=()=>resolve(request.result||null);
        request.onerror=()=>resolve(null);
        tx.oncomplete=()=>db.close();tx.onerror=()=>db.close();
      }catch{try{db.close()}catch{}resolve(null)}
    });
  }

  async function cachePut(value){
    const db=await openDb();if(!db)return false;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(CACHE_STORE,"readwrite");
        tx.objectStore(CACHE_STORE).put(value);
        tx.oncomplete=()=>{db.close();resolve(true)};
        tx.onerror=()=>{db.close();resolve(false)};
        tx.onabort=()=>{db.close();resolve(false)};
      }catch{try{db.close()}catch{}resolve(false)}
    });
  }

  function setLoadingMessage(message){
    const apply=()=>{
      const text=document.querySelector("#readerLoading p");
      if(text&&!document.querySelector("#readerLoading")?.classList.contains("hidden"))text.textContent=message;
    };
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
  }

  function revokeUrls(){
    for(const url of current.objectUrls.values())try{URL.revokeObjectURL(url)}catch{}
    current.objectUrls.clear();
  }

  function activate(payload,cached){
    revokeUrls();
    current.key=payload.key;
    current.bookUrl=payload.bookUrl;
    current.records=new Map();
    for(const record of payload.visuals||[])current.records.set(cleanHref(record.href),record);
    current.ready=true;
    current.summary={
      cached:Boolean(cached),
      scanned:Number(payload.scanned)||0,
      visualPages:current.records.size,
      converted:Number(payload.converted)||0,
      reused:Number(payload.reused)||0,
      createdAt:payload.createdAt||Date.now()
    };
    window.__sgVisualPageManifest={
      version:CACHE_VERSION,
      bookUrl:current.bookUrl,
      visualPages:[...current.records.values()].map(({blob,...record})=>record)
    };
    document.dispatchEvent(new CustomEvent("sg-visual-pages-ready",{detail:current.summary}));
    return current.summary;
  }

  function recordForHref(href){
    const clean=cleanHref(href);
    if(current.records.has(clean))return current.records.get(clean);
    for(const record of current.records.values())if(hrefMatches(record.href,clean))return record;
    return null;
  }

  function objectUrl(record){
    if(!record?.blob)return"";
    const key=cleanHref(record.href);
    if(current.objectUrls.has(key))return current.objectUrls.get(key);
    const url=URL.createObjectURL(record.blob);
    current.objectUrls.set(key,url);
    return url;
  }

  function meaningfulText(doc){
    const root=doc?.body||firstLocal(doc,"body")||doc?.documentElement;if(!root)return"";
    const svgDocument=doc?.documentElement?.localName==="svg";
    const clone=root.cloneNode(true);
    const discard=new Set(["script","style","noscript","img","picture","source","video","canvas","object","title","desc"]);
    [...clone.getElementsByTagName("*")].forEach(node=>{
      if(discard.has(node.localName)||(!svgDocument&&node.localName==="svg"))node.remove();
    });
    return String(clone.textContent||"").replace(/\s+/g," ").trim();
  }

  function structuralHint(doc,href){
    const root=doc?.body||firstLocal(doc,"body")||doc?.documentElement;
    const signal=[href,root?.id,root?.className?.baseVal||root?.className||"",...([...root?.querySelectorAll?.("[id],[class]")||[]].slice(0,12).flatMap(node=>[node.id,node.className?.baseVal||node.className||""]))].join(" ");
    return VISUAL_HINT.test(signal);
  }

  function simpleRasterSvg(svg){
    if(!svg)return null;
    const images=localElements(svg,"image");
    if(images.length!==1)return null;
    const allowed=new Set(["image","title","desc"]);
    const extra=[...svg.getElementsByTagName("*")].some(node=>!allowed.has(node.localName));
    return extra?null:images[0];
  }

  function svgDimensions(svg){
    if(!svg)return null;
    try{
      const vb=svg.viewBox?.baseVal;
      if(vb?.width>0&&vb?.height>0)return{width:vb.width,height:vb.height};
    }catch{}
    const values=String(svg.getAttribute?.("viewBox")||"").trim().split(/[\s,]+/).map(Number);
    if(values.length===4&&values[2]>0&&values[3]>0)return{width:values[2],height:values[3]};
    const width=parseFloat(svg.getAttribute?.("width")),height=parseFloat(svg.getAttribute?.("height"));
    return width>0&&height>0?{width,height}:null;
  }

  function isLargeEnough(dimensions,hinted,cover){
    if(cover||hinted)return true;
    const width=Number(dimensions?.width)||0,height=Number(dimensions?.height)||0;
    if(!width||!height)return false;
    return Math.max(width,height)>=900&&(width*height)>=450000;
  }

  async function blobDimensions(blob){
    if(!blob)return null;
    if(typeof createImageBitmap==="function"){
      try{
        const bitmap=await createImageBitmap(blob),result={width:bitmap.width,height:bitmap.height};
        bitmap.close?.();
        if(result.width>0&&result.height>0)return result;
      }catch{}
    }
    return new Promise(resolve=>{
      const image=new Image(),url=URL.createObjectURL(blob);
      image.onload=()=>{const result={width:image.naturalWidth||image.width,height:image.naturalHeight||image.height};URL.revokeObjectURL(url);resolve(result.width&&result.height?result:null)};
      image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};
      image.src=url;
    });
  }

  async function normalizedRaster(blob){
    const originalDimensions=await blobDimensions(blob);
    if(!originalDimensions)return{blob,width:0,height:0,converted:false};
    if(!CONVERT_MIME.test(blob.type||""))return{blob,width:originalDimensions.width,height:originalDimensions.height,converted:false};

    let source=null,release=()=>{};
    if(typeof createImageBitmap==="function"){
      try{const bitmap=await createImageBitmap(blob);source=bitmap;release=()=>bitmap.close?.()}catch{}
    }
    if(!source){
      const loaded=await new Promise(resolve=>{
        const image=new Image(),url=URL.createObjectURL(blob);
        image.onload=()=>resolve({image,url});image.onerror=()=>{URL.revokeObjectURL(url);resolve(null)};image.src=url;
      });
      if(!loaded)return{blob,width:originalDimensions.width,height:originalDimensions.height,converted:false};
      source=loaded.image;release=()=>URL.revokeObjectURL(loaded.url);
    }
    const sourceWidth=Number(source.width||source.naturalWidth)||originalDimensions.width;
    const sourceHeight=Number(source.height||source.naturalHeight)||originalDimensions.height;
    const scale=Math.min(1,MAX_WEBP_EDGE/Math.max(sourceWidth,sourceHeight));
    const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const context=canvas.getContext("2d",{alpha:true});
    if(!context){release();return{blob,width:sourceWidth,height:sourceHeight,converted:false}}
    try{context.drawImage(source,0,0,width,height)}catch{release();return{blob,width:sourceWidth,height:sourceHeight,converted:false}}
    release();
    const webp=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.92));
    return webp?{blob:webp,width,height,converted:true}:{blob,width:originalDimensions.width,height:originalDimensions.height,converted:false};
  }

  async function dataUrlForZip(zip,path,mime="application/octet-stream"){
    const entry=zip.file(path);if(!entry)return"";
    const bytes=new Uint8Array(await entry.async("uint8array"));
    let binary="";const chunk=0x8000;
    for(let index=0;index<bytes.length;index+=chunk)binary+=String.fromCharCode(...bytes.subarray(index,index+chunk));
    return`data:${mime};base64,${btoa(binary)}`;
  }

  function mimeFromPath(path,declared=""){
    if(declared)return declared;
    const ext=(String(path||"").match(/\.([a-z0-9]+)$/i)||[])[1]?.toLowerCase();
    return({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",avif:"image/avif",gif:"image/gif",svg:"image/svg+xml"})[ext]||"application/octet-stream";
  }

  async function rasterAsset(zip,path,mime){
    const entry=zip.file(path);if(!entry)return null;
    const blob=new Blob([await entry.async("arraybuffer")],{type:mimeFromPath(path,mime)});
    if(!RASTER_MIME.test(blob.type))return null;
    return normalizedRaster(blob);
  }

  async function svgAsset(zip,svg,basePath){
    const clone=svg.cloneNode(true);
    for(const image of localElements(clone,"image")){
      const href=image.getAttribute("href")||image.getAttribute("xlink:href")||"";
      if(!href||/^(?:data:|blob:|https?:|\/\/)/i.test(href))continue;
      const path=resolvePath(dirName(basePath),href),entry=zip.file(path);if(!entry)continue;
      const data=await dataUrlForZip(zip,path,mimeFromPath(path));
      if(data){image.setAttribute("href",data);image.removeAttribute("xlink:href")}
    }
    if(!clone.getAttribute("xmlns"))clone.setAttribute("xmlns","http://www.w3.org/2000/svg");
    const serialized=new XMLSerializer().serializeToString(clone);
    const blob=new Blob([serialized],{type:"image/svg+xml"});
    const normalized=await normalizedRaster(blob);
    if(normalized.converted)return normalized;
    const dimensions=svgDimensions(clone)||await blobDimensions(blob)||{width:0,height:0};
    return{blob,width:dimensions.width||0,height:dimensions.height||0,converted:false};
  }

  async function classifySpineDocument({zip,item,coverPath}){
    const entry=zip.file(item.path);if(!entry)return null;
    const source=await entry.async("string");
    let doc=parseXml(source);
    if(broken(doc))doc=parseHtml(source);
    const root=doc.body||firstLocal(doc,"body")||doc.documentElement;
    if(!root)return null;
    const text=meaningfulText(doc);
    const svgDocument=doc.documentElement?.localName==="svg";
    if(!svgDocument&&text.length>TEXT_LIMIT)return null;

    const hinted=structuralHint(doc,item.href);
    const images=localElements(root,"img");
    const svgs=localElements(root,"svg");
    const objects=localElements(root,"object").filter(node=>node.getAttribute("data"));
    if(!images.length&&!svgs.length&&!objects.length&&doc.documentElement?.localName!=="svg")return null;
    if(images.length+svgs.length+objects.length>4&&!hinted)return null;

    let asset=null,sourcePath="",alt="",cover=false,dimensions=null,kind="visual";
    const image=images[0];
    if(image){
      const src=image.getAttribute("src")||"";
      if(src&&!/^(?:data:|blob:|https?:|\/\/)/i.test(src)){
        sourcePath=resolvePath(dirName(item.path),src);
        cover=hrefMatches(sourcePath,coverPath);
        asset=await rasterAsset(zip,sourcePath,mimeFromPath(sourcePath));
        alt=image.getAttribute("alt")||"";
      }
    }

    const svg=svgs[0]||(doc.documentElement?.localName==="svg"?doc.documentElement:null);
    if(!asset&&svg){
      const embedded=simpleRasterSvg(svg);
      if(embedded){
        const href=embedded.getAttribute("href")||embedded.getAttribute("xlink:href")||"";
        if(href&&!/^(?:data:|blob:|https?:|\/\/)/i.test(href)){
          sourcePath=resolvePath(dirName(item.path),href);
          cover=hrefMatches(sourcePath,coverPath);
          asset=await rasterAsset(zip,sourcePath,mimeFromPath(sourcePath));
        }
      }
      if(!asset){asset=await svgAsset(zip,svg,item.path);sourcePath=item.path;kind="svg"}
      dimensions=svgDimensions(svg);
    }

    if(!asset&&objects.length){
      const data=objects[0].getAttribute("data")||"";
      if(data&&!/^(?:data:|blob:|https?:|\/\/)/i.test(data)){
        sourcePath=resolvePath(dirName(item.path),data);
        const mime=mimeFromPath(sourcePath,objects[0].getAttribute("type")||"");
        if(RASTER_MIME.test(mime))asset=await rasterAsset(zip,sourcePath,mime);
        else if(mime==="image/svg+xml"){
          const svgText=await zip.file(sourcePath)?.async("string");
          if(svgText){const svgDoc=parseXml(svgText),svgRoot=svgDoc.documentElement;asset=await svgAsset(zip,svgRoot,sourcePath);dimensions=svgDimensions(svgRoot);kind="svg"}
        }
      }
    }

    if(!asset?.blob)return null;
    dimensions=dimensions||{width:asset.width,height:asset.height};
    if(!isLargeEnough(dimensions,hinted,cover))return null;

    return{
      href:item.href,
      path:item.path,
      spineIndex:item.spineIndex,
      sourcePath,
      sourceKind:kind,
      mime:asset.blob.type||mimeFromPath(sourcePath),
      width:Number(asset.width||dimensions?.width)||0,
      height:Number(asset.height||dimensions?.height)||0,
      alt,
      cover,
      blob:asset.blob,
      converted:Boolean(asset.converted)
    };
  }

  async function scanBook(bookUrl){
    const absolute=new URL(bookUrl,location.href).href;
    const response=await fetch(absolute,{cache:"force-cache",credentials:"same-origin"});
    if(!response.ok)throw new Error(`Visual-page scan failed (${response.status})`);
    const zip=await JSZip.loadAsync(await response.arrayBuffer());
    const containerEntry=zip.file("META-INF/container.xml");if(!containerEntry)throw new Error("Visual-page scan: missing container.xml");
    const container=parseXml(await containerEntry.async("string"));
    const rootfile=firstLocal(container,"rootfile")?.getAttribute("full-path")||"";
    if(!rootfile||!zip.file(rootfile))throw new Error("Visual-page scan: missing package document");
    const opf=parseXml(await zip.file(rootfile).async("string"));
    const opfDir=dirName(rootfile),manifest=new Map();
    for(const node of localElements(opf,"item")){
      const id=node.getAttribute("id")||"",href=node.getAttribute("href")||"";
      if(!id||!href)continue;
      manifest.set(id,{id,href,path:resolvePath(opfDir,href),mediaType:node.getAttribute("media-type")||"",properties:String(node.getAttribute("properties")||"").split(/\s+/).filter(Boolean)});
    }
    const coverItem=[...manifest.values()].find(item=>item.properties.includes("cover-image"));
    const coverPath=coverItem?.path||"";
    const spineNode=firstLocal(opf,"spine"),items=[];
    let spineIndex=0;
    for(const ref of spineNode?localElements(spineNode,"itemref"):[]){
      const item=manifest.get(ref.getAttribute("idref")||"");
      if(!item){spineIndex++;continue}
      const media=item.mediaType;
      if(media==="application/xhtml+xml"||media==="text/html"||media==="image/svg+xml"||/\.(?:xhtml?|html?|svg)$/i.test(item.path))items.push({...item,spineIndex});
      spineIndex++;
    }

    const visuals=[];let converted=0,reused=0;
    for(let index=0;index<items.length;index++){
      const item=items[index];
      document.dispatchEvent(new CustomEvent("sg-visual-pages-progress",{detail:{index:index+1,total:items.length,href:item.href}}));
      try{
        const visual=await classifySpineDocument({zip,item,coverPath});
        if(visual){visuals.push(visual);if(visual.converted)converted++;else reused++}
      }catch(error){console.warn(`Visual-page preparation skipped ${item.href}`,error)}
      if(index%8===7)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return{
      key:cacheKey(absolute),
      version:CACHE_VERSION,
      bookUrl:absolute,
      createdAt:Date.now(),
      scanned:items.length,
      converted,reused,visuals
    };
  }

  async function prepare(bookUrl){
    const absolute=new URL(bookUrl,location.href).href,key=cacheKey(absolute);
    if(current.ready&&current.key===key)return current.summary;
    if(current.preparing&&current.key===key)return current.preparing;
    current.key=key;current.bookUrl=absolute;current.ready=false;
    setLoadingMessage("Preparing visual pages…");
    current.preparing=(async()=>{
      const cached=await cacheGet(key);
      if(cached?.version===CACHE_VERSION&&Array.isArray(cached.visuals)){
        const result=activate(cached,true);setLoadingMessage("Opening the book…");return result;
      }
      const payload=await scanBook(absolute);
      await cachePut(payload).catch(()=>false);
      const result=activate(payload,false);setLoadingMessage("Opening the book…");return result;
    })().catch(error=>{
      current.ready=true;current.records=new Map();current.summary={cached:false,scanned:0,visualPages:0,converted:0,reused:0,error:String(error?.message||error)};
      console.warn("Standalone visual-page preparation unavailable; using EPUB source pages",error);
      document.dispatchEvent(new CustomEvent("sg-visual-pages-error",{detail:{error}}));
      setLoadingMessage("Opening the book…");
      return current.summary;
    }).finally(()=>{current.preparing=null});
    return current.preparing;
  }

  function renditionMetrics(rendition,target){
    const manager=rendition?.manager;
    let viewer=null;
    if(target?.nodeType===1)viewer=target;
    else if(typeof target==="string")viewer=document.getElementById(target)||document.querySelector(target);
    const rect=viewer?.getBoundingClientRect?.();
    const width=Math.max(240,Math.round(Number(manager?.container?.clientWidth)||Number(rect?.width)||Number(window.innerWidth)||720));
    const height=Math.max(240,Math.round(Number(manager?.container?.clientHeight)||Number(rect?.height)||Number(window.innerHeight)||800));
    return{width,height};
  }

  /* Continuous mode reshapes publication bodies through the rendition theme: the
     text-width column caps the body, auto margins center it, and vertical padding insets
     the content box. Left unopposed those rules wrapped the synthetic full-page plate in
     the prose column — landscape artwork overflowed the narrowed body and was clipped
     sideways, while the fixed-height body plus theme padding cut the bottom off portrait
     plates. In Continuous flow the stylesheet therefore gains higher-specificity,
     data-marker anchored rules that re-assert the exact one-canvas plate geometry, so no
     theme rule order can reshape a full-page image. Paginated keeps its dedicated
     inline-style frame controller (reader-paginated-visual-fit.js) and is unaffected. */
  function syntheticPageCss(width,height,continuous){
    const base=`html,body{margin:0!important;padding:0!important;width:100%!important;height:${height}px!important;min-height:${height}px!important;max-height:${height}px!important;overflow:hidden!important;overflow-anchor:none!important;box-sizing:border-box!important}body[data-sg-synthetic-visual="1"]{display:block!important;background:transparent!important}.sg-synthetic-visual-page{box-sizing:border-box!important;width:100%!important;height:${height}px!important;min-height:${height}px!important;display:grid!important;place-items:center!important;margin:0!important;padding:0!important;overflow:hidden!important}.sg-synthetic-visual-page>img{display:block!important;width:auto!important;height:auto!important;max-width:${width}px!important;max-height:${height}px!important;margin:auto!important;object-fit:contain!important}`;
    if(!continuous)return base;
    return base+`html[data-sg-synthetic-visual="1"]{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;overflow:hidden!important;box-sizing:border-box!important}html[data-sg-synthetic-visual="1"] body[data-sg-synthetic-visual="1"]{display:block!important;width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important;height:${height}px!important;min-height:${height}px!important;max-height:${height}px!important;overflow:hidden!important;overflow-anchor:none!important;box-sizing:border-box!important}`;
  }

  function applySynthetic(contents,href,metrics={}){
    const record=recordForHref(href);if(!record?.blob)return false;
    const doc=contents?.document,body=doc?.body;if(!doc?.documentElement||!doc?.head||!body)return false;
    const width=Math.max(240,Math.round(Number(metrics.width)||720));
    const height=Math.max(240,Math.round(Number(metrics.height)||800));
    if(body.dataset.sgSyntheticVisual==="1"){
      body.style.height=`${height}px`;body.style.minHeight=`${height}px`;
      const wrapper=body.querySelector(".sg-synthetic-visual-page");if(wrapper)wrapper.style.height=`${height}px`;
      return true;
    }

    const url=objectUrl(record);if(!url)return false;
    doc.head.replaceChildren();
    const meta=doc.createElement("meta");meta.setAttribute("charset","utf-8");
    const style=doc.createElement("style");
    style.textContent=syntheticPageCss(width,height,Boolean(document.body?.classList?.contains("reader-flow-scrolled")));
    doc.head.append(meta,style);
    body.replaceChildren();
    body.dataset.sgSyntheticVisual="1";
    body.style.height=`${height}px`;body.style.minHeight=`${height}px`;
    const wrapper=doc.createElement("div");wrapper.className="sg-synthetic-visual-page";wrapper.style.height=`${height}px`;
    const image=doc.createElement("img");image.src=url;image.alt=record.alt||"";image.decoding="async";image.draggable=false;
    wrapper.appendChild(image);body.appendChild(wrapper);
    doc.documentElement.dataset.sgSyntheticVisual="1";
    try{
      contents.textHeight=()=>height;
      contents.textWidth=()=>width;
      contents.__sgSyntheticVisualHeight=height;
    }catch{}
    return true;
  }

  function patchRendition(rendition,target){
    if(!rendition||rendition.__sgVisualCachePatched)return rendition;
    rendition.__sgVisualCachePatched=true;
    const patchView=view=>{
      if(!view||view.__sgVisualCacheViewPatched)return view;
      view.__sgVisualCacheViewPatched=true;
      if(typeof view.load==="function"){
        const rawLoad=view.load.bind(view);
        view.load=(...args)=>Promise.resolve(current.preparing).catch(()=>null).then(()=>rawLoad(...args)).then(result=>{
          const applied=applySynthetic(view.contents,view.section?.href,renditionMetrics(rendition,target));
          if(applied){try{view.stopExpanding=false}catch{}}
          return result;
        });
      }
      if(view.contents)applySynthetic(view.contents,view.section?.href,renditionMetrics(rendition,target));
      return view;
    };
    const install=()=>{
      const manager=rendition.manager;if(!manager||manager.__sgVisualCacheManagerPatched)return;
      manager.__sgVisualCacheManagerPatched=true;
      if(typeof manager.createView==="function"){
        const rawCreateView=manager.createView.bind(manager);
        manager.createView=(...args)=>patchView(rawCreateView(...args));
      }
      try{manager.views?.all?.().forEach(patchView)}catch{}
    };
    install();
    try{Promise.resolve(rendition.started).then(install).catch(()=>{})}catch{}
    try{rendition.on?.("started",install)}catch{}
    try{rendition.on?.("rendered",(_section,view)=>{patchView(view);applySynthetic(view?.contents,view?.section?.href,renditionMetrics(rendition,target))})}catch{}
    return rendition;
  }

  function patchBook(book){
    if(!book||book.__sgVisualCacheBookPatched||typeof book.renderTo!=="function")return book;
    book.__sgVisualCacheBookPatched=true;
    const rawRenderTo=book.renderTo.bind(book);
    book.renderTo=(target,options={})=>patchRendition(rawRenderTo(target,options),target);
    return book;
  }

  const api={
    version:CACHE_VERSION,
    prepare,
    ready:()=>current.ready,
    has:href=>Boolean(recordForHref(href)),
    get:href=>recordForHref(href),
    summary:()=>current.summary,
    applyToContents:applySynthetic,
    revoke:revokeUrls
  };
  window.__sgVisualPageCache=api;
  window.addEventListener("pagehide",revokeUrls,{once:true});
  const initialBook=new URLSearchParams(location.search).get("book");
  if(initialBook)void prepare(initialBook);

  function wrappedEpub(...args){return patchBook(baseEpub.apply(this,args))}
  try{Object.assign(wrappedEpub,baseEpub)}catch{}
  try{wrappedEpub.prototype=baseEpub.prototype}catch{}
  window.ePub=wrappedEpub;
})();
