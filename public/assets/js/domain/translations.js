/* Shadow Garden v2.1 — fan-translation provenance normalization and inheritance. */
const STATUS_ALIASES=new Map([
  ["complete","Complete"],["completed","Complete"],["finished","Complete"],
  ["ongoing","Ongoing"],["active","Ongoing"],["current","Ongoing"],
  ["stalled","Stalled"],["paused","Stalled"],["inactive","Stalled"],
  ["partial","Partial"],["incomplete","Partial"]
]);
export const translationStatuses=Object.freeze(["Complete","Ongoing","Stalled","Partial"]);
const arr=value=>Array.isArray(value)?value:[];
const text=(value,max=500)=>String(value??"").trim().slice(0,max);

export function normalizeTranslationStatus(value){return STATUS_ALIASES.get(text(value,80).toLowerCase())||""}

export function normalizeTranslationCredit(value){
  if(typeof value==="string")value={name:value};
  if(!value||typeof value!=="object")return null;
  const name=text(value.name,160);
  if(!name)return null;
  let url="";
  const raw=text(value.url,2000);
  if(raw){
    try{const parsed=new URL(raw);if(["http:","https:"].includes(parsed.protocol))url=parsed.href}catch{}
  }
  const coverage=text(value.coverage,300);
  return {name,...(url?{url}:{}),...(coverage?{coverage}:{})};
}

export function normalizeTranslations(value){
  const seen=new Set(),out=[];
  for(const raw of arr(value)){
    const credit=normalizeTranslationCredit(raw);
    if(!credit)continue;
    const key=[credit.name,credit.url||"",credit.coverage||""].join("\u0000").toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);out.push(credit);
    if(out.length>=24)break;
  }
  return out;
}

export function creditDisplayName(credit){return normalizeTranslationCredit(credit)?.name||""}

export function effectiveVolumeTranslations(series,volume){
  const own=normalizeTranslations(volume?.translations);
  return own.length?own:normalizeTranslations(series?.translations);
}

export function translatorNames(series){
  const out=[],seen=new Set();
  const add=value=>{const v=text(value,160);if(!v)return;const key=v.toLowerCase();if(seen.has(key))return;seen.add(key);out.push(v)};
  for(const credit of normalizeTranslations(series?.translations))add(credit.name);
  for(const volume of arr(series?.volumes))for(const credit of normalizeTranslations(volume?.translations))add(credit.name);
  return out;
}

export function translationSearchTerms(series){
  const values=[normalizeTranslationStatus(series?.translationStatus)];
  for(const credit of normalizeTranslations(series?.translations))values.push(credit.name,credit.coverage);
  for(const volume of arr(series?.volumes))for(const credit of normalizeTranslations(volume?.translations))values.push(credit.name,credit.coverage);
  return values.filter(Boolean);
}

export function primaryTranslator(series){
  return normalizeTranslations(series?.translations)[0]||arr(series?.volumes).flatMap(volume=>normalizeTranslations(volume?.translations))[0]||null;
}
