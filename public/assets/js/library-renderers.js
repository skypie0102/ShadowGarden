/* Shadow Garden R3 — Library render ownership. */
import { volumeActionFor } from "./public/volume-actions.js";
import { readingProgressSummary } from "./public/reading-progress.js";
import { readingStatusIcon } from "./public/reading-status-icons.js?v=2.29.4";
import { addedTime, seriesCover, volumeCover } from "./library-model.js";

const arr = value => Array.isArray(value) ? value : [];

function attrs(action, esc) {
  return `data-volume-action="open" data-volume-state="${esc(action.state)}" data-series-id="${esc(action.seriesId)}" data-book-id="${esc(action.bookId)}" data-volume-title="${esc(action.title)}"`;
}

export function seriesCard(series, index, { readingState, preferences, urls, format, translations }) {
  const esc = format.escapeHtml;
  const cover = seriesCover(series);
  const volumes = arr(series?.volumes).length;
  const aboveFold = index < 6;
  const entries = readingState.volumeEntries(series);
  const finished = entries.length > 0 && entries.every(entry => entry.state === readingState.STATES.FINISHED);
  const active = entries.find(entry => entry.state === readingState.STATES.IN_PROGRESS) || null;
  const savedPercent = active ? readingProgressSummary(active.progress).percent : null;
  const activePercent = savedPercent === null ? 0 : Math.max(1, Math.min(99, savedPercent));
  const visualProgress = finished ? 100 : activePercent;
  const pinned = preferences.isPinned(series?.id);
  const href = urls.seriesUrl(series?.id,{adult:series?.nsfw});
  const translator = translations?.primaryTranslator(series);
  const translationStatus = translations?.normalizeTranslationStatus(series?.translationStatus) || "";
  const translatorLabel = translator ? translations.creditDisplayName(translator) : "";
  return `<a class="series-card ${finished ? "is-finished" : ""}" href="${href}">
    <div class="cover">
      ${cover ? `<img src="${esc(cover)}" alt="${esc(series?.title)} cover" loading="${aboveFold ? "eager" : "lazy"}" decoding="async" fetchpriority="${index < 2 ? "high" : "low"}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">` : ""}
      <div class="cover-fallback ${cover ? "hidden" : ""}">${esc(series?.title)}</div>
      <span class="volume-pill">${volumes} ${volumes === 1 ? "VOL" : "VOLS"}</span>
      ${series?.nsfw ? `<span class="adult-pill">18+</span>` : ""}
      ${finished ? `<span class="finished-series-badge">Finished</span>` : ""}
      <div class="series-list-status-badges">
        ${finished ? `<span class="series-list-status-badge finished" role="img" aria-label="Finished" title="Finished">${readingStatusIcon("finished")}</span>` : ""}
        ${pinned ? `<span class="series-list-status-badge pinned" role="img" aria-label="Pinned series" title="Pinned series">${readingStatusIcon("pinned")}</span>` : ""}
      </div>
      ${visualProgress ? `<span class="cover-reading-progress" aria-hidden="true"><span style="width:${visualProgress}%"></span></span>` : ""}
    </div>
    <div class="card-copy">
      <h2>${esc(series?.title)}</h2>
      <p>${esc(series?.author || "Unknown author")}</p>
      ${translatorLabel ? `<p class="card-translator">TL · ${esc(translatorLabel)}${translationStatus ? ` · ${esc(translationStatus)}` : ""}</p>` : ""}
      <div class="card-meta"><span>${series?.year || "—"}</span><span>${finished ? "Finished" : esc(arr(series?.genres)[0] || arr(series?.tags)[0] || "")}</span></div>
    </div>
    <div class="compact-card-badges" aria-label="Series badges">
      <span class="compact-card-badge volumes">${volumes} ${volumes === 1 ? "VOL" : "VOLS"}</span>
      ${series?.nsfw ? '<span class="compact-card-badge adult">18+</span>' : ""}
    </div>
  </a>`;
}

function formatDate(value, format) {
  if (format?.formatDate) return format.formatDate(value);
  const time = addedTime(value);
  if (!time) return "Date unknown";
  try { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(time)); }
  catch { return String(value || ""); }
}

function recentCopy(series, title, added, esc, format, progress = "", progressId = "") {
  return `<div class="recent-volume-copy"><strong>${esc(title)}</strong><span class="recent-volume-series">${esc(series?.title || "Untitled series")}</span>${progress ? `<span id="${esc(progressId)}" class="recent-volume-progress">${esc(progress)}</span>` : ""}<span class="recent-volume-added">Added ${esc(formatDate(added, format))}</span></div>`;
}

