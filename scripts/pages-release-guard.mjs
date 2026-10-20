// Validate deployment configuration as well as compiled source. A binding-free
// Worker can return HTTP 200 while serving the recovered catalog instead of D1.
export function assertCompatibility(actual,config){
  const date=config?.compatibility_date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Production compatibility date is invalid.');
  if(actual?.compatibility_date!==date)throw Error('Pages compatibility date does not match configuration.');
  const flags=value=>{
    const list=value===undefined?[]:value;
    if(!Array.isArray(list)||list.some(flag=>typeof flag!=='string'||!flag.trim())||new Set(list).size!==list.length)throw Error('Pages compatibility flags are invalid.');
    return [...list].sort();
  };
  if(JSON.stringify(flags(actual.compatibility_flags))!==JSON.stringify(flags(config.compatibility_flags)))throw Error('Pages compatibility flags do not match configuration.');
}

export function assertReleaseBindings(metadata,config){
  if(!Array.isArray(metadata?.bindings))throw Error('Pages release has no binding metadata.');
  const bindings=new Map();
  for(const entry of metadata.bindings){
    if(bindings.has(entry.name))throw Error(`Duplicate Pages binding: ${entry.name}`);
    bindings.set(entry.name,entry);
  }
  if(!config?.d1_databases?.length)throw Error('Production D1 configuration is missing.');
  for(const expected of config.d1_databases){
    const actual=bindings.get(expected.binding);
    if(!expected.database_id||/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(expected.database_id))throw Error('Production D1 configuration uses a placeholder.');
    if(actual?.type!=='d1'||actual.id!==expected.database_id)throw Error(`Pages D1 binding does not match configuration: ${expected.binding}`);
  }
  for(const [name,value]of Object.entries(config.vars||{})){
    const actual=bindings.get(name);
    if(typeof value!=='string'||actual?.type!=='plain_text'||actual.text!==value)throw Error(`Pages variable does not match configuration: ${name}`);
  }
  assertCompatibility(metadata,config);
  return metadata;
}

export async function readWorkerMetadata(bytes){
  const firstLine=new TextDecoder().decode(bytes).split(/\r?\n/,1)[0];
  if(!firstLine.startsWith('--')||firstLine.length<4)throw Error('Invalid Pages Worker bundle.');
  const form=await new Response(bytes,{headers:{'content-type':`multipart/form-data; boundary=${firstLine.slice(2)}`}}).formData();
  const value=form.get('metadata');
  if(typeof value!=='string')throw Error('Pages Worker metadata is missing.');
  return JSON.parse(value);
}

export function assertDeployedBindings(deployment,config){
  if(deployment?.environment!=='production'||deployment.project_name!==config.name)throw Error('Deployment is not the configured production project.');
  for(const expected of config.d1_databases||[]){
    if(deployment.d1_databases?.[expected.binding]?.id!==expected.database_id)throw Error(`Deployed D1 binding is missing or incorrect: ${expected.binding}`);
  }
  for(const [name,value]of Object.entries(config.vars||{})){
    const actual=deployment.env_vars?.[name];
    if(actual?.type!=='plain_text'||actual.value!==value)throw Error(`Deployed variable is missing or incorrect: ${name}`);
  }
  assertCompatibility(deployment,config);
  return deployment;
}

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export function assertCatalogUnchanged(before,after){
  for(const value of [before,after])if(!Array.isArray(value?.series)||typeof value.generatedAt!=='string')throw Error('Catalog response is invalid.');
  if(JSON.stringify(canonical(before))!==JSON.stringify(canonical(after)))throw Error('Production catalog differs from its verified baseline; inspect D1 before accepting this deployment.');
}
