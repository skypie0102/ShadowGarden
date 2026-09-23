/* Shadow Garden R2 — canonical browser-local bookmark service. */

import { bookIdForLegacyPath, cleanIdentities, cleanIdentity, isBookId, legacyBookPath } from "./book-identity.js";
import { listKeys, readJson, writeJson } from "./storage.js";

export const BOOKMARK_PREFIX = "sg-bookmarks:";

export function bookmarkKey(identity) {
  const id = cleanIdentity(identity);
  return id ? `${BOOKMARK_PREFIX}${id}` : "";
}

export function isBookmarkStorageKey(key) {
  return String(key || "").startsWith(BOOKMARK_PREFIX);
}

export function bookmarkIdentityFromKey(key) {
  return isBookmarkStorageKey(key) ? String(key).slice(BOOKMARK_PREFIX.length) : "";
}

export function readBookmarks(identity) {
  const key = bookmarkKey(identity);
  if (!key) return [];
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
}

export function readBookmarksAliases(ids) {
  for (const id of cleanIdentities(ids)) {
    const key = bookmarkKey(id);
    if (!key) continue;
    const value = readJson(key, null);
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function writeBookmarksAliases(ids, value) {
  const aliases = cleanIdentities(ids);
  if (!aliases.length) return false;
  const next = Array.isArray(value) ? value : [];
  let ok = true;
  for (const id of aliases) ok = writeJson(bookmarkKey(id), next) && ok;
  return ok;
}

export async function migrateLegacyBookmarks(bookIds = []) {
  const wanted = new Set(cleanIdentities(bookIds).filter(isBookId));
  if (!wanted.size) return 0;
  let migrated = 0;
  for (const key of listKeys(BOOKMARK_PREFIX)) {
    const oldIdentity = bookmarkIdentityFromKey(key);
    if (!legacyBookPath(oldIdentity)) continue;
    const bookId = await bookIdForLegacyPath(oldIdentity);
    if (!wanted.has(bookId)) continue;
    const existing = readJson(bookmarkKey(bookId), null);
    if (Array.isArray(existing)) continue;
    const oldValue = readBookmarks(oldIdentity);
    if (writeJson(bookmarkKey(bookId), oldValue)) migrated += 1;
  }
  return migrated;
}
