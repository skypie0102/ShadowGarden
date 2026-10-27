/* Shadow Garden R3 — Series hero and volume-card render ownership. */
import {isAdultSeries} from "./domain/catalog.js";
import { volumeActionFor } from "./public/volume-actions.js";
import { readingProgressSummary } from "./public/reading-progress.js";

const arr = value => Array.isArray(value) ? value : [];

function attrs(action, esc) {
  return `data-volume-action="open" data-volume-state="${esc(action.state)}" data-series-id="${esc(action.seriesId)}" data-book-id="${esc(action.bookId)}" data-volume-title="${esc(action.title)}"`;
}

function volumeArtwork(series, volume) {
  return String(volume?.cover || volume?.coverThumb || series?.cover || series?.coverThumb || "");
}

function randomUnit(value) {
  const sampled = typeof value === "function" ? Number(value()) : Number(value);
  const fallback = Number.isFinite(sampled) ? sampled : Math.random();
  return Math.min(0.999999999, Math.max(0, fallback));
}

export function selectBannerVolume(series, identity, randomValue = Math.random) {
  const volumes = arr(series?.volumes);
  const selected = String(series?.bannerBookId || "");
  if (identity?.isBookId?.(selected)) {
    const match = volumes.find(volume => String(volume?.bookId || volume?.file || "") === selected);
    if (match) return match;
  }
  const covered = volumes.filter(volume => volume?.cover || volume?.coverThumb);
  const pool = covered.length ? covered : volumes;
  if (!pool.length) return null;
  return pool[Math.floor(randomUnit(randomValue) * pool.length)] || pool[0] || null;
}

