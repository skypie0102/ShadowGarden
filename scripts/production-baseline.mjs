// Self-contained so the connected Cloudflare plugin can execute this function
// with cloudflare.request. Only project GETs and fixed SELECT statements exist.
// The returned private document belongs in ignored private/ or .wrangler/ files.
export async function captureProductionBaseline(request,{accountId,projectName,databaseId}){
  if(!/^[a-f0-9]{32}$/.test(accountId)||!/^[a-z0-9-]+$/.test(projectName)||!/^[a-f0-9-]{36}$/.test(databaseId))throw Error('Invalid production resource identifiers.');
  const projectPath=`/accounts/${accountId}/pages/projects/${projectName}`;
  const [project,database]=await Promise.all([
    request({method:'GET',path:projectPath}),
    request({method:'POST',path:`/accounts/${accountId}/d1/database/${databaseId}/query`,body:{sql:'SELECT revision,document,updated_at FROM library_state WHERE id=1; SELECT id,created_at,sha256,document FROM snapshots ORDER BY id;'}})
  ]);
  if(!project.success||project.status!==200||!database.success||database.status!==200||!Array.isArray(database.result)||database.result.length!==2)throw Error('Production baseline read failed.');
  if(database.result.some(result=>!result.success||result.meta?.rows_written!==0||result.meta?.changes!==0))throw Error('Production SELECT results are invalid or report writes.');
  if(database.result[0].results?.length!==1||!Array.isArray(database.result[1].results))throw Error('Production state is missing or ambiguous.');
  const sha=async value=>{
    if(typeof value!=='string')throw Error('Production document is missing.');
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(byte=>byte.toString(16).padStart(2,'0')).join('');
  };
  const settings=value=>Object.fromEntries(Object.entries(value||{}).sort(([a],[b])=>a.localeCompare(b)).map(([name,setting])=>{
    if(setting.type==='plain_text'&&typeof setting.value==='string')return [name,{type:'plain_text',value:setting.value}];
    if(setting.type==='secret_text')return [name,{type:'secret_text'}];
    throw Error('Unknown production setting type.');
  }));
  const configuration=value=>{
    const flags=value?.compatibility_flags===undefined?[]:value.compatibility_flags;
    return {d1_databases:value?.d1_databases||{},compatibility_date:value?.compatibility_date,compatibility_flags:Array.isArray(flags)?[...flags].sort():flags,env_vars:settings(value?.env_vars)};
  };
  const deployed=project.result?.canonical_deployment;
  if(project.result?.name!==projectName||!deployed)throw Error('Canonical production deployment is missing.');
  const row=database.result[0].results[0];
  return {
    schemaVersion:1,checkedAt:new Date().toISOString(),projectName,databaseId,
    deployment:{id:deployed.id,source:deployed.deployment_trigger?.metadata?.commit_hash,environment:deployed.environment,status:deployed.latest_stage?.status},
    actual:configuration(deployed),saved:configuration(project.result.deployment_configs?.production),
    database:{revision:row.revision,updatedAt:row.updated_at,document:row.document,documentSha256:await sha(row.document),snapshots:await Promise.all(database.result[1].results.map(async saved=>({id:saved.id,created_at:saved.created_at,sha256:saved.sha256,actualSha256:await sha(saved.document)})))},
    databaseWrites:0
  };
}
