// Isolated EPUB.js page-map measurement: iframe/runtime setup, media settling,
// per-section layout/CFI sampling, source release and sandbox disposal.
// The controller owns generation ordering, cache identity and fallback policy.
import {createReaderScope} from "./lifecycle.js";
import {installEpubLifecyclePatch} from './epub-lifecycle.js';
import {applyParagraphAlignment} from './paragraph-alignment.js';

const VISUAL_SELECTOR = "img,svg,picture,video,object,canvas";

function textOf(document) {
  return String(document?.body?.innerText || document?.body?.textContent || "").replace(/\s+/g, " ").trim();
}

function isPureVisual(document) {
  const body = document?.body;
  if (!body?.querySelector(VISUAL_SELECTOR)) return false;
  if (textOf(document).length > 24) return false;
  const meaningful = [...body.children].filter(node => {
    if (node.matches?.("script,style,noscript")) return false;
    if (node.matches?.(VISUAL_SELECTOR)) return true;
    if (node.querySelector?.(VISUAL_SELECTOR)) return true;
    return String(node.textContent || "").trim().length > 0;
  });
  return meaningful.length <= 3;
}

function firstMeaningfulElement(document) {
  return document?.body?.querySelector(VISUAL_SELECTOR) || document?.body?.firstElementChild || document?.body || document?.documentElement || null;
}

function lastMeaningfulElement(document) {
  const body = document?.body;
  if (!body) return firstMeaningfulElement(document);
  const media = body.querySelectorAll(VISUAL_SELECTOR);
  return media[media.length - 1] || body.lastElementChild || firstMeaningfulElement(document);
}

function cfiFromElement(section, element) {
  if (!section || !element || typeof section.cfiFromElement !== "function") return "";
  try { return section.cfiFromElement(element) || ""; } catch { return ""; }
}

function framePaint(scope) {
  return scope.wait(new Promise(resolve=>scope.frame(()=>scope.frame(resolve))));
}

function loadScript(document, src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function abortError() {
  const error = new Error("Canonical Page Map generation superseded");
  error.name = "AbortError";
  return error;
}

function abortable(promise, signal) {
  if (!signal) return Promise.resolve(promise);
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      value => { signal.removeEventListener("abort", onAbort); resolve(value); },
      error => { signal.removeEventListener("abort", onAbort); reject(error); }
    );
  });
}

function destroySandbox(sandbox) {
  if (!sandbox || sandbox.destroyed) return;
  sandbox.destroyed = true;
  try { sandbox.rendition?.destroy?.(); } catch {}
  try { sandbox.book?.destroy?.(); } catch {}
  try { sandbox.frame?.remove?.(); } catch {}
  sandbox.rendition = null;
  sandbox.book = null;
  sandbox.frame = null;
}

async function waitForMedia(view, frame, signal) {
  const document = view?.contents?.document;
  if (!document) return;
  const scope=createReaderScope();
  if(signal?.aborted)scope.dispose();else scope.listen(signal,"abort",()=>scope.dispose(),{once:true});
  try{
    await scope.wait(Promise.race([
      document.fonts?.ready||Promise.resolve(),
      new Promise(resolve=>scope.timeout(resolve,900))
    ]));
    const pending=[];
    document.querySelectorAll("img,video,object,svg image").forEach(node=>{
      if(node.tagName==="IMG"&&node.complete||node.tagName==="VIDEO"&&node.readyState>0)return;
      pending.push(new Promise(resolve=>{
        const media=scope.child(),done=()=>{media.dispose();resolve()};
        media.listen(node,"load",done,{once:true,passive:true});
        media.listen(node,"error",done,{once:true,passive:true});
        media.listen(node,"loadedmetadata",done,{once:true,passive:true});
        media.timeout(done,900);
      }));
    });
    await scope.wait(Promise.all(pending));
    await framePaint(scope);
    try{view.stopExpanding=false;view.expand?.(true)}catch{}
    await framePaint(scope);
  }finally{scope.dispose()}
}

