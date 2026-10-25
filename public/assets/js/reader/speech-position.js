import { createReaderScope, readerInstanceScope, readerContentsScope } from "./lifecycle.js";
import { captureContinuousScrollPosition, restoreContinuousScrollPosition } from "./rendition.js";
import { recordReaderDiagnostic } from "./diagnostics.js";

const NAME = "sg-reader-speech";

// Ranges and paint belong to the live rendition, never the leased source DOM.
// Custom Highlight preserves publisher markup, CFIs, selections and pagination.
export function createSpeechPosition() {
  const scope = createReaderScope(), marks = new Map();
  let rendition = null, lifetime = null, selected = null, fallback = "", centered = false;
  function resetCenter() {
    centered = false;
    const container = rendition?.manager?.container;
    if (container?.classList.contains("sg-speech-centered-scroll")) {
      const anchor = captureContinuousScrollPosition(rendition);
      const horizontal = rendition.manager.settings?.axis === "horizontal";
      const offset = horizontal ? container.scrollLeft : container.scrollTop;
      const gutter = parseFloat(container.style.getPropertyValue("--sg-speech-scroll-inset")) || 0;
      container.classList.remove("sg-speech-centered-scroll", "sg-speech-centered-scroll-x");
      container.style.removeProperty("--sg-speech-scroll-inset");
      if (!anchor || !restoreContinuousScrollPosition(rendition, anchor)) {
        if (horizontal) container.scrollLeft = Math.max(0, offset - gutter);
        else container.scrollTop = Math.max(0, offset - gutter);
      }
    }
    if (container?.classList.contains("sg-speech-centered-page")) {
      container.classList.remove("sg-speech-centered-page");
      container.style.removeProperty("--sg-speech-page-inset");
      container.scrollTop = 0;
    }
  }
  function unmark(doc) {
    const owned = marks.get(doc);
    if (owned && doc.defaultView?.CSS?.highlights?.get(NAME) === owned)
      doc.defaultView.CSS.highlights.delete(NAME);
    marks.delete(doc);
  }
  function clearMarks() {
    for (const doc of marks.keys()) unmark(doc);
    if (fallback) {
      try { rendition?.annotations?.remove(fallback, "highlight"); }
      catch { recordReaderDiagnostic("speech.highlightFailed"); }
    }
    fallback = "";
  }
  function locate() {
    if (!selected || !rendition) return null;
    const view = rendition.manager?.views?.all?.().find(
      (view) => view.displayed !== false && view.section?.index === selected.spineIndex,
    );
    if (!view?.contents?.document) return null;
    try {
      const range = view.contents.range(selected.cfi);
      return range ? { view, range, doc: view.contents.document } : null;
    } catch { return null; }
  }
  function paint() {
    if (scope.disposed) return;
    clearMarks();
    const located = locate();
    if (!located) return;
    const { doc, range } = located, win = doc.defaultView;
    if (win?.CSS?.highlights && typeof win.Highlight === "function") {
      const highlight = new win.Highlight(range);
      win.CSS.highlights.set(NAME, highlight);
      marks.set(doc, highlight);
    } else if (rendition.annotations?.highlight) {
      rendition.annotations.highlight(selected.cfi, {}, undefined,
        "sg-reader-speech-highlight", { fill: "var(--leaf)", "fill-opacity": "0.26", "mix-blend-mode": "normal", "pointer-events": "none" });
      fallback = selected.cfi;
    }
  }
  function refresh() {
    try { paint(); }
    catch { recordReaderDiagnostic("speech.highlightFailed"); }
  }
  function clear() { selected = null; clearMarks(); resetCenter(); }
  scope.add(clear);
  return {
    show(passage) {
      if (scope.disposed) return;
      selected = passage;
      refresh();
    },
    clear,
    resetCenter,
    suspendCenter() { centered = false; },
    center() {
      const located = locate(), manager = rendition?.manager;
      if (!located || !manager) return false;
      const fullsize = manager.settings?.fullsize === true;
      const height = fullsize ? window.innerHeight : manager.container?.clientHeight;
      const width = fullsize ? window.innerWidth : manager.container?.clientWidth;
      if (!height || !width) return false;
      if (manager.isPaginated) {
        // Shift only the rendered page viewport, not the publication's columns.
        // Extra scroll space is visual, so page counts and source CFIs stay put.
        manager.container.style.setProperty("--sg-speech-page-inset", `${height / 2}px`);
        manager.container.classList.add("sg-speech-centered-page");
      } else if (!fullsize) {
        // Outer gutters make true centering possible at either book boundary,
        // without padding or rewriting any publication document.
        const horizontal = manager.settings?.axis === "horizontal";
        manager.container.style.setProperty("--sg-speech-scroll-inset", `${(horizontal ? width : height) / 2}px`);
        manager.container.classList.add("sg-speech-centered-scroll");
        manager.container.classList.toggle("sg-speech-centered-scroll-x", horizontal);
      }
      const rect = located.range.getBoundingClientRect();
      const rects = [...located.range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      const frame = located.view.iframe.getBoundingClientRect();
      const viewport = fullsize ? {top:0,left:0,right:width} : manager.container.getBoundingClientRect();
      const visible = manager.isPaginated ? rects.filter(r => frame.left+r.right>viewport.left+1 && frame.left+r.left<viewport.right-1) : rects;
      const first = visible[0] || rects[0] || rect;
      if (!rect.height) return false;
      const top = visible.length ? Math.min(...visible.map(r=>r.top)) : rect.top;
      const bottom = visible.length ? Math.max(...visible.map(r=>r.bottom)) : rect.bottom;
      const targetHeight = bottom-top <= height * 0.7 ? bottom-top : first.height;
      const targetWidth = rect.width <= width * 0.7 ? rect.width : first.width;
      if (manager.isPaginated) {
        const targetTop = bottom-top <= height*0.7 ? top : first.top;
        manager.container.scrollTop += frame.top + targetTop + targetHeight/2 - (viewport.top+height/2);
        manager.scrollTop = manager.container.scrollTop;
        centered = true;
        return true;
      }
      const moved = restoreContinuousScrollPosition(rendition, {
        index: selected.spineIndex, contentCfi: selected.cfi, fullsize,
        top: (height - targetHeight) / 2, left: (width - targetWidth) / 2,
      });
      if (moved) {
        const owner = rendition;
        void Promise.resolve(owner.reportLocation?.()).catch(() => {
          if (!scope.disposed && rendition === owner)
            recordReaderDiagnostic("speech.followFailed");
        });
      }
      centered = moved;
      return moved;
    },
    attachRendition(next) {
      resetCenter();
      clearMarks();
      lifetime?.dispose();
      rendition = next;
      lifetime = scope.child().link(readerInstanceScope(next));
      lifetime.add(() => { clearMarks(); resetCenter(); if (rendition === next) rendition = null; });
      lifetime.hook(next.hooks.content, contents => {
        const contentsLife = lifetime.child().link(readerContentsScope(next, contents));
        const doc = contents.document;
        contentsLife.add(() => unmark(doc));
      });
      lifetime.on(next, "rendered", refresh);
      lifetime.on(next, "resized", () => {
        refresh();
        if (centered) this.center();
      });
    },
    dispose: () => scope.dispose(),
  };
}
