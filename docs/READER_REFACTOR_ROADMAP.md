# Reader refactor roadmap

Started 2026-10-15. Canonical branch: `main`. The navigation/position
milestone is merged through [PR #3](https://github.com/skypie0102/ShadowGarden/pull/3).
Phase 3 lifecycle ownership is verified and merged through
[PR #4](https://github.com/skypie0102/ShadowGarden/pull/4) as
`61a487502248882e02bcd9bd8d8903fcdad7bdbb`. Phase 4 is verified and merged
through [PR #5](https://github.com/skypie0102/ShadowGarden/pull/5) as
`0d33b7220e500e4e2225fd8044486bf226faeff6`. Phase 5 merged through PR #6 as
`235308a7e1716fa744cee8aaf7c1d53c1c9eef3e` and v2.12.0 deployed successfully.
The v2.12.1 mobile image-touch follow-up and final live verification are in progress
on `refactor/reader-release`; production still serves the image-focus milestone.
Baseline source: `93e5aad9107db4a8c4efee521e8fedf36f2fe1a4`; deployed reader
implementation: `9daea7f481ae1f19cc3d0640b83b20d424eab794`.

## Objective and invariants

Make the rendering, navigation and lifecycle behavior understandable and
testable without changing the reader's features or stored reading identities.
Fix demonstrated bugs as they are discovered and record potential problems
with a reproducible check or an explicit follow-up; do not remove compatibility
behavior just because it looks unusual.

- A temporary image/dialog operation preserves the visible passage. Explicit
  navigation wins over an older pending restoration.
- Saved CFI/page-map progress and a transient viewport anchor are distinct
  representations. Neither is a universal replacement for the other.
- Page/Continuous mode changes, resize, font changes and foreground recovery
  retain the same semantic passage within the limits of the new layout.
- Book access stays behind the existing authorization boundary. Test fixtures
  mock network responses only in the disposable browser project; production
  receives no test endpoint, test credential or authorization bypass.
- Keep bookmarks, progress keys, completion state, storage formats, UI controls,
  footnotes, internal links and standalone-image behavior compatible.
- Each change has a clear owner, bounded cancellation and a testable exit
  condition. No unrelated backend, B2, D1 or deployment-settings changes.

## Phases and completion gates

| Phase | Work | Completion gate | Status |
| --- | --- | --- | --- |
| 0 — Production baseline | Exercise the reader page, startup, authorization client and complete adapter stack with original generated EPUBs. Add image, TOC, mode-change and reopen scenarios. | Desktop/mobile browser runs exercise the production entry point, report page errors, and preserve existing tests. Document the remaining coverage gaps. | Complete for the initial Chromium matrix; broader scenarios remain below |
| 1 — Engine boundary | Replace six implicit global EPUB factory wrappers with explicit installers, a single ordered integration module and one application book-creation API. Keep version-specific manager patches inside that boundary. | Initialization is idempotent, unsupported runtimes fail clearly, no feature script replaces `window.ePub`, and full-stack tests pass. | Complete; clean CI passes all 79 Node and 30 browser tests |
| 2 — Navigation and position | Establish one navigation coordinator for TOC, links, seeks, mode changes, relayout and temporary viewport restoration. Remove duplicate event interception after callers are migrated. Use navigation generations/cancellation rather than unrelated timers competing to restore position. | Old restoration cannot override a newer user action; all navigation entry points use the coordinator; passage survives mode/viewport/settings changes. | Complete; 113 Node tests and all 48 desktop/mobile browser cases pass locally and in both clean CI runs. Merged into main through PR #3. |
| 3 — Lifecycle | Give reader/session/controllers a uniform disposal contract. Track event listeners, observers, timers, pending work and object URLs by owner. Handle partial initialization and repeated create/destroy cycles. | Repeated startup/teardown leaves no active callbacks or retained reader DOM owned by disposed controllers; suspended-page restoration remains functional. | Complete; 128 Node tests, all 62 desktop/mobile Chromium cases, audit and both builds pass locally and in both clean CI runs. Merged into main through PR #4. |
| 4 — Rendering and diagnostics | Profile page-map generation, visual preparation and chapter buffering; remove redundant work only with evidence. Expand dense source and give expected fallbacks distinguishable diagnostics. | Measured before/after results for performance changes, bounded memory/work for long books, and useful diagnostics without private book/token logging. | Complete for the documented generated-publication matrix; 146 Node tests, all 68 desktop/mobile Chromium browser cases and nine final profile runs pass. Both clean CI runs pass. Merged into main through PR #5. |
| 5 — Release verification | Run the complete matrix, inspect representative long/image-heavy books, review changes and rollback instructions, then release verified milestones. | All required checks pass, remaining limits are recorded, and deployed code can be identified and rolled back. | In progress |

Phases are milestones, not permission checkpoints. Continue on the authorized
branch and fix failures before marking a milestone complete. A browser suite
passing against a reduced fixture is not evidence that the full reader passed.

## Initial ownership map

| Concern | Current owners | Intended direction |
| --- | --- | --- |
| EPUB creation/patching | `reader-epub-adapter`, `reader-footnotes`, `reader-internal-links`, `reader-visual-cache`, `reader-paginated-visual-fit`, `reader-continuous-core`, `reader/epub-lifecycle` | One ordered engine integration; explicit feature installers |
| Navigation | `reader/app`, `reader/continuous`, `reader/progress-controller`, legacy adapter, internal links | One coordinator; adapters report facts and perform requested engine work |
| Position/geometry | `reader/rendition`, continuous core, resume controller, image focus, page map, legacy adapter | Shared capture/restore operations with explicit semantic/viewport contracts |
| Lifecycle | Controller-local listeners, global scripts, EPUB prototype/instance cleanup | Reader/session disposal scope with controller-owned resources |

## Validation matrix

The original baseline has 70 project-wide Node tests and 20 Chromium browser
cases. Seven Node cases cover image focus. Six browser cases cover it using a
reduced setup; that setup deliberately omits several production adapters.

Add coverage in layers:

1. Production HTML, vendor runtime, security client, full adapter order and real
   application startup, using disposable network fixtures and original EPUBs.
2. Continuous image return via X, desktop double-click, mobile touch and Escape;
   zoom/pan, repeated visits, buffered neighbors and changing chapter geometry.
3. TOC/internal anchors/footnotes and progress seek; mode switching; saved-place
   reload; resize/orientation/font changes; background/foreground recovery.
4. Teardown/reinitialization, interrupted startup, rapid conflicting navigation,
   corrupt EPUB and expired/failed authorization.
5. Representative long books, standalone SVG/raster pages, unusual markup and
   browser engines beyond the initial desktop/mobile Chromium matrix.

Tests must assert user-visible position/state rather than an exact number of
internal retries. Keep focused helper tests where they isolate a race the
browser tests cannot schedule reliably. CI uses an isolated local Pages/D1
project and no production credentials or catalog writes.

## Findings and issue register

| ID | Finding | Treatment / status |
| --- | --- | --- |
| RDR-001 | Six scripts independently overwrite `window.ePub`; behavior is load-order dependent. | Resolved with explicit ordered engine extensions; full-suite verification passes. |
| RDR-002 | Legacy adapter captures Continuous TOC clicks before the app handler; it also owns a separate Continuous seek path. | Removed duplicate TOC interception, routed internal links/seeks through the app owner and removed the obsolete custom seek handler. |
| RDR-003 | Several controllers install listeners/observers without a common disposal API; resume cleanup is returned but not owned by app teardown. | Fixed in PR #4: lifecycle scopes, per-session renewal and explicit disposal own teardown; verification is recorded below. |
| RDR-004 | Image regression fixture omits the production adapter chain and startup. | Resolved for the initial matrix: added ten desktop/mobile production-entry cases while retaining the targeted fixture. Broader lifecycle/reflow coverage remains. |
| RDR-005 | README still describes the test deployment branch and obsolete recovered-file totals. | Corrected deployment guidance and pointed to the audit for current counts. |
| RDR-006 | Standalone `<img src="...svg">` artwork is skipped while inline/object SVG is supported. | Fixed shared SVG normalization; advanced the cache payload version to invalidate previously skipped results. Production-entry regression covers the case. |
| RDR-007 | Clearing a consumed srcdoc link marker via `location.hash` can scroll the source iframe back into view and undo explicit navigation. | Replaced native hash navigation with history replacement and marker rotation; repeated-link regression verifies the visible target. |
| RDR-008 | Vendor fragment handling can apply a text character offset to an element child list. | Resolve fragment text to a collapsed text-node CFI; retain element CFIs for non-text anchors. Added focused tests. |
| RDR-009 | Delayed seek target resolution or location-generation refinement can replay an old seek after newer navigation. | Resolved: captured book/rendition identity, operation cancellation and bounded refinement. Focused race and production-entry checks pass. |
| RDR-010 | Resume renewal/capture/paint waits can outlive newer user navigation and restore the old passage. | Revision-tagged snapshots and guarded recovery moves; paused renewal/capture/display regression tests pass. |
| RDR-011 | A single latest navigation barrier can disappear while an earlier move remains active; raw moves can overlap. | Track all barriers and serialize vendor moves. Cancellation releases obsolete barriers. Tests cover reverse completion order and in-flight displays. |
| RDR-012 | Initial display and flow replacement still own separate capture/restore sequences. | Resolved: lock mode replacement before capture, serialize capture/startup/fallbacks, guard canonical correction and let newer chapter input cancel an uncommitted mode request. Rapid mode and passage checks added. |
| RDR-013 | A 750 ms same-target suppression drops the deliberate settling display after Continuous buffering; an older promise can clear a newer pending display. | Resolved: deduplicate only identical calls still in flight, clean up by promise identity and expose explicit buffer settlement through the engine. |
| RDR-014 | Continuous core still stops native progress input/pointer/touch events before the app sees them. | Removed obsolete global capture listeners and preview writer. Both rail and range use the shared debounced seek path; browser input-only regression added. |
| RDR-015 | Calling vendor currentLocation() before Continuous capture mutates layout, and mode conversion rounds a precise CFI to a device-page boundary. | Mutation-free viewport sampling supplies the semantic CFI; exact CFIs survive flow conversion. Page-map fallback remains for records without a CFI. |
| RDR-016 | Repeated font/width input captures an already-reflowed passage. | Freeze the first live CFI before applying CSS and retain it through coalesced input. A newer navigation invalidates it. |
| RDR-017 | Resize handlers can observe geometry after browser/vendor reflow and remember the wrong passage. | Retain the last stable Continuous semantic/viewport snapshot. Detect the geometry boundary before accepting a relocated update; restore through the app navigator. |
| RDR-018 | Footnote fallback bypasses navigation ownership; delayed notes can outlive a newer chapter selection, and clearing a note marker triggers a native fragment scroll. | Fallback delegates to the app, asynchronous resolution checks rendition/book/revision, and note markers use history replacement plus marker rotation. Repeated footnotes are covered. |
| RDR-019 | Continuous 100% seeking can choose the beginning of the last device page while its remaining content exceeds the visible viewport. | Use the last page end CFI for Continuous; retain the last-page start in Page mode. Full-stack tests check the final content and seeking back to the cover. |
| RDR-020 | An image return can run while a newer seek is still resolving, before the manager generation changes. | Viewport snapshots also record navigation revision and reject pending/newer navigation before restoring scroll or focus. |
| RDR-021 | A mode request can cancel a still-settling chapter destination and capture the old passage; chapter chrome appears before navigation finishes. | Finish the existing chapter/seek before mode capture, while a later positional request still cancels an uncommitted mode change. The viewer exposes aria-busy during navigation, and a same-turn chapter/mode browser case protects the ordering. |
| RDR-022 | Vendor paginated mapping reports the first text even when an illustration precedes it on the visible page, so Page-to-Continuous conversion skips that image. | Sample visible blocks in reading/column order and preserve a leading visual CFI. Keep the vendor live text CFI when text comes first. Positive and negative unit cases and the full production-entry mode tests cover the contract. |
| RDR-023 | Access renewal is permanently bound to the first authorized session by a global installed flag. | Fixed in PR #4: per-session removable bindings, cancellation and repeated-session tests. |
| RDR-024 | Marker polling, drawer/input handlers and delayed compatibility work can survive their reader/rendition/Contents. | Fixed in PR #4: shared scopes and earlier Contents cleanup; browser resource accounting caught and now protects the drawer-tab handler too. |
| RDR-025 | Visual-page URLs are revoked on BFCache pagehide, while obsolete preparation can publish over a replacement. | Fixed in PR #4: actual-release ownership, scan abort/generation checks and BFCache/departure coverage. |
| RDR-026 | EPUB.js openFailed can leave metadata/startup promises pending forever. | Fixed in PR #4: startup listens for the failure, disposes partial state and retries successfully after source recovery. |
| RDR-027 | Startup or completion Read Again can clear progress or navigate after its reader closes. | Fixed in PR #4: cancellation before state writes, abortable confirmation/focus and unit/browser regressions. |
| RDR-028 | Continuous neighbor-display deadlines remain live after work succeeds or its manager closes. | Fixed in PR #4: manager-owned child work scopes cancel their deadline/paint callbacks on completion or teardown. |
| RDR-029 | A controller-wide event scope can retain replaced bookmark/search result DOM until the whole session closes. | Fixed in PR #4: replaceable row/result scopes release old UI immediately. |
| RDR-030 | The isolated page map retains every parsed chapter until generation ends; distant Continuous displays also retain sources after clearing their old views. | Release replaced sandbox sources and give every live view a source lease. The measured long fixture falls from 81 to 2 map sources and from 33–34 to 10 reader sources. |
| RDR-031 | Search, notes, location generation and rendering independently load/unload a shared Section, so one can discard another's source or read unfinished content hooks. | Share pending loads and retain sources through explicit reader/view leases. Overlap, hook completion, retry, disposal and view replacement have focused regressions. |
| RDR-032 | Every standalone page normalizes its image again, even when many pages reference one archive asset. | Reuse normalized assets within one scan while retaining each page's own metadata. The repeated-plate fixture performs one conversion instead of 21; unique artwork remains distinct. |
| RDR-033 | Reader warnings include raw Errors, chapter paths and potentially protected source URLs. | Known diagnostic codes accept numeric fields only, retain 64 events, and emit fixed first-occurrence warnings. Expected fallback/cancellation is quiet. |
| RDR-034 | A failed EPUB open inside the map sandbox can leave book.ready pending. | Race opened/ready against openFailed, remove the sandbox on failure, and keep ordinary reader navigation usable. Desktop/mobile fault cases verify recovery and sanitized output. |
| RDR-035 | Disposable map/visual caches retain old versions, obsolete layouts and publications without an eviction bound. | Atomic cache maintenance removes invalid/old records and applies count, age and payload budgets. Reopen tests seed obsolete and damaged records and check cache reuse after pruning. |
| RDR-036 | Firefox throttles animation frames in the hidden/offscreen map document, delaying long-book maps and leaving progress on its fallback. | Keep the isolated measurement iframe transparent within the viewport, non-interactive and excluded from accessibility. Firefox's 32-chapter bound and seek-to-cover regressions pass. Full release matrix verifies the change across engines. |
| RDR-037 | Vendor render/content continuations can outlive their rendition, and Section destruction can clear hooks while a source load still needs them. | Own the render/unload pipeline at the view/rendition boundary; apply the lifecycle integration in the map sandbox too. Defer final Section destruction until pending work and read leases settle, while refusing new work immediately. Deterministic unit/browser regressions reproduce late work and verify its cancellation. |
| RDR-038 | WebKit's IndexedDB rejects Blob/File image writes, preventing cached illustration reopening. | Visual cache format 3 persists shared ArrayBuffer assets and reconstructs shared Blobs on read. Byte budgets count buffers, old disposable formats are evicted, and stored progress/bookmark schemas stay unchanged. Cross-engine cache/reopen cases cover the portable representation. |
| RDR-039 | The vendor location queue can append parsed CFIs after destroy clears its arrays, even when its Section source lease is retained. | Location generation now owns a cancellable sequential loop, retaining vendor CFI parsing and pacing. Closing during a load or pacing timer stops all later parsing/writes; overlapping generation calls share the active operation. |
| RDR-040 | A correct CFI can land one page early when a new paginated view positions before asynchronous content hooks finish styling its columns. | Track render/content work and complete its paint phase, then reapply the same CFI once for a newly rendered paginated view. Startup and app navigation share that boundary; newer navigation cancels an older correction. Unit and full-reader mode tests cover the ordering. |
| RDR-041 | Vendor scrollTo/scrollBy assign `scrolled = true`, overwriting the Continuous callback with the same name before delayed work runs. | Keep the owned reporter under a separate field and capture it in the debounce. The stabilization boundary calls that reporter while respecting disposal/suppression. Unit and full-reader checks force the vendor boolean and still receive scroll reports. |

## Phase 3 findings

- Session access renewal used a module-level installed flag and anonymous global
  listeners. Replacing a session left the first session subscribed and prevented
  its successor from installing renewal. Renewal now belongs to each session.
- Internal-link and footnote marker polling continued after rendition teardown.
  Polling, content hooks, delayed installs and per-content layout work now stop
  when their rendition/Contents is destroyed.
- A pending startup/mode/resume completion could outlive its owner. The app and
  protected runtime now expose idempotent disposal and abort pending startup;
  controllers stop navigation, search, seeks and recovery before book release.
- Visual-page object URLs were revoked on every pagehide, including BFCache
  suspension. They now live until actual book/runtime disposal. Preparation
  uses generation ownership and aborts obsolete scans instead of publishing
  stale manifests or clearing a newer preparation promise.
- Interaction/touch observers retained removed frames and input surfaces.
  Controller-owned child scopes now release those nodes on removal, including
  image return handlers and delayed frame-height repair.
- EPUB.js emits `openFailed` without rejecting its metadata promises for some
  failures. Startup now listens for that event while waiting, releases partial
  initialization and can retry on the same page.
- Completion's Read Again confirmation/reset could outlive the reader. The
  shared public helpers accept an optional abort signal, and Reader teardown
  closes its confirmation and checks cancellation before progress writes.
  The completion dialog's delayed focus and overlapping close event are owned
  by the current confirmation.

## Progress log

- 2026-10-15: Inspected current production source and recorded the baseline,
  invariants, ownership map, phase gates and known coverage limits. Created the
  isolated refactor branch. Production remains at the verified image-focus fix.
- The first full-stack baseline (CI run `38738863755`) passed 24/30 cases and
  exposed the SVG and internal-link issues above. Corrected test assumptions
  about immersive zoom chrome and transient iframe removal as well.
- Implemented the explicit engine boundary and the first navigation ownership
  changes. All 79 Node tests, the recovered-asset audit, static build and
  Functions compilation pass. Clean CI run
  [38743863205](https://github.com/skypie0102/ShadowGarden/actions/runs/38743863205)
  passes all 30 desktop/mobile Chromium browser cases against source
  `5d3856ecf7000fa47714a5e38df0445d2e8f74e9`. That includes ten new
  production-entry cases for SVG preparation, saved progress, image return,
  mode/reopen continuity, footnotes and repeated cross-chapter links.
- First milestone was retargeted and merged into `main` through
  [PR #2](https://github.com/skypie0102/ShadowGarden/pull/2) as
  `b99e76a4198d032b746676fe9cc286ead3793056`, as requested. Main had no
  divergent commits; the merge also includes the already deployed production
  fixes. Main CI run `38745346280` passes. No Cloudflare deployment occurred.
- Completed Phase 2 on `refactor/reader-navigation`: one app seek path,
  navigation revisions, ordered vendor moves, guarded startup/mode replacement,
  mutation-free Continuous capture, stable pre-resize snapshots and explicit
  engine buffer settlement. Paginated capture preserves leading illustrations
  as well as text. All 113 Node tests (50 reader cases), the asset audit,
  static build, Functions compilation and all 48 desktop/mobile Chromium browser
  cases pass locally and in clean CI runs
  [38782520185](https://github.com/skypie0102/ShadowGarden/actions/runs/38782520185)
  and [38782528728](https://github.com/skypie0102/ShadowGarden/actions/runs/38782528728)
  against source `a1262eec57ee0b87030a8ce5893245de9183ddd6`.
  [PR #3](https://github.com/skypie0102/ShadowGarden/pull/3) merged the milestone
  into `main` as `f20e47e772865e89713ef8c66562da9452420cb0`. No Cloudflare
  deployment occurred. Production-entry helpers exclude offscreen page-map
  frames and reacquire frames across reflow. Passage assertions use clipped
  parent geometry and hit testing because Chromium can report zero
  IntersectionObserver ratios for visibly rendered translated vendor columns.
- CI run `38778009831` passed 45/46 browser cases. Its mobile mode trace
  retained the tracking-line passage, while the test expected a different
  centered paragraph to remain on the same page as a large illustration.
  Corrected the test to independently sample the visible pre-change anchor
  for each flow and verify that anchor after conversion, including the return
  direction. Further CI exposed RDR-021: chapter chrome was available before
  navigation finished, and a mode request could capture an incomplete destination.
  Mode replacement now preserves that pending destination, and browser setup
  waits for the accessible navigation busy state before placing a passage.
  A new same-turn chapter/mode case expands the full matrix to 48 cases.
  The next clean run passed 46/48 and pinpointed RDR-022: Page-to-Continuous
  capture skipped a leading image because vendor mapping starts at text.
  Capture now preserves a leading visual anchor and keeps text-first behavior;
  the Node suite expands to 113 cases (50 reader cases).
- Architecture and current limits are documented in
  [READER_ARCHITECTURE.md](READER_ARCHITECTURE.md). The one-time CI browser-runtime
  export used for restricted-environment debugging was removed from the workflow.

## Phase 3 implementation checklist

Complete and merged into `main` through PR #4:

1. Introduced one disposal scope for listeners, timers, observers and registered
   cleanup callbacks, with idempotent teardown and cancellation of pending work.
2. Gave `startReader()` and its book session an explicit `dispose()` contract;
   teardown invalidates navigation before destroying the rendition/book or clearing DOM.
3. Attached controller and engine-extension cleanup to that owner, starting with
   resume bindings, footnote/link marker polling and compatibility viewport work.
4. Covered partial startup failure and repeated create/dispose cycles in focused
   tests and the actual production reader browser matrix.
5. Recorded retained global vendor patches separately from per-reader resources;
   an installed prototype integration is not evidence of a leaked reader.

- Phase 3 implementation introduces `reader/lifecycle.js` and wires the protected
  runtime, application, controllers and engine instance resources to explicit
  owners. Focused tests cover timer/frame/listener/hook teardown, interrupted
  authorization/renewal, closed-rendition navigation and image-return cancellation.
  The new full production-entry browser cases cover repeated reopen/dispose,
  pending mode changes, partial-startup retry, interrupted preparation and BFCache.
  Local browser verification and both GitHub CI runs pass; the existing workflow
  is unchanged. No production deployment has been performed.

- Local validation now passes 128 Node tests, including cancellation before
  startup/completion progress resets and interrupted resume/authorization.
  The final full browser run passes all 62 desktop/mobile Chromium cases
  (including fourteen new lifecycle cases) in 4.1 minutes. The instrumentation run
  caught one missed drawer-tab listener; it now has the same owner as the other
  app input. Bookmark/search row scopes release replaced UI immediately, and
  Continuous neighbor deadlines are canceled when completed or disposed.
- Published and CI-verified source: `1456fa12259e3d37c56d757d7f445e57cc3c3406`.
  Its tree `1e492ab23a39e44dedb9546bb12ed0253082b611` exactly matches the
  locally verified tree. Clean push and pull-request CI runs
  [38819451742](https://github.com/skypie0102/ShadowGarden/actions/runs/38819451742)
  and [38819468106](https://github.com/skypie0102/ShadowGarden/actions/runs/38819468106)
  both pass. [PR #4](https://github.com/skypie0102/ShadowGarden/pull/4) merged
  into `main` as `61a487502248882e02bcd9bd8d8903fcdad7bdbb`.
  All 128 Node tests, all 62 Chromium desktop/mobile browser cases, asset audit,
  static build and Functions compilation pass locally and in CI. The first local
  full run passed 60/62: its old foreground-recovery fixture emitted a non-persisted pagehide,
  which now correctly disposes the reader. The fixture now explicitly requests
  BFCache suspension, and the lifecycle matrix also asserts non-persisted
  departure cleanup. The clean final run has zero failed cases.
  No Cloudflare deployment occurred. Phase 4 work follows below.

## Phase 4 — rendering and diagnostics

Measured three original generated publications: an 80-chapter long prose book,
40 chapters with repeated standalone artwork, and 40 chapters with unique artwork.
The production entry point, authorization client and complete engine run in the
disposable Pages/D1 harness. Profile instrumentation is test-only.

`reader/section-source.js` now owns parsed-source leases, including vendor view
replacement and location generation. The independent page-map sandbox tracks
only its current/recently replaced sources and indexes sections once, avoiding a
whole-spine search on every chapter. Visual normalization shares archive assets
within the current scan. The cancellation/activation path has been expanded for
readability; existing page metadata and cache identities remain compatible.

`reader/cache-store.js` maintains the existing IndexedDB stores atomically:
page maps keep at most 24 records, four per publication, and 8 MiB of serialized
payload; visual preparation keeps eight publications and 64 MiB of normalized
Blob payload. Both expire records after 30 days and discard obsolete versions
and damaged records. An oversized record is used in the live reader without
being cached. Reading progress and bookmarks use their existing storage.

`reader/diagnostics.js` records page-map, visual-preparation and Continuous-buffer
timings and known fallback/failure codes. Snapshots accept finite nonnegative
numeric measurements only. Event history is capped at 64, counters have a fixed
code set, and warning text never includes an Error, source URL or book content.

Published source `9b59c5ce5e207e539c9c3b939010707ceb6b012b` has the exact
locally verified public tree `8cbfea2bd6de2145a360f8b88b391f656fdb7ea6`.
Clean push and pull-request CI runs
[38828402947](https://github.com/skypie0102/ShadowGarden/actions/runs/38828402947)
and [38828428816](https://github.com/skypie0102/ShadowGarden/actions/runs/38828428816)
both pass all 146 Node tests, all 68 browser cases, the asset audit and both
builds. The local rendering milestone also passed all 68 browser cases; the
final cache changes passed the six targeted desktop/mobile cases and all nine
final profile runs. [PR #5](https://github.com/skypie0102/ShadowGarden/pull/5)
merged the milestone as `0d33b7220e500e4e2225fd8044486bf226faeff6`.

[Measured results](READER_PERFORMANCE.md) and
[raw profile data](reader-performance-results.json) record three baseline and
three candidate runs per fixture. Repeated-plate median startup falls from
1653 ms to 704 ms (57%); its actual conversions fall from 21 to 1. Unique assets
retain 21 conversions. All canonical totals are unchanged, and every candidate
cached reopen performs zero conversions. No production deployment occurred.

Profile timings are local fixture measurements, not a universal speed claim or
a measurement of all browser/vendor heap allocations. The current publication's
archive, map records and normalized artwork still scale with its actual content.

## Phase 5 — release verification

The `2.12.0` candidate adds Firefox and desktop/mobile WebKit to the existing
desktop/mobile Chromium suite. Additional publication cases cover EPUB 2 NCX,
encoded nested paths, ruby/multilingual text, tables, notes, retained bookmarks
and progress identities, and corrupt embedded artwork. Existing long-book,
illustration, cache, cancellation and layout cases run in the same matrix.

Main and NSFW footer checks verify a visible release number and commit without
horizontal overflow. The build identifies the actual Git branch instead of the
old reconstruction fallback; JavaScript and CSS revalidate between deployments.
The recovered `public/data/version.json` remains provenance: the build generates
the actual release metadata in `dist/data/version.json`.

See [release verification](READER_RELEASE.md) for the matrix, rollout and limits.

PR #6 passed all 159 Node tests and 205 browser cases in both clean CI runs,
plus the audit, builds and three final profile runs. v2.12.0 was deployed as
`b13cf583-ad91-43e7-ad1f-55dbc9365802` on 2026-10-16 at 04:25 UTC.

The owner's mobile follow-up exposed nontransparent native tap highlighting on
the EPUB image and full-screen focus surface. v2.12.1 scopes transparent native
feedback to those image interactions, preserving keyboard focus styles. A new
production-entry check compares rendered image colors to the source and checks
touch feedback and return position. Patch validation and live checks are pending.
