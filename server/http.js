export class HttpError extends Error {
  constructor(status, code, message, extra = {}, headers = {}) {
    super(message); Object.assign(this, {status, code, extra, headers});
  }
}
export function fail(status, code, message, extra, headers) {
  throw new HttpError(status, code, message, extra, headers);
}
export function json(value, status = 200, headers = {}) {
  return Response.json(value, {status, headers: {
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin', ...headers
  }});
}
export function endpoint(handler) {
  return async context => {
    try { return await handler(context); }
    catch (error) {
      if (error instanceof HttpError) return json({ok:false, code:error.code, error:error.message, ...error.extra}, error.status, error.headers);
      // Do not include stack traces, provider responses, private keys or SQL in public errors.
      console.error('ShadowGarden request failed', error?.name || 'Error');
      return json({ok:false, code:'internal_error', error:'The server could not complete this request.'}, 500);
    }
  };
}
export function method(request, allowed) {
  if (!allowed.includes(request.method)) fail(405, 'method_not_allowed', 'Method not allowed.', {}, {allow:allowed.join(', ')});
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== new URL(request.url).origin)) {
    fail(403, 'cross_origin', 'Cross-origin requests are not allowed.');
  }
}
export async function boundedBytes(request, limit) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) fail(413, 'body_too_large', 'Request body is too large.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); fail(413, 'body_too_large', 'Request body is too large.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function bodyJson(request, limit = 1024 * 1024) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) fail(415, 'invalid_content_type', 'Expected application/json.');
  let value;
  try { value = JSON.parse(new TextDecoder().decode(await boundedBytes(request, limit))); }
  catch (error) { if (error instanceof HttpError) throw error; fail(400, 'invalid_json', 'Invalid JSON request.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'invalid_body', 'Expected a JSON object.');
  return value;
}
export function text(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }
export function required(value, label, max = 300) {
  const result = text(value, max); if (!result) fail(400, 'invalid_input', `${label} is required.`); return result;
}
export function safeUrl(value) {
  const input = text(value, 2048); if (!input) return '';
  let url; try { url = new URL(input); } catch { fail(400, 'invalid_url', 'Expected an HTTPS or HTTP URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail(400, 'invalid_url', 'Expected an HTTPS or HTTP URL.');
  return url.href;
}