function tagLinks(series, urls, format) {
  const esc = format.escapeHtml;
  const adult = isAdultSeries(series);
  const base = urls.libraryUrl(adult);
  const genres=arr(series?.genres).map(genre=>{const value=String(genre||"");const href=`${base}?genre=${encodeURIComponent(value)}`;return `<a class="tag genre" href="${href}" title="Show ${esc(value)} genre in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});
  const tags=arr(series?.tags).map(tag=>{const value=String(tag||"");const href=`${base}?tag=${encodeURIComponent(value)}`;return `<a class="tag" href="${href}" title="Show ${esc(value)} in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});
  return [...genres,...tags].join("");
}

function translatorFilterHref(series, value, urls) {
  const adult = isAdultSeries(series);
  return `${urls.libraryUrl(adult)}?translator=${encodeURIComponent(value)}`;
}

function translatorLink(series, credit, urls, format, translations, className = "translation-name") {
  const esc = format.escapeHtml;
  const normalized = translations.normalizeTranslationCredit(credit);
  const label = normalized?.name || "";
  if (!label) return "";
  if (normalized?.url) {
    return `<a class="${className}" href="${esc(normalized.url)}" target="_blank" rel="noopener noreferrer" title="Visit ${esc(label)} source">${esc(label)}</a>`;
  }
  return `<a class="${className}" href="${translatorFilterHref(series, label, urls)}" title="Show ${esc(label)} in the ${series?.nsfw ? "Adult Library" : "Library"}">${esc(label)}</a>`;
}

function volumeCard(series, entry, dependencies, context) {
  const { readingState, format, urls, translations } = dependencies;
  const esc = format.escapeHtml;
  const { volume, index, state, progress } = entry;
  const action = volumeActionFor(series, volume, index, context);
  const available = Boolean(volume?.file);
  const cover = volume?.coverThumb || volume?.cover || series?.coverThumb || series?.cover || "";
  const summary = readingProgressSummary(progress);
  const finished = state === readingState.STATES.FINISHED;
  const inProgress = state === readingState.STATES.IN_PROGRESS;
  const buttonLabel = finished ? "Read Again" : inProgress ? "Continue" : "Read";
  const upNext = index === context.nextIndex;
  const visualProgress = finished ? 100 : inProgress && summary.percent !== null ? Math.max(1, Math.min(99, summary.percent)) : 0;
  const stateMeta = finished ? "Finished" : inProgress ? summary.text : "Unread";
  const stateLabel = finished ? "✓ Finished" : inProgress ? "In progress" : "Unread";
  const title = volume?.title || `Volume ${index + 1}`;
  const number = volume?.number ?? index + 1;
  const order = `Volume ${number}${Number(number) === index + 1 ? " of" : ` · ${index + 1} of`} ${context.entries.length}`;
  const overrides = translations.normalizeTranslations(volume?.translations);
  const overrideMarkup = overrides.length ? `<p class="volume-translator"><span>TL override</span> ${overrides.map(credit => translatorLink(series, credit, urls, format, translations, "volume-translator-link")).join(" · ")}</p>` : "";
  const artwork = `<div class="volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="lazy" decoding="async" fetchpriority="low">` : ""}${finished ? '<span class="finished-volume-badge" title="Finished" aria-label="Finished">✓</span>' : ""}${visualProgress ? `<span class="cover-reading-progress" aria-hidden="true"><span style="width:${visualProgress}%"></span></span>` : ""}</div>`;
  return `<article id="series-volume-${index}" tabindex="-1" aria-labelledby="series-volume-title-${index}" class="volume-card ${finished ? "is-finished" : ""} ${upNext ? "is-up-next" : ""} ${inProgress ? "is-in-progress" : ""}" data-volume-index="${index}" data-reading-state="${esc(state)}">
    ${available ? `<a class="volume-cover-link" ${attrs(action, esc)} href="${action.href}" aria-label="${esc(action.label)} ${esc(title)}" title="${esc(action.label)} ${esc(title)}">${artwork}</a>` : `<div class="volume-cover-unavailable">${artwork}</div>`}
    <p class="volume-order">${esc(order)}${upNext ? " · Up next" : ""}</p>
    <div class="volume-title-row"><h3 id="series-volume-title-${index}" class="volume-title">${esc(title)}</h3><span class="volume-state-pill ${finished ? "finished" : inProgress ? "progress" : upNext ? "up-next" : "unread"}">${esc(stateLabel)}</span></div>
    <p class="volume-meta">${[volume?.date || "", format.formatBytes(volume?.size), stateMeta].filter(Boolean).map(esc).join(" · ")}</p>
    ${overrideMarkup}
    <div class="volume-actions">
      ${available ? `<a class="read" ${attrs(action, esc)} href="${action.href}">${esc(buttonLabel)}</a>
      <a class="download" href="#book-${esc(volume.file)}" data-book-id="${esc(volume.file)}" aria-label="Download EPUB: ${esc(title)}" download>Download EPUB</a>` : '<span class="volume-unavailable">EPUB unavailable</span>'}
    </div>
  </article>`;
}

export function seriesMarkup(series, dependencies) {
  const { readingState, preferences, urls, format, identity, translations, bannerRandom } = dependencies;
  const esc = format.escapeHtml;
  const volumes = arr(series?.volumes);
  const first = volumes[0];
  const pinned = preferences.isPinned(series?.id);
  const finishedCount = readingState.finishedCount(series) || 0;
  const context = readingState.seriesReadingContext(series);
  const { entries, preferred: startEntry } = context;
  const startAction = startEntry ? volumeActionFor(series, startEntry.volume, startEntry.index, context) : null;
  const savedContext = startEntry?.state === readingState.STATES.IN_PROGRESS
    ? `Volume ${startEntry.volume?.number ?? startEntry.index + 1} · ${readingProgressSummary(startEntry.progress).text}` : "";
  const audioAlignedUrl = series?.audioAlignedUrl || volumes.find(volume => volume?.audioAlignedUrl)?.audioAlignedUrl || "";
  const cover = series?.cover || first?.cover || series?.coverThumb || first?.coverThumb || "";
  const backdrop = volumeArtwork(series, selectBannerVolume(series, identity, bannerRandom)) || series?.coverThumb || first?.coverThumb || cover;
  const primaryTranslator = translations.primaryTranslator(series);
  const translatorSummary = primaryTranslator ? `<p class="series-translator-summary"><span>Fan translation</span>${translatorLink(series, primaryTranslator, urls, format, translations)}</p>` : "";

  return `
    <section class="series-hero">
      ${backdrop ? `<div class="series-backdrop" aria-hidden="true" style="background-image:url('${esc(backdrop)}')"></div>` : ""}
      <div class="series-hero-inner">
        ${cover ? `<img class="series-cover" src="${esc(cover)}" alt="${esc(series?.title)} cover" loading="eager" decoding="async" fetchpriority="high">` : `<div class="series-cover-fallback"><span>${esc(series?.title)}</span></div>`}
        <div class="series-info">
          <div class="series-heading">
            <p class="kicker">${series?.nsfw ? "ADULT · " : ""}${esc((series?.status || "SERIES").toUpperCase())}</p>
            <h1>${esc(series?.title)}</h1>
            <p class="series-byline">${esc(series?.author || "Unknown author")} ${series?.year ? `<span class="series-year">· ${series.year}</span>` : ""}${finishedCount ? ` <span class="series-year">· ${finishedCount}/${volumes.length} finished</span>` : ""}${savedContext ? `<br><span class="series-reading-context series-year">${esc(savedContext)}</span>` : ""}</p>
            ${translatorSummary}
          </div>
          <div class="series-actions">
            ${startAction ? `<a class="primary-button" ${attrs(startAction, esc)} href="${startAction.href}">${esc(startAction.label)}</a>` : ""}
            ${volumes.length ? '<a class="secondary-button" href="#seriesVolumes">Browse volumes</a>' : ""}
            ${audioAlignedUrl ? `<a class="secondary-button audio-series-link" href="${esc(audioAlignedUrl)}" target="_blank" rel="noopener noreferrer">Audio EPUBs ↗</a>` : ""}
            <button id="pinButton" class="secondary-button series-pin-button ${pinned ? "pinned" : ""}" type="button" aria-label="${pinned ? "Unpin from Garden" : "Pin to Garden"}" aria-pressed="${pinned}" title="${pinned ? "Unpin from Garden" : "Pin to Garden"}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path class="pin-head" d="m16 3 5 5-4 1-4 4 1 4-2 2-7-7 2-2 4 1 4-4 1-4Z"/><path d="m8.5 15.5-5.5 5.5"/></svg></button>
          </div>
          <div class="tag-row">${tagLinks(series, urls, format)}</div>
        </div>
      </div>
    </section>
    <section class="series-body">
      ${series?.description ? `<section class="series-synopsis" aria-labelledby="seriesSynopsisTitle"><div class="series-synopsis-head"><h2 id="seriesSynopsisTitle">Synopsis</h2><button id="synopsisToggle" type="button" aria-expanded="true" aria-controls="seriesSynopsis" hidden>Show less</button></div><p id="seriesSynopsis" class="series-description">${esc(series.description)}</p></section>` : ""}
      <section id="seriesVolumes" class="series-volumes" tabindex="-1" aria-labelledby="seriesVolumesTitle">
        <div class="series-section-head"><h2 id="seriesVolumesTitle">Volumes</h2><div class="series-list-context"><span>${volumes.length} ${volumes.length === 1 ? "volume" : "volumes"} · Catalog order</span>${startEntry ? `<a href="#series-volume-${startEntry.index}" aria-label="Find Volume ${esc(startEntry.volume?.number ?? startEntry.index + 1)} in the volume list">Find Volume ${esc(startEntry.volume?.number ?? startEntry.index + 1)}</a>` : ""}</div></div>
        ${entries.length ? `<div class="volume-grid">${entries.map(entry => volumeCard(series, entry, dependencies, context)).join("")}</div>` : '<p class="series-empty">No volumes have been added yet.</p>'}
      </section>
    </section>
    <button id="seriesBackToTop" class="series-back-to-top" type="button" aria-label="Back to top" hidden>↑ Back to top</button>`;
}

export function notFoundMarkup(home, format) {
  const esc = format.escapeHtml;
  return `<section class="not-found"><span>PATH LOST</span><h1>This shelf has slipped into shadow.</h1><p>The Garden could not find this series among its living shelves.</p><a class="primary-button" href="${esc(home)}">Return to the Garden</a></section>`;
}
