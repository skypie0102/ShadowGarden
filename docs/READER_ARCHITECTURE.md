# Reader integration and navigation ownership

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

## Navigation and position ownership

The app registers a navigator for each rendition in `reader/navigation-state`.
Internal links delegate to this owner, which coordinates input reset, chapter
intent, Continuous target resolution and settling. A callback belonging to an
old rendition cannot navigate a replacement one. Standalone extension consumers
without an app owner retain direct vendor display behavior.

The compatibility adapter no longer captures TOC clicks ahead of the app.
The existing TOC controller and progress seeks call the same app navigation path
as internal links. The obsolete compatibility adapter's custom Continuous seek
listener and its separate target/display implementation have been removed.

Each rendition has a navigation revision and an abortable operation. A new user
request invalidates older work before asynchronous page-map resolution, chapter
loading or deferred settling can complete. Vendor moves run in a shared queue:
EPUB.js cannot cancel an already-started display, so the newest requested target
runs after it and stale queued work is skipped. A failed move releases the queue.
Continuous settling checks ownership before its second display and location
report. Setting relayouts use the same ownership checks.

Progress requests capture their book/rendition/map and retain ownership through
optional generated-location refinement. A newer navigation cancels both the
debounce and refinement. The refinement wait expires after ten seconds if
location generation stalls. Page turns share the vendor queue; intentional rapid
turns accumulate within a batch, while a newer chapter/seek cancels queued turns.
Separate batches advance the revision so an older lifecycle snapshot expires.

Resume captures record the navigation revision. Stale captures cannot overwrite
a newer remembered position. Recovery checks ownership after access renewal,
paint waits and target lookup, and before every move or transient restoration.
Its cancellation releases the navigation barrier even if renewal remains pending.
Continuous lifecycle snapshots remain mutation-free.

Startup and saved-target fallback also use this queue. A stale failed initial
CFI cannot fall back to the first chapter after a newer request. A flow switch
locks synchronously before its asynchronous capture, coalesces mode requests
and finishes an existing chapter/seek destination before capturing it. The
viewer exposes aria-busy while an application navigation settles, so assistive
clients can distinguish partial rendering from completion. Capture then runs
after preceding vendor moves. A later chapter/seek can cancel the
capture before replacement starts. A fresh rendition has its own startup
operation; delayed canonical correction checks that operation before moving it.

Paginated capture checks visible blocks in reading/column order before falling
back to vendor text mapping. A leading illustration has its own semantic CFI;
text-first pages retain the vendor live text position. This avoids scrolling
past a visible illustration when returning to Continuous mode.

Continuous capture samples the live content block without currentLocation(),
whose vendor implementation mutates layout. Semantic CFIs are retained across
mode conversion; page-map targets remain a fallback for records without a CFI.
Settings changes sample before CSS is applied and retain the first anchor across
rapid input. Resize recovery uses the last stable semantic/viewport snapshot,
rejecting relocated updates across an unprocessed viewport geometry change.
Recovery then delegates to the same app navigation path as chapter selection.

The engine exposes Continuous buffer settlement. The navigation adapter waits
for the current neighborhood to finish before the deliberate settling display;
scroll events continue to buffer in the background. The old 750 ms same-target
display suppression is removed: only identical calls still in flight are
coalesced, and older completions cannot clear a newer pending call. No legacy
core listener intercepts range input/pointer/touch events before the app.
Continuous 100% seeks use the final page end anchor, while Page mode still opens
the beginning of the last device page.

Image return remains a synchronous transient viewport operation, distinct from
semantic navigation. It checks rendition, manager generation, navigation revision
and pending navigation before changing scroll/focus; it cannot replay an older
image position during a pending seek. Footnote fallback delegates to the app;
late note resolution checks book/rendition/revision before displaying or moving.
Its native markers use history replacement and rotation, like internal links.

Session/controller resources now have explicit disposal ownership, described
below. The queue cannot cancel a vendor call already in flight; it prevents
subsequent application work and serializes newer destinations while live.
Broader browser engines and representative long-book profiling remain later work.

The srcdoc link bridge keeps publication scripts disabled. It consumes a
temporary link marker using history replacement instead of assigning
`location.hash`, which can cause a second native scroll back to the source
iframe. It rotates the anchor's marker so repeat activation also works if a
browser refuses history replacement. Fragment text targets use a collapsed
text-node CFI, avoiding a vendor code path that interprets character offsets as
element child indexes.

## Lifecycle ownership

`reader/lifecycle.js` defines the common scope. A scope owns removable DOM and
emitter listeners, content hooks, timers, animation frames, observers and child
scopes. `dispose()` is idempotent, aborts pending waits and releases resources
in reverse registration order. Cleanup continues if an individual owner throws.
A canceled wait detaches its abort handler even if the underlying provider or
vendor promise never settles; late results cannot continue application startup.

