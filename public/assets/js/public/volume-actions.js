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
    href: bookId ? urls.readerUrl(bookId, seriesId,{adult:catalog.isAdultSeries(series)}) : "#"
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
    if (dialog.open || !pendingConfirmation) return;
    pendingConfirmation.resolve(dialog.returnValue === "confirm");
    pendingConfirmation = null;
  });
  return dialog;
}

export function confirmReadAgain(title, { signal } = {}) {
  if(signal?.aborted)return Promise.resolve(false);
  const label = title || "this volume";
  const dialog = ensureDialog();
  dialog.querySelector("[data-read-again-title]").textContent = label;
  if (typeof dialog.showModal !== "function") {
    return Promise.resolve(window.confirm(`Walk ${label} from the beginning?\n\nIts reading trail will be cleared, the Finished mark lifted, and the book reopened at page 1. Bookmarks remain untouched.`));
  }
  if(pendingConfirmation)pendingConfirmation.resolve(false);
  if (dialog.open) dialog.close("cancel");
  return new Promise(resolve => {
    let settled=false,focusFrame=0;
    const finish=value=>{
      if(settled)return;settled=true;
      signal?.removeEventListener("abort",onAbort);
      if(focusFrame)cancelAnimationFrame(focusFrame);
      if(pendingConfirmation===record)pendingConfirmation=null;
      resolve(value);
    };
    const record={resolve:finish};
    const onAbort=()=>{finish(false);if(dialog.open)dialog.close("cancel")};
    pendingConfirmation=record;
    signal?.addEventListener("abort",onAbort,{once:true});
    dialog.returnValue = "cancel";
    try{dialog.showModal()}catch{finish(false);return}
    focusFrame=requestAnimationFrame(() => {focusFrame=0;if(!settled)dialog.querySelector(".read-again-cancel")?.focus()});
  });
}

async function resolveVolume(seriesId, bookId,adult=catalog.isAdultSeriesId(seriesId)) {
  if (!window.ShadowGardenData || !seriesId || !bookId) return null;
  const context=await catalog.findSeriesContext(window.ShadowGardenData.loadCatalog,seriesId,{adult});
  return context?catalog.findVolumeEntry({series:[context.series]},seriesId,bookId):null;
}

export async function resetFinishedVolume(seriesId, bookId, { signal,adult } = {}) {
  if(signal?.aborted)return false;
  let entry;
  try {
    entry = await resolveVolume(seriesId, bookId,adult);
  } catch (error) {
    console.warn("Read Again catalog lookup failed", error);
    return false;
  }
  if (signal?.aborted || !entry) return false;
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

  let adult=catalog.adultRoute(seriesId,new URL(link.href,location.href).search);
  let entry = null;
  try { entry = await resolveVolume(seriesId, bookId,adult);if(entry)adult=catalog.isAdultSeries(entry.series); }
  catch (error) { console.warn("Volume state refresh failed", error); }

  if (entry) {
    const liveState = readingState.volumeState(entry.series.id, entry.volume, entry.index);
    if (liveState !== readingState.STATES.FINISHED) {
      location.assign(urls.readerUrl(bookId, seriesId,{adult}));
      return;
    }
  }

  if (!(await confirmReadAgain(title))) return;
  const reset = await resetFinishedVolume(seriesId, bookId,{adult});
  if (!reset) {
    window.alert("The Garden could not clear this reading trail. Your place has been left unchanged; please try again.");
    return;
  }
  location.assign(urls.readerUrl(bookId, seriesId, { restart: true,adult }));
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
