/* URL state is independent of DOM controls and catalog rendering. */
import {VALID_SORTS,VALID_READING_STATUSES} from '../library-model.js';

const FILTER_KEYS=['q','author','translator','genre','tag','year','vols','reading','sort','pinned','view'];
export function readLibraryLocation(input,{sort='recent',view='grid'}={}){
  const params=new URL(input).searchParams;
  return{
    query:params.get('q')||'',author:params.get('author')||'',translator:params.get('translator')||'',
    genre:params.get('genre')||'',tags:new Set(params.getAll('tag').filter(Boolean)),year:params.get('year')||'',
    volumeRange:params.get('vols')||'',readingStatus:VALID_READING_STATUSES.has(params.get('reading'))?params.get('reading'):'',
    sort:VALID_SORTS.has(params.get('sort'))?params.get('sort'):sort,pinnedOnly:params.get('pinned')==='1',
    view:['grid','compact'].includes(params.get('view'))?params.get('view'):view
  };
}
export function writeLibraryLocation(input,state){
  const url=new URL(input),params=url.searchParams;
  FILTER_KEYS.forEach(key=>params.delete(key));
  for(const [key,value] of [['q',state.query.trim()],['author',state.author],['translator',state.translator],['genre',state.genre],['year',state.year],['vols',state.volumeRange],['reading',state.readingStatus]])if(value)params.set(key,value);
  [...state.tags].sort((a,b)=>a.localeCompare(b)).forEach(tag=>params.append('tag',tag));
  if(state.sort!=='recent')params.set('sort',state.sort);
  if(state.pinnedOnly)params.set('pinned','1');
  params.set('view',state.view);
  return `${url.pathname}${params.size?'?'+params:''}${url.hash}`;
}
export function activeLibraryFilterCount(state){
  return [state.query.trim(),state.author,state.translator,state.genre,state.year,state.volumeRange,state.readingStatus,state.pinnedOnly].filter(Boolean).length+state.tags.size;
}
