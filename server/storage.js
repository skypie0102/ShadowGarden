import {fail} from './http.js';

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
export function storageConfigured(env) { return ['B2_APPLICATION_KEY_ID','B2_APPLICATION_KEY','B2_BUCKET_ID','B2_BUCKET_NAME'].every(k=>Boolean(env[k])); }
function providerUrl(value) {
  let url; try { url = new URL(value); } catch { fail(502,'storage_error','Storage returned an invalid endpoint.'); }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.backblazeb2.com') || url.username || url.password || url.port) fail(502,'storage_error','Storage returned an invalid endpoint.');
  return url;
}
async function request(url, options = {}) {
  try { return await fetch(url, {...options, redirect:'error', signal:AbortSignal.timeout(30000)}); }
  catch { fail(502,'storage_unavailable','Private media storage is temporarily unavailable.'); }
}
const authorizationCache = new Map();
async function authorize(env) {
  if (!storageConfigured(env)) fail(503,'storage_not_configured','Backblaze B2 is not configured.');
  const cacheKey = env.B2_APPLICATION_KEY_ID;
  const cached = authorizationCache.get(cacheKey);
  if (cached && cached.key === env.B2_APPLICATION_KEY && cached.until > Date.now()) return cached.data;
  const response = await request('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers:{authorization:`Basic ${btoa(`${env.B2_APPLICATION_KEY_ID}:${env.B2_APPLICATION_KEY}`)}`}
  });
  if (!response.ok) fail(502,'storage_auth_failed','Private media storage authorization failed.');
  const data = await response.json(); providerUrl(data.apiUrl); providerUrl(data.downloadUrl);
  if (!data.authorizationToken || (data.allowed?.bucketId && data.allowed.bucketId !== env.B2_BUCKET_ID)) fail(502,'storage_auth_failed','Storage authorization does not match the configured bucket.');
  if (authorizationCache.size > 8) authorizationCache.clear();
  authorizationCache.set(cacheKey,{key:env.B2_APPLICATION_KEY,until:Date.now()+15*60000,data});
  return data;
}
export async function getObject(env, key, {head = false, range = ''} = {}) {
  objectKey(key); const auth = await authorize(env);
  const url = new URL(`/file/${encodeURIComponent(env.B2_BUCKET_NAME)}/${key.split('/').map(encodeURIComponent).join('/')}`,providerUrl(auth.downloadUrl));
  const headers = {authorization:auth.authorizationToken}; if (range) headers.range=range;
  const response = await request(url,{method:head?'HEAD':'GET',headers});
  if (response.status === 404) return null;
  if (![200,206,416].includes(response.status)) fail(502,'storage_error','Private media storage could not serve the object.');
  return response;
}
export async function uploadObject(env,key,bytes) {
  objectKey(key); const auth=await authorize(env);
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
