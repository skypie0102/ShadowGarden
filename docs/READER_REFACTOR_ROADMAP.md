# Reader refactor roadmap

Started 2026-10-15. Working branch: `refactor/reader-foundation`.
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
| 0 — Production baseline | Exercise the unmodified reader page, startup, authorization client and complete adapter stack with original generated EPUBs. Add image, TOC, mode-change and reopen scenarios. | Desktop/mobile browser runs exercise the production entry point, report page errors, and preserve existing tests. Document the remaining coverage gaps. | In progress |
| 1 — Engine boundary | Replace six implicit global EPUB factory wrappers with explicit installers, a single ordered integration module and one application book-creation API. Keep version-specific manager patches inside that boundary. | Initialization is idempotent, unsupported runtimes fail clearly, no feature script replaces `window.ePub`, and full-stack tests pass. | Implemented; validation in progress |
| 2 — Navigation and position | Establish one navigation coordinator for TOC, links, seeks, mode changes, relayout and temporary viewport restoration. Remove duplicate event interception after callers are migrated. Use navigation generations/cancellation rather than unrelated timers competing to restore position. | Old restoration cannot override a newer user action; all navigation entry points use the coordinator; passage survives mode/viewport/settings changes. | Started: TOC/internal links use the app owner; seek/relayout/resume consolidation remains |
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
| RDR-001 | Six scripts independently overwrite `window.ePub`; behavior is load-order dependent. | Implemented explicit ordered engine extensions; full-suite verification pending. |
| RDR-002 | Legacy adapter captures Continuous TOC clicks before the app handler; it also owns a separate Continuous seek path. | Removed duplicate TOC interception and routed internal links through the app owner. Separate seek migration remains in Phase 2. |
| RDR-003 | Several controllers install listeners/observers without a common disposal API; resume cleanup is returned but not owned by app teardown. | Phase 3: lifecycle tests and disposal scope. This is a structural concern, not a measured memory-leak claim. |
| RDR-004 | Image regression fixture omits the production adapter chain and startup. | Phase 0: add production-entry tests while retaining the targeted fixture. |
| RDR-005 | README still describes the test deployment branch and obsolete recovered-file totals. | Corrected deployment guidance and pointed to the audit for current counts. |
| RDR-006 | Standalone `<img src="...svg">` artwork is skipped while inline/object SVG is supported. | Fixed shared SVG normalization; advanced the cache payload version to invalidate previously skipped results. Production-entry regression covers the case. |
| RDR-007 | Clearing a consumed srcdoc link marker via `location.hash` can scroll the source iframe back into view and undo explicit navigation. | Replaced native hash navigation with history replacement and marker rotation; repeated-link regression verifies the visible target. |
| RDR-008 | Vendor fragment handling can apply a text character offset to an element child list. | Resolve fragment text to a collapsed text-node CFI; retain element CFIs for non-text anchors. Added focused tests. |

## Progress log

- 2026-10-15: Inspected current production source and recorded the baseline,
  invariants, ownership map, phase gates and known coverage limits. Created the
  isolated refactor branch. Production remains at the verified image-focus fix.
- The first full-stack baseline (CI run `38738863755`) passed 24/30 cases and
  exposed the SVG and internal-link issues above. Corrected test assumptions
  about immersive zoom chrome and transient iframe removal as well.
- Implemented the explicit engine boundary and the first navigation ownership
  changes. All 79 local Node tests, the recovered-asset audit, static build and
  Functions compilation pass. Desktop full-stack image return, mode/reopen and
  corrected internal navigation have passed. The complete desktop/mobile matrix
  and clean CI validation are required before the milestone is marked complete.
- Architecture and current limits are documented in
  [READER_ARCHITECTURE.md](READER_ARCHITECTURE.md). The one-time CI browser-runtime
  export used for restricted-environment debugging was removed from the workflow.
