/* Shadow Garden R3 — Library catalog query/filter/sort model. */

import { translationSearchTerms, translatorNames } from "./domain/translations.js";
import { CANONICAL_GENRES } from "./domain/catalog-taxonomy.js";

export const VALID_SORTS = new Set(["recent", "oldest", "title", "title-desc", "author", "author-desc", "year", "year-asc", "volumes", "volumes-asc"]);
export const VALID_VOLUME_RANGES = new Set(["", "1", "2-5", "6-10", "11+"]);
export const VALID_READING_STATUSES = new Set(["", "finished", "unfinished"]);

const arr = value => Array.isArray(value) ? value : [];

export function normalizeSearch(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function queryTokens(value) {
  const matches = String(value || "").match(/"[^"]+"|\S+/g) || [];
  return matches.map(token => normalizeSearch(token.replace(/^"|"$/g, ""))).filter(Boolean);
}

export function addedTime(value) {
  return Date.parse(value || "") || 0;
}

export function latestAddedTime(series) {
  return Math.max(0, ...arr(series?.volumes).map(volume => addedTime(volume?.added)));
}

export function seriesCover(series) {
  return series?.coverThumb || series?.cover || arr(series?.volumes).find(volume => volume?.coverThumb)?.coverThumb || arr(series?.volumes).find(volume => volume?.cover)?.cover || "";
}

export function volumeCover(series, volume) {
  return volume?.coverThumb || volume?.cover || seriesCover(series);
}

export function volumeCountMatches(count, range) {
  if (!range) return true;
  if (range === "1") return count === 1;
  if (range === "2-5") return count >= 2 && count <= 5;
  if (range === "6-10") return count >= 6 && count <= 10;
  if (range === "11+") return count >= 11;
  return true;
}

export function seriesHaystack(series) {
  return normalizeSearch([
    series?.title,
    series?.author,
    series?.description,
    ...translationSearchTerms(series),
    ...arr(series?.genres),
    ...arr(series?.tags),
    ...arr(series?.volumes).flatMap(volume => [volume?.title, volume?.number, volume?.year])
  ].filter(Boolean).join(" "));
}

export function validateFilterState(state, items) {
  const authors = new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean));
  const translators = new Set(items.flatMap(translatorNames));
  const years = new Set(items.map(series => String(series?.year || "")).filter(Boolean));
  const genres = new Set(items.flatMap(series => arr(series?.genres).map(String)));
  const tags = new Set(items.flatMap(series => arr(series?.tags).map(String)));
  if (state.author && !authors.has(state.author)) state.author = "";
  if (state.translator && !translators.has(state.translator)) state.translator = "";
  if (state.year && !years.has(state.year)) state.year = "";
  if (state.genre && !genres.has(state.genre)) state.genre = "";
  state.tags = new Set([...state.tags].filter(tag => tags.has(tag)));
  if (!VALID_VOLUME_RANGES.has(state.volumeRange)) state.volumeRange = "";
  if (!VALID_READING_STATUSES.has(state.readingStatus)) state.readingStatus = "";
  if (!VALID_SORTS.has(state.sort)) state.sort = "recent";
  if (!["grid", "compact"].includes(state.view)) state.view = "grid";
  return state;
}

