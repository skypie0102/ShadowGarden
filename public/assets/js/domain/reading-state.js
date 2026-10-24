/* Shadow Garden R2 — canonical Unread / In Progress / Finished state machine. */

import { cleanIdentities, cleanIdentity, stableVolumeId, volumeAliases as identityVolumeAliases, volumePrimaryIdentity } from "./book-identity.js";
import { clearProgressAliases as clearProgress, isProgressStorageKey, progressAtBeginning, progressForAliases, progressRemovalChanges, PROGRESS_EVENT, readProgress } from "./progress.js";
import { dispatchLocalEvent, readJson, readText, writeChanges } from "./storage.js";

export const KEY = "sg-finished-books";
export const MARKER_PREFIX = "sg-finished:";
export const EVENT = "sg-reading-status-changed";
export const STATES = Object.freeze({ UNREAD: "unread", IN_PROGRESS: "in-progress", FINISHED: "finished" });

export function load() {
  const value = readJson(KEY, {});
  if (Array.isArray(value)) return Object.fromEntries(value.filter(Boolean).map(id => [String(id), Date.now()]));
  return value && typeof value === "object" ? value : {};
}

function markerKey(identity) {
  const id = cleanIdentity(identity);
  return id ? `${MARKER_PREFIX}${id}` : "";
}

function markerFinished(identity) {
  const key = markerKey(identity);
  return Boolean(key && readText(key, "") === "1");
}

export function isFinished(identity) {
  const id = cleanIdentity(identity);
  return Boolean(id && (load()[id] || markerFinished(id)));
}

export function isAnyFinished(ids) {
  return cleanIdentities(ids).some(isFinished);
}

function finishedChanges(updates) {
  const stamp = Date.now();
  return [{key: KEY, value: raw => {
    // A failed read or malformed map must not erase other books' Finished state.
    const previous = raw === null ? {} : JSON.parse(raw);
    if (!previous || typeof previous !== "object") throw new TypeError("Invalid Finished state");
    const state = Object.assign(Object.create(null), Array.isArray(previous) ? Object.fromEntries(previous.filter(Boolean).map(id => [String(id), stamp])) : previous);
    for (const [id, finished] of updates) {
      if (finished) state[id] = stamp;
      else delete state[id];
    }
    return JSON.stringify(state);
  }}, ...updates.map(([id, finished]) => ({key: markerKey(id), value: finished ? "1" : null}))];
}

export function setAliasesFinished(ids, finished = true) {
  const aliases = cleanIdentities(ids);
  if (!aliases.length || !writeChanges(finishedChanges(aliases.map(id => [id, Boolean(finished)])))) return false;
  dispatchLocalEvent(EVENT, { bookId: aliases[0], bookIds: aliases, finished: Boolean(finished) });
  return true;
}

export function setFinished(bookId, finished = true) {
  return setAliasesFinished([bookId], finished);
}

export function migrateFinished(fromId, toId) {
  const from = cleanIdentity(fromId), to = cleanIdentity(toId);
  if (!from || !to || from === to || !isFinished(from)) return false;
  const ok = writeChanges(finishedChanges([[from, false], [to, true]]));
  if (ok) dispatchLocalEvent(EVENT, { bookId: to, bookIds: [from, to], finished: true, migratedFrom: from });
  return ok;
}

export function resetReadingAliases(ids) {
  const aliases = cleanIdentities(ids);
  if (!aliases.length) return false;
  if (!writeChanges([...finishedChanges(aliases.map(id => [id, false])), ...progressRemovalChanges(aliases)])) return false;
  dispatchLocalEvent(EVENT, {bookId: aliases[0], bookIds: aliases, finished: false});
  dispatchLocalEvent(PROGRESS_EVENT, {identity: aliases[0], identities: aliases, progress: null, cleared: true});
  return true;
}

export function resetVolumeReadingState(seriesId, volume, index = -1, extra = []) {
  return resetReadingAliases(volumeAliases(seriesId, volume, index, extra));
}

export function volumeId(volume) {
  return volumePrimaryIdentity(volume);
}

export { stableVolumeId };

export function volumeAliases(seriesId, volume, index = -1, extra = []) {
  return identityVolumeAliases(seriesId, volume, index, extra);
}

export function isVolumeFinished(seriesId, volume, index = -1, extra = []) {
  return isAnyFinished(volumeAliases(seriesId, volume, index, extra));
}

export function setVolumeFinished(seriesId, volume, finished = true, index = -1, extra = []) {
  return setAliasesFinished(volumeAliases(seriesId, volume, index, extra), finished);
}

export function progressForIdentity(identity) {
  return readProgress(identity);
}

export { progressForAliases, progressAtBeginning };

export function volumeProgress(seriesId, volume, index = -1, extra = []) {
  return progressForAliases(volumeAliases(seriesId, volume, index, extra));
}

export function volumeState(seriesId, volume, index = -1, extra = []) {
  if (isVolumeFinished(seriesId, volume, index, extra)) return STATES.FINISHED;
  return progressAtBeginning(volumeProgress(seriesId, volume, index, extra)) ? STATES.UNREAD : STATES.IN_PROGRESS;
}

export function actionLabelForState(state) {
  if (state === STATES.FINISHED) return "Read Again";
  if (state === STATES.IN_PROGRESS) return "Continue";
  return "Read";
}

export function clearProgressAliases(ids) {
  return clearProgress(ids);
}

export function clearVolumeProgress(seriesId, volume, index = -1, extra = []) {
  return clearProgress(volumeAliases(seriesId, volume, index, extra));
}