export function recentVolumeCard(entry, index, { readingState, urls, format }, context) {
  const esc = format.escapeHtml;
  const { series, volume, volumeIndex } = entry;
  const cover = volumeCover(series, volume);
  const title = volume?.title || `Volume ${volume?.number ?? "—"}`;
  if (!volume?.file) {
    const copy = recentCopy(series, title, volume?.added, esc, format);
    return `<a class="recent-volume" href="${urls.seriesUrl(series?.id,{adult:series?.nsfw})}"><div class="recent-volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="${index < 4 ? "eager" : "lazy"}" decoding="async">` : ""}<div class="recent-volume-fallback ${cover ? "hidden" : ""}">${esc(title)}</div><span class="recent-volume-badge">NEW</span></div>${copy}</a>`;
  }
  const action = volumeActionFor(series, volume, volumeIndex, context);
  const progress = readingState.volumeProgress(series?.id, volume, volumeIndex);
  const summary = readingProgressSummary(progress);
  const inProgress = action.state === readingState.STATES.IN_PROGRESS;
  const progressId = `recent-volume-progress-${index}`;
  const copy = recentCopy(series, title, volume?.added, esc, format, inProgress ? summary.text : "", progressId);
  const badge = action.state === readingState.STATES.FINISHED ? "FINISHED" : inProgress ? `CONTINUE${summary.percent === null ? "" : ` · ${summary.percent}%`}` : volume?.number != null ? `VOL ${volume.number}` : "READ";
  return `<a class="recent-volume" ${attrs(action, esc)} href="${action.href}" aria-label="${esc(action.label)} ${esc(title)} — ${esc(series?.title)}"${inProgress ? ` aria-describedby="${esc(progressId)}"` : ""}><div class="recent-volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">` : ""}<div class="recent-volume-fallback ${cover ? "hidden" : ""}">${esc(title)}</div><span class="recent-volume-badge">${esc(badge)}</span></div>${copy}</a>`;
}

export function renderRecentlyAdded(section, container, entries, dependencies) {
  if (!section || !container) return;
  if (!entries.length) {
    container.replaceChildren();
    section.classList.add("hidden");
    return;
  }
  const contexts = new Map();
  container.innerHTML = entries.map((entry, index) => {
    if (!contexts.has(entry.series)) contexts.set(entry.series, dependencies.readingState.seriesReadingContext(entry.series));
    return recentVolumeCard(entry, index, dependencies, contexts.get(entry.series));
  }).join("");
  section.classList.remove("hidden");
}

export function renderReadingBanner(panel, intro, current, { readingState, format }) {
  if (!panel) return;
  const oldArt = intro?.querySelector(":scope > .intro-banner-art");
  if (!current) {
    panel.replaceChildren();
    panel.classList.add("hidden");
    delete panel.dataset.readingState;
    delete panel.dataset.readingMode;
    oldArt?.remove();
    return;
  }
  const esc = format.escapeHtml;
  const { series, volume, index, progress, state } = current;
  const action = volumeActionFor(series, volume, index);
  const cover = volumeCover(series, volume);
  const title = String(volume?.title || `Volume ${volume?.number ?? index + 1}`);
  const number = String(volume?.number ?? index + 1);
  const summary = readingProgressSummary(progress);
  const mode = current.mode === "suggestion" ? "suggestion" : "continue";
  const next = mode === "suggestion" && current.suggestion === "next";
  const heading = mode === "continue" ? "Continue reading" : next ? "Next in series" : "Reading suggestion";
  const seriesContext = series?.title && series.title !== title ? `${series.title} · ` : "";
  const context = `${seriesContext}Volume ${number}${state === readingState.STATES.IN_PROGRESS ? ` · ${summary.text}` : ""}`;
  const label = action.label;
  panel.dataset.readingState = state;
  panel.dataset.readingMode = mode;
  const reroll = mode === "suggestion" && current.suggestion === "random" && current.suggestionCount > 1 ? `<button class="another-suggestion" type="button" data-another-suggestion aria-label="Show another reading suggestion" title="Another suggestion">↻</button>` : "";
  panel.innerHTML = `<div class="continue-mark${cover ? " continue-cover" : ""}">${cover ? `<img src="${esc(cover)}" alt="" loading="eager" decoding="async">` : "✦"}</div><div class="continue-copy"><p class="continue-eyebrow">${heading}</p><strong title="${esc(title)}">${esc(title)}</strong><span class="continue-context">${esc(context)}</span></div><div class="continue-actions"><a ${attrs(action, esc)} href="${action.href}">${label}</a>${reroll}</div>`;
  panel.classList.remove("hidden");

  if (intro && cover) {
    let art = oldArt;
    if (!art) {
      art = document.createElement("div");
      art.className = "intro-banner-art";
      art.setAttribute("aria-hidden", "true");
      intro.prepend(art);
    }
    art.style.backgroundImage = `url(${JSON.stringify(cover)})`;
  } else oldArt?.remove();
}