export function filterAndSort(items, state, { pinnedIds = new Set(), seriesFinished = () => false } = {}) {
  const tokens = queryTokens(state.query);
  const filtered = items.filter(series => {
    if (tokens.length) {
      const haystack = seriesHaystack(series);
      if (!tokens.every(token => haystack.includes(token))) return false;
    }
    if (state.author && String(series?.author || "").trim() !== state.author) return false;
    if (state.translator && !translatorNames(series).includes(state.translator)) return false;
    if (state.genre && !arr(series?.genres).map(String).includes(state.genre)) return false;
    const seriesTags = new Set(arr(series?.tags).map(String));
    if ([...state.tags].some(tag => !seriesTags.has(tag))) return false;
    if (state.year && String(series?.year || "") !== state.year) return false;
    if (!volumeCountMatches(arr(series?.volumes).length, state.volumeRange)) return false;
    if (state.readingStatus) {
      const finished = Boolean(seriesFinished(series));
      if (state.readingStatus === "finished" && !finished) return false;
      if (state.readingStatus === "unfinished" && finished) return false;
    }
    if (state.pinnedOnly && !pinnedIds.has(series?.id)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const titleA = String(a?.title || ""), titleB = String(b?.title || "");
    const authorA = String(a?.author || ""), authorB = String(b?.author || "");
    if (state.sort === "title") return titleA.localeCompare(titleB);
    if (state.sort === "title-desc") return titleB.localeCompare(titleA);
    if (state.sort === "author") return authorA.localeCompare(authorB) || titleA.localeCompare(titleB);
    if (state.sort === "author-desc") return authorB.localeCompare(authorA) || titleA.localeCompare(titleB);
    if (state.sort === "year") return (Number(b?.year) || 0) - (Number(a?.year) || 0) || titleA.localeCompare(titleB);
    if (state.sort === "year-asc") return (Number(a?.year) || Number.POSITIVE_INFINITY) - (Number(b?.year) || Number.POSITIVE_INFINITY) || titleA.localeCompare(titleB);
    if (state.sort === "volumes") return arr(b?.volumes).length - arr(a?.volumes).length || titleA.localeCompare(titleB);
    if (state.sort === "volumes-asc") return arr(a?.volumes).length - arr(b?.volumes).length || titleA.localeCompare(titleB);
    if (state.sort === "oldest") {
      const aTime = latestAddedTime(a) || Number.POSITIVE_INFINITY;
      const bTime = latestAddedTime(b) || Number.POSITIVE_INFINITY;
      return aTime - bTime || titleA.localeCompare(titleB);
    }
    return latestAddedTime(b) - latestAddedTime(a) || titleA.localeCompare(titleB);
  });
  return filtered;
}

export function recentlyAdded(items, limit = 8) {
  return items.flatMap(series => arr(series?.volumes).map((volume, volumeIndex) => ({
    series,
    volume,
    volumeIndex,
    time: addedTime(volume?.added)
  }))).filter(entry => entry.time > 0).sort((a, b) => b.time - a.time).slice(0, limit);
}

export function filterOptions(items) {
  const authors = [...new Set(items.map(series => String(series?.author || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const translators = [...new Set(items.flatMap(translatorNames))].sort((a, b) => a.localeCompare(b));
  const years = [...new Set(items.map(series => String(series?.year || "")).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const presentGenres=new Set(items.flatMap(series=>arr(series?.genres).map(String)));
  const genres=CANONICAL_GENRES.filter(genre=>presentGenres.has(genre));
  const tagCounts = new Map();
  items.forEach(series => new Set(arr(series?.tags).map(String)).forEach(tag => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
  const tags = [...tagCounts.keys()].sort((a, b) => a.localeCompare(b));
  const popularTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 16).map(([tag]) => tag);
  return { authors, translators, years, genres, tags, popularTags, tagCounts };
}


function cloneState(state) {
  return { ...state, tags: new Set(state?.tags || []) };
}

export function contextualFilterOptions(items, state, dependencies = {}) {
  const base = filterOptions(items);
  const count = patch => filterAndSort(items, Object.assign(cloneState(state), patch), dependencies).length;
  const authorCounts = new Map(base.authors.map(value => [value, count({ author: value })]));
  const translatorCounts = new Map(base.translators.map(value => [value, count({ translator: value })]));
  const genreCounts = new Map(base.genres.map(value => [value, count({ genre: value })]));
  const yearCounts = new Map(base.years.map(value => [value, count({ year: value })]));
  const volumeCounts = new Map(VALID_VOLUME_RANGES.size ? [...VALID_VOLUME_RANGES].filter(Boolean).map(value => [value, count({ volumeRange: value })]) : []);
  const tagCounts = new Map(base.tags.map(value => { const tags = new Set(state?.tags || []); tags.add(value); return [value, count({ tags })]; }));
  return { ...base, authorCounts, translatorCounts, genreCounts, yearCounts, volumeCounts, tagCounts };
}
