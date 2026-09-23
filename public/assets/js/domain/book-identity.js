/* Shadow Garden R2 — canonical public/private book identity helpers. */

export const BOOK_ID_PATTERN = /^bk_[A-Za-z0-9_-]{22}$/;
export const LEGACY_BOOK_PATTERN = /^\/media\/shadow-garden\/books\/.+\.epub$/i;
export const BOOK_ID_DOMAIN = "shadow-garden-book-id-v1";

const encoder = new TextEncoder();

export function cleanIdentity(value) {
  return String(value || "").trim();
}

export function cleanIdentities(values) {
  const source = Array.isArray(values) ? values : [values];
  return [...new Set(source.map(cleanIdentity).filter(Boolean))];
}

export function isBookId(value) {
  return BOOK_ID_PATTERN.test(cleanIdentity(value));
}

function baseHref() {
  return globalThis.location?.href || "https://shadow-garden.invalid/";
}

export function legacyBookPath(value) {
  const raw = cleanIdentity(value);
  if (!raw) return "";
  try {
    const url = new URL(raw, baseHref());
    const currentOrigin = globalThis.location?.origin;
    if (currentOrigin && url.origin !== currentOrigin) return "";
    return LEGACY_BOOK_PATTERN.test(url.pathname) ? url.pathname : "";
  } catch {
    return LEGACY_BOOK_PATTERN.test(raw) ? raw : "";
  }
}

export function normalizeBookIdentity(value) {
  const raw = cleanIdentity(value);
  if (isBookId(raw)) return raw;
  return legacyBookPath(raw) || raw;
}

function base64Url(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function nodeSafeBase64Url(bytes) {
  if (typeof btoa === "function") return base64Url(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function bookIdForLegacyPath(value) {
  const path = legacyBookPath(value);
  if (!path) return "";
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`${BOOK_ID_DOMAIN}\n${path}`)));
  return `bk_${nodeSafeBase64Url(digest.slice(0, 16))}`;
}

export function volumePrimaryIdentity(volume) {
  const bookId = cleanIdentity(volume?.bookId);
  if (isBookId(bookId)) return bookId;
  return cleanIdentity(volume?.file);
}

export function stableVolumeId(seriesId, volume, index = -1) {
  const sid = cleanIdentity(seriesId);
  if (!sid) return "";
  const number = Number(volume?.number);
  if (Number.isFinite(number)) return `series:${sid}:volume:${number}`;
  const title = cleanIdentity(volume?.title);
  if (title) return `series:${sid}:title:${title}`;
  return index >= 0 ? `series:${sid}:index:${index}` : "";
}

export function volumeAliases(seriesId, volume, index = -1, extra = []) {
  return cleanIdentities([
    volume?.bookId,
    volume?.file,
    stableVolumeId(seriesId, volume, index),
    ...(Array.isArray(extra) ? extra : [extra])
  ]);
}

export function volumeMatchesIdentity(seriesId, volume, index, identity, extra = []) {
  const wanted = cleanIdentity(identity);
  return Boolean(wanted && volumeAliases(seriesId, volume, index, extra).includes(wanted));
}
