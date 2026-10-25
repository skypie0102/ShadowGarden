import {
  createSandbox,
  destroySandbox,
  mapSection,
  releaseSandboxSources,
  abortable
} from "./page-map-measurement.js";
import {measureReaderOperation,recordReaderDiagnostic} from './diagnostics.js';
import {createReaderCache} from './cache-store.js';
import {cleanSectionHref,sectionHrefMatches,linearSpineItems} from './sections.js';
import {normalizeParagraphAlignment} from './paragraph-alignment.js';
const PAGE_MAP_VERSION = 2;

const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function hashText(input) {
  let hash = 0x811c9dc5;
  const text = String(input || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

const pageMapCache=createReaderCache({
  database:'shadow-garden-reader',store:'page-maps',version:PAGE_MAP_VERSION,
  maxEntries:24,maxPerBook:4,maxBytes:8*1024*1024
});
const cacheGet=key=>pageMapCache.get(key);
const cachePut=value=>pageMapCache.put(value);

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
  const items = linearSpineItems(book);
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
  let disposed = false;
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
      alignment: normalizeParagraphAlignment(settings.alignment),
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
    const spine = linearSpineItems(book).map(item => `${item.index}:${cleanSectionHref(item.href)}`).join("|");
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
    return Boolean(!disposed && record && !record.controller.signal.aborted && record.serial === generationSerial);
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
    const finish=measureReaderOperation('pageMap.ready');
    const record = { serial, controller: new AbortController(), sandbox: null };
    activeGeneration = record;
    const sectionMap = new Map();
    try {
      const sandbox = await createSandbox({
        bookUrl,
        metrics: spec.metrics,
        paginatedTheme: getPaginatedTheme?.() || {},
        paragraphAlignment: spec.settings.alignment,
        signal: record.controller.signal,
        onCreate: value => { record.sandbox = value; }
      });
      if (!generationIsCurrent(record)) return null;

      const sandboxItems = new Map((sandbox.book.spine.spineItems || []).map(item=>[Number(item.index),item]));
      const retainedSources=new Set();
      const order = prioritizedIndices(book, anchorCfi);
      for (const index of order) {
        if (!generationIsCurrent(record)) return null;
        const section = sandboxItems.get(index);
        if (!section?.href) continue;
        let pages;
        try {
          pages = await mapSection({ rendition: sandbox.rendition, frame: sandbox.frame, section, signal: record.controller.signal });
        } catch (error) {
          if (error?.name === "AbortError" || !generationIsCurrent(record)) return null;
          recordReaderDiagnostic('pageMap.sectionFallback');
          pages = fallbackSectionPage(section);
        }
        releaseSandboxSources(retainedSources,sandbox.rendition,section);
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
      void cachePut(map).then(saved=>{if(!saved)recordReaderDiagnostic('pageMap.cacheUnavailable')});
      finish({sections:sectionMap.size,pages:pages.length});
      return map;
    } catch (error) {
      if (error?.name !== "AbortError" && generationIsCurrent(record)) {
        onUpdate?.({ type: "error", error });
        finish({},'pageMap.failed');
      }
      return null;
    } finally {
      finish({},'pageMap.cancelled');
      destroySandbox(record.sandbox);
      if (activeGeneration === record) activeGeneration = null;
      if (serial === generationSerial) generationPromise = null;
    }
  }

  async function ensure({ anchorCfi = "", force = false } = {}) {
    if(disposed)return{map:null,cancelled:true};
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
        recordReaderDiagnostic('pageMap.cached',{pages:cached.pages.length});
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

  async function targetForPercentage(percentage, { flow = "paginated" } = {}) {
    if (!activeMap?.totalPages) return "";
    const p = clamp01(percentage);
    const total = activeMap.totalPages;
    if (p >= 1) {
      const last = activeMap.pages[total - 1];
      // The beginning of the final device page is right for Page mode. In
      // Continuous, its remaining text can exceed a viewport: reach the final
      // content anchor so choosing 100% actually exposes the end of the book.
      if (flow === "scrolled-doc" && last?.endCfi) return last.endCfi;
      return last?.startCfi || last?.href || "";
    }
    const scaled = p * total;
    const pageNumber = Math.min(total, Math.floor(scaled) + 1);
    const fraction = scaled - Math.floor(scaled);
    return targetForPosition({ page: pageNumber, totalPages: total, pageFraction: fraction }, { includeFraction: true });
  }

  function firstPageForHref(href) {
    if (!activeMap?.pages?.length) return null;
    return activeMap.pages.find(page => sectionHrefMatches(page.href, href))?.page || null;
  }

  function hasCompleteMap() {
    return Boolean(activeMap?.totalPages && activeMap.pages?.length === activeMap.totalPages);
  }

  function map() { return activeMap; }
  function fingerprint() { return activeFingerprint; }
  function isGenerating() { return Boolean(generationPromise); }

  return {
    dispose(){
      if(disposed)return;disposed=true;generationSerial++;cancelGeneration();
      if(window.__sgCanonicalPageMap?.fingerprint===activeFingerprint)delete window.__sgCanonicalPageMap;
      activeMap=null;partialSections.clear();pagesBySection.clear();
    },
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
