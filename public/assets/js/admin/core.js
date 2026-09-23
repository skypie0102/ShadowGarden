/* Shadow Garden R5 — Garden Keeper core runtime and sole admin API client. */
(()=>{
  const root=window.ShadowGardenKeeper=window.ShadowGardenKeeper||{};
  if(root.core)return;

  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const arr=value=>Array.isArray(value)?value:[];
  const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const slug=value=>String(value||"untitled").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"untitled";
  const cleanHtml=value=>{const doc=new DOMParser().parseFromString(String(value||""),"text/html");return(doc.body?.textContent||"").replace(/\s+/g," ").trim()};
  const fmtSize=value=>{if(!value)return"";let n=Number(value),index=0;const units=["B","KB","MB","GB"];while(n>=1024&&index<3){n/=1024;index++}return`${n.toFixed(index>1?1:0)} ${units[index]}`};
  const elementsByLocal=(node,name)=>node?[...node.getElementsByTagName("*")].filter(element=>element.localName===name):[];
  const firstText=(node,name)=>elementsByLocal(node,name)[0]?.textContent?.trim()||"";
  const texts=(node,name)=>elementsByLocal(node,name).map(element=>element.textContent?.trim()||"").filter(Boolean);
  const metaNodes=node=>elementsByLocal(node,"meta");
  const metaByName=(node,name)=>metaNodes(node).find(element=>element.getAttribute("name")===name)?.getAttribute("content")||"";
  const metaByProperty=(node,name)=>metaNodes(node).find(element=>element.getAttribute("property")===name)?.textContent?.trim()||"";
  const dirName=path=>{const parts=String(path||"").split("/");parts.pop();return parts.join("/")};
  const inferSeries=title=>String(title||"Untitled").replace(/\s*(?:[-–—:]\s*)?(?:volume|vol|book)\s*\.?\s*\d+(?:\.\d+)?(?:\b.*)?$/i,"").trim()||title;
  const detectVolume=(title,file,opf)=>{const calibre=parseFloat(metaByName(opf,"calibre:series_index"));if(Number.isFinite(calibre)&&calibre>0)return calibre;const position=parseFloat(metaByProperty(opf,"group-position"));if(Number.isFinite(position)&&position>0)return position;const match=`${title} ${file}`.match(/\b(?:volume|vol|book)\s*\.?\s*(\d+(?:\.\d+)?)/i);return match?parseFloat(match[1]):1};
  const mimeExt=(type,href)=>{const ext=(String(href||"").match(/\.(jpe?g|png|webp|avif|gif)$/i)||[])[0];if(ext)return ext.toLowerCase().replace(".jpeg",".jpg");return({"image/jpeg":".jpg","image/png":".png","image/webp":".webp","image/avif":".avif","image/gif":".gif"})[type]||".jpg"};
  const mimeForExt=ext=>({".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".avif":"image/avif",".gif":"image/gif"})[ext]||"image/jpeg";

  const STATUS_ALIASES=new Map([
    ["complete","Complete"],["completed","Complete"],["finished","Complete"],
    ["ongoing","Ongoing"],["publishing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
    ["hiatus","Hiatus"],["on hiatus","Hiatus"],["paused","Hiatus"],
    ["dropped","Dropped"],["cancelled","Dropped"],["canceled","Dropped"],["discontinued","Dropped"]
  ]);
  const normalizeSeriesStatus=value=>STATUS_ALIASES.get(String(value||"").trim().toLowerCase())||"Ongoing";

  const state={
    unlocked:false,
    management:null,
    manageScope:"all",
    manageQuery:"",
    activeSeriesId:null,
    addBookTarget:null,
    uploading:false,
    batch:null
  };

  const events=new EventTarget();
  const workflows=new Map();
  function registerWorkflow(name,initializer){
    if(!name||typeof initializer!=="function")throw new TypeError("Garden Keeper workflow requires a name and initializer");
    workflows.set(name,{name,initializer,instance:null});
  }
  async function initializeWorkflow(name){
    const entry=workflows.get(name);if(!entry)throw new Error(`Unknown Garden Keeper workflow: ${name}`);
    if(entry.instance)return entry.instance;
    entry.instance=await entry.initializer(root);
    return entry.instance;
  }

  function setPill(element,label,kind=""){
    if(!element)return;
    element.textContent=label;
    element.className=`state-pill ${kind}`.trim();
  }
  function setFileState(label,kind=""){setPill($("#fileState"),label,kind)}
  function setUploadState(label,kind=""){setPill($("#uploadState"),label,kind)}
  function setAuthState(label,kind=""){setPill($("#authState"),label,kind)}
  function setStatus(title,detail,mark="✦"){
    if($("#statusTitle"))$("#statusTitle").textContent=title;
    if($("#statusDetail"))$("#statusDetail").textContent=detail;
    if($("#statusMark"))$("#statusMark").textContent=mark;
  }

  function toastHost(){
    let host=$("#adminToastHost");
    if(host)return host;
    host=document.createElement("div");host.id="adminToastHost";host.className="admin-toast-host";host.setAttribute("aria-live","polite");host.setAttribute("aria-atomic","true");document.body.appendChild(host);return host;
  }
  function toast(message,kind="success"){
    const item=document.createElement("div");item.className=`admin-toast ${kind}`.trim();item.setAttribute("role","status");item.textContent=message;toastHost().appendChild(item);
    setTimeout(()=>{item.classList.add("leaving");setTimeout(()=>item.remove(),180)},2600);
  }

  async function hash8(blob){
    const hash=await crypto.subtle.digest("SHA-1",await blob.arrayBuffer());
    return[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,"0")).join("").slice(0,8);
  }

  async function imageSource(blob){
    if(typeof createImageBitmap==="function"){
      let bitmap;try{bitmap=await createImageBitmap(blob,{imageOrientation:"from-image"})}catch{bitmap=await createImageBitmap(blob)}
      return{source:bitmap,width:bitmap.width,height:bitmap.height,close:()=>bitmap.close?.()};
    }
    const url=URL.createObjectURL(blob),image=new Image();
    try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Cover image could not be decoded"));image.src=url});return{source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>URL.revokeObjectURL(url)}}catch(error){URL.revokeObjectURL(url);throw error}
  }
  async function renderWebp(image,maxWidth,quality){
    if(!image.width||!image.height)throw new Error("Cover has invalid dimensions");
    const scale=Math.min(1,maxWidth/image.width),width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const context=canvas.getContext("2d",{alpha:true});if(!context)throw new Error("Canvas is unavailable");
    context.imageSmoothingEnabled=true;context.imageSmoothingQuality="high";context.drawImage(image.source,0,0,width,height);
    const output=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));canvas.width=1;canvas.height=1;if(!output||output.type!=="image/webp")throw new Error("WebP encoding is unavailable");return output;
  }
  async function optimizedCoverSet(blob){
    let image;try{image=await imageSource(blob);const detail=await renderWebp(image,1000,.84),thumb=await renderWebp(image,480,.78);return{detail,thumb,optimized:true}}
    catch(error){console.warn("Cover optimization unavailable; using original cover",error);return{detail:blob,thumb:null,optimized:false}}
    finally{image?.close?.()}
  }

  class AdminClient{
    #authorized=false;
    #coverRoots=new Map();
    #coverKeys=new Map();
    #bookKeys=new Map();
    #revision=null;

    token(){return $("#adminToken")?.value.trim()||""}
    isAuthorized(){return this.#authorized}
    markUnlocked(){this.#authorized=true}
    markLocked(){this.#authorized=false}

    timeoutFor(path,method){
      if(String(path).startsWith("/admin-api/upload"))return 180000;
      if(path==="/admin-api/catalog"&&method==="POST")return 60000;
      if(path==="/admin-api/library"&&method==="GET")return 8000;
      return 30000;
    }

    randomCoverId(){
      if(!globalThis.crypto?.getRandomValues)throw new Error("Secure random cover identifiers are unavailable in this browser.");
      const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);let binary="";for(const value of bytes)binary+=String.fromCharCode(value);
      return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
    }

    opaqueCoverKey(key){
      const raw=String(key||""),prefix="shadow-garden/covers/",opaque=/^shadow-garden\/covers\/cv_[A-Za-z0-9_-]{20,64}-(?:detail|thumb)\.[A-Za-z0-9]+$/i;
      if(!raw.startsWith(prefix)||opaque.test(raw))return raw;
      if(this.#coverKeys.has(raw))return this.#coverKeys.get(raw);
      const extension=(raw.match(/(\.[A-Za-z0-9]+)$/)||[])[1]?.toLowerCase();if(!extension)throw new Error("Cover upload is missing a file extension.");
      const stem=raw.slice(prefix.length,-extension.length),variant=stem.match(/^(.*)-(detail|thumb)$/i),rootKey=variant?variant[1]:stem,kind=(variant?.[2]||"detail").toLowerCase();
      let id=this.#coverRoots.get(rootKey);if(!id){id=this.randomCoverId();this.#coverRoots.set(rootKey,id)}
      const mapped=`${prefix}cv_${id}-${kind}${extension}`;this.#coverKeys.set(raw,mapped);return mapped;
    }

    rewriteCoverKeys(value){
      if(Array.isArray(value))return value.map(item=>this.rewriteCoverKeys(item));
      if(!value||typeof value!=="object")return value;
      const copy={};for(const [key,item] of Object.entries(value))copy[key]=key==="epubKey"&&typeof item==="string"?(this.#bookKeys.get(item)||item):(key==="coverKey"||key==="coverThumbKey")&&typeof item==="string"?(this.#coverKeys.get(item)||item):this.rewriteCoverKeys(item);return copy;
    }

    transformPayload(path,method,payload){
      let body=this.rewriteCoverKeys(payload);
      if(path==="/admin-api/catalog"&&method==="POST"&&body&&typeof body==="object"){
        const target=state.addBookTarget;
        if(target){body={...body,targetSeriesId:target.id,series:target.title,adult:target.scope==="adult"};if(!String(body.author||"").trim()&&target.author)body.author=target.author}
        if(body.status)body.status=normalizeSeriesStatus(body.status);
        else{
          const shelf=body.adult?arr(state.batch?.library?.adult||state.management?.adult):arr(state.batch?.library?.main||state.management?.main);
          const id=`${body.adult?"adult-":""}${slug(body.series)}`;
          const exists=Boolean(body.targetSeriesId)||shelf.some(series=>series?.id===id||slug(series?.title)===slug(body.series));
          if(!exists)body.status="Ongoing";
        }
      }
      return body;
    }

    async request(path,options={},internal={}){
      const method=String(options.method||"GET").toUpperCase();
      if(String(path).startsWith("/admin-api/")){if(!internal.allowLocked&&!this.#authorized)throw new Error("Garden Keeper is locked.");if(!this.token())throw new Error("Admin token is required.")}
      const headers=new Headers(options.headers||{});if(String(path).startsWith("/admin-api/"))headers.set("authorization",`Bearer ${this.token()}`);
      if(method==="POST"&&this.#revision!==null&&/^\/admin-api\/(catalog|library|maintenance|translations|series-banner)$/.test(path))headers.set("if-match",String(this.#revision));
      let body=options.body;
      if(typeof body==="string"&&String(headers.get("content-type")||"").includes("application/json")){
        try{body=JSON.stringify(this.transformPayload(path,method,JSON.parse(body)))}catch{}
      }
      const controller=options.signal?null:new AbortController(),timeoutMs=this.timeoutFor(path,method),timer=controller?setTimeout(()=>controller.abort(),timeoutMs):0;
      try{
        const response=await fetch(path,{...options,method,headers,body,credentials:"same-origin",cache:"no-store",signal:options.signal||controller?.signal});
        let data={};try{data=await response.json()}catch{}
        if(!response.ok){
          if(response.status===401||response.status===403)events.dispatchEvent(new CustomEvent("session:rejected",{detail:{path,status:response.status}}));
          throw new Error(data.detail||data.error||`Request failed (${response.status})`);
        }
        if(Number.isInteger(data.revision))this.#revision=data.revision;
        return data;
      }catch(error){
        if(error?.name==="AbortError")throw new Error(path.startsWith("/admin-api/upload")?`Upload timed out after ${Math.round(timeoutMs/1000)} seconds. Check the connection and try again.`:`Garden Keeper request timed out after ${Math.round(timeoutMs/1000)} seconds.`);
        throw error;
      }finally{if(timer)clearTimeout(timer)}
    }

    verifySession(){return this.request("/admin-api/status",{method:"POST"},{allowLocked:true})}
    async uploadObject(key,blob,type){let mapped=this.opaqueCoverKey(key);if(String(key).startsWith("shadow-garden/books/")){mapped=`shadow-garden/books/book_${this.randomCoverId()}.epub`;this.#bookKeys.set(key,mapped)}return this.request(`/admin-api/upload?key=${encodeURIComponent(mapped)}`,{method:"POST",headers:{"content-type":type||"application/octet-stream"},body:blob})}
    async closeSession(){this.markLocked();try{await fetch("/admin-access",{method:"DELETE",credentials:"same-origin",cache:"no-store",keepalive:true})}catch{}}
  }

  const client=new AdminClient();
  root.core={state,events,workflows,registerWorkflow,initializeWorkflow};
  root.state=state;root.events=events;root.client=client;root.registerWorkflow=registerWorkflow;root.initializeWorkflow=initializeWorkflow;
  root.util={$,$$,arr,esc,slug,cleanHtml,fmtSize,elementsByLocal,firstText,texts,metaByName,metaByProperty,dirName,inferSeries,detectVolume,mimeExt,mimeForExt,normalizeSeriesStatus,hash8,optimizedCoverSet};
  root.ui={setPill,setFileState,setUploadState,setAuthState,setStatus,toast};

  /* Compatibility bridge for retained Upload internals. R5 forbids later layers from replacing
     these bindings; every admin request still passes through the single AdminClient above. */
  Object.assign(window,{$,$$,state,arr,esc,slug,cleanHtml,fmtSize,elementsByLocal,firstText,texts,metaByName,metaByProperty,dirName,inferSeries,detectVolume,mimeExt,mimeForExt,hash8,optimizedCoverSet,setFileState,setUploadState,setAuthState,setStatus});
  const api=(path,options={})=>client.request(path,options);api.__sgUploadResilient=true;window.api=api;
  window.uploadObject=(key,blob,type)=>client.uploadObject(key,blob,type);
})();
