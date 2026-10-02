import {fail} from './http.js';
import {storageCredentials} from './config.js';

export function objectKey(value, kind = '') {
  const key = String(value || '');
  if (key.length > 1024 || !/^shadow-garden\/(books|covers)\/[A-Za-z0-9_./-]+$/.test(key) || key.split('/').some(x=>!x || x==='.' || x==='..')) {
    fail(400,'invalid_object_key','Invalid media object key.');
  }
  const book = key.startsWith('shadow-garden/books/') && key.endsWith('.epub');
  const cover = key.startsWith('shadow-garden/covers/') && /\.(webp|png|jpg|jpeg|gif)$/i.test(key);
  if ((!book && !cover) || (kind === 'book' && !book) || (kind === 'cover' && !cover)) fail(400,'invalid_object_key','Unsupported media object type.');
  return key;
}
export const mimeFor = key => key.endsWith('.epub') ? 'application/epub+zip' : /\.webp$/i.test(key) ? 'image/webp' : /\.png$/i.test(key) ? 'image/png' : /\.gif$/i.test(key) ? 'image/gif' : 'image/jpeg';
export function storageConfigured(env,access='all') {
  const present=value=>typeof value==='string'&&value.length>0;
  return present(env.B2_BUCKET_ID)&&present(env.B2_BUCKET_NAME)&&(access==='all'?['read','write']:[access]).every(role=>{
    const {id,key}=storageCredentials(env,role);return present(id)&&present(key);
  });
}
export async function getStaticCover(env,key,{head=false,origin}={}) {
  if (!key.startsWith('shadow-garden/covers/') || !env.ASSETS) return null;
  objectKey(key,'cover');
  const response=await env.ASSETS.fetch(new Request(new URL(`/media/${key}`,origin),{method:head?'HEAD':'GET'}));
  if (response.ok && /^image\/(?:webp|png|jpeg|gif)(?:;|$)/i.test(response.headers.get('content-type') || '')) return response;
  await response.body?.cancel();
  return null;
}
function providerUrl(value) {
  let url; try { url = new URL(value); } catch { fail(502,'storage_error','Storage returned an invalid endpoint.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.backblazeb2.com') || url.username || url.password || url.port) fail(502,'storage_error','Storage returned an invalid endpoint.');
  return url;
}
async function request(url, options = {}) {
  const {timeoutMs=30000,...init}=options;
  try { return await fetch(url, {...init, redirect:'error', signal:AbortSignal.timeout(timeoutMs)}); }
  catch { fail(502,'storage_unavailable','Private media storage is temporarily unavailable.'); }
}
const authorizationCache = new Map();
async function authorize(env,access) {
  if (!storageConfigured(env,access)) fail(503,'storage_not_configured',`Backblaze B2 ${access} access is not configured.`);
  const {id,key}=storageCredentials(env,access),cacheKey=`${access}:${id}`;
  const checkBucket=data=>{
    const buckets=data.allowed?.buckets;
    if (typeof data.authorizationToken!=='string' || !data.authorizationToken || (buckets!==null && !Array.isArray(buckets))) fail(502,'storage_auth_failed','Storage returned invalid authorization information.');
    if (buckets!==null && !buckets.some(bucket=>bucket?.id===env.B2_BUCKET_ID && (bucket.name===null || bucket.name===env.B2_BUCKET_NAME))) fail(502,'storage_auth_failed','Storage authorization does not match the configured bucket.');
    return data;
  };
  const cached = authorizationCache.get(cacheKey);
  if (cached && cached.key === key && cached.until > Date.now()) return checkBucket(cached.data);
  const response = await request('https://api.backblazeb2.com/b2api/v4/b2_authorize_account', {
    headers:{authorization:`Basic ${btoa(`${id}:${key}`)}`}
  });
  if (!response.ok) fail(502,'storage_auth_failed','Private media storage authorization failed.');
  let result;try {result=await response.json();} catch {fail(502,'storage_auth_failed','Storage returned unreadable authorization information.');}
  const storage=result?.apiInfo?.storageApi;
  const data=checkBucket({authorizationToken:result?.authorizationToken,apiUrl:storage?.apiUrl,downloadUrl:storage?.downloadUrl,allowed:storage?.allowed});
  providerUrl(data.apiUrl); providerUrl(data.downloadUrl);
  if (authorizationCache.size > 8) authorizationCache.clear();
  authorizationCache.set(cacheKey,{key,until:Date.now()+15*60000,data});
  return data;
}
export async function getObject(env, key, {head = false, range = ''} = {}) {
  objectKey(key); const auth = await authorize(env,'read');
  const url = new URL(`/file/${encodeURIComponent(env.B2_BUCKET_NAME)}/${key.split('/').map(encodeURIComponent).join('/')}`,providerUrl(auth.downloadUrl));
  const headers = {authorization:auth.authorizationToken}; if (range) headers.range=range;
  const response = await request(url,{method:head?'HEAD':'GET',headers});
  if (response.status === 404) return null;
  if (![200,206,416].includes(response.status)) fail(502,'storage_error','Private media storage could not serve the object.');
  return response;
}
export async function uploadObject(env,key,bytes) {
  objectKey(key); const auth=await authorize(env,'write');
  const response=await request(new URL('/b2api/v2/b2_get_upload_url',providerUrl(auth.apiUrl)),{
    method:'POST',headers:{authorization:auth.authorizationToken,'content-type':'application/json'},body:JSON.stringify({bucketId:env.B2_BUCKET_ID})
  });
  if (!response.ok) fail(502,'upload_unavailable','Storage could not prepare the upload.');
  const target=await response.json(), url=providerUrl(target.uploadUrl);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-1',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const result=await request(url,{method:'POST',headers:{authorization:target.authorizationToken,
    'content-type':mimeFor(key),'x-bz-file-name':key.split('/').map(encodeURIComponent).join('/'),
    'x-bz-content-sha1':hash,'content-length':String(bytes.byteLength)},body:bytes});
  if (!result.ok) fail(502,'upload_failed','Private media upload failed.');
  const metadata=await result.json();
  return {key,size:bytes.byteLength,fileId:metadata.fileId};
}

