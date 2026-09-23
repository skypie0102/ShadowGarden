const DB_NAME = "shadow-garden-reader";
const DB_VERSION = 1;
const STORE_NAME = "page-maps";
const PAGE_MAP_VERSION = 2;
const VISUAL_SELECTOR = "img,svg,picture,video,object,canvas";

const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function cleanHref(value) {
  let href = String(value || "").split("#")[0].split("?")[0];
  try { href = decodeURIComponent(href); } catch {}
  return href.replace(/^\.\//, "").replace(/^\//, "");
}

function hrefMatches(a, b) {
  const left = cleanHref(a), right = cleanHref(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function hashText(input) {
  let hash = 0x811c9dc5;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function openDatabase() {
  if (!window.indexedDB) return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function cacheGet(key) {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      try { db.close(); } catch {}
      resolve(null);
    }
  });
}

async function cachePut(value) {
  const db = await openDatabase();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    } catch {
      try { db.close(); } catch {}
      resolve(false);
    }
  });
}

function linearSpine(book) {
  const raw = book?.spine?.spineItems || [];
  const linear = raw.filter(item => item?.href && item.linear !== "no");
  return linear.length ? linear : raw.filter(item => item?.href);
}

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

function framePaint(frame) {
  return new Promise(resolve => {
    const raf = frame?.contentWindow?.requestAnimationFrame || requestAnimationFrame;
    raf(() => raf(resolve));
  });
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

async function waitForMedia(view, frame) {
  const document = view?.contents?.document;
  if (!document) return;
  try { await Promise.race([document.fonts?.ready || Promise.resolve(), sleep(900)]); } catch {}
  const pending = [];
  document.querySelectorAll("img,video,object,svg image").forEach(node => {
    if (node.tagName === "IMG" && node.complete) return;
    if (node.tagName === "VIDEO" && node.readyState > 0) return;
    pending.push(new Promise(resolve => {
      const done = () => resolve();
      node.addEventListener?.("load", done, { once: true, passive: true });
      node.addEventListener?.("error", done, { once: true, passive: true });
      node.addEventListener?.("loadedmetadata", done, { once: true, passive: true });
      setTimeout(done, 900);
    }));
  });
  if (pending.length) await Promise.all(pending);
  await framePaint(frame);
  try { view.stopExpanding = false; view.expand?.(true); } catch {}
  await framePaint(frame);
}

async function createSandbox({ bookUrl, metrics, paginatedTheme, signal, onCreate }) {
  const frame = document.createElement("iframe");
  const sandbox = { frame, book: null, rendition: null, destroyed: false };
  onCreate?.(sandbox);
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.dataset.sgPageMapSandbox = "1";
  Object.assign(frame.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${metrics.width}px`,
    height: `${metrics.height}px`,
    border: "0",
    visibility: "hidden",
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

    const absoluteBookUrl = new URL(bookUrl, location.href).href;
    const book = epub(absoluteBookUrl);
    sandbox.book = book;
    await abortable(book.ready, signal);
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

async function mapSection({ rendition, frame, section, signal }) {
  await abortable(rendition.display(section.href), signal);
  const view = sandboxView(rendition, section);
  if (!view) throw new Error(`Could not render ${section.href}`);
  await abortable(waitForMedia(view, frame), signal);

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

function fallbackSectionPage(section) {
  return [{
    sectionIndex: Number(section?.index),
    href: section?.href || "",
    localPage: 1,
    sectionPages: 1,
    startCfi: "",
    endCfi: "",
    kind: "fallback"
  }];
}

function prioritizedIndices(book, anchorCfi) {
  const items = linearSpine(book);
  const allowed = new Set(items.map(item => Number(item.index)));
  let current = Number(items[0]?.index) || 0;
  if (anchorCfi) {
    try {
      const section = book.spine.get(anchorCfi);
      if (section && allowed.has(Number(section.index))) current = Number(section.index);
    } catch {}
  }
  const order = [current, current - 1, current + 1];
  items.forEach(item => order.push(Number(item.index)));
  return [...new Set(order)].filter(index => allowed.has(index));
}

function finalizeSections(sectionMap) {
  const sections = [...sectionMap.entries()].sort((a, b) => a[0] - b[0]);
  const pages = [];
  let number = 1;
  for (const [, sectionPages] of sections) {
    for (const page of sectionPages) pages.push({ ...page, page: number++ });
  }
  return pages;
}

export function createPageMapController({
  book,
  bookUrl,
  getSettings,
  getLayoutMetrics,
  getViewer,
  getPaginatedTheme,
  onUpdate
}) {
  let activeFingerprint = "";
  let activeMap = null;
  let partialSections = new Map();
  let pagesBySection = new Map();
  let generationSerial = 0;
  let generationPromise = null;
  let activeGeneration = null;

  function settingsSnapshot() {
    const settings = getSettings?.() || {};
    return {
      font: settings.font || "book",
      fontSize: Number(settings.fontSize) || 100,
      lineHeight: Number(settings.lineHeight) || 1.6,
      textWidth: Number(settings.width) || 760
    };
  }

  function fingerprintData() {
    const metrics = getLayoutMetrics?.() || { width: 0, height: 0, spread: "single" };
    /* Continuous removes the 48px bottom navigation row. The canonical map always
       describes Pages mode, so normalize that extra Continuous viewport height away. */
    const flowHeightAdjustment = document.body?.classList.contains("reader-flow-scrolled") ? 48 : 0;
    const spine = linearSpine(book).map(item => `${item.index}:${cleanHref(item.href)}`).join("|");
    const metadata = book?.packaging?.metadata || {};
    const publication = `${metadata.identifier || ""}|${metadata.modified || ""}|${metadata.title || ""}`;
    const data = {
      version: PAGE_MAP_VERSION,
      width: Math.max(1, Math.round(Number(metrics.width) || 1)),
      height: Math.max(1, Math.round((Number(metrics.height) || 1) - flowHeightAdjustment)),
      spread: metrics.spread === "spread" ? "spread" : "single",
      ...settingsSnapshot(),
      spine: hashText(spine),
      publication: hashText(publication)
    };
    const fingerprint = `pm${PAGE_MAP_VERSION}-${hashText(JSON.stringify(data))}`;
    return { fingerprint, metrics: { width: data.width, height: data.height, spread: data.spread }, settings: settingsSnapshot() };
  }

  function rebuildIndexes(map) {
    pagesBySection = new Map();
    if (!map?.pages) return;
    for (const page of map.pages) {
      const index = Number(page.sectionIndex);
      if (!pagesBySection.has(index)) pagesBySection.set(index, []);
      pagesBySection.get(index).push(page);
    }
  }

  function activate(map, source = "ready") {
    activeMap = map;
    activeFingerprint = map.fingerprint;
    partialSections = new Map();
    rebuildIndexes(map);
    window.__sgCanonicalPageMap = { active: true, fingerprint: activeFingerprint, totalPages: map.totalPages };
    onUpdate?.({ type: source, map });
  }

  function currentFingerprint() {
    return fingerprintData().fingerprint;
  }

  function generationIsCurrent(record) {
    return Boolean(record && !record.controller.signal.aborted && record.serial === generationSerial);
  }

  function cancelGeneration() {
    const record = activeGeneration;
    if (!record) return;
    activeGeneration = null;
    try { record.controller.abort(); } catch {}
    destroySandbox(record.sandbox);
    generationPromise = null;
  }

  async function generate(spec, anchorCfi, serial) {
    const record = { serial, controller: new AbortController(), sandbox: null };
    activeGeneration = record;
    const sectionMap = new Map();
    try {
      const sandbox = await createSandbox({
        bookUrl,
        metrics: spec.metrics,
        paginatedTheme: getPaginatedTheme?.() || {},
        signal: record.controller.signal,
        onCreate: value => { record.sandbox = value; }
      });
      if (!generationIsCurrent(record)) return null;

      const sandboxItems = sandbox.book.spine.spineItems || [];
      const order = prioritizedIndices(book, anchorCfi);
      for (const index of order) {
        if (!generationIsCurrent(record)) return null;
        const section = sandboxItems.find(item => Number(item.index) === index);
        if (!section?.href) continue;
        let pages;
        try {
          pages = await mapSection({ rendition: sandbox.rendition, frame: sandbox.frame, section, signal: record.controller.signal });
        } catch (error) {
          if (error?.name === "AbortError" || !generationIsCurrent(record)) return null;
          console.warn(`Canonical page fallback for ${section.href}`, error);
          pages = fallbackSectionPage(section);
        }
        if (!generationIsCurrent(record)) return null;
        sectionMap.set(index, pages);
        partialSections.set(index, pages);
        onUpdate?.({ type: "section", sectionIndex: index, pages, completedSections: sectionMap.size, totalSections: order.length });
        await abortable(sleep(0), record.controller.signal);
      }

      if (!generationIsCurrent(record)) return null;
      const pages = finalizeSections(sectionMap);
      const map = {
        key: `${bookUrl}::${spec.fingerprint}`,
        version: PAGE_MAP_VERSION,
        fingerprint: spec.fingerprint,
        bookUrl,
        createdAt: Date.now(),
        layout: spec.metrics,
        settings: spec.settings,
        totalPages: pages.length,
        pages
      };
      activate(map, "ready");
      cachePut(map).catch(() => {});
      return map;
    } catch (error) {
      if (error?.name !== "AbortError" && generationIsCurrent(record)) {
        onUpdate?.({ type: "error", error });
        console.warn("Canonical page map generation failed", error);
      }
      return null;
    } finally {
      destroySandbox(record.sandbox);
      if (activeGeneration === record) activeGeneration = null;
      if (serial === generationSerial) generationPromise = null;
    }
  }

  async function ensure({ anchorCfi = "", force = false } = {}) {
    const spec = fingerprintData();
    if (!force && activeMap?.fingerprint === spec.fingerprint) return { map: activeMap, cached: true };
    if (!force && generationPromise && activeFingerprint === spec.fingerprint) return { map: activeMap, generating: true };

    cancelGeneration();
    generationSerial += 1;
    const serial = generationSerial;
    activeFingerprint = spec.fingerprint;
    activeMap = null;
    partialSections = new Map();
    pagesBySection = new Map();
    window.__sgCanonicalPageMap = { active: true, fingerprint: activeFingerprint, totalPages: 0 };
    onUpdate?.({ type: "loading", fingerprint: activeFingerprint });

    if (!force) {
      const cached = await cacheGet(`${bookUrl}::${spec.fingerprint}`);
      if (serial !== generationSerial) return { map: activeMap, superseded: true };
      if (cached?.version === PAGE_MAP_VERSION && cached?.fingerprint === spec.fingerprint && Array.isArray(cached.pages) && cached.pages.length) {
        activate(cached, "cached");
        return { map: cached, cached: true };
      }
    }

    generationPromise = generate(spec, anchorCfi, serial);
    return { map: null, generating: true };
  }

  function compareCfi(a, b) {
    if (!a || !b) return null;
    try {
      const compare = book?.locations?.epubcfi?.compare;
      if (typeof compare === "function") return compare.call(book.locations.epubcfi, a, b);
    } catch {}
    return null;
  }

  function sectionIndexForCfi(cfi, fallbackIndex = null) {
    if (cfi) {
      try {
        const section = book?.spine?.get?.(cfi);
        if (section) return Number(section.index);
      } catch {}
    }
    const number = Number(fallbackIndex);
    return Number.isFinite(number) ? number : null;
  }

  function sectionPages(index) {
    const number = Number(index);
    return pagesBySection.get(number) || partialSections.get(number) || [];
  }

  function pageForCfi(cfi, fallbackIndex = null, fallbackLocalPage = null) {
    const index = sectionIndexForCfi(cfi, fallbackIndex);
    const pages = sectionPages(index);
    if (!pages.length) return null;
    if (pages.length === 1) return pages[0];

    let candidate = pages[0];
    if (cfi) {
      for (const page of pages) {
        const order = compareCfi(page.startCfi, cfi);
        if (order == null) break;
        if (order <= 0) candidate = page;
        else break;
      }
      return candidate;
    }

    const local = Math.max(1, Number(fallbackLocalPage) || 1);
    return pages[Math.min(pages.length - 1, local - 1)] || pages[0];
  }

  function pageFraction(page, cfi) {
    if (!page || page.kind === "visual" || !cfi) return 0;
    try {
      const locations = book?.locations;
      if (!locations || typeof locations.locationFromCfi !== "function") return 0;
      const start = Number(locations.locationFromCfi(page.startCfi));
      const end = Number(locations.locationFromCfi(page.endCfi));
      const current = Number(locations.locationFromCfi(cfi));
      if (![start, end, current].every(Number.isFinite) || start < 0 || end <= start) return 0;
      return clamp01((current - start) / (end - start));
    } catch {
      return 0;
    }
  }

  function trackingCfi(rendition) {
    const viewer = getViewer?.();
    const manager = rendition?.manager;
    const rect = viewer?.getBoundingClientRect?.();
    if (!manager || !rect?.height) return "";
    const anchorY = rect.top + rect.height * 0.30;
    const anchorX = rect.left + rect.width * 0.50;
    let views = [];
    try { views = manager.views?.all?.() || []; } catch {}
    let nearest = null;
    let nearestDistance = Infinity;

    for (const view of views) {
      if (!view?.displayed || !view?.contents?.document) continue;
      const frameRect = view.iframe?.getBoundingClientRect?.() || view.position?.();
      if (!frameRect) continue;
      const distance = anchorY < frameRect.top ? frameRect.top - anchorY : anchorY > frameRect.bottom ? anchorY - frameRect.bottom : 0;
      if (distance < nearestDistance) { nearest = { view, frameRect }; nearestDistance = distance; }
      if (distance === 0) break;
    }
    if (!nearest) return "";

    const { view, frameRect } = nearest;
    const documentRef = view.contents.document;
    const x = Math.max(1, Math.min(Math.max(1, frameRect.width - 2), anchorX - frameRect.left));
    const y = Math.max(1, Math.min(Math.max(1, frameRect.height - 2), anchorY - frameRect.top));
    try {
      let range = null;
      const caret = documentRef.caretPositionFromPoint?.(x, y);
      if (caret?.offsetNode) {
        range = documentRef.createRange();
        range.setStart(caret.offsetNode, caret.offset);
        range.collapse(true);
      } else {
        range = documentRef.caretRangeFromPoint?.(x, y) || null;
      }
      if (range && typeof view.contents.cfiFromRange === "function") {
        const cfi = view.contents.cfiFromRange(range);
        if (cfi) return cfi;
      }
      const element = documentRef.elementFromPoint?.(x, y) || documentRef.body;
      if (element && typeof view.contents.cfiFromNode === "function") return view.contents.cfiFromNode(element) || "";
    } catch {}
    return "";
  }

  function positionForLocation(location, { rendition = null, flow = "paginated" } = {}) {
    const reported = location?.start || {};
    let cfi = String(reported.cfi || "");
    if (flow === "scrolled-doc" && rendition) cfi = trackingCfi(rendition) || cfi;
    const localDisplayed = Number(reported.displayed?.page) || 1;
    const page = pageForCfi(cfi, reported.index, localDisplayed);
    const totalPages = Number(activeMap?.totalPages) || 0;
    return {
      cfi,
      sectionIndex: page?.sectionIndex ?? sectionIndexForCfi(cfi, reported.index),
      href: page?.href || reported.href || "",
      localPage: page?.localPage || localDisplayed,
      sectionPages: page?.sectionPages || Number(reported.displayed?.total) || 1,
      page: Number(page?.page) || null,
      totalPages,
      pageFraction: pageFraction(page, cfi),
      fingerprint: activeFingerprint || null,
      kind: page?.kind || "text"
    };
  }

  function pageRecordForPosition(position) {
    if (!position) return null;
    const global = Number(position.page);
    if (activeMap && Number.isFinite(global) && global >= 1 && global <= activeMap.totalPages) return activeMap.pages[global - 1] || null;
    const pages = sectionPages(position.sectionIndex);
    if (!pages.length) return null;
    const local = Math.max(1, Number(position.localPage) || 1);
    return pages[Math.min(pages.length - 1, local - 1)] || pages[0];
  }

  async function targetForPosition(position, { includeFraction = true } = {}) {
    const page = pageRecordForPosition(position);
    if (!page) return position?.cfi || "";
    const fraction = includeFraction ? clamp01(position?.pageFraction) : 0;
    if (fraction > 0 && page.kind !== "visual") {
      try {
        const locations = book?.locations;
        const start = Number(locations?.locationFromCfi?.(page.startCfi));
        const end = Number(locations?.locationFromCfi?.(page.endCfi));
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start) {
          const index = Math.round(start + (end - start) * fraction);
          const cfi = locations.cfiFromLocation?.(index);
          if (typeof cfi === "string" && cfi && cfi !== "-1") return cfi;
        }
      } catch {}
    }
    return page.startCfi || position?.cfi || page.href || "";
  }

  function percentageForPosition(position, fallback = 0) {
    const page = Number(position?.page);
    const total = Number(position?.totalPages || activeMap?.totalPages);
    if (Number.isFinite(page) && Number.isFinite(total) && page >= 1 && total > 0) {
      return clamp01(((page - 1) + clamp01(position?.pageFraction)) / total);
    }
    return clamp01(fallback);
  }

  async function targetForPercentage(percentage) {
    if (!activeMap?.totalPages) return "";
    const p = clamp01(percentage);
    const total = activeMap.totalPages;
    if (p >= 1) {
      const last = activeMap.pages[total - 1];
      return last?.startCfi || last?.href || "";
    }
    const scaled = p * total;
    const pageNumber = Math.min(total, Math.floor(scaled) + 1);
    const fraction = scaled - Math.floor(scaled);
    return targetForPosition({ page: pageNumber, totalPages: total, pageFraction: fraction }, { includeFraction: true });
  }

  function firstPageForHref(href) {
    if (!activeMap?.pages?.length) return null;
    return activeMap.pages.find(page => hrefMatches(page.href, href))?.page || null;
  }

  function hasCompleteMap() {
    return Boolean(activeMap?.totalPages && activeMap.pages?.length === activeMap.totalPages);
  }

  function map() { return activeMap; }
  function fingerprint() { return activeFingerprint; }
  function isGenerating() { return Boolean(generationPromise); }

  return {
    ensure,
    map,
    fingerprint,
    currentFingerprint,
    hasCompleteMap,
    isGenerating,
    positionForLocation,
    targetForPosition,
    targetForPercentage,
    percentageForPosition,
    firstPageForHref
  };
}
