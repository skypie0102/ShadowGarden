/* Shadow Garden R2 — browser-local Library/Series preference service. */

import { readJson, readText, removeKey, writeJson, writeText } from "./storage.js";

export const PINNED_KEY = "sg-pinned";
export const PINNED_NAV_COLLAPSED_KEY = "sg-pinned-nav-collapsed";
export const ADULT_ACK_KEY = "sg-adult-ack";
export const VIEW_PREFIX = "sg-view:";
export const SORT_PREFIX = "sg-sort:";
export const MOBILE_FILTER_PREFIX = "sg-mobile-filters-collapsed:";
export const LIBRARY_SORTS = Object.freeze([
  "recent", "oldest", "title", "title-desc", "author", "author-desc", "year", "year-asc", "volumes", "volumes-asc"
]);

function cleanScope(scope) {
  return String(scope || "main").trim() || "main";
}

export function viewKey(scope = "main") {
  return `${VIEW_PREFIX}${cleanScope(scope)}`;
}

export function sortKey(scope = "main") {
  return `${SORT_PREFIX}${cleanScope(scope)}`;
}

export function mobileFilterKey(scope = "main") {
  return `${MOBILE_FILTER_PREFIX}${cleanScope(scope)}`;
}

export function pinnedIds() {
  const value = readJson(PINNED_KEY, []);
  return new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean));
}

export function isPinned(seriesId) {
  return pinnedIds().has(String(seriesId || ""));
}

export function setPinned(seriesId, pinned = true) {
  const id = String(seriesId || "").trim();
  if (!id) return false;
  const next = pinnedIds();
  if (pinned) next.add(id); else next.delete(id);
  return writeJson(PINNED_KEY, [...next]);
}

export function libraryView(scope = "main") {
  return readText(viewKey(scope), "grid") === "compact" ? "compact" : "grid";
}

export function setLibraryView(scope = "main", view = "grid") {
  return writeText(viewKey(scope), view === "compact" ? "compact" : "grid");
}

export function librarySort(scope = "main") {
  const value = readText(sortKey(scope), "recent");
  return LIBRARY_SORTS.includes(value) ? value : "recent";
}

export function setLibrarySort(scope = "main", sort = "recent") {
  const value = LIBRARY_SORTS.includes(sort) ? sort : "recent";
  return writeText(sortKey(scope), value);
}

export function mobileFiltersCollapsed(scope = "main") {
  const saved = readText(mobileFilterKey(scope), "");
  return saved === "" ? true : saved !== "0";
}

export function setMobileFiltersCollapsed(scope = "main", collapsed = true) {
  return writeText(mobileFilterKey(scope), collapsed ? "1" : "0");
}

export function pinnedNavCollapsed() {
  return readText(PINNED_NAV_COLLAPSED_KEY, "0") === "1";
}

export function setPinnedNavCollapsed(collapsed = true) {
  return writeText(PINNED_NAV_COLLAPSED_KEY, collapsed ? "1" : "0");
}

export function adultAcknowledged() {
  return readText(ADULT_ACK_KEY, "") === "1";
}

export function setAdultAcknowledged(acknowledged = true) {
  return acknowledged ? writeText(ADULT_ACK_KEY, "1") : removeKey(ADULT_ACK_KEY);
}

export function isPreferenceStorageKey(key) {
  const value = String(key || "");
  return value === PINNED_KEY || value === PINNED_NAV_COLLAPSED_KEY || value === ADULT_ACK_KEY || value.startsWith(VIEW_PREFIX) || value.startsWith(SORT_PREFIX) || value.startsWith(MOBILE_FILTER_PREFIX);
}
