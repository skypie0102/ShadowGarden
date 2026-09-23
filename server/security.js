import {bodyJson, fail, json, method, sameOrigin} from './http.js';
const encoder = new TextEncoder();
export const now = () => Math.floor(Date.now() / 1000);
export const ADMIN_COOKIE = '__Host-sg_admin';
export const HUMAN_COOKIE = '__Host-sg_human';
export const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
export async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', typeof value === 'string' ? encoder.encode(value) : value))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function secret(env, name) {
  if (typeof env[name] !== 'string' || env[name].length < 32) fail(503, name === 'BOOK_SIGNING_SECRET' ? 'ticketing_not_configured' : 'security_not_configured', 'Server security is not configured.');
  return env[name];
}
async function hmacKey(value) { return crypto.subtle.importKey('raw', encoder.encode(value), {name:'HMAC', hash:'SHA-256'}, false, ['sign','verify']); }
export async function signed(env, kind, claims, ttl, keyName = 'SESSION_SECRET') {
  const data = b64(encoder.encode(JSON.stringify({...claims, kind, exp:now()+ttl})));
  const signature = b64(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret(env,keyName)), encoder.encode(data))));
  return `${data}.${signature}`;
}
export async function verified(env, token, kind, keyName = 'SESSION_SECRET') {
  const key = await hmacKey(secret(env,keyName));
  try {
    if (!token || token.length > 8192) return null;
    const [data,signature,extra] = token.split('.'); if (!data || !signature || extra) return null;
    if (!await crypto.subtle.verify('HMAC', key, unb64(signature), encoder.encode(data))) return null;
    const result = JSON.parse(new TextDecoder().decode(unb64(data)));
    return result.kind === kind && Number.isInteger(result.exp) && result.exp > now() ? result : null;
  } catch { return null; }
}
export function cookies(request) {
  return Object.fromEntries((request.headers.get('cookie') || '').split(';').map(x=>{const i=x.indexOf('=');return i>0?[x.slice(0,i).trim(),x.slice(i+1).trim()]:['',''];}));
}
export function cookie(name, value, ttl, path = '/') {
  return `${name}=${value}; Path=${path}; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Strict`;
}
export function database(env) { if (!env.DB) fail(503,'database_not_configured','The reconstructed database binding is not configured.'); return env.DB; }
export async function checkAdminToken(env, token) {
  const expected = secret(env, 'ADMIN_TOKEN');
  const key = await hmacKey(secret(env,'SESSION_SECRET'));
  const expectedMac = await crypto.subtle.sign('HMAC',key,encoder.encode(expected));
  return crypto.subtle.verify('HMAC',key,expectedMac,encoder.encode(String(token || '')));
}
export async function requireAdmin(context) {
  sameOrigin(context.request);
  const token = context.request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!await checkAdminToken(context.env,token)) fail(401,'unauthorized','A valid keeper token is required.');
  const session = await verified(context.env,cookies(context.request)[ADMIN_COOKIE],'admin');
  if (!session) fail(401,'session_required','Unlock Garden Keeper first.');
  const found = await database(context.env).prepare('SELECT id FROM admin_sessions WHERE id = ? AND expires_at > ?').bind(session.sid,now()).first();
  if (!found) fail(401,'session_expired','The keeper session has expired or was revoked.');
}
export function challenge(context, action) {
  secret(context.env,'SESSION_SECRET');
  if (!context.env.TURNSTILE_SITE_KEY || !context.env.TURNSTILE_SECRET_KEY) fail(503,'human_verification_unavailable','Human verification is not configured.');
  return {siteKey:context.env.TURNSTILE_SITE_KEY, action};
}
export async function turnstile(context, token, action) {
  challenge(context, action);
  if (typeof token !== 'string' || !token || token.length > 2048) fail(403,'human_verification_failed','Complete human verification.');
  let result;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST', headers:{'content-type':'application/json'}, signal:AbortSignal.timeout(10000),
      body:JSON.stringify({secret:context.env.TURNSTILE_SECRET_KEY, response:token,
        remoteip:context.request.headers.get('cf-connecting-ip') || undefined})
    });
    if (!response.ok) throw new Error('Siteverify failed'); result = await response.json();
  } catch { fail(503,'human_verification_unavailable','Human verification is temporarily unavailable.'); }
  const hostname = context.env.TURNSTILE_HOSTNAME || new URL(context.request.url).hostname;
  if (!result.success || result.action !== action || result.hostname !== hostname) fail(403,'human_verification_failed','Verification was not accepted. Please try again.');
}
export async function clientId(context) {
  const ip = context.request.headers.get('cf-connecting-ip') || 'local-unknown';
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret(context.env,'SESSION_SECRET')), encoder.encode(`network:${ip}`))));
}
export async function rateLimit(context, scope, max = 10, windowSeconds = 600) {
  const db = database(context.env), client = await clientId(context), id = `${scope}:${client}`;
  const time = now();
  const row = await db.prepare(`INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    RETURNING count,expires_at`).bind(id,time+windowSeconds,time,time).first();
  if (row.count > max) {
    if (row.count === max+1) await db.prepare('INSERT INTO security_events(id,client_id,kind,created_at,cooldown_until,detail) VALUES(?,?,?,?,?,?)')
      .bind(crypto.randomUUID(),client,scope==='admin'?'admin_cooldown':'public_cooldown',new Date().toISOString(),row.expires_at,JSON.stringify({failures:row.count,retryAfterSeconds:row.expires_at-time,scope})).run();
    fail(429,'cooldown','Too many attempts. Please try again later.',{}, {'retry-after':String(row.expires_at-time)});
  }
  // Bounded retention; no raw network addresses are stored.
  if (row.count === 1) await db.batch([
    db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(time-3600),
    db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(time),
    db.prepare('DELETE FROM security_events WHERE created_at < ?').bind(new Date(Date.now()-30*86400000).toISOString())
  ]);
}
export async function adminAccess(context) {
  const {request,env} = context;
  method(request,['GET','POST','DELETE']); sameOrigin(request);
  if (request.method === 'GET') return json(challenge(context,'admin_access'));
  if (request.method === 'DELETE') {
    const session = await verified(env,cookies(request)[ADMIN_COOKIE],'admin');
    if (session) await database(env).prepare('DELETE FROM admin_sessions WHERE id = ?').bind(session.sid).run();
    return json({ok:true},200,{'set-cookie':cookie(ADMIN_COOKIE,'',0)});
  }
  const body = await bodyJson(request,8192);
  await rateLimit(context,'admin',5,600);
  await turnstile(context,body.turnstileToken,'admin_access');
  if (!await checkAdminToken(env,body.adminToken)) fail(401,'unauthorized','Invalid keeper token.');
  const sid = crypto.randomUUID(), ttl = 3600;
  await database(env).prepare('INSERT INTO admin_sessions(id,expires_at) VALUES(?,?)').bind(sid,now()+ttl).run();
  return json({ok:true,expiresAt:now()+ttl},200,{'set-cookie':cookie(ADMIN_COOKIE,await signed(env,'admin',{sid},ttl),ttl)});
}
export async function humanAccess(context) {
  method(context.request,['GET','POST']); sameOrigin(context.request);
  if (context.request.method === 'GET') return json(challenge(context,'book_access'));
  const body = await bodyJson(context.request,8192);
  await rateLimit(context,'human',20,600); await turnstile(context,body.token,'book_access');
  const ttl=43200;
  return json({ok:true,expiresAt:now()+ttl},200,{'set-cookie':cookie(HUMAN_COOKIE,await signed(context.env,'human',{},ttl),ttl)});
}
