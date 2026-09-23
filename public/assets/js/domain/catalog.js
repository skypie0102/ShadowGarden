/* Shadow Garden R2 — canonical catalog normalization and lookup helpers. */

import { cleanIdentities, isBookId, volumeMatchesIdentity } from "./book-identity.js";
import { migrateLegacyBookmarks } from "./bookmarks.js";
import { migrateLegacyProgress } from "./progress.js";
import { normalizeTranslationStatus, normalizeTranslations } from "./translations.js";

const STATUS_ALIASES = new Map([
  ["complete", "Complete"], ["completed", "Complete"], ["finished", "Complete"],
  ["ongoing", "Ongoing"], ["publishing", "Ongoing"], ["active", "Ongoing"], ["current", "Ongoing"],
  ["hiatus", "Hiatus"], ["on hiatus", "Hiatus"], ["paused", "Hiatus"],
  ["dropped", "Dropped"], ["cancelled", "Dropped"], ["canceled", "Dropped"], ["discontinued", "Dropped"]
]);
const STATUS_TAG_KEYS = new Set([...STATUS_ALIASES.keys(), "complete", "ongoing", "hiatus", "dropped"]);

export const statuses = Object.freeze(["Complete", "Ongoing", "Hiatus", "Dropped"]);

export function normalizeStatus(value) {
  return STATUS_ALIASES.get(String(value || "").trim().toLowerCase()) || "Ongoing";
}

export function normalizeCatalogShape(catalog) {
  const value = catalog && typeof catalog === "object" ? catalog : {};
  const bookIds = [];
  const series = (Array.isArray(value.series) ? value.series : []).map(item => {
    const status = normalizeStatus(item?.status);
    const tags = [...new Set([
      ...(Array.isArray(item?.tags) ? item.tags : []).map(String).filter(tag => !STATUS_TAG_KEYS.has(String(tag).trim().toLowerCase())),
      status
    ])];
    const volumes = (Array.isArray(item?.volumes) ? item.volumes : []).map(volume => {
      const next = { ...(volume || {}) }, credits = normalizeTranslations(volume?.translations);
      if (credits.length) next.translations = credits; else delete next.translations;
      const bookId = String(volume?.bookId || "");
      if (!isBookId(bookId)) return next;
      bookIds.push(bookId);
      return { ...next, file: bookId };
    });
    const next = { ...item, status, tags, volumes }, translationStatus = normalizeTranslationStatus(item?.translationStatus), credits = normalizeTranslations(item?.translations);
    if (translationStatus) next.translationStatus = translationStatus; else delete next.translationStatus;
    if (credits.length) next.translations = credits; else delete next.translations;
    return next;
  });
  return { catalog: { ...value, series }, bookIds };
}

export async function normalizeCatalog(catalog, { migrateLegacyState = true } = {}) {
  const normalized = normalizeCatalogShape(catalog);
  if (migrateLegacyState && normalized.bookIds.length) {
    try {
      await Promise.all([
        migrateLegacyProgress(normalized.bookIds),
        migrateLegacyBookmarks(normalized.bookIds)
      ]);
    } catch (error) {
      console.warn("Legacy reading-state migration skipped", error);
    }
  }
  return normalized.catalog;
}

export function seriesList(catalog) {
  return Array.isArray(catalog?.series) ? catalog.series : [];
}

export function seriesById(catalog, seriesId) {
  const id = String(seriesId || "");
  return seriesList(catalog).find(series => String(series?.id || "") === id) || null;
}

export function volumeEntries(series) {
  const volumes = Array.isArray(series?.volumes) ? series.volumes : [];
  return volumes.map((volume, index) => ({ series, volume, index }));
}

export function allVolumeEntries(catalog) {
  return seriesList(catalog).flatMap(volumeEntries);
}

export function findVolumeEntry(catalog, seriesId, identity, extra = []) {
  const series = seriesById(catalog, seriesId);
  if (!series) return null;
  const volumes = Array.isArray(series.volumes) ? series.volumes : [];
  const wanted = String(identity || "").trim();
  if (!wanted) return null;
  /* Direct lookup consults each volume's own identities plus its stable id.
     Session-level alternates stay out of this pass so a shared ticket or
     source-path value can never blanket-match the first catalog entry. */
  for (let index = 0; index < volumes.length; index += 1) {
    const volume = volumes[index];
    if (volumeMatchesIdentity(series.id, volume, index, wanted)) return { series, volume, index };
  }
  /* Legacy equivalence: an alternate identity such as a private media path or a
     migrated opaque id resolves only through a volume's own declared identities,
     never by being appended to every candidate at once. */
  const alternatives = cleanIdentities(extra);
  for (const candidate of alternatives) {
    if (candidate === wanted) continue;
    for (let index = 0; index < volumes.length; index += 1) {
      const volume = volumes[index];
      const owned = cleanIdentities([volume?.bookId, volume?.file]);
      if (owned.includes(candidate)) return { series, volume, index };
    }
  }
  return null;
}

export function isAdultSeriesId(seriesId) {
  return String(seriesId || "").startsWith("adult-");
}
