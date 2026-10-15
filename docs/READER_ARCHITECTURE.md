# Reader integration — first refactor milestone

The phased work and remaining ownership changes are tracked in
[READER_REFACTOR_ROADMAP.md](READER_REFACTOR_ROADMAP.md).

## Startup and engine boundary

`reader.html` loads the unchanged vendor bundles and security/data clients.
`reader-bootstrap.js` initializes `reader/engine.js`, authorizes the requested
book, and starts the application. `reader/app.js` opens its publication through
`getReaderEngine().createBook(sourcePath)`.

The engine validates the recovered EPUB.js runtime shape before installing
extensions, installs the version-specific lifecycle compatibility once, and
creates one extension collection per vendor runtime. Reinitialization reuses
that engine and does not register another copy of its listeners.

Book creation calls the vendor factory once and applies explicit extensions in
this order, preserving the original installation order:

1. Layout, external-link and legacy progress compatibility.
2. Footnotes/endnotes.
3. Internal publication links.
4. Standalone visual-page preparation/cache.
5. Paginated standalone-image fitting.
6. Continuous buffering and manager behavior.

Feature modules export extension constructors; none replaces `window.ePub`.
The application has one creation API. Extensions still adapt rendition/manager
methods where required by the recovered vendor runtime. Those patches remain
inside the engine integration; replacing them without reproducing their
browser/layout behavior is outside this first milestone.

The page-map generator intentionally uses a separate, unextended vendor runtime
inside its offscreen iframe. It does not register a second application engine.
`window.__sgVisualPageCache` and the canonical page-map diagnostic remain legacy
bridges; subsequent phases will replace global coupling where appropriate.

## Navigation ownership started

The app registers a navigator for each rendition in `reader/navigation-state`.
Internal links delegate to this owner, which coordinates input reset, chapter
intent, Continuous target resolution and settling. A callback belonging to an
old rendition cannot navigate a replacement one. Standalone extension consumers
without an app owner retain direct vendor display behavior.

The compatibility adapter no longer captures TOC clicks ahead of the app.
The existing TOC controller calls the same app navigation path as internal links.
Progress seeking, resize/relayout and some resume paths still need consolidation
in Phase 2; the navigation refactor is not complete.

The srcdoc link bridge keeps publication scripts disabled. It consumes a
temporary link marker using history replacement instead of assigning
`location.hash`, which can cause a second native scroll back to the source
iframe. It rotates the anchor's marker so repeat activation also works if a
browser refuses history replacement. Fragment text targets use a collapsed
text-node CFI, avoiding a vendor code path that interprets character offsets as
element child indexes.

## Visual cache correction

Standalone artwork referenced by `<img src="...svg">` now uses the same SVG
normalization path as inline/object SVG. Embedded publication resources are
resolved relative to the SVG file. The cache payload version advances to 2 so
an older cached result that skipped these images is not reused. Progress and
bookmark identities/formats are unchanged. Old cache-version eviction belongs
to the planned cache lifecycle/performance work.

## Verification boundaries

- The first milestone passes all 79 Node tests, 30 desktop/mobile Chromium
  browser cases, recovered-asset audit, static build and Functions compilation
  in clean [CI run 38743863205](https://github.com/skypie0102/ShadowGarden/actions/runs/38743863205).
  The tested source is `5d3856ecf7000fa47714a5e38df0445d2e8f74e9` on draft
  [PR #2](https://github.com/skypie0102/ShadowGarden/pull/2); production is unchanged.
- Engine tests check initialization, repeat initialization, the original vendor
  factory, extension installation and unsupported-runtime failure.
- Navigation tests check delegation and ownership cleanup. Continuous target
  tests check fragment/text offsets and non-text anchors.
- Existing focused-image tests retain their reduced setup for controlled scroll
  races. Production-entry tests open the actual `reader.html` and run the full
  security client, bootstrap, integration extensions and UI controllers.
- The original generated EPUB contains prose, standalone SVG artwork, mixed
  image/text chapters, footnotes and cross-chapter fragments. Browser tests
  substitute ticket, publication-byte and catalog responses on the local test
  server only. They do not validate live Turnstile/B2 provider behavior.
- The initial full-stack matrix checks chapter-level mode/reopen continuity;
  mid-passage reflow, broader lifecycle cases and non-Chromium engines remain
  explicit roadmap work.
