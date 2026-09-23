/* Shadow Garden R3 — Library render ownership. */
import { volumeActionFor } from "./public/volume-actions.js";
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
  const activePercent = active ? Math.max(1, Math.min(99, Math.round((Number(active.progress?.percentage) || 0) * 100))) : 0;
  const visualProgress = finished ? 100 : activePercent;
  const pinned = preferences.isPinned(series?.id);
  const href = urls.seriesUrl(series?.id);
  const translator = translations?.primaryTranslator(series);
  const translationStatus = translations?.normalizeTranslationStatus(series?.translationStatus) || "";
  const translatorLabel = translator ? translations.creditDisplayName(translator) : "";
  return `<a class="series-card ${finished ? "is-finished" : ""}" href="${href}">
    <div class="cover">
      ${cover ? `<img src="${esc(cover)}" alt="${esc(series?.title)} cover" loading="${aboveFold ? "eager" : "lazy"}" decoding="async" fetchpriority="${index < 2 ? "high" : "low"}" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">` : ""}
      <div class="cover-fallback ${cover ? "hidden" : ""}">${esc(series?.title)}</div>
      <span class="volume-pill">${volumes} ${volumes === 1 ? "VOL" : "VOLS"}</span>
      ${series?.nsfw ? `<span class="adult-pill">18+</span>` : ""}
      ${finished ? `<span class="finished-series-badge">✓ Finished</span>` : ""}
      ${visualProgress ? `<span class="cover-reading-progress" aria-hidden="true"><span style="width:${visualProgress}%"></span></span>` : ""}
    </div>
    <div class="card-copy">
      <h2>${esc(series?.title)}</h2>
      <p>${esc(series?.author || "Unknown author")}</p>
      ${translatorLabel ? `<p class="card-translator">TL · ${esc(translatorLabel)}${translationStatus ? ` · ${esc(translationStatus)}` : ""}</p>` : ""}
      <div class="card-meta"><span>${series?.year || "—"}</span><span>${finished ? "Finished" : esc(arr(series?.genres)[0] || arr(series?.tags)[0] || "")}</span></div>
    </div>
    <div class="compact-card-badges" aria-label="Series badges">
      ${finished ? '<span class="compact-card-badge finished">✓ Finished</span>' : ""}
      ${pinned ? '<span class="compact-card-badge pinned">◆ Pinned</span>' : ""}
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

function recentCopy(series, title, added, esc, format) {
  return `<div class="recent-volume-copy"><strong>${esc(title)}</strong><span class="recent-volume-series">${esc(series?.title || "Untitled series")}</span><span class="recent-volume-added">Added ${esc(formatDate(added, format))}</span></div>`;
}

export function recentVolumeCard(entry, index, { readingState, urls, format }) {
  const esc = format.escapeHtml;
  const { series, volume, volumeIndex } = entry;
  const cover = volumeCover(series, volume);
  const title = volume?.title || `Volume ${volume?.number ?? "—"}`;
  const copy = recentCopy(series, title, volume?.added, esc, format);
  if (!volume?.file) {
    return `<a class="recent-volume" href="${urls.seriesUrl(series?.id)}"><div class="recent-volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="${index < 4 ? "eager" : "lazy"}" decoding="async">` : ""}<div class="recent-volume-fallback ${cover ? "hidden" : ""}">${esc(title)}</div><span class="recent-volume-badge">NEW</span></div>${copy}</a>`;
  }
  const action = volumeActionFor(series, volume, volumeIndex);
  const progress = readingState.volumeProgress(series?.id, volume, volumeIndex);
  const percent = Math.round((Number(progress?.percentage) || 0) * 100);
  const badge = action.state === readingState.STATES.FINISHED ? "✓ FINISHED" : action.state === readingState.STATES.IN_PROGRESS ? `CONTINUE · ${percent}%` : volume?.number != null ? `VOL ${volume.number}` : "READ";
  return `<a class="recent-volume" ${attrs(action, esc)} href="${action.href}" aria-label="${esc(action.label)} ${esc(title)} — ${esc(series?.title)}"><div class="recent-volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden')">` : ""}<div class="recent-volume-fallback ${cover ? "hidden" : ""}">${esc(title)}</div><span class="recent-volume-badge">${esc(badge)}</span></div>${copy}</a>`;
}

export function renderRecentlyAdded(section, container, entries, dependencies) {
  if (!section || !container) return;
  if (!entries.length) {
    container.replaceChildren();
    section.classList.add("hidden");
    return;
  }
  container.innerHTML = entries.map((entry, index) => recentVolumeCard(entry, index, dependencies)).join("");
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
  const percent = Math.round((Number(progress?.percentage) || 0) * 100);
  const mode = current.mode === "suggestion" ? "suggestion" : "continue";
  const context = mode === "continue"
    ? `${series?.title || "Untitled series"} · Volume ${number} · ${percent}%`
    : `${current.suggestion === "next" ? "Next in series" : "Read suggestion"} · ${series?.title || "Untitled series"} · Volume ${number}`;
  panel.dataset.readingState = state;
  panel.dataset.readingMode = mode;
  const reroll = mode === "suggestion" && current.suggestion === "random" ? `<button class="another-suggestion" type="button" data-another-suggestion aria-label="Show another reading suggestion" title="Another suggestion">↻</button>` : "";
  panel.innerHTML = `<div class="continue-mark${cover ? " continue-cover" : ""}">${cover ? `<img src="${esc(cover)}" alt="" loading="eager" decoding="async">` : "✦"}</div><div><strong>${esc(title)}</strong><span>${esc(context)}</span></div><div class="continue-actions"><a ${attrs(action, esc)} href="${action.href}">${esc(action.label)}</a>${reroll}</div>`;
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
