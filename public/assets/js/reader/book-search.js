/* Shadow Garden v2.8 — bounded EPUB text-search engine shared by Contents search. */
const MIN_QUERY_LENGTH=3;
const MAX_RESULTS=100;
const EXCERPT_RADIUS=78;
const SHOW_TEXT=4;

export function normalizeBookSearchQuery(value){
  return String(value||"").replace(/\s+/g," ").trim();
}

export function buildBookSearchPattern(value){
  const query=normalizeBookSearchQuery(value);
  if(query.length<MIN_QUERY_LENGTH)return null;
  const escaped=query.split(" ").map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  return new RegExp(escaped.join("\\s+"),"gi");
}

function searchableTextNodes(document){
  const root=document?.body||document?.documentElement;
  if(!root||typeof document.createTreeWalker!=="function")return[];
  const walker=document.createTreeWalker(root,SHOW_TEXT);
  const nodes=[];
  let node;
  while((node=walker.nextNode())){
    const parent=node.parentElement;
    if(!node.nodeValue||!node.nodeValue.trim())continue;
    if(parent?.closest?.("script,style,noscript,svg"))continue;
    nodes.push(node);
  }
  return nodes;
}

function sectionTextMap(document){
  const chunks=[];
  let text="";
  for(const node of searchableTextNodes(document)){
    if(text)text+=" ";
    const start=text.length,value=node.nodeValue||"";
    text+=value;
    chunks.push({node,start,end:start+value.length});
  }
  return{text,chunks};
}

function rangePosition(chunks,index,{end=false}={}){
  for(let i=0;i<chunks.length;i++){
    const chunk=chunks[i];
    if(index>=chunk.start&&index<chunk.end)return{node:chunk.node,offset:index-chunk.start};
    if(end&&index===chunk.end)return{node:chunk.node,offset:chunk.end-chunk.start};
    if(index<chunk.start){
      const target=end?chunks[Math.max(0,i-1)]:chunk;
      return{node:target.node,offset:end?target.end-target.start:0};
    }
  }
  const last=chunks[chunks.length-1];
  return last?{node:last.node,offset:last.end-last.start}:null;
}

function excerptFor(text,start,end){
  const from=Math.max(0,start-EXCERPT_RADIUS),to=Math.min(text.length,end+EXCERPT_RADIUS);
  const excerpt=text.slice(from,to).replace(/\s+/g," ").trim();
  return`${from>0?"…":""}${excerpt}${to<text.length?"…":""}`;
}

export function findSectionMatches(section,query,limit=MAX_RESULTS){
  const pattern=buildBookSearchPattern(query);
  const document=section?.document;
  if(!pattern||!document||limit<=0)return[];
  const{text,chunks}=sectionTextMap(document);
  if(!text||!chunks.length)return[];
  const matches=[];
  let match;
  while(matches.length<limit&&(match=pattern.exec(text))){
    const start=rangePosition(chunks,match.index),lastIndex=match.index+Math.max(1,match[0].length)-1,end=rangePosition(chunks,lastIndex);
    if(start&&end){
      try{
        const range=document.createRange();
        range.setStart(start.node,start.offset);
        range.setEnd(end.node,end.offset+1);
        matches.push({cfi:section.cfiFromRange(range),excerpt:excerptFor(text,match.index,match.index+match[0].length)});
      }catch(error){console.warn("Book search match skipped",error)}
    }
    if(match[0].length===0)pattern.lastIndex+=1;
  }
  return matches;
}

export function createBookSearchController({getBook}={}){
  let runId=0;
  let busy=false;

  function cancel(){if(busy)runId+=1;busy=false}

  async function search(rawQuery,{onProgress}={}){
    const query=normalizeBookSearchQuery(rawQuery);
    if(query.length<MIN_QUERY_LENGTH){cancel();return{hits:[],capped:false,tooShort:true,totalSections:0}}
    const book=getBook?.();
    const sections=Array.isArray(book?.spine?.spineItems)?book.spine.spineItems:[];
    if(!book||!sections.length)return{hits:[],capped:false,unavailable:true,totalSections:0};

    const id=++runId,hits=[];
    busy=true;
    onProgress?.({scanned:0,total:sections.length,count:0});
    for(let index=0;index<sections.length&&hits.length<MAX_RESULTS;index++){
      if(id!==runId)return{hits:[],capped:false,cancelled:true,totalSections:sections.length};
      const section=sections[index];
      const wasLoaded=Boolean(section?.contents);
      try{
        await section.load(book.load.bind(book));
        if(id!==runId)return{hits:[],capped:false,cancelled:true,totalSections:sections.length};
        const remaining=MAX_RESULTS-hits.length;
        const matches=findSectionMatches(section,query,remaining);
        for(const match of matches)hits.push({...match,href:section.href||"",sectionIndex:Number(section.index)});
      }catch(error){console.warn(`Book search skipped section ${section?.href||index}`,error)}finally{
        if(!wasLoaded){try{section?.unload?.()}catch{}}
      }
      if(id===runId)onProgress?.({scanned:Math.min(index+1,sections.length),total:sections.length,count:hits.length});
      await Promise.resolve();
    }
    if(id!==runId)return{hits:[],capped:false,cancelled:true,totalSections:sections.length};
    busy=false;
    return{hits,capped:hits.length>=MAX_RESULTS,totalSections:sections.length};
  }

  return{search,cancel,isBusy:()=>busy,minQueryLength:MIN_QUERY_LENGTH,maxResults:MAX_RESULTS};
}
