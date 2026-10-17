// Opt-in investigation harness. Only the routed browser response is instrumented;
// neither the checkout's production module nor its build output is rewritten.
import {readFile} from 'node:fs/promises';

export function instrumentContinuousLayout(source){
  const replace=(before,after)=>{
    if(source.split(before).length!==2)throw new Error('Continuous diagnostic seam changed: '+before);
    source=source.replace(before,after);
  };
  replace('let anchor=null;const generation=', 'let anchor=null,probeId=null;const generation=');
  const chosen="anchor=(!document.body.classList.contains('reader-image-focused')&&contentLayoutAnchor(manager))||visibleView(manager);";
  replace(chosen,chosen+`
    probeId=globalThis.__sgScrollProbe?.begin({anchorIndex:(manager.views?.all?.()||[]).find(view=>view.element===anchor?.element)?.section.index,
      anchorKind:anchor?.node?'block':'view',anchorNode:anchor?.node?.id||null,
      anchorBlockIndex:anchor?.node?[...anchor.node.ownerDocument.querySelectorAll('p,li,dd,dt,blockquote,pre,h1,h2,h3,h4,h5,h6,figcaption,figure,td,th,.sg-synthetic-visual-page')].indexOf(anchor.node):null,
      expectedTop:anchor?.top,generation});`);
  const delta="const delta=manager.settings?.axis==='horizontal'?rect.left-anchor.left:top-anchor.top;";
  replace(delta,delta+'\n      globalThis.__sgScrollProbe?.correction(probeId,{top,delta});');
  const end='    rememberContinuousLayout(manager);\n  }\n}';
  replace(end,'    rememberContinuousLayout(manager);\n    globalThis.__sgScrollProbe?.end(probeId);\n  }\n}');
  return source;
}

export async function installScrollDiagnostics(page){
  const source=await readFile(new URL('../../public/assets/js/reader/continuous-layout.js',import.meta.url),'utf8');
  const body=instrumentContinuousLayout(source);
  await page.route('**/assets/js/reader/continuous-layout.js',route=>route.fulfill({body,contentType:'application/javascript'}));
  await page.addInitScript(()=>{
    const probe=window.__sgScrollProbe={events:[],serial:0,active:null,enabled:false,lastRead:null,
      begin(data){if(!this.enabled)return null;const id=++this.serial;this.events.push({...data,type:'begin',id,atMs:performance.now()});this.active=id;return id},
      correction(id,data){if(id!==null&&id!==undefined)this.events.push({...data,type:'correction',id,atMs:performance.now()})},
      end(id){if(id!==null&&id!==undefined){this.events.push({type:'end',id,atMs:performance.now()});this.active=null}},
      start(manager){
        const container=manager.container,native=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
        if(Object.hasOwn(container,'scrollTop')||!native?.get||!native?.set)throw new Error('Unexpected scrollTop descriptor');
        this.events=[];this.serial=0;this.active=null;this.lastRead=null;this.enabled=true;
        Object.defineProperty(container,'scrollTop',{configurable:true,
          get(){const value=native.get.call(this);probe.lastRead=value;return value},
          set(value){probe.events.push({type:'scrollWrite',atMs:performance.now(),transaction:probe.active,lastRead:probe.lastRead,to:value});native.set.call(this,value)}});
        this.restore=()=>{delete container.scrollTop};
      },
      stop(){this.enabled=false;this.restore?.();this.restore=null}
    };
  });
}
