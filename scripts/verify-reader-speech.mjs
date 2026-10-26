import { boundedBytes } from '../server/http.js';
import { PRODUCTION_ORIGIN } from './verify-production.mjs';
import { EDGE_DEFAULT_VOICE } from '../server/edge-speech.js';

// Only public metadata and requests rejected before synthesis/rate-limit writes.
// No Garden Pass cookie or publication text is used by release verification.
export async function verifyReaderSpeech({fetchImpl=fetch}={}){
  const checks=[];
  const request=async(method,body,origin,expected)=>{
    const response=await fetchImpl(PRODUCTION_ORIGIN+'/tts',{
      method,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(30_000),
      headers:{accept:'application/json','cache-control':'no-cache',...(origin?{origin}:{}),...(body?{'content-type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    if(response.status!==expected){await response.body?.cancel();throw Error(`Reader speech ${method} returned HTTP ${response.status}; expected ${expected}.`);}
    if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('Reader speech did not return JSON.');}
    // fetch can decode compression while retaining the wire Content-Length.
    // Bound the decoded stream without treating that header as its byte count.
    const bytes=await boundedBytes(new Response(response.body),1024*1024);
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('Reader speech returned invalid JSON.');}
  };
  const voices=await request('GET',undefined,undefined,200);
  if(voices?.ok!==true||voices.provider!=='edge'||voices.defaultVoice!==EDGE_DEFAULT_VOICE||!Array.isArray(voices.voices)||!voices.voices.some(v=>v.id===voices.defaultVoice))throw Error('Reader speech default voice is unavailable.');
  checks.push({method:'GET',status:200});
  const passage={text:'Original release verification text.',voice:voices.defaultVoice};
  for(const [name,method,body,origin,status,code] of [
    ['garden-pass','POST',passage,PRODUCTION_ORIGIN,428,'human_verification_required'],
    ['text-limit','POST',{...passage,text:'a'.repeat(1201)},PRODUCTION_ORIGIN,400,'invalid_tts_text'],
    ['ornament-text','POST',{...passage,text:'❦ ✦ ***'},PRODUCTION_ORIGIN,400,'invalid_tts_text'],
    ['origin','POST',passage,'https://example.com',403,'cross_origin'],
    ['method','PUT',undefined,undefined,405,'method_not_allowed']
  ]){
    const result=await request(method,body,origin,status);
    if(result?.ok!==false||result.code!==code)throw Error(`Reader speech ${name} guard did not reject as expected.`);
    checks.push({name,method,status,code});
  }
  return {voiceCount:voices.voices.length,defaultVoice:voices.defaultVoice,checks};
}
