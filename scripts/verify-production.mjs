import {createHash} from 'node:crypto';
import {readFile,realpath,writeFile} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inspectCatalog} from '../server/catalog-document.js';
import {publicCatalog} from '../server/state.js';
import {assertDeployedBindings,assertCatalogUnchanged} from './pages-release-guard.mjs';
import {verifyServedVersion} from './served-version.mjs';

export const PRODUCTION_ORIGIN='https://shadowgarden-bon.pages.dev';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const configurationKey=value=>({...value,compatibility_flags:[...(value.compatibility_flags||[])].sort()});
const sha=value=>createHash('sha256').update(value).digest('hex');
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const requireValue=(condition,message)=>{if(!condition)throw Error(message);};

export function validateProductionBaseline(baseline,config,{now=Date.now(),maxAgeMs=15*60_000}={}){
  requireValue(baseline?.schemaVersion===1&&baseline.projectName===config.name&&baseline.databaseId===config.d1_databases?.find(binding=>binding.binding==='DB')?.database_id,'Baseline targets the wrong production resources.');
  const age=now-Date.parse(baseline.checkedAt);
  requireValue(validDate(baseline.checkedAt)&&age>=-30_000&&age<=maxAgeMs,'Baseline timestamp is invalid or stale; capture production again.');
  const deployment=baseline.deployment;
  requireValue(typeof deployment?.id==='string'&&/^[a-f0-9-]{36}$/.test(deployment.id)&&/^[a-f0-9]{40}$/.test(deployment.source)&&deployment.environment==='production'&&deployment.status==='success','Baseline canonical deployment is invalid or unsuccessful.');
  for(const configuration of [baseline.actual,baseline.saved]){
    requireValue(configuration&&typeof configuration.env_vars==='object'&&configuration.env_vars!==null,'Baseline configuration is missing.');
    for(const setting of Object.values(configuration.env_vars))requireValue(setting&&(setting.type==='plain_text'&&typeof setting.value==='string'||setting.type==='secret_text'&&!Object.hasOwn(setting,'value')),'Baseline setting metadata is invalid.');
    assertDeployedBindings({...configuration,environment:'production',project_name:config.name},config);
  }
  requireValue(equal(configurationKey(baseline.actual),configurationKey(baseline.saved)),'Actual and saved production settings differ.');
  const database=baseline.database;
  requireValue(baseline.databaseWrites===0&&Number.isSafeInteger(database?.revision)&&database.revision>=0&&validDate(database.updatedAt)&&typeof database.document==='string'&&sha(database.document)===database.documentSha256,'Baseline database record is invalid or its checksum differs.');
  const {document,error}=inspectCatalog(database.document);
  requireValue(!error,'Baseline catalog is structurally invalid.');
  requireValue(Array.isArray(database.snapshots),'Baseline snapshot history is missing.');
  const ids=new Set();
  for(const snapshot of database.snapshots){
    requireValue(typeof snapshot.id==='string'&&snapshot.id.length>0&&!ids.has(snapshot.id)&&validDate(snapshot.created_at)&&/^[a-f0-9]{64}$/.test(snapshot.sha256)&&snapshot.actualSha256===snapshot.sha256,'Baseline snapshot identity or checksum is invalid.');
    ids.add(snapshot.id);
  }
  const row={document,updated_at:database.updatedAt};
  return {main:publicCatalog(row,false),adult:publicCatalog(row,true)};
}

export function assertProductionPreserved(before,after,config,options){
  // A pre-release record may be older; only the current record must be fresh.
  validateProductionBaseline(before,config,{...options,maxAgeMs:Infinity});
  validateProductionBaseline(after,config,options);
  requireValue(Date.parse(before.checkedAt)<=Date.parse(after.checkedAt),'Pre-release baseline is newer than the current baseline.');
  const state=baseline=>({database:baseline.database,actual:configurationKey(baseline.actual),saved:configurationKey(baseline.saved)});
  requireValue(equal(state(before),state(after)),'Production data, snapshots or configuration changed; inspect before accepting the release.');
}

async function getBytes(fetchImpl,path,{timeoutMs=15_000,maxBytes=4*1024*1024}={}){
  const response=await fetchImpl(PRODUCTION_ORIGIN+path,{method:'GET',redirect:'manual',cache:'no-store',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(Math.ceil(timeoutMs))});
  if(response.status!==200){await response.body?.cancel();throw Error(`Production GET ${path} returned HTTP ${response.status}.`);}
  const chunks=[];let size=0;
  if(response.body){
    const reader=response.body.getReader();
    try{
      while(true){
        const {done,value}=await reader.read();if(done)break;
        size+=value.byteLength;
        if(size>maxBytes){await reader.cancel();throw Error(`Production response exceeds verification limit: ${path}`);}
        chunks.push(Buffer.from(value));
      }
    }finally{reader.releaseLock();}
  }
  return {bytes:Buffer.concat(chunks),contentType:response.headers.get('content-type')||''};
}

