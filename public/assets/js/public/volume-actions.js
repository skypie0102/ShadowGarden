/* Shadow Garden R3 — one action pipeline for every public volume entry point. */
import { catalog, readingState, urls } from "../domain/index.js";

let pendingConfirmation = null;
let installed = false;

export function volumeActionFor(series, volume, index = -1) {
  const seriesId = String(series?.id || "");
  const bookId = String(volume?.file || volume?.bookId || "");
  const title = String(volume?.title || `Volume ${index >= 0 ? index + 1 : volume?.number || ""}`).trim() || "this volume";
  const state = readingState.volumeState(seriesId, volume, index);
  return {
    seriesId,
    bookId,
    title,
    index,
    state,
    label: readingState.actionLabelForState(state),
    href: bookId ? urls.readerUrl(bookId, seriesId) : "#"
  };
}

function ensureDialog() {
  let dialog = document.getElementById("readAgainDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "readAgainDialog";
  dialog.className = "read-again-dialog";
  dialog.innerHTML = `
    <form method="dialog" class="read-again-card">
      <div class="read-again-mark" aria-hidden="true">↺</div>
      <p class="read-again-kicker">RETURN TO THE FIRST PAGE</p>
      <h2>Walk this volume from the beginning?</h2>
      <p class="read-again-copy">The reading trail for <strong data-read-again-title>this volume</strong> will be cleared and its Finished mark lifted. You will return to page 1; bookmarks remain untouched.</p>
      <div class="read-again-actions">
        <button class="read-again-cancel" value="cancel" type="submit">Keep My Place</button>
        <button class="read-again-confirm" value="confirm" type="submit">Begin Again</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close("cancel"); });
  dialog.addEventListener("cancel", () => {
    if (!pendingConfirmation) return;
    pendingConfirmation.resolve(false);
    pendingConfirmation = null;
  });
  dialog.addEventListener("close", () => {
    if (!pendingConfirmation) return;
    pendingConfirmation.resolve(dialog.returnValue === "confirm");
    pendingConfirmation = null;
  });
  return dialog;
}

export function confirmReadAgain(title) {
  const label = title || "this volume";
  const dialog = ensureDialog();
  dialog.querySelector("[data-read-again-title]").textContent = label;
  if (typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(`Walk ${label} from the beginning?\n\nIts reading trail will be cleared, the Finished mark lifted, and the book reopened at page 1. Bookmarks remain untouched.`));
  }
  if (dialog.open) dialog.close("cancel");
  return new Promise(resolve => {
    pendingConfirmation = { resolve };
    dialog.returnValue = "cancel";
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector(".read-again-cancel")?.focus());
  });
}

async function resolveVolume(seriesId, bookId) {
  if (!window.ShadowGardenData || !seriesId || !bookId) return null;
  const adult = catalog.isAdultSeriesId(seriesId);
  const shelf = await window.ShadowGardenData.loadCatalog(adult);
  return catalog.findVolumeEntry(shelf, seriesId, bookId);
}

export async function resetFinishedVolume(seriesId, bookId) {
  let entry;
  try {
    entry = await resolveVolume(seriesId, bookId);
  } catch (error) {
    console.warn("Read Again catalog lookup failed", error);
    return false;
  }
  if (!entry) return false;
  const clearedFinished = readingState.setVolumeFinished(entry.series.id, entry.volume, false, entry.index);
  const clearedProgress = readingState.clearVolumeProgress(entry.series.id, entry.volume, entry.index);
  return Boolean(clearedFinished && clearedProgress && readingState.volumeState(entry.series.id, entry.volume, entry.index) === readingState.STATES.UNREAD);
}

async function handleFinishedLink(link, event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  const seriesId = String(link.dataset.seriesId || "");
  const bookId = String(link.dataset.bookId || "");
  const title = String(link.dataset.volumeTitle || "this volume");
  if (!seriesId || !bookId) return;

  let entry = null;
  try { entry = await resolveVolume(seriesId, bookId); }
  catch (error) { console.warn("Volume state refresh failed", error); }

  if (entry) {
    const liveState = readingState.volumeState(entry.series.id, entry.volume, entry.index);
    if (liveState !== readingState.STATES.FINISHED) {
      location.assign(urls.readerUrl(bookId, seriesId));
      return;
    }
  }

  if (!(await confirmReadAgain(title))) return;
  const reset = await resetFinishedVolume(seriesId, bookId);
  if (!reset) {
    window.alert("The Garden could not clear this reading trail. Your place has been left unchanged; please try again.");
    return;
  }
  location.assign(urls.readerUrl(bookId, seriesId, { restart: true }));
}

export function installVolumeActionController(root = document) {
  if (installed) return () => {};
  installed = true;
  const handler = event => {
    const link = event.target?.closest?.("a[data-volume-action]");
    if (!link || !root.contains?.(link)) return;
    if (link.dataset.volumeState !== readingState.STATES.FINISHED) return;
    void handleFinishedLink(link, event);
  };
  root.addEventListener("click", handler, true);
  return () => {
    root.removeEventListener("click", handler, true);
    installed = false;
  };
}
