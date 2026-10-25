import { createReaderScope, readerInstanceScope, readerContentsScope } from "./lifecycle.js";
import { captureContinuousScrollPosition, restoreContinuousScrollPosition } from "./rendition.js";
import { recordReaderDiagnostic } from "./diagnostics.js";

const NAME = "sg-reader-speech";

// Ranges and paint belong to the live rendition, never the leased source DOM.
// Custom Highlight preserves publisher markup, CFIs, selections and pagination.
export function createSpeechPosition() {
  const scope = createReaderScope(), marks = new Map();
  let rendition = null, lifetime = null, selected = null, fallback = "", centered = false, motion = null;
  function cancelMotion() { motion?.dispose(); motion = null; }
  function slide(place, smooth, signal) {
    cancelMotion();
    if (scope.disposed || signal?.aborted || !lifetime || lifetime.disposed) return Promise.resolve(false);
    if (!smooth || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      return Promise.resolve(place(1));
    const animation = lifetime.child();
    motion = animation;
    return new Promise(resolve => {
      const finish = moved => {
        resolve(moved);
        if (motion === animation) motion = null;
        animation.dispose();
      };
      animation.add(() => resolve(false));
      animation.listen(signal, "abort", () => finish(false), { once: true });
      const start = performance.now();
      const frame = time => {
        const progress = Math.min(1, Math.max(0, (time - start) / 360));
        // Ease both ends so short passages do not jerk into motion or stop.
        const eased = progress * progress * (3 - 2 * progress);
        try {
          if (!place(eased)) return finish(false);
        } catch {
          recordReaderDiagnostic("speech.followFailed");
          return finish(false);
        }
        if (progress === 1) finish(true);
        else animation.frame(frame);
      };
      animation.frame(frame);
    });
  }
  function resetCenter() {
    cancelMotion();
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
    suspendCenter() { cancelMotion(); centered = false; },
    async center({ smooth = false, signal } = {}) {
      cancelMotion();
      const located = locate(), manager = rendition?.manager;
      if (!located || !manager || scope.disposed || signal?.aborted) return false;
      const fullsize = manager.settings?.fullsize === true;
      const height = fullsize ? window.innerHeight : manager.container?.clientHeight;
      const width = fullsize ? window.innerWidth : manager.container?.clientWidth;
      if (!height || !width) return false;
      if (manager.isPaginated) {
        const frame = located.view.iframe.getBoundingClientRect();
        const viewport = manager.container.getBoundingClientRect();
        if (![...located.range.getClientRects()].some(r => r.width > 0 && r.height > 0 &&
          frame.left + r.right > viewport.left + 1 && frame.left + r.left < viewport.right - 1)) return false;
      }
      if (manager.isPaginated) {
        // Shift only the rendered page viewport, not the publication's columns.
        // Extra scroll space is visual, so page counts and source CFIs stay put.
        const previous = parseFloat(manager.container.style.getPropertyValue("--sg-speech-page-inset")) || 0;
        manager.container.style.setProperty("--sg-speech-page-inset", `${height / 2}px`);
        manager.container.classList.add("sg-speech-centered-page");
        manager.container.scrollTop += height / 2 - previous;
        manager.scrollTop = manager.container.scrollTop;
      } else if (!fullsize) {
        // Outer gutters make true centering possible at either book boundary,
        // without padding or rewriting any publication document.
        const horizontal = manager.settings?.axis === "horizontal";
        const inset = (horizontal ? width : height) / 2;
        const previous = parseFloat(manager.container.style.getPropertyValue("--sg-speech-scroll-inset")) || 0;
        if (inset !== previous) {
          const anchor = captureContinuousScrollPosition(rendition);
          manager.container.style.setProperty("--sg-speech-scroll-inset", `${inset}px`);
          manager.container.classList.add("sg-speech-centered-scroll");
          manager.container.classList.toggle("sg-speech-centered-scroll-x", horizontal);
          // Installing a book-edge gutter must not move the visible text first.
          if (!anchor || !restoreContinuousScrollPosition(rendition, anchor)) {
            if (horizontal) manager.container.scrollLeft += inset - previous;
            else manager.container.scrollTop += inset - previous;
          }
        }
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
        const from = manager.container.scrollTop;
        const distance = frame.top + targetTop + targetHeight/2 - (viewport.top+height/2);
        const moved = await slide(progress => {
          manager.container.scrollTop = from + distance * progress;
          manager.scrollTop = manager.container.scrollTop;
          return true;
        }, smooth && Math.abs(distance) > 1, signal);
        centered = moved;
        return moved;
      }
      const fromTop = frame.top + rect.top - viewport.top;
      const fromLeft = frame.left + rect.left - viewport.left;
      const toTop = (height - targetHeight) / 2, toLeft = (width - targetWidth) / 2;
      const passage = selected;
      const moved = await slide(progress => restoreContinuousScrollPosition(rendition, {
        index: passage.spineIndex, contentCfi: passage.cfi, fullsize,
        top: fromTop + (toTop - fromTop) * progress,
        left: fromLeft + (toLeft - fromLeft) * progress,
      }), smooth && Math.max(Math.abs(toTop - fromTop), Math.abs(toLeft - fromLeft)) > 1, signal);
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
        if (centered || motion) void this.center().catch(() => recordReaderDiagnostic("speech.followFailed"));
      });
    },
    dispose: () => scope.dispose(),
  };
}