export async function verifyProduction({baseline,before,config,distDir,version,source,files,fetchImpl=fetch,now=Date.now,waitForPreviousVersion=false,sleep,clock}){
  const currentTime=()=>typeof now==='function'?now():now;
  const checkedAt=currentTime();
  const catalogs=validateProductionBaseline(baseline,config,{now:checkedAt});
  if(before)assertProductionPreserved(before,baseline,config,{now:checkedAt});
  requireValue(typeof version==='string'&&/^\d+\.\d+\.\d+$/.test(version)&&source===baseline.deployment.source,'Expected version/source is invalid or differs from canonical production.');
  requireValue(Array.isArray(files)&&files.length>0&&files.length<=100&&new Set(files).size===files.length,'Provide 1–100 unique reviewed asset paths.');
  const root=await realpath(distDir),assets=[];
  for(const file of files){
    requireValue(typeof file==='string'&&/^assets\/[A-Za-z0-9_./-]+\.(js|css)$/.test(file)&&!file.split('/').some(part=>!part||part==='.'||part==='..'),'Reviewed assets must be safe dist-relative JS/CSS paths.');
    const path=await realpath(resolve(root,file)),within=relative(root,path);
    requireValue(within&&!within.startsWith('..'+sep)&&within!=='..'&&!within.startsWith(sep),'Reviewed asset escapes the release directory.');
    assets.push({file,bytes:await readFile(path)});
  }
  const localVersion=JSON.parse(await readFile(resolve(root,'data/version.json'),'utf8'));
  requireValue(localVersion.version===version&&localVersion.releaseVersion===version&&localVersion.commit===source&&localVersion.branch==='main','Local dist version does not match the reviewed production source.');
  const checks=[];
  const getJson=async(path,options)=>{
    const result=await getBytes(fetchImpl,path,options);
    requireValue(/^application\/json(?:\s*;|$)/i.test(result.contentType),`Production JSON content type is invalid: ${path}`);
    let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(result.bytes));}catch{throw Error(`Production JSON is invalid: ${path}`);}
    return value;
  };
  const versionCheck=await verifyServedVersion(
    timeoutMs=>getJson('/data/version.json',{timeoutMs,maxBytes:64*1024}),
    {version,source,previousSource:before?.deployment.source,waitForPreviousVersion,sleep,clock}
  );
  checks.push({path:'/data/version.json',source,version});
  for(const [scope,path] of [['main','/media/shadow-garden/data/catalog.json'],['adult','/media/shadow-garden/data/adult-catalog.json']]){
    const value=await getJson(path);assertCatalogUnchanged(catalogs[scope],value);
    checks.push({path,sha256:sha(JSON.stringify(canonical(value))),series:value.series.length,volumes:value.series.reduce((sum,series)=>sum+series.volumes.length,0)});
  }
  for(const asset of assets){
    const path='/'+asset.file,result=await getBytes(fetchImpl,path);
    const expectedType=asset.file.endsWith('.js')?/^(?:application|text)\/javascript(?:\s*;|$)/i:/^text\/css(?:\s*;|$)/i;
    requireValue(expectedType.test(result.contentType)&&result.bytes.equals(asset.bytes),`Served asset differs from the reviewed build: ${path}`);
    checks.push({path,sha256:sha(result.bytes),bytes:result.bytes.length});
  }
  return {checkedAt:new Date(currentTime()).toISOString(),origin:PRODUCTION_ORIGIN,deploymentId:baseline.deployment.id,source,version,baselineCheckedAt:baseline.checkedAt,revision:baseline.database.revision,documentSha256:baseline.database.documentSha256,snapshots:baseline.database.snapshots.length,preservationChecked:Boolean(before),databaseWrites:0,versionCheck,checks};
}

export async function main(args){
  const options={files:[]};
  for(let i=0;i<args.length;i++){
    const name=args[i],value=args[++i];
    requireValue(['--baseline','--before','--dist','--version','--source','--file','--output'].includes(name)&&value&&!value.startsWith('--'),'Usage: npm run verify:production -- --baseline private/current.json [--before private/before.json] --dist dist --version X.Y.Z --source FULL_SHA --file assets/js/changed.js [--file ...] [--output private/report.json]');
    if(name==='--file')options.files.push(value);else{requireValue(!Object.hasOwn(options,name.slice(2)),'Duplicate verifier option.');options[name.slice(2)]=value;}
  }
  requireValue(options.baseline&&options.dist&&options.version&&options.source,'Baseline, dist, version and source are required.');
  const root=fileURLToPath(new URL('../',import.meta.url));
  const json=async path=>JSON.parse(await readFile(path,'utf8'));
  const report=await verifyProduction({baseline:await json(options.baseline),before:options.before?await json(options.before):undefined,config:await json(resolve(root,'wrangler.jsonc')),distDir:options.dist,version:options.version,source:options.source,files:options.files});
  const output=JSON.stringify(report,null,2)+'\n';
  if(options.output)await writeFile(options.output,output);
  console.log(output);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
