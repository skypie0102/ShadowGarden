import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyReaderSpeech} from '../scripts/verify-reader-speech.mjs';
import {PRODUCTION_ORIGIN} from '../scripts/verify-production.mjs';

const voice='en-US-BrianMultilingualNeural';
const metadata=()=>Response.json({ok:true,provider:'edge',defaultVoice:voice,voices:[{id:voice}]});
const codes={428:'human_verification_required',400:'invalid_tts_text',403:'cross_origin',405:'method_not_allowed'};
function fixture(override){
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    if(options.method==='GET')return override?.(options)||metadata();
    const text=options.body?JSON.parse(options.body).text:'';
    const status=options.method==='PUT'?405:options.headers.origin!==PRODUCTION_ORIGIN?403:text.length>1200||text==='❦ ✦ ***'?400:428;
    return override?.(options,status)||Response.json({ok:false,code:codes[status]}, {status});
  };
  return {calls,fetchImpl};
}

test('release checks prove public voice availability and rejected synthesis without book text or credentials',async()=>{
  const f=fixture(),report=await verifyReaderSpeech(f);
  assert.equal(report.voiceCount,1);assert.equal(report.defaultVoice,voice);assert.equal(report.checks.length,6);
  assert.deepEqual(report.checks.find(check=>check.name==='ornament-text'),{name:'ornament-text',method:'POST',status:400,code:'invalid_tts_text'});
  for(const {url,options} of f.calls){
    assert.equal(url,PRODUCTION_ORIGIN+'/tts');assert.equal(options.redirect,'manual');
    assert.equal(options.headers.cookie,undefined);assert.equal(options.headers.authorization,undefined);
    assert.ok(options.signal instanceof AbortSignal);
  }
  assert.equal(JSON.parse(f.calls[1].options.body).text,'Original release verification text.');
});

test('missing routes, provider failures, HTML and missing default voices cannot pass release verification',async()=>{
  for(const response of [()=>new Response('not found',{status:404}),()=>new Response('unavailable',{status:503}),()=>new Response('<html>OK</html>'),()=>Response.json({ok:true,provider:'edge',defaultVoice:voice,voices:[]})]){
    const f=fixture(options=>options.method==='GET'?response():undefined);
    await assert.rejects(verifyReaderSpeech(f),/Reader speech/);assert.equal(f.calls.length,1);
  }
});

test('decoded HTTP bodies are checked independently of retained compressed Content-Length',async()=>{
  const f=fixture(options=>options.method==='GET'?Response.json({ok:true,provider:'edge',defaultVoice:voice,voices:[{id:voice}]},{headers:{'content-encoding':'gzip','content-length':'1'}}):undefined);
  assert.equal((await verifyReaderSpeech(f)).voiceCount,1);
});

test('unexpected synthesis access or a mismatched rejection code fails release verification',async()=>{
  for(const response of [()=>Response.json({ok:true}),()=>Response.json({ok:false,code:'wrong_guard'},{status:428})]){
    const f=fixture(options=>options.method==='POST'?response():undefined);
    await assert.rejects(verifyReaderSpeech(f),/Reader speech/);assert.equal(f.calls.length,2);
  }
});
