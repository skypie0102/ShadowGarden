/* Shadow Garden v2.3 — canonical Novel Updates genre taxonomy + EPUB subject normalization. */

export const CANONICAL_GENRES = Object.freeze([
  "Action","Adult","Adventure","Comedy","Drama","Ecchi","Fantasy","Gender Bender","Harem","Historical","Horror","Josei","Martial Arts","Mature","Mecha","Mystery","Psychological","Romance","School Life","Sci-fi","Seinen","Shoujo","Shoujo Ai","Shounen","Shounen Ai","Slice of Life","Smut","Sports","Supernatural","Tragedy","Wuxia","Xianxia","Xuanhuan","Yaoi","Yuri"
]);

const normalizeKey=value=>String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[‐‑‒–—]/g,"-").replace(/\s+/g," ").trim();
const cleanDisplay=value=>String(value??"").replace(/\s+/g," ").trim();
const GENRE_BY_KEY=new Map(CANONICAL_GENRES.map(value=>[normalizeKey(value),value]));
const GENERIC=new Set(["fiction","general","fiction general","general fiction","literature","literary fiction","juvenile fiction","young adult fiction","books","novels","novel"]);
const TAG_ALIASES=new Map([["light novels","Light Novel"],["light novel","Light Novel"],["web novels","Webnovel"],["web novel","Webnovel"]]);
const GENRE_ALIASES=new Map([
  ["science fiction",["Sci-fi"]],["sci fi",["Sci-fi"]],["sci-fi",["Sci-fi"]],["science-fiction",["Sci-fi"]],
  ["fantasy fiction",["Fantasy"]],["romance fiction",["Romance"]],["horror fiction",["Horror"]],["historical fiction",["Historical"]],
  ["mystery fiction",["Mystery"]],["mystery & detective",["Mystery"]],["mystery and detective",["Mystery"]],
  ["action & adventure",["Action","Adventure"]],["action and adventure",["Action","Adventure"]],
  ["martial arts fiction",["Martial Arts"]],["school life fiction",["School Life"]],["supernatural fiction",["Supernatural"]],
  ["gender-bender",["Gender Bender"]],["gender bender fiction",["Gender Bender"]],
  ["slice-of-life",["Slice of Life"]],["slice of life fiction",["Slice of Life"]]
]);

function addUnique(list,seen,value){const key=normalizeKey(value);if(!key||seen.has(key))return;seen.add(key);list.push(value)}
function canonicalGenresFor(value){
  const key=normalizeKey(value);if(!key)return[];
  if(GENRE_BY_KEY.has(key))return[GENRE_BY_KEY.get(key)];
  if(GENRE_ALIASES.has(key))return GENRE_ALIASES.get(key);
  if(key.endsWith(" fiction")){
    const base=key.slice(0,-8).trim();
    if(GENRE_BY_KEY.has(base))return[GENRE_BY_KEY.get(base)];
  }
  return[];
}
function splitSubject(value){
  const clean=cleanDisplay(value);if(!clean)return[];
  return clean.split(/\s*(?:\/|>|\||::|→)\s*/).map(part=>part.trim()).filter(Boolean);
}

export function normalizeGenres(values){
  const found=new Set();
  for(const value of Array.isArray(values)?values:[]){for(const genre of canonicalGenresFor(value))found.add(genre)}
  return CANONICAL_GENRES.filter(genre=>found.has(genre));
}

export function classifySubjects(values){
  const genres=[],genreSeen=new Set(),tags=[],tagSeen=new Set(),rawSubjects=[];
  for(const raw of Array.isArray(values)?values:[]){
    const source=cleanDisplay(raw);if(!source)continue;addUnique(rawSubjects,new Set(rawSubjects.map(normalizeKey)),source);
    const wholeGenres=canonicalGenresFor(source);
    if(wholeGenres.length){for(const genre of wholeGenres)addUnique(genres,genreSeen,genre);continue}
    for(const part of splitSubject(source)){
      const key=normalizeKey(part);if(!key||GENERIC.has(key))continue;
      const mapped=canonicalGenresFor(part);
      if(mapped.length){for(const genre of mapped)addUnique(genres,genreSeen,genre);continue}
      const aliasTag=TAG_ALIASES.get(key);
      addUnique(tags,tagSeen,aliasTag||part);
    }
  }
  const orderedGenres=CANONICAL_GENRES.filter(genre=>genreSeen.has(normalizeKey(genre)));
  const genreKeys=new Set(orderedGenres.map(normalizeKey));
  const cleanTags=tags.filter(tag=>!genreKeys.has(normalizeKey(tag))&&!GENERIC.has(normalizeKey(tag)));
  return{genres:orderedGenres,tags:cleanTags,rawSubjects};
}

export function normalizeTags(values,{genres=[]}={}){
  const classified=classifySubjects(values),genreKeys=new Set([...genres,...classified.genres].map(normalizeKey)),tags=[],seen=new Set();
  for(const value of classified.tags){const key=normalizeKey(value);if(!key||genreKeys.has(key)||GENERIC.has(key)||seen.has(key))continue;seen.add(key);tags.push(value)}
  return tags;
}

export function normalizeSeriesTaxonomy(series={}){
  const classified=classifySubjects([...(Array.isArray(series.genres)?series.genres:[]),...(Array.isArray(series.tags)?series.tags:[])]);
  return{genres:classified.genres,tags:normalizeTags(classified.tags,{genres:classified.genres})};
}

export function taxonomyDiff(series={}){
  const next=normalizeSeriesTaxonomy(series),beforeGenres=Array.isArray(series.genres)?series.genres:[],beforeTags=Array.isArray(series.tags)?series.tags:[];
  return{...next,changed:JSON.stringify(beforeGenres)!==JSON.stringify(next.genres)||JSON.stringify(beforeTags)!==JSON.stringify(next.tags)};
}