| Owner | Lifetime and cleanup |
| --- | --- |
| Protected runtime | `createReaderRuntime().open()` replaces its previous startup/application. `dispose()` removes interaction/touch controllers and their observers, cancels authorization/preparation, closes the app and releases the failure-view actions. Retry uses the same runtime. |
| Authorized session | `session.dispose()` removes foreground/pageshow renewal listeners. Pending renewals cannot mutate a disposed session's ticket. Each replacement session installs its own bindings. Read Again checks cancellation before clearing progress. |
| Application | `startReader()` replaces an earlier app and returns an abort signal plus `dispose()`. It owns settings/input/drawer listeners, controller cleanup, startup, relayout timers, the page map and the publication. Teardown invalidates navigation before vendor destruction and clears reader frames, hit surfaces and controller lists. |
| Book/rendition | The engine installs a resource scope once per instance. Book destruction closes remaining renditions; a destroyed rendition detaches from the book's ownership. Navigation delegation, content hooks, marker polling, compatibility timers and manager work are released before vendor teardown. |
| Contents/manager | Contents destruction releases iframe listeners and delayed height/theme repair as soon as a view is trimmed, without waiting for the whole book to close. Continuous managers own neighbor-display deadlines, paint waits and cleanup of debounce/trim work. |
| Controller UI | Bookmark rows and search results have replaceable child scopes. Re-rendering releases old controls immediately. Interaction/touch controllers prune disconnected frames and hit targets from their ownership maps. |

The installed EPUB prototype patches and the page's external-link, footnote and
Read Again dialog shells remain runtime resources. They do not get installed
per book. Active book/rendition/origin references are cleared at their respective
boundaries. Note/image focus returns cannot revive a closed rendition. A Reader
Read Again confirmation receives the application's abort signal, closes on
teardown and cannot reset progress or navigate afterward.

A `pagehide` with `persisted:true` suspends a live reader for BFCache; it does not
dispose the reader or revoke its visual-page object URLs. The existing resume
controller still captures/restores that live session. A non-persisted departure
closes the runtime. Visual-page preparation has its own generation and fetch
cancellation, so an obsolete scan cannot publish into a newer manifest. Object
URLs are revoked on actual release; the stored IndexedDB cache remains reusable.

Startup listens for EPUB.js `openFailed` while awaiting metadata/navigation and
the opened book. A provider/archive failure therefore exits through the owned
failure path rather than leaving the metadata wait hanging. Startup can then be
retried on the same page. An already-started vendor operation may still complete
internally; scopes block its application callbacks and close its instance.

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
  [PR #2](https://github.com/skypie0102/ShadowGarden/pull/2) is merged into `main`
  as `b99e76a4198d032b746676fe9cc286ead3793056`; its main CI run
  [38745346280](https://github.com/skypie0102/ShadowGarden/actions/runs/38745346280)
  also passes. This merge did not deploy to Cloudflare.
- The navigation milestone passes all 113 Node tests (50 reader cases),
  all 48 desktop/mobile Chromium browser cases, asset audit and both builds
  locally and in clean CI runs
  [38782520185](https://github.com/skypie0102/ShadowGarden/actions/runs/38782520185)
  and [38782528728](https://github.com/skypie0102/ShadowGarden/actions/runs/38782528728).
  Verified application source: `a1262eec57ee0b87030a8ce5893245de9183ddd6`.
  [PR #3](https://github.com/skypie0102/ShadowGarden/pull/3) merged this milestone
  into `main` as `f20e47e772865e89713ef8c66562da9452420cb0`. No production
  deployment was performed.
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
- The expanded production-entry matrix checks mid-passage mode changes,
  repeated footnotes, rail/range seeks, rapid conflicting navigation, delayed
  access renewal, font reflow and viewport resize. It excludes offscreen
  page-map frames and reacquires content frames after reflow. Multi-column
  mode checks independently record the visible pre-change anchor for each
  flow: pagination can place a formerly centered paragraph on the following
  page while retaining the tracking-line passage. Passage checks use parent
  clipping and hit testing because Chromium reports
  false zero IntersectionObserver ratios for visibly rendered vendor columns.
  The lifecycle milestone adds repeated create/dispose, interrupted startup,
  startup failure/retry and BFCache cases. Long books and non-Chromium engines
  remain explicit roadmap work.

- The Phase 3 implementation is merged into `main` through
  [PR #4](https://github.com/skypie0102/ShadowGarden/pull/4) as
  `61a487502248882e02bcd9bd8d8903fcdad7bdbb`. All 128 Node tests, the
  recovered-asset audit, both builds and all 62 Chromium desktop/mobile browser
  cases pass locally and in clean CI runs
  [38819451742](https://github.com/skypie0102/ShadowGarden/actions/runs/38819451742)
  and [38819468106](https://github.com/skypie0102/ShadowGarden/actions/runs/38819468106).
  Verified source: `1456fa12259e3d37c56d757d7f445e57cc3c3406`; its tree
  exactly matches the locally verified tree. Seven new cases per
  browser cover repeated open/dispose with resource accounting, pending mode
  replacement, partial startup retry, interrupted preparation, cancellation of
  Read Again, actual EPUB open failure/recovery and BFCache suspension.
  Resource accounting checks session-owned main-window listeners, observers,
  marker intervals and visual-cache object URLs; focused scope/Contents tests
  check trimming cleanup and cancellation. This is not a heap-profiler claim
  about all browser/vendor allocations. Rendering/diagnostics, broader release
  verification and production deployment remain roadmap work.
