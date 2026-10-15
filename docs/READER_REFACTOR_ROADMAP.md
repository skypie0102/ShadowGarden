# Reader refactor roadmap

Started 2026-10-15. Canonical branch: `main`; current work:
`refactor/reader-navigation`.
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
| 2 — Navigation and position | Establish one navigation coordinator for TOC, links, seeks, mode changes, relayout and temporary viewport restoration. Remove duplicate event interception after callers are migrated. Use navigation generations/cancellation rather than unrelated timers competing to restore position. | Old restoration cannot override a newer user action; all navigation entry points use the coordinator; passage survives mode/viewport/settings changes. | Implementation complete; 113 Node tests and targeted desktop/mobile checks pass. Full 48-case matrix and clean CI pending before merge. |
| 3 — Lifecycle | Give reader/session/controllers a uniform disposal contract. Track event listeners, observers, timers, pending work and object URLs by owner. Handle partial initialization and repeated create/destroy cycles. | Repeated startup/teardown leaves no active callbacks or retained reader DOM owned by disposed controllers; suspended-page restoration remains functional. | Pending |
| 4 — Rendering and diagnostics | Profile page-map generation, visual preparation and chapter buffering; remove redundant work only with evidence. Expand dense source and give expected fallbacks distinguishable diagnostics. | Measured before/after results for performance changes, bounded memory/work for long books, and useful diagnostics without private book/token logging. | Pending |
| 5 — Release verification | Run the complete matrix, inspect representative long/image-heavy books, review changes and rollback instructions, then release verified milestones. | All required checks pass, remaining limits are recorded, and deployed code can be identified and rolled back. | Pending |

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
| RDR-003 | Several controllers install listeners/observers without a common disposal API; resume cleanup is returned but not owned by app teardown. | Phase 3: lifecycle tests and disposal scope. This is a structural concern, not a measured memory-leak claim. |
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
- Continued Phase 2 on `refactor/reader-navigation`: one app seek path,
  navigation revisions, ordered vendor moves, stale resume/capture cancellation,
  bounded seek refinement and ordered page-turn batches. Continued with guarded
  startup/mode replacement, mutation-free Continuous capture, first-anchor
  settings relayout, stable pre-resize snapshots and engine-owned buffer
  settlement. All 111 Node tests, asset audit and both builds pass. The expanded
  46-case desktop/mobile browser matrix passes locally. Clean CI is required
  before merge through [PR #3](https://github.com/skypie0102/ShadowGarden/pull/3).
  Production-entry helpers exclude the offscreen page-map frames and reacquire
  frames across reflow. Passage assertions use clipped parent geometry and
  actual hit testing: Chromium IntersectionObserver incorrectly reports zero
  for visibly rendered text in the vendor's translated multi-column iframe.
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

## Next implementation slice — lifecycle ownership

1. Introduce one disposal scope for listeners, timers, observers and registered
   cleanup callbacks, with idempotent teardown and cancellation of pending work.
2. Give `startReader()` and its book session an explicit `dispose()` contract;
   invalidate navigation before destroying the rendition/book or clearing DOM.
3. Attach controller and engine-extension cleanup to that owner, starting with
   resume bindings, footnote/link marker polling and compatibility viewport work.
4. Cover partial startup failure and repeated create/dispose cycles in focused
   tests, then run the actual production reader through the browser matrix.
5. Record retained global vendor patches separately from per-reader resources;
   an installed prototype integration is not evidence of a leaked reader.
