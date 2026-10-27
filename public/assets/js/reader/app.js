/* ShadowGarden — reader application composition and navigation. */
import { recordReaderDiagnostic } from "./diagnostics.js";
import { createReaderScope, readerInstanceScope } from "./lifecycle.js";
import { createReaderStorage } from "./storage.js";
import { createThemeController } from "./theme.js";
import { createTocController } from "./toc.js";
import { createPageMapController } from "./page-map.js";
import { createSettingsController } from "./settings.js";
import { createProgressController } from "./progress-controller.js";
import { createBookmarksController } from "./bookmarks-controller.js";
import { createBookSearchController } from "./book-search.js";
import { createPageNavigationInput } from "./page-navigation-input.js";
import { createImageFocusController } from "./image-focus.js";
import { createCompletionController } from "./completion.js";
import { createSpeechController } from "./speech-controller.js";
import { createPaginatedController } from "./paginated.js";
import { createContinuousController } from "./continuous.js";
import { createReaderResumeController } from "./resume-controller.js";
import {
  createRendition,
  captureContinuousScrollPosition,
  captureRenditionPosition,
  configureSpread,
  destroyRendition,
  pageMapLayoutMetrics,
  displaySettledRenditionTarget
} from "./rendition.js";
import { preferences, urls } from "../domain/index.js";
import { getReaderEngine } from "./engine.js";
import {
  beginRenditionNavigation,
  cancelRenditionNavigation,
  holdRenditionNavigation,
  registerRenditionNavigator,
  disposeRenditionNavigation,
  renditionNavigationRevision,
  runRenditionMove
} from "./navigation-state.js";
const $ = (selector) => document.querySelector(selector);
function readerElements() {
  return {
    readerApp: $("#readerApp"),
    loading: $("#readerLoading"),
    viewerShell: $("#viewerShell"),
    viewer: $("#viewer"),
    imageFocus: $("#imageFocus"),
    imageFocusViewport: $("#imageFocusViewport"),
    imageFocusLayer: $("#imageFocusLayer"),
    imageFocusImage: $("#imageFocusImage"),
    imageFocusClose: $("#imageFocusClose"),
    bookTitle: $("#bookTitle"),
    chapterTitle: $("#chapterTitle"),
    tocToggle: $("#tocToggle"),
    tocDrawer: $("#tocDrawer"),
    tocPanel: $("#tocPanel"),
    bookmarksPanel: $("#bookmarksPanel"),
    settingsToggle: $("#settingsToggle"),
    settingsDrawer: $("#settingsDrawer"),
    ...Object.fromEntries(['speechToggle','speechDrawer','speechAudio','speechVoice','speechSpeed','speechFollow','speechPlay','speechStop','speechHere','speechNext','speechPrevious','speechStatus','speechPassage','speechMini','speechMiniFollow','speechMiniPlay','speechMiniPrevious','speechMiniNext','speechMiniStop','speechMiniSettings','speechMiniLabel','speechVoicesRetry','speechVoiceHint'].map(id=>[id,$(`#${id}`)])),
    backdrop: $("#drawerBackdrop"),
    bookmarkButton: $("#bookmarkButton"),
    backLink: $("#backLink"),
    returnButton: $("#returnButton"),
    fullscreenButton: $("#fullscreenButton"),
    progressRange: $("#progressRange"),
    progressText: $("#progressText"),
    currentChapterText: $("#readerCurrentChapter"),
    volumeProgressText: $("#readerVolumeProgress"),
    navigationHelpToggle: $("#readerNavigationHelpToggle"),
    navigationHelp: $("#readerNavigationHelp"),
    prevPage: $("#prevPage"),
    nextPage: $("#nextPage"),
    prevBottom: $("#prevBottom"),
    nextBottom: $("#nextBottom"),
    themeSelect: $("#themeSelect"),
    fontSelect: $("#fontSelect"),
    alignmentSelect: $("#alignmentSelect"),
    fontSizeRange: $("#fontSizeRange"),
    fontSizeValue: $("#fontSizeValue"),
    lineHeightRange: $("#lineHeightRange"),
    lineHeightValue: $("#lineHeightValue"),
    widthRange: $("#widthRange"),
    widthValue: $("#widthValue"),
    textWidthSetting: $("#textWidthSetting"),
    flowSelect: $("#flowSelect"),
    swipeTurnsToggle: $("#swipeTurnsToggle"),
    resetReader: $("#resetReader"),
    resetReaderDescription: $("#resetReaderDescription"),
    readerFlowHint: $("#readerFlowHint"),
    toast: $("#toast"),
    volumeEndPage: $("#volumeEndPage"),
    volumeCompleteTitle: $("#volumeCompleteTitle"),
    volumeCompleteDetail: $("#volumeCompleteDetail"),
    nextVolumeLink: $("#nextVolumeLink"),
    completeReturnLink: $("#completeReturnLink")
  };
}
let activeReader = null;
function getActiveReader() {
  return activeReader;
}
async function startReader(session, { signal } = {}) {
  if (!session) return;
  signal?.throwIfAborted();
  activeReader?.dispose();
  const scope = createReaderScope();
  const handle = { session, signal: scope.signal, dispose() {
    scope.dispose();
    if (activeReader === handle) activeReader = null;
  } };
  activeReader = handle;
  scope.add(() => session.dispose?.());
  if (signal?.aborted) handle.dispose();
  else scope.listen(signal, "abort", () => handle.dispose(), { once: true });
  try {
    const reader = await initializeReader(session, scope);
    Object.assign(handle, reader);
    return handle;
  } catch (error) {
    handle.dispose();
    throw error;
  }
}
async function initializeReader(session, scope) {
  const elements = readerElements();
  const storage = createReaderStorage({ sourceIdentity: session.sourcePath, publicIdentity: session.publicBookId });
  const state = {
    book: null,
    rendition: null,
    navigation: null,
    pageMap: null,
    pendingNavigation: null,
    currentChapter: "",
    currentSpineIndex: null,
    continuousNavigation: null,
    renditionSerial: 0,
    switchingFlow: false,
    queuedFlow: null,
    renderedFlow: null,
    toastTimer: 0,
    resizeTimer: 0,
    relayoutTimer: 0,
    relayoutIntent: null,
    pageMapRefreshTimer: 0
  };
  let settingsController, progressController, bookmarksController, pageInputController,
    imageFocusController, paginatedController, continuousController, resumeController, completionController, speechController;
  scope.add(() => {
    state.renditionSerial++;
    disposeRenditionNavigation(state.rendition);
    state.rendition = null;
    state.book = null;
    state.pageMap = null;
    state.pendingNavigation = null;
    state.continuousNavigation = null;
    state.relayoutIntent = null;
    state.queuedFlow = null;
    elements.viewer?.replaceChildren();
    elements.viewer?.removeAttribute("aria-busy");
    elements.toast?.classList.add("hidden");
    document.querySelectorAll(".reader-drawer").forEach((item) => item.classList.remove("open"));
    elements.backdrop?.classList.add("hidden");
  });
  const own = (controller) => {
    scope.add(() => controller?.dispose?.());
    return controller;
  };
  const themeController = createThemeController({
    getSettings: () => settingsController?.get?.() || {},
    isAdult: session.adult
  });
  own(themeController);
  function toast(message) {
    if (scope.disposed || !elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");
    scope.clearTimeout(state.toastTimer);
    state.toastTimer = scope.timeout(() => elements.toast.classList.add("hidden"), 1800);
  }
  let tocController = null;
  function openDrawer(drawer) {
    if (scope.disposed) return;
    if (drawer !== elements.tocDrawer) tocController?.cancelSearch?.();
    document.querySelectorAll(".reader-drawer").forEach((item) => item.classList.toggle("open", item === drawer));
    elements.backdrop?.classList.remove("hidden");
  }
  function closeDrawers() {
    if (scope.disposed) return;
    tocController?.cancelSearch?.();
    document.querySelectorAll(".reader-drawer").forEach((item) => item.classList.remove("open"));
    elements.backdrop?.classList.add("hidden");
  }
  function resetReaderInput() {
    pageInputController?.reset();
    imageFocusController?.closeImageFocus({ restoreFocus: false });
  }
  function targetSpineIndex(target) {
    const text = String(target || "");
    if (!text || text.startsWith("epubcfi(")) return null;
    for (const value of [text, text.split("#")[0]]) {
      try {
        const index = Number(state.book?.spine?.get?.(value)?.index);
        if (Number.isFinite(index)) return index;
      } catch {
      }
    }
    return null;
  }
  function locationSpineIndex(location) {
    for (const value of [location?.start?.index, location?.end?.index]) {
      const index = Number(value);
      if (Number.isFinite(index) && index >= 0) return index;
    }
    return targetSpineIndex(location?.start?.href || location?.end?.href || "");
  }
  function relocationIsBeforeExplicitTarget(location, intent) {
    const index = locationSpineIndex(location);
    if (!Number.isFinite(index) || !Number.isFinite(intent?.targetIndex) || !Number.isFinite(intent?.fromIndex)) return false;
    if (intent.targetIndex > intent.fromIndex) return index < intent.targetIndex;
    if (intent.targetIndex < intent.fromIndex) return index > intent.targetIndex;
    return false;
  }
  function navigate(target, { operation, speech = false, speechChapterChange = false, signal, followSpeech } = {}) {
    if (scope.disposed || signal?.aborted) return Promise.resolve(false);
    const rendition = state.rendition;
    if (!target || !rendition) return Promise.resolve(false);
    if (!speech && !['resume','relayout'].includes(operation?.kind)) speechController?.stop();
    operation = operation || beginRenditionNavigation(rendition);
    if (!operation.isCurrent()) return Promise.resolve(false);
    const cancel = () => operation.cancel();
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    const pending = { rendition, target, operation, promise: null };
    state.pendingNavigation = pending;
    elements.viewer?.setAttribute("aria-busy", "true");
    pending.promise = (async () => {
      // Keep navigation ownership while following a loaded passage directly.
      // Displaying it first would snap to its top before the centered movement.
      const current = () => !scope.disposed && rendition === state.rendition && operation.isCurrent();
      if (speech && !speechChapterChange &&
        await followSpeech?.(operation.signal)) return current();
      if (!current() || !await displayTarget(rendition, target, operation)) return false;
      if (speech && followSpeech) return await followSpeech(operation.signal) && current();
      return current();
    })().finally(() => {
      signal?.removeEventListener("abort", cancel);
      if (state.pendingNavigation !== pending) return;
      state.pendingNavigation = null;
      elements.viewer?.removeAttribute("aria-busy");
    });
    holdRenditionNavigation(rendition, pending.promise, { signal: operation.signal });
    return pending.promise;
  }
  async function displayTarget(rendition, target, operation) {
    const current = () => !scope.disposed && rendition === state.rendition && operation.isCurrent();
    if (!current()) return false;
    resetReaderInput();
    if (state.renderedFlow === "scrolled-doc") {
      const requested = { start: { href: String(target) } };
      const chapter = tocController?.chapterForLocation?.(requested) || "";
      const targetIndex = targetSpineIndex(target);
      const intent = chapter && Number.isFinite(targetIndex) ? {
        rendition,
        operation,
        requested,
        chapter,
        targetIndex,
        fromIndex: state.currentSpineIndex
      } : null;
      state.continuousNavigation = intent;
      try {
        await continuousController.display(target, { operation });
        // Explicit href navigation owns chapter chrome while the Continuous buffer
        // settles. Ignore old-side relocations until the requested section is reached.
        if (current() && intent && state.continuousNavigation === intent) {
          state.currentChapter = chapter;
          if (elements.chapterTitle) elements.chapterTitle.textContent = chapter;
          tocController?.setActiveForLocation?.(requested);
          state.continuousNavigation = null;
        }
      } catch (error) {
        if (state.continuousNavigation === intent) state.continuousNavigation = null;
        throw error;
      }
    } else {
      state.continuousNavigation = null;
      await displaySettledRenditionTarget(rendition, target, { operation });
    }
    return current();
  }
  const bookSearchController = createBookSearchController({ getBook: () => state.book });
  own(bookSearchController);
  speechController = own(createSpeechController({elements,getBook:()=>state.book,getCfi:()=>progressController?.currentCfi?.()||'',getSpineIndex:()=>state.currentSpineIndex,navigate,openDrawer,closeDrawers}));
  tocController = createTocController({
    panel: elements.tocPanel,
    navigate,
    closeDrawers,
    getBook: () => state.book,
    bookSearch: bookSearchController
  });
  own(tocController);
  function mapMetrics() {
    return pageMapLayoutMetrics(elements.viewerShell);
  }
  function mapLayoutChangedSignificantly() {
    const mapped = state.pageMap?.map?.()?.layout;
    if (!mapped) return true;
    const current = mapMetrics();
    return Math.abs(Number(mapped.width) - current.width) > 24 || Math.abs(Number(mapped.height) - current.height) > 120 || String(mapped.spread) !== String(current.spread);
  }
  function schedulePageMapRefresh(delay = 700) {
    scope.clearTimeout(state.pageMapRefreshTimer);
    state.pageMapRefreshTimer = scope.timeout(() => {
      if (!state.pageMap || !state.book) return;
      state.pageMap.ensure({ anchorCfi: progressController?.currentCfi?.() || "" }).catch((error) => {
        if (!scope.disposed) recordReaderDiagnostic("pageMap.refreshFailed");
      });
    }, delay);
  }
  function scheduleRelayout() {
    const rendition = state.rendition;
    if (!rendition) return;
    const previous = state.relayoutIntent;
    // Capture before applying font/width CSS. Repeated slider input keeps the
    // first anchor until the coalesced reflow finishes or newer navigation wins.
    const keepCfi = previous?.rendition === rendition && previous.operation.isCurrent()
      ? previous.cfi
      : (state.renderedFlow === "scrolled-doc"
        ? captureContinuousScrollPosition(rendition)?.contentCfi : "") || progressController.currentCfi();
    const operation = beginRenditionNavigation(rendition, { kind: "relayout" });
    const intent = { rendition, operation, cfi: keepCfi };
    state.relayoutIntent = intent;
    scope.clearTimeout(state.relayoutTimer);
    state.relayoutTimer = scope.timeout(async () => {
      try {
        if (rendition !== state.rendition || !operation.isCurrent() || state.switchingFlow) return;
        if (!await runRenditionMove(rendition, operation, () => {
          rendition.resize?.("100%", "100%");
          configureSpread(rendition, settingsController.get().flow);
        })) return;
        if (keepCfi) await navigate(keepCfi, { operation });
      } catch (error) {
        if (operation.isCurrent()) recordReaderDiagnostic("layout.relayoutFailed");
      } finally {
        if (state.relayoutIntent === intent) state.relayoutIntent = null;
      }
    }, 120);
  }
  function applySettings({ relayout = false, rebuildPageMap = false } = {}) {
    if (relayout || rebuildPageMap) resetReaderInput();
    const rendition = state.rendition, settings = settingsController.get();
    if (rendition) {
      if (relayout) scheduleRelayout();
      try {
        rendition.themes.default(themeController.css(settings));
      } catch (error) {
        recordReaderDiagnostic("theme.refreshFailed");
      }
      configureSpread(rendition, settings.flow);
      themeController.refresh(rendition);
    }
    if (rebuildPageMap) schedulePageMapRefresh();
  }
  settingsController = createSettingsController({
    storage,
    elements,
    isAdult: session.adult,
    onApply: applySettings,
    onFlowChange: (flow) => void switchFlow(flow),
    onReset: (previousFlow, desiredFlow) => {
      resetReaderInput();
      schedulePageMapRefresh(100);
      if (previousFlow !== desiredFlow) void switchFlow(desiredFlow);
      else applySettings({ relayout: true, rebuildPageMap: true });
      toast("Reader settings reset");
    }
  });
  own(settingsController);
  progressController = createProgressController({
    storage,
    elements,
    getBook: () => state.book,
    getRendition: () => state.rendition,
    getPageMap: () => state.pageMap,
    getFlow: () => settingsController.get().flow,
    getChapter: () => state.currentChapter,
    toast,
    onPositionChange: () => bookmarksController?.syncButton?.()
  });
  own(progressController);
  bookmarksController = createBookmarksController({
    storage,
    elements,
    getPosition: () => progressController.currentPosition(),
    getCfi: () => progressController.currentCfi(),
    getChapter: () => state.currentChapter,
    getPageMap: () => state.pageMap,
    navigate,
    closeDrawers,
    toast
  });
  own(bookmarksController);
  function turn(direction, { browsing = false } = {}) {
    if (browsing) speechController?.suspendFollowing();
    else speechController?.stop();
    if (scope.disposed) return;
    if (settingsController.get().flow !== "paginated") return;
    paginatedController?.turn(direction);
  }
  pageInputController = createPageNavigationInput({
    getFlow: () => settingsController.get().flow,
    getSwipeTurns: () => settingsController.get().swipeTurns,
    turn: direction => turn(direction, { browsing: true })
  });
  own(pageInputController);
  imageFocusController = createImageFocusController({
    overlay: elements.imageFocus,
    viewport: elements.imageFocusViewport,
    layer: elements.imageFocusLayer,
    image: elements.imageFocusImage,
    closeButton: elements.imageFocusClose,
    hint: document.getElementById("imageFocusHint"),
    guidanceElement: document.getElementById("imageFocusGuidance"),
    guidanceText: document.getElementById("imageFocusGuidanceText"),
    guidanceDismiss: document.getElementById("imageFocusGuidanceDismiss"),
    shouldSuppressOpen: () => pageInputController.shouldSuppressClick(),
    getRendition: () => state.rendition,
    getFlow: () => settingsController.get().flow
  });
  own(imageFocusController);
  paginatedController = createPaginatedController({ getRendition: () => state.rendition, beforeTurn: resetReaderInput });
  own(paginatedController);
  continuousController = createContinuousController({
    getRendition: () => state.rendition,
    getBook: () => state.book,
    beforeNavigate: resetReaderInput,
    settleNavigation: (rendition) => getReaderEngine().settleNavigation(rendition)
  });
  own(continuousController);
  resumeController = createReaderResumeController({
    getRendition: () => state.rendition,
    getFlow: () => settingsController.get().flow,
    getPageMap: () => state.pageMap,
    getPosition: () => progressController.currentPosition(),
    getCfi: () => progressController.currentCfi(),
    capturePosition: ({
      rendition,
      flow,
      pageMap,
      fallback
    }) => captureRenditionPosition({ rendition, flow, pageMap, fallback }),
    renewAccess: () => session.renewAccess?.(),
    resetInput: resetReaderInput,
    resizeRendition: (rendition) => rendition.resize?.("100%", "100%"),
    configureRendition: (rendition, flow) => configureSpread(rendition, flow),
    layoutChanged: mapLayoutChangedSignificantly,
    onLayoutChanged: () => schedulePageMapRefresh(900)
  });
  own(resumeController);
  function onRelocated(rendition, location) {
    if (rendition !== state.rendition) return;
    const pending = state.continuousNavigation;
    const intent = pending?.operation.isCurrent() ? pending : null;
    if (pending && !intent) state.continuousNavigation = null;
    if (intent?.rendition === rendition && relocationIsBeforeExplicitTarget(location, intent)) {
      themeController.refresh(rendition);
      return;
    }
    const spineIndex = locationSpineIndex(location);
    if (Number.isFinite(spineIndex)) state.currentSpineIndex = spineIndex;
    const chapter = tocController.chapterForLocation(location);
    if (intent?.rendition === rendition) {
      const reachedChapter = Boolean(intent.chapter && chapter === intent.chapter);
      // WebKit may report the destination index before its chapter href catches up.
      // The requested chapter completes the intent; navigate() clears the remainder
      // after its explicit display/reportLocation sequence settles.
      if (reachedChapter) state.continuousNavigation = null;
    }
    state.currentChapter = chapter;
    if (elements.chapterTitle) elements.chapterTitle.textContent = state.currentChapter;
    progressController.save(location);
    resumeController?.remember();
    tocController.setActiveForLocation(location);
    bookmarksController.syncButton();
    themeController.refresh(rendition);
  }
  function wireRendition(rendition) {
    const lifetime = readerInstanceScope(rendition);
    lifetime.add(registerRenditionNavigator(rendition, (target, options) => rendition === state.rendition ? navigate(target, options) : Promise.resolve(false)));
    lifetime.hook(rendition.hooks.content, (contents) => themeController.prepare(contents));
    pageInputController.attachRendition(rendition);
    imageFocusController.attachRendition(rendition);
    speechController.attachRendition(rendition);
    lifetime.on(rendition, "relocated", (location) => onRelocated(rendition, location));
    lifetime.on(rendition, "rendered", () => {
      if (rendition !== state.rendition) return;
      themeController.refresh(rendition);
      bookmarksController.syncButton();
    });
    lifetime.on(rendition, "keyup", (event) => {
      if (rendition !== state.rendition || settingsController.get().flow !== "paginated" || imageFocusController.isFocused()) return;
      if (event.key === "ArrowRight") turn(1);
      if (event.key === "ArrowLeft") turn(-1);
    });
  }
  async function openRendition(target) {
    speechController?.stop();
    scope.signal.throwIfAborted();
    const serial = ++state.renditionSerial, flow = settingsController.get().flow;
    let operation;
    const rendition = await scope.wait(createRendition({ book: state.book, target, flow, wire: wireRendition, onCreate: (value, initial) => {
      state.rendition = value;
      state.renderedFlow = flow;
      operation = initial;
    }, themeCss: themeController.css(settingsController.get()) }));
    if (serial === state.renditionSerial && rendition === state.rendition) {
      themeController.refresh(rendition);
      bookmarksController.syncButton();
    }
    return { rendition, operation };
  }
  async function correctCanonicalPosition(opened, position, flow) {
    if (!state.pageMap || !position) return;
    const { rendition, operation } = opened;
    const current = () => !scope.disposed && rendition === state.rendition && operation.isCurrent();
    if (!current()) return;
    if (position.cfi && flow === "paginated") return;
    let target = position.cfi;
    try {
      target = target || await state.pageMap.targetForPosition(position, { includeFraction: flow === "scrolled-doc" });
    } catch (error) {
      if (current()) recordReaderDiagnostic("navigation.canonicalFallback");
      return;
    }
    if (!target || !current()) return;
    if (flow === "scrolled-doc") await scope.paint();
    if (current()) {
      try {
        await navigate(target, { operation });
      } catch (error) {
        if (current()) recordReaderDiagnostic("navigation.canonicalFallback");
      }
    }
  }
  async function switchFlow(nextFlow) {
    if (scope.disposed) return;
    const desired = nextFlow === "scrolled-doc" ? "scrolled-doc" : "paginated";
    if (state.switchingFlow) {
      state.queuedFlow = desired;
      return;
    }
    if (!state.rendition) {
      state.queuedFlow = desired;
      return;
    }
    if (desired === state.renderedFlow && state.rendition) {
      settingsController.setFlow(desired);
      return;
    }
    const previousFlow = state.renderedFlow || settingsController.get().flow, old = state.rendition;
    // Lock before asynchronous capture. Coalesce mode requests while allowing
    // explicit chapter/seek input to cancel this uncommitted capture.
    state.switchingFlow = true;
    const revision = renditionNavigationRevision(old), pending = state.pendingNavigation;
    let operation = null, release = () => {
    };
    const current = () => !scope.disposed && old === state.rendition && (operation ? operation.isCurrent() : revision === renditionNavigationRevision(old));
    let target = progressController.currentCfi() || storage.loadProgress()?.cfi || void 0;
    let replaced = false;
    try {
      // Finish the destination already selected by chapter/seek before capturing
      // geometry. A newer positional request still cancels the uncommitted switch.
      if (pending?.rendition === old && ["explicit", "seek"].includes(pending.operation.kind)) {
        try {
          await pending.promise;
        } catch {
        }
      }
      if (!current()) return;
      operation = beginRenditionNavigation(old, { kind: "flow" });
      holdRenditionNavigation(old, new Promise((resolve) => {
        release = resolve;
      }), { signal: operation.signal });
      let position;
      if (!await runRenditionMove(old, operation, async () => {
        position = await captureRenditionPosition({
          rendition: old,
          flow: previousFlow,
          pageMap: state.pageMap,
          fallback: progressController.currentPosition()
        });
      })) return;
      target = position?.cfi || target;
      if (state.pageMap && position && !position.cfi) {
        try {
          target = await state.pageMap.targetForPosition(position, { includeFraction: desired === "scrolled-doc" }) || target;
        } catch (error) {
          if (current()) recordReaderDiagnostic("navigation.canonicalFallback");
        }
      }
      if (!current()) return;
      progressController.setPosition(position);
      settingsController.setFlow(desired);
      resetReaderInput();
      state.rendition = null;
      cancelRenditionNavigation(old);
      destroyRendition(old, elements.viewer);
      replaced = true;
      const opened = await openRendition(target);
      await correctCanonicalPosition(opened, position, desired);
    } catch (error) {
      if (scope.disposed || !replaced && !current()) return;
      recordReaderDiagnostic("flow.switchFailed");
      toast("Could not switch reading flow");
      if (replaced) {
        cancelRenditionNavigation(state.rendition);
        destroyRendition(state.rendition, elements.viewer);
        settingsController.setFlow(previousFlow);
        try {
          await openRendition(target);
        } catch (recoveryError) {
          if (scope.disposed) return;
          recordReaderDiagnostic("flow.recoveryFailed");
          elements.loading?.classList.remove("hidden");
          if (elements.loading) elements.loading.innerHTML = "<p>Shadow Garden could not restore the reader.</p>";
        }
      }
    } finally {
      release();
      state.switchingFlow = false;
      if (!scope.disposed) {
        settingsController.sync();
        resumeController?.remember();
      }
      const queued = state.queuedFlow;
      state.queuedFlow = null;
      if (!scope.disposed && queued && queued !== state.renderedFlow) void switchFlow(queued);
    }
  }
  function onPageMapUpdate(event) {
    if (scope.disposed) return;
    if (event.type === "loading") {
      if (elements.progressText) elements.progressText.title = "Preparing device page map…";
      tocController.setPageResolver(null);
      return;
    }
    if (event.type === "cached" || event.type === "ready") {
      const map = event.map;
      tocController.setPageResolver((href) => state.pageMap?.firstPageForHref?.(href));
      if (elements.progressText) elements.progressText.title = `${map.totalPages} device pages cached for this layout`;
      progressController.pageMapReady();
      bookmarksController.render();
      return;
    }
    if (event.type === "error" && elements.progressText) elements.progressText.title = "Page map unavailable; using EPUB location tracking";
  }
  function bindDrawers() {
    scope.listen(elements.navigationHelpToggle,"click",()=>{
      const help=elements.navigationHelp;if(!help)return;
      const expanded=help.hidden;help.hidden=!expanded;
      elements.navigationHelpToggle.setAttribute("aria-expanded",String(expanded));
    });
    scope.listen(elements.tocToggle, "click", () => openDrawer(elements.tocDrawer));
    scope.listen(elements.settingsToggle, "click", () => openDrawer(elements.settingsDrawer));
    scope.listen(elements.backdrop, "click", closeDrawers);
    document.querySelectorAll("[data-close]").forEach((button) => scope.listen(button, "click", closeDrawers));
    scope.listen(document.querySelector(".drawer-tabs"), "click", (event) => {
      const button = event.target.closest("button[data-panel]");
      if (!button) return;
      document.querySelectorAll(".drawer-tabs button[data-panel]").forEach((item) => item.classList.toggle("active", item === button));
      elements.tocPanel?.classList.toggle("hidden", button.dataset.panel !== "toc");
      elements.bookmarksPanel?.classList.toggle("hidden", button.dataset.panel !== "bookmarks");
      if (button.dataset.panel === "bookmarks") bookmarksController.render();
    });
  }
  function bindNavigation() {
    scope.listen(elements.prevPage, "click", () => turn(-1));
    scope.listen(elements.prevBottom, "click", () => turn(-1));
    scope.listen(elements.nextPage, "click", () => turn(1));
    scope.listen(elements.nextBottom, "click", () => turn(1));
    scope.listen(elements.progressRange, "input", (event) => {
      speechController.stop();
      resetReaderInput();
      progressController.seekTo(Number(event.target.value) / 1e3);
    });
    scope.listen(elements.progressRange, "change", (event) => {
      resetReaderInput();
      progressController.seekTo(Number(event.target.value) / 1e3, true);
    });
    scope.listen(elements.progressRange, "pointerup", (event) => {
      if (settingsController.get().flow === "paginated") {
        resetReaderInput();
        progressController.seekTo(Number(event.currentTarget.value) / 1e3, true);
      }
    });
    scope.listen(elements.progressRange, "touchend", (event) => {
      if (settingsController.get().flow === "paginated") {
        resetReaderInput();
        progressController.seekTo(Number(event.currentTarget.value) / 1e3, true);
      }
    }, { passive: true });
    scope.listen(elements.fullscreenButton, "click", () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.();
    });
    scope.listen(document, "keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && !imageFocusController.isFocused()) {
        event.preventDefault();
        openDrawer(elements.tocDrawer);
        tocController.openSearch();
        return;
      }
      if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (event.key === "Escape") {
        if (imageFocusController.isFocused()) imageFocusController.closeImageFocus();
        else closeDrawers();
        return;
      }
      if (event.key.toLowerCase() === "t") {
        openDrawer(elements.tocDrawer);
        return;
      }
      if (settingsController.get().flow !== "paginated" || imageFocusController.isFocused()) return;
      if (event.key === "ArrowRight") turn(1);
      if (event.key === "ArrowLeft") turn(-1);
    });
    let viewportWidth = Number(window.innerWidth) || 0;
    const scheduleViewportRecovery = () => {
      const width = Number(window.innerWidth) || 0, widthChanged = Math.abs(width - viewportWidth) > 1;
      viewportWidth = width;
      if (state.renderedFlow === "scrolled-doc" && !widthChanged && !state.resizeTimer) {
        resumeController?.rememberViewport();
        return;
      }
      if (!state.resizeTimer) void resumeController?.capture?.();
      scope.clearTimeout(state.resizeTimer);
      state.resizeTimer = scope.timeout(() => {
        state.resizeTimer = 0;
        if (!state.rendition || state.switchingFlow) return;
        void resumeController?.restore();
      }, 180);
    };
    scope.listen(window, "resize", scheduleViewportRecovery);
    scope.listen(window, "orientationchange", scheduleViewportRecovery);
  }
  bindDrawers();
  bindNavigation();
  const returnHref = session.seriesId ? urls.seriesUrl(session.seriesId,{adult:session.adult}) : urls.libraryUrl(session.adult);
  if (elements.backLink) elements.backLink.href = returnHref;
  if (elements.returnButton) elements.returnButton.href = returnHref;
  try {
    scope.signal.throwIfAborted();
    state.book = getReaderEngine().createBook(session.sourcePath);
    const book = state.book;
    scope.add(() => book.destroy());
    const metadataPromise = state.book.loaded.metadata, navigationPromise = state.book.loaded.navigation.catch((error) => {
      if (!scope.disposed) recordReaderDiagnostic("navigation.tocUnavailable");
      return { toc: [] };
    });
    const opening = scope.child();
    const failed = new Promise((_resolve, reject) => opening.on(book, "openFailed", reject));
    let metadata, navigation;
    try {
      [metadata, navigation] = await scope.wait(Promise.race([Promise.all([metadataPromise, navigationPromise, book.opened]), failed]));
    } finally {
      opening.dispose();
    }
    state.navigation = navigation;
    const title = metadata?.title || "Untitled EPUB";
    if (elements.bookTitle) elements.bookTitle.textContent = title;
    document.title = `${title} — Shadow Garden`;
    tocController.render(navigation?.toc || []);
    const saved = progressController.restoreSaved();
    state.pageMap = createPageMapController({
      book: state.book,
      bookUrl: session.sourcePath,
      getSettings: () => settingsController.get(),
      getLayoutMetrics: mapMetrics,
      getViewer: () => elements.viewer,
      getPaginatedTheme: () => themeController.css({ ...settingsController.get(), flow: "paginated" }),
      onUpdate: onPageMapUpdate
    });
    own(state.pageMap);
    const pageMapResult = await scope.wait(state.pageMap.ensure({ anchorCfi: saved?.cfi || "" }));
    let initialTarget = saved?.cfi || void 0;
    if (!initialTarget && pageMapResult?.map && saved?.pageMapFingerprint === state.pageMap.fingerprint() && Number(saved?.page) > 0) {
      try {
        initialTarget = await state.pageMap.targetForPosition(saved, { includeFraction: settingsController.get().flow === "scrolled-doc" }) || initialTarget;
      } catch {
      }
    }
    progressController.startLocationGeneration();
    // Initialize Continuous at its normal starting view, then navigate to the
    // saved CFI. Starting its buffer directly at that CFI can drift on prepend.
    const restoreContinuousCfi = saved?.cfi && settingsController.get().flow === "scrolled-doc";
    const opened = await openRendition(restoreContinuousCfi ? undefined : initialTarget);
    if (restoreContinuousCfi || !saved?.cfi && pageMapResult?.map && saved?.pageMapFingerprint === state.pageMap.fingerprint() && Number(saved?.page) > 0) {
      try {
        await correctCanonicalPosition(opened, saved, state.renderedFlow);
      } catch (error) {
        if (!scope.disposed) recordReaderDiagnostic("navigation.canonicalFallback");
      }
    }
    const queuedFlow = state.queuedFlow;
    state.queuedFlow = null;
    if (queuedFlow) await switchFlow(queuedFlow);
    scope.signal.throwIfAborted();
    resumeController.remember();
    resumeController.bind();
    completionController = await createCompletionController({ session, elements, toast, signal: scope.signal });
    own(completionController);
    scope.signal.throwIfAborted();
    elements.loading?.classList.add("hidden");
  } catch (error) {
    if (scope.disposed) throw error;
    recordReaderDiagnostic("reader.startupFailed");
    elements.loading?.classList.remove("hidden");
    if (elements.loading) elements.loading.innerHTML = "<p>Shadow Garden could not open this EPUB.</p>";
    throw error;
  }
  return {
    session,
    state,
    settings: settingsController,
    progress: progressController,
    bookmarks: bookmarksController,
    search: bookSearchController,
    pageInput: pageInputController,
    imageFocus: imageFocusController,
    resume: resumeController,
    completion: completionController,
    speech: speechController
  };
}
export {
  getActiveReader,
  startReader
};
