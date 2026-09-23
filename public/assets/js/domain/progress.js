/* Shadow Garden R2 — canonical browser-local reading progress service. */

import { bookIdForLegacyPath, cleanIdentities, cleanIdentity, isBookId, legacyBookPath } from "./book-identity.js";
import { dispatchLocalEvent, listKeys, readJson, removeKey, writeJson } from "./storage.js";

export const PROGRESS_PREFIX = "sg-progress:";
export const PROGRESS_EVENT = "sg-progress-changed";

export function progressKey(identity) {
  const id = cleanIdentity(identity);
  return id ? `${PROGRESS_PREFIX}${id}` : "";
}

export function isProgressStorageKey(key) {
  return String(key || "").startsWith(PROGRESS_PREFIX);
}

export function progressIdentityFromKey(key) {
  return isProgressStorageKey(key) ? String(key).slice(PROGRESS_PREFIX.length) : "";
}

export function readProgress(identity) {
  const key = progressKey(identity);
  if (!key) return null;
  const value = readJson(key, null);
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function progressForAliases(ids) {
  let newest = null;
  for (const id of cleanIdentities(ids)) {
    const item = readProgress(id);
    if (!item) continue;
    if (!newest || (Number(item.updatedAt) || 0) > (Number(newest.updatedAt) || 0)) newest = item;
  }
  return newest;
}

export function writeProgress(identity, value, { canonicalIdentity = identity, notify = true } = {}) {
  const id = cleanIdentity(identity);
  if (!id || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const canonical = cleanIdentity(canonicalIdentity) || id;
  const next = { ...value, file: canonical };
  if (!writeJson(progressKey(id), next)) return false;
  if (notify) dispatchLocalEvent(PROGRESS_EVENT, { identity: id, identities: [id], progress: next });
  return true;
}

export function writeProgressAliases(ids, value, { canonicalIdentity = "", notify = true } = {}) {
  const aliases = cleanIdentities(ids);
  if (!aliases.length || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const canonical = cleanIdentity(canonicalIdentity) || aliases.find(isBookId) || cleanIdentity(value.file) || aliases[0];
  const next = { ...value, file: canonical };
  let ok = true;
  for (const id of aliases) ok = writeJson(progressKey(id), next) && ok;
  if (notify && ok) dispatchLocalEvent(PROGRESS_EVENT, { identity: canonical, identities: aliases, progress: next });
  return ok;
}

export function clearProgressAliases(ids, { notify = true } = {}) {
  const aliases = cleanIdentities(ids);
  if (!aliases.length) return true;
  let ok = true;
  for (const id of aliases) ok = removeKey(progressKey(id)) && ok;
  if (notify && ok) dispatchLocalEvent(PROGRESS_EVENT, { identity: aliases[0], identities: aliases, progress: null, cleared: true });
  return ok;
}

export function progressAtBeginning(progress) {
  if (!progress) return true;
  const page = Number(progress.page);
  if (Number.isFinite(page) && page > 0) return page <= 1;
  const percentage = Number(progress.percentage);
  if (Number.isFinite(percentage)) return percentage <= 0.01;
  return true;
}

export function allProgressEntries() {
  return listKeys(PROGRESS_PREFIX).map(key => {
    const identity = progressIdentityFromKey(key);
    return { identity, progress: readProgress(identity) };
  }).filter(entry => entry.identity && entry.progress);
}

export async function migrateLegacyProgress(bookIds = []) {
  const wanted = new Set(cleanIdentities(bookIds).filter(isBookId));
  if (!wanted.size) return 0;
  let migrated = 0;
  for (const key of listKeys(PROGRESS_PREFIX)) {
    const oldIdentity = progressIdentityFromKey(key);
    if (!legacyBookPath(oldIdentity)) continue;
    const bookId = await bookIdForLegacyPath(oldIdentity);
    if (!wanted.has(bookId)) continue;
    const oldValue = readProgress(oldIdentity);
    if (!oldValue) continue;
    const current = readProgress(bookId);
    if (!current || (Number(oldValue.updatedAt) || 0) > (Number(current.updatedAt) || 0)) {
      if (writeProgress(bookId, oldValue, { canonicalIdentity: bookId, notify: false })) migrated += 1;
    }
  }
  return migrated;
}