export function finishedCount(series) {
  const volumes = Array.isArray(series?.volumes) ? series.volumes : [];
  return volumes.filter((volume, index) => isVolumeFinished(series?.id, volume, index)).length;
}

export function seriesFinished(series) {
  const volumes = Array.isArray(series?.volumes) ? series.volumes : [];
  return volumes.length > 0 && finishedCount(series) === volumes.length;
}

export function volumeEntries(series) {
  const volumes = Array.isArray(series?.volumes) ? series.volumes : [];
  return volumes.map((volume, index) => {
    const finished = isVolumeFinished(series?.id, volume, index);
    const progress = volumeProgress(series?.id, volume, index);
    return {
      volume,
      index,
      state: finished ? STATES.FINISHED : progressAtBeginning(progress) ? STATES.UNREAD : STATES.IN_PROGRESS,
      progress
    };
  });
}

export function preferredSeriesEntry(series) {
  const entries = volumeEntries(series);
  const inProgress = entries.filter(entry => entry.state === STATES.IN_PROGRESS)
    .sort((a, b) => (Number(b.progress?.updatedAt) || 0) - (Number(a.progress?.updatedAt) || 0));
  return inProgress[0] || entries.find(entry => entry.state === STATES.UNREAD) || entries.find(entry => entry.state === STATES.FINISHED) || null;
}

function entrySnapshots(seriesList) {
  return (Array.isArray(seriesList) ? seriesList : []).map(series => ({ series, entries: volumeEntries(series) }));
}

function latestActiveFromSnapshots(snapshots) {
  const candidates = [];
  for (const { series, entries } of snapshots) {
    for (const entry of entries) {
      if (!entry.progress?.updatedAt || entry.state === STATES.FINISHED) continue;
      candidates.push({ series, ...entry, updatedAt: Number(entry.progress.updatedAt) || 0 });
    }
  }
  candidates.sort((a, b) => b.updatedAt - a.updatedAt);
  return candidates[0] || null;
}

export function latestActiveEntry(seriesList) {
  return latestActiveFromSnapshots(entrySnapshots(seriesList));
}

function readableEntry(entry) {
  return Boolean(entry?.volume?.file || entry?.volume?.bookId);
}

function finishedAt(seriesId, entry, finishedState) {
  if (entry?.state !== STATES.FINISHED) return 0;
  let latest = 0;
  for (const id of volumeAliases(seriesId, entry.volume, entry.index)) {
    const stamp = Number(finishedState?.[id]) || 0;
    if (stamp > latest) latest = stamp;
    else if (!stamp && markerFinished(id)) latest = Math.max(latest, 1);
  }
  return latest;
}

function nextStartedFromSnapshots(snapshots, finishedState) {
  const candidates = [];
  for (const { series, entries } of snapshots) {
    if (!entries.length || entries.some(entry => entry.state === STATES.IN_PROGRESS)) continue;
    let lastFinished = -1, activityAt = 0;
    for (const entry of entries) {
      if (entry.state !== STATES.FINISHED) continue;
      lastFinished = Math.max(lastFinished, entry.index);
      activityAt = Math.max(activityAt, finishedAt(series?.id, entry, finishedState), Number(entry.progress?.updatedAt) || 0);
    }
    if (lastFinished < 0) continue;
    const next = entries[lastFinished + 1];
    if (!next || next.state !== STATES.UNREAD || !readableEntry(next)) continue;
    candidates.push({ series, ...next, updatedAt: activityAt, suggestion: "next" });
  }
  candidates.sort((a, b) => b.updatedAt - a.updatedAt || String(a.series?.title || "").localeCompare(String(b.series?.title || "")));
  return candidates[0] || null;
}

export function nextStartedSeriesEntry(seriesList) {
  return nextStartedFromSnapshots(entrySnapshots(seriesList), load());
}

function randomUnit(value) {
  const sampled = typeof value === "function" ? Number(value()) : Number(value);
  const fallback = Number.isFinite(sampled) ? sampled : Math.random();
  return Math.min(0.999999999, Math.max(0, fallback));
}

function randomSuggestionFromSnapshots(snapshots, randomValue) {
  const candidates = [];
  for (const { series, entries: sourceEntries } of snapshots) {
    const entries = sourceEntries.filter(readableEntry);
    if (!entries.length) continue;
    const entry = entries.find(item => item.state === STATES.IN_PROGRESS) || entries.find(item => item.state === STATES.UNREAD) || entries[0];
    if (entry) candidates.push({ series, ...entry, suggestion: "random" });
  }
  if (!candidates.length) return null;
  const unfinished = candidates.filter(candidate => candidate.state !== STATES.FINISHED);
  const pool = unfinished.length ? unfinished : candidates;
  const selected = pool[Math.floor(randomUnit(randomValue) * pool.length)] || pool[0];
  return { ...selected, suggestionCount: pool.length };
}

export function randomSeriesSuggestionEntry(seriesList, randomValue = Math.random) {
  return randomSuggestionFromSnapshots(entrySnapshots(seriesList), randomValue);
}

export function libraryBannerEntry(seriesList, randomValue = Math.random) {
  const snapshots = entrySnapshots(seriesList);
  const current = latestActiveFromSnapshots(snapshots);
  if (current) return { ...current, mode: "continue" };
  const next = nextStartedFromSnapshots(snapshots, load());
  if (next) return { ...next, mode: "suggestion" };
  const suggestion = randomSuggestionFromSnapshots(snapshots, randomValue);
  return suggestion ? { ...suggestion, mode: "suggestion" } : null;
}

export function isReadingStorageKey(key) {
  const value = String(key || "");
  return value === KEY || value.startsWith(MARKER_PREFIX) || isProgressStorageKey(value);
}
