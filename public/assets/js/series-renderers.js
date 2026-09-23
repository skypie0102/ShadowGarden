/* Shadow Garden R3 — Series hero and volume-card render ownership. */
import { volumeActionFor } from "./public/volume-actions.js";

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
  const adult = Boolean(series?.nsfw) || String(series?.id || "").startsWith("adult-");
  const base = urls.libraryUrl(adult);
  const genres=arr(series?.genres).map(genre=>{const value=String(genre||"");const href=`${base}?genre=${encodeURIComponent(value)}`;return `<a class="tag genre" href="${href}" title="Show ${esc(value)} genre in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});
  const tags=arr(series?.tags).map(tag=>{const value=String(tag||"");const href=`${base}?tag=${encodeURIComponent(value)}`;return `<a class="tag" href="${href}" title="Show ${esc(value)} in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`});
  return [...genres,...tags].join("");
}

function translatorFilterHref(series, value, urls) {
  const adult = Boolean(series?.nsfw) || String(series?.id || "").startsWith("adult-");
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

function volumeCard(series, entry, dependencies, preferredIndex = -1) {
  const { readingState, format, urls, translations } = dependencies;
  const esc = format.escapeHtml;
  const { volume, index, state, progress } = entry;
  const action = volumeActionFor(series, volume, index);
  const cover = volume?.coverThumb || volume?.cover || series?.coverThumb || series?.cover || "";
  const percent = progress ? Math.round((Number(progress?.percentage) || 0) * 100) : 0;
  const finished = state === readingState.STATES.FINISHED;
  const inProgress = state === readingState.STATES.IN_PROGRESS;
  const upNext = !finished && !inProgress && index === preferredIndex;
  const visualProgress = finished ? 100 : inProgress ? Math.max(1, Math.min(99, percent)) : 0;
  const stateMeta = finished ? "Finished" : inProgress ? `${percent}% read` : "Unread";
  const stateLabel = finished ? "✓ Finished" : inProgress ? "Continue" : upNext ? "Up next" : "Unread";
  const title = volume?.title || `Volume ${index + 1}`;
  const overrides = translations.normalizeTranslations(volume?.translations);
  const overrideMarkup = overrides.length ? `<p class="volume-translator"><span>TL override</span> ${overrides.map(credit => translatorLink(series, credit, urls, format, translations, "volume-translator-link")).join(" · ")}</p>` : "";
  return `<article class="volume-card ${finished ? "is-finished" : ""} ${upNext ? "is-up-next" : ""} ${inProgress ? "is-in-progress" : ""}" data-volume-index="${index}" data-reading-state="${esc(state)}">
    <a class="volume-cover-link" ${attrs(action, esc)} href="${action.href}" aria-label="${esc(action.label)} ${esc(title)}" title="${esc(action.label)} ${esc(title)}">
      <div class="volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="lazy" decoding="async" fetchpriority="low">` : ""}${finished ? '<span class="finished-volume-badge" title="Finished" aria-label="Finished">✓</span>' : ""}${visualProgress ? `<span class="cover-reading-progress" aria-hidden="true"><span style="width:${visualProgress}%"></span></span>` : ""}</div>
    </a>
    <div class="volume-title-row"><h3 class="volume-title">${esc(title)}</h3><span class="volume-state-pill ${finished ? "finished" : inProgress ? "progress" : upNext ? "up-next" : "unread"}">${esc(stateLabel)}</span></div>
    <p class="volume-meta">${[volume?.date || "", format.formatBytes(volume?.size), stateMeta].filter(Boolean).join(" · ")}</p>
    ${overrideMarkup}
    <div class="volume-actions">
      <a class="read" ${attrs(action, esc)} href="${action.href}">${esc(action.label)}</a>
      <a class="download" href="#book-${esc(volume?.file)}" data-book-id="${esc(volume?.file)}" download>Download EPUB</a>
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
  const entries = readingState.volumeEntries(series);
  const startEntry = readingState.preferredSeriesEntry(series);
  const preferredIndex = startEntry && startEntry.state !== readingState.STATES.FINISHED ? startEntry.index : -1;
  const startAction = startEntry ? volumeActionFor(series, startEntry.volume, startEntry.index) : null;
  const audioAlignedUrl = series?.audioAlignedUrl || volumes.find(volume => volume?.audioAlignedUrl)?.audioAlignedUrl || "";
  const cover = series?.cover || first?.cover || series?.coverThumb || first?.coverThumb || "";
  const backdrop = volumeArtwork(series, selectBannerVolume(series, identity, bannerRandom)) || series?.coverThumb || first?.coverThumb || cover;
  const primaryTranslator = translations.primaryTranslator(series);
  const translatorSummary = primaryTranslator ? `<p class="series-translator-summary"><span>Fan translation</span>${translatorLink(series, primaryTranslator, urls, format, translations)}</p>` : "";

  return `
    <section class="series-hero">
      ${backdrop ? `<div class="series-backdrop" aria-hidden="true" style="background-image:url('${esc(backdrop)}')"></div>` : ""}
      <div class="series-hero-inner">
        ${cover ? `<img class="series-cover" src="${esc(cover)}" alt="${esc(series?.title)} cover" loading="eager" decoding="async" fetchpriority="high">` : `<div class="series-cover-fallback">${esc(series?.title)}</div>`}
        <div class="series-info">
          <p class="kicker">${series?.nsfw ? "ADULT · " : ""}${esc((series?.status || "SERIES").toUpperCase())}</p>
          <h1>${esc(series?.title)}</h1>
          <p class="series-byline">${esc(series?.author || "Unknown author")} ${series?.year ? `<span class="series-year">· ${series.year}</span>` : ""}${finishedCount ? ` <span class="series-year">· ${finishedCount}/${volumes.length} finished</span>` : ""}</p>
          ${translatorSummary}
          <div class="series-actions">
            ${startAction ? `<a class="primary-button" ${attrs(startAction, esc)} href="${startAction.href}">${esc(startAction.label)}</a>` : ""}
            ${audioAlignedUrl ? `<a class="secondary-button audio-series-link" href="${esc(audioAlignedUrl)}" target="_blank" rel="noopener noreferrer">Audio EPUBs ↗</a>` : ""}
            <button id="pinButton" class="secondary-button ${pinned ? "pinned" : ""}" type="button">${pinned ? "◆ Pinned" : "◇ Pin to Garden"}</button>
          </div>
          <div class="tag-row">${tagLinks(series, urls, format)}</div>
        </div>
      </div>
    </section>
    <section class="series-body">
      ${series?.description ? `<p class="series-description">${esc(series.description)}</p>` : ""}
      <div class="series-section-head"><h2>Volumes</h2><span>${volumes.length} ${volumes.length === 1 ? "volume" : "volumes"}</span></div>
      <div class="volume-grid">${entries.map(entry => volumeCard(series, entry, dependencies, preferredIndex)).join("")}</div>
    </section>
    <button id="seriesBackToTop" class="series-back-to-top" type="button" aria-label="Back to top" hidden>↑ Back to top</button>`;
}

export function notFoundMarkup(home, format) {
  const esc = format.escapeHtml;
  return `<section class="not-found"><span>PATH LOST</span><h1>This shelf has slipped into shadow.</h1><p>The Garden could not find this series among its living shelves.</p><a class="primary-button" href="${esc(home)}">Return to the Garden</a></section>`;
}
