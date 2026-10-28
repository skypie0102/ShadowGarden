/* Shadow Garden R3 — Series controller. Rendering and volume actions have single owners. */
(async () => {
  const $ = selector => document.querySelector(selector);
  const root = document.getElementById("seriesRoot");
  if (!root) return;

  const id = new URLSearchParams(location.search).get("id") || "";
  let requestedAdult = window.__SG_SERIES_ROUTE_ADULT__ === true || String(id).startsWith("adult-");
  const bannerRandom = Math.random();
  let domain = null;
  let seriesPreferences = null;
  let series = null;
  let rendering = false;
  let volumeView = "grid";
  let viewScope = "main";

  function syncVolumeView() {
    root.querySelector(".volume-grid")?.classList.toggle("volume-list", volumeView === "list");
    root.querySelectorAll("[data-series-view]").forEach(button => {
      const active = button.dataset.seriesView === volumeView;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function syncLibraryScope(adult) {
    document.body.classList.toggle("adult-library", Boolean(adult));
    document.body.dataset.libraryScope = adult ? "nsfw" : "main";
    window.dispatchEvent(
      new CustomEvent("sg:catalog-context", { detail: { adult: Boolean(adult) } })
    );
    const home = $(".brand-home"),
      back = $("#headerBack"),
      adultNav = $(".adult-nav-link"),
      mainNav = $(".main-nav-link"),
      themeMeta = document.querySelector('meta[name="theme-color"]');
    if (home) {
      home.href = domain.urls.libraryUrl(adult);
      home.setAttribute(
        "aria-label",
        adult ? "Shadow Garden Adult Library home" : "Shadow Garden home"
      );
    }
    if (back) back.href = domain.urls.libraryUrl(adult);
    if (adultNav) {
      adultNav.classList.toggle("active", Boolean(adult));
      adult
        ? adultNav.setAttribute("aria-current", "page")
        : adultNav.removeAttribute("aria-current");
    }
    if (mainNav) {
      mainNav.classList.toggle("active", !adult);
      !adult
        ? mainNav.setAttribute("aria-current", "page")
        : mainNav.removeAttribute("aria-current");
    }
    if (themeMeta) themeMeta.content = adult ? "#10090c" : "#09080d";
  }

  function syncBackToTop() {
    const button = $("#seriesBackToTop");
    if (!button) return;
    const visible = window.scrollY > Math.max(640, window.innerHeight * 0.8);
    button.hidden = !visible;
    button.classList.toggle("visible", visible);
  }

  async function render() {
    if (!series || rendering) return;
    rendering = true;
    try {
      const { seriesMarkup } = await import("/assets/js/series-renderers.js?v=2.29.5");
      root.innerHTML = seriesMarkup(series, { ...domain, bannerRandom, volumeView });
      root.setAttribute("aria-busy", "false");
      syncBackToTop();
    } finally {
      rendering = false;
    }
  }

  function bindControllerEvents() {
    root.addEventListener("click", event => {
      const viewButton = event.target.closest?.("[data-series-view]");
      if (viewButton) {
        const next = viewButton.dataset.seriesView;
        if (!["grid", "list"].includes(next) || next === volumeView) return;
        volumeView = next;
        seriesPreferences.setSeriesView(viewScope, volumeView);
        syncVolumeView();
        return;
      }
      const backTop = event.target.closest?.("#seriesBackToTop");
      if (backTop) {
        window.scrollTo({
          top: 0,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
        return;
      }
      const button = event.target.closest?.("#pinButton");
      if (!button || !series) return;
      const on = !domain.preferences.isPinned(series.id);
      domain.preferences.setPinned(series.id, on);
      button.classList.toggle("pinned", on);
      const label = on ? "Unpin from Garden" : "Pin to Garden";
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", label);
      button.title = label;
    });

    let scrollTick = false;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollTick) return;
        scrollTick = true;
        requestAnimationFrame(() => {
          scrollTick = false;
          syncBackToTop();
        });
      },
      { passive: true }
    );
    window.addEventListener(domain.readingState.EVENT, () => void render());
    window.addEventListener("storage", event => {
      if (event.key === seriesPreferences.seriesViewKey(viewScope)) {
        volumeView = seriesPreferences.seriesView(viewScope);
        syncVolumeView();
        return;
      }
      if (
        domain.readingState.isReadingStorageKey(event.key) ||
        event.key === domain.preferences.PINNED_KEY
      )
        void render();
    });
    window.addEventListener("pageshow", () => void render());
  }

  try {
    [domain, seriesPreferences] = await Promise.all([
      import("/assets/js/domain/index.js"),
      import("/assets/js/domain/preferences.js?v=2.28.5")
    ]);
    const { installVolumeActionController } = await import("/assets/js/public/volume-actions.js");
    installVolumeActionController(document);
    requestedAdult = domain.catalog.adultRoute(id, location.search);
    if (!window.ShadowGardenData) throw new Error("Catalog data source is unavailable");
    const context = await domain.catalog.findSeriesContext(
      window.ShadowGardenData.loadCatalog,
      id,
      { adult: requestedAdult }
    );
    if (!context) throw new Error("Series not found");
    series = context.series;
    requestedAdult = context.adult;
    viewScope = requestedAdult ? "nsfw" : "main";
    volumeView = seriesPreferences.seriesView(viewScope);
    syncLibraryScope(requestedAdult);

    if (requestedAdult && !domain.preferences.adultAcknowledged()) {
      location.replace(
        domain.urls.adultGateReturnUrl(domain.urls.seriesUrl(id, { adult: requestedAdult }))
      );
      return;
    }
    syncLibraryScope(Boolean(series.nsfw));
    document.title = `${series.title} — Shadow Garden`;
    bindControllerEvents();
    await render();
  } catch (error) {
    console.error(error);
    if (!domain) domain = await import("/assets/js/domain/index.js");
    const { notFoundMarkup } = await import("/assets/js/series-renderers.js?v=2.29.5");
    root.innerHTML = notFoundMarkup(domain.urls.libraryUrl(requestedAdult), domain.format);
    root.setAttribute("aria-busy", "false");
  }
})();