async function versionRequest(env,auth,operation,payload,deadline) {
  const remaining=deadline-Date.now();
  if(remaining<=0)fail(409,'cleanup_budget','Cleanup paused at its request time limit. Continue this job.');
  const response=await request(new URL(`/b2api/v2/${operation}`,providerUrl(auth.apiUrl)),{
    timeoutMs:Math.min(10000,remaining),method:'POST',headers:{authorization:auth.authorizationToken,'content-type':'application/json'},body:JSON.stringify(payload)
  });
  let data;try {data=await response.json();} catch {fail(502,'storage_error','Storage returned an unreadable response.');}
  if (!response.ok) {
    if (operation==='b2_delete_file_version' && response.status===400 && data.code==='file_not_present') return {};
    if (data.code==='access_denied') fail(409,'storage_object_locked','Storage retention or a legal hold prevents deletion.');
    if ([401,403].includes(response.status)) fail(503,'storage_delete_denied','The B2 key needs listFiles and deleteFiles permissions for media cleanup.');
    fail(502,'storage_unavailable','Media cleanup could not reach storage. Retry the cleanup job.');
  }
  return data;
}
export async function deleteObjectVersions(env,key,{deadline=Date.now()+20000}={}) {
  objectKey(key);const auth=await authorize(env,'write');
  const list=async limit=>{
    const data=await versionRequest(env,auth,'b2_list_file_versions',{bucketId:env.B2_BUCKET_ID,prefix:key,startFileName:key,maxFileCount:limit},deadline);
    if (!Array.isArray(data.files) || data.files.length>limit) fail(502,'storage_error','Storage returned an invalid version list.');
    // A prefix may include neighbouring names; never delete those entries.
    const exact=data.files.filter(file=>file.fileName===key);
    if (exact.some(file=>typeof file.fileId!=='string'||!file.fileId||!['upload','hide','start'].includes(file.action)||file.bucketId!==env.B2_BUCKET_ID)) fail(502,'storage_error','Storage returned invalid file coordinates.');
    if (!exact.length && data.nextFileName===key) fail(502,'storage_error','Storage returned an incomplete version list.');
    return exact;
  };
  const versions=await list(5);
  for (const file of versions) {
    // Never bypass B2 Object Lock, governance retention or legal holds.
    const deleted=await versionRequest(env,auth,'b2_delete_file_version',{fileName:key,fileId:file.fileId},deadline);
    if ((deleted.fileName && deleted.fileName!==key) || (deleted.fileId && deleted.fileId!==file.fileId)) fail(502,'storage_error','Storage returned an unexpected deletion result.');
  }
  return {complete:(await list(1)).length===0,versionsDeleted:versions.length};
}