async function createSandbox({ bookUrl, metrics, paginatedTheme, paragraphAlignment="default", signal, onCreate }) {
  const frame = document.createElement("iframe");
  const sandbox = { frame, book: null, rendition: null, destroyed: false };
  onCreate?.(sandbox);
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.dataset.sgPageMapSandbox = "1";
  Object.assign(frame.style, {
    position: "fixed",
    // Keep the measurement document in the viewport's rendering lifecycle.
    // Firefox/WebKit may suspend vendor animation frames in invisible/offscreen
    // iframes, leaving a valid long publication without a finished page map.
    left: "0",
    top: "0",
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-2147483647"
  });
  document.body.appendChild(frame);

  try {
    if (signal?.aborted) throw abortError();
    const documentRef = frame.contentDocument;
    documentRef.open();
    documentRef.write("<!doctype html><html><head><meta charset=\"utf-8\"><style>html,body,#sgPageMapHost{margin:0;width:100%;height:100%;overflow:hidden}</style></head><body><div id=\"sgPageMapHost\"></div></body></html>");
    documentRef.close();

    await abortable(loadScript(documentRef, "/assets/vendor/jszip.min.js?v=2.11.0"), signal);
    await abortable(loadScript(documentRef, "/assets/vendor/epub.min.js?v=2.11.0"), signal);
    const epub = frame.contentWindow?.ePub;
    if (typeof epub !== "function") throw new Error("EPUB.js page-map sandbox did not initialize");
    if(!installEpubLifecyclePatch(epub))throw new Error('EPUB.js page-map lifecycle could not initialize');

    const absoluteBookUrl = new URL(bookUrl, location.href).href;
    const book = epub(absoluteBookUrl);
    sandbox.book = book;
    const opening=createReaderScope();
    try{
      const failed=new Promise((_resolve,reject)=>opening.on(book,'openFailed',reject));
      await abortable(Promise.race([Promise.all([book.ready,book.opened]),failed]),signal);
    }finally{opening.dispose()}
    if (signal?.aborted) throw abortError();
    const host = documentRef.getElementById("sgPageMapHost");
    const rendition = book.renderTo(host, {
      width: metrics.width,
      height: metrics.height,
      manager: "default",
      flow: "paginated",
      spread: metrics.spread === "single" ? "none" : "auto",
      minSpreadWidth: 900
    });
    sandbox.rendition = rendition;
    rendition.hooks.content.register(contents=>applyParagraphAlignment(contents,paragraphAlignment));
    try { rendition.themes.default(paginatedTheme); } catch {}
    try {
      if (metrics.spread === "single") rendition.spread("none");
      else rendition.spread("auto", 900);
    } catch {}

    return sandbox;
  } catch (error) {
    destroySandbox(sandbox);
    throw error;
  }
}

function sandboxView(rendition, section) {
  const views = rendition?.manager?.views;
  try {
    const found = views?.find?.(section);
    if (found) return found;
  } catch {}
  try { return views?.first?.() || views?.all?.()?.[0] || null; } catch { return null; }
}

function releaseSandboxSources(retained,rendition,section){
  // The isolated map has no search/note consumers. A displayed view owns only
  // its current source; earlier sections can be released after view replacement.
  const visible=new Set(rendition.manager?.views?.all?.().map(view=>view.section)||[]);
  retained.add(section);
  for(const item of visible)retained.add(item);
  for(const item of retained){
    if(visible.has(item))continue;
    item.unload();
    retained.delete(item);
  }
}

async function mapSection({ rendition, frame, section, signal }) {
  await abortable(rendition.display(section.href), signal);
  const view = sandboxView(rendition, section);
  if (!view) throw new Error(`Could not render ${section.href}`);
  await abortable(waitForMedia(view, frame, signal), signal);

  const manager = rendition.manager;
  const layout = manager?.layout;
  const document = view.contents?.document;
  const startFallback = cfiFromElement(section, firstMeaningfulElement(document));
  const endFallback = cfiFromElement(section, lastMeaningfulElement(document)) || startFallback;

  if (isPureVisual(document) || layout?.name === "pre-paginated") {
    return [{
      sectionIndex: Number(section.index),
      href: section.href,
      localPage: 1,
      sectionPages: 1,
      startCfi: startFallback,
      endCfi: endFallback,
      kind: "visual"
    }];
  }

  const width = Math.max(1, Number(view.width?.()) || Number(view._width) || 1);
  const pageWidth = Math.max(1, Number(layout?.pageWidth) || Number(layout?.delta) || Number(manager?._stageSize?.width) || 1);
  const counted = Number(layout?.count?.(width)?.pages);
  const total = Math.max(1, Number.isFinite(counted) ? Math.round(counted) : Math.ceil(width / pageWidth));
  const pages = [];

  for (let index = 0; index < total; index += 1) {
    const start = index * pageWidth;
    const end = Math.min(width, start + pageWidth);
    let mapping = null;
    try { mapping = manager?.mapping?.page?.(view.contents, section.cfiBase, start, end) || null; } catch {}
    pages.push({
      sectionIndex: Number(section.index),
      href: section.href,
      localPage: index + 1,
      sectionPages: total,
      startCfi: mapping?.start || startFallback,
      endCfi: mapping?.end || endFallback || mapping?.start || startFallback,
      kind: "text"
    });
  }

  return pages;
}


export {createSandbox, destroySandbox, mapSection, releaseSandboxSources, abortable};
