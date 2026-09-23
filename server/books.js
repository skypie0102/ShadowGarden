import {bodyJson, fail, json, method, sameOrigin} from './http.js';
import {b64, challenge, cookie, cookies, HUMAN_COOKIE, now, rateLimit, signed, verified} from './security.js';
import {loadState, publicCatalog} from './state.js';
import {getObject, mimeFor, objectKey} from './storage.js';
export const BOOK_ID=/^bk_[A-Za-z0-9_-]{22}$/;
export async function bookIdForKey(key) {
  objectKey(key,'book');
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`shadow-garden-book-id-v1\n/media/${key}`)));
  return `bk_${b64(bytes.slice(0,16))}`;
}
export function activeBooks(doc) { return new Set([...doc.main,...doc.adult].flatMap(s=>s.volumes.map(v=>v.bookId))); }
export async function bookAccess(context) {
  method(context.request,['POST']); sameOrigin(context.request);
  const body=await bodyJson(context.request,8192);
  if (!context.env.BOOK_SIGNING_SECRET || context.env.BOOK_SIGNING_SECRET.length<32) fail(503,'ticketing_not_configured','Signed EPUB access is not configured.');
  const info=challenge(context,'book_access');
  if (!await verified(context.env,cookies(context.request)[HUMAN_COOKIE],'human')) fail(428,'human_verification_required','Confirm you are human to open a protected book.',info);
  await rateLimit(context,'book',120,600);
  const {document}=await loadState(context.env);
  let id=body.bookId;
  if (!id && typeof body.book==='string') {
    let url; try { url=new URL(body.book,context.request.url); } catch { fail(400,'invalid_book','Invalid book identity.'); }
    if (url.origin!==new URL(context.request.url).origin || !url.pathname.startsWith('/media/')) fail(400,'invalid_book','Invalid book identity.');
    let key; try { key=objectKey(decodeURIComponent(url.pathname.slice(7)),'book'); } catch { fail(400,'invalid_book','Invalid book identity.'); }
    id=Object.keys(document.books).find(bookId=>document.books[bookId]===key);
  }
  if (!BOOK_ID.test(id || '')) fail(400,'invalid_book','Invalid book identity.');
  if (!activeBooks(document).has(id)) fail(404,'book_not_found','This book is not in the active catalog.');
  const key=document.books[id];
  if (!key) fail(503,'book_mapping_missing','This book’s private storage mapping was not recovered.');
  objectKey(key,'book');
  const ttl=900,path=`/media/${key}`,ticket=await signed(context.env,'book',{bookId:id,key},ttl,'BOOK_SIGNING_SECRET');
  return json({ok:true,bookId:id,url:`${path}?sig=${encodeURIComponent(ticket)}`,expiresAt:now()+ttl,ttlSeconds:ttl},200,
    {'set-cookie':cookie(`__Secure-sg_book_${id}`,ticket,ttl,path)});
}
export async function media(context) {
  const {request,env}=context; method(request,['GET','HEAD']);
  const url=new URL(request.url);
  let key; try { key=decodeURIComponent(url.pathname.slice('/media/'.length)); } catch { fail(400,'invalid_path','Invalid media path.'); }
  if (['shadow-garden/data/catalog.json','shadow-garden/data/adult-catalog.json'].includes(key)) {
    const row=await loadState(env),value=publicCatalog(row,key.endsWith('/adult-catalog.json'));
    const response=json(value,200,{'cache-control':'no-cache'});
    return request.method==='HEAD'?new Response(null,{status:200,headers:response.headers}):response;
  }
  objectKey(key);
  if (key.startsWith('shadow-garden/books/')) {
    const {document}=await loadState(env);
    const id=Object.keys(document.books).find(value=>document.books[value]===key && activeBooks(document).has(value));
    if (!id) fail(404,'book_not_found','Book not found.');
    const token=url.searchParams.get('sig') || cookies(request)[`__Secure-sg_book_${id}`];
    const claims=await verified(env,token,'book','BOOK_SIGNING_SECRET');
    if (!claims || claims.bookId!==id || claims.key!==key) fail(403,'book_ticket_required','A valid book ticket is required.');
  } else {
    // Only an exact recovered/static image is eligible for the asset fallback.
    const fallback=await env.ASSETS.fetch(new Request(new URL(`/media/${key}`,url.origin),{method:request.method}));
    if (fallback.ok && /^image\/(webp|png|jpeg|gif)/i.test(fallback.headers.get('content-type') || '')) return fallback;
    await fallback.body?.cancel();
  }
  const range=request.headers.get('range') || '';
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) fail(416,'invalid_range','Only a single byte range is supported.');
  const response=await getObject(env,key,{head:request.method==='HEAD',range});
  if (!response) fail(404,'media_not_found','Media object not found.');
  const headers=new Headers({'content-type':mimeFor(key),'x-content-type-options':'nosniff',
    'cache-control':key.endsWith('.epub')?'private, no-store':'public, max-age=3600',
    'referrer-policy':'same-origin','accept-ranges':'bytes'});
  for (const header of ['content-length','content-range','etag','last-modified']) if (response.headers.has(header)) headers.set(header,response.headers.get(header));
  // Provider credentials and x-bz metadata are deliberately not forwarded.
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
