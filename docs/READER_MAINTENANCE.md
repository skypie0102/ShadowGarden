# Reader maintenance roadmap

Started 2026-10-17 after v2.12.5 phone acceptance. The owner reports no more
jumping or dimming during ordinary Android/Soul use. The
[code review](READER_CODE_REVIEW.md) supplies the baseline findings.

## Working rules

Keep each increment independently reviewable. Preserve extension/hook order,
navigation ownership, cancellation, source leases, persistence keys, cache formats
and accepted scrolling/image behavior. Retain compatibility behavior until a
failing-before reproduction supports its replacement. Run relevant regressions
and the full five-profile matrix before merging reader changes. Record source
validation separately from deployment.

## Increments

| Increment | Scope and completion check | Status |
| --- | --- | --- |
| M1 — Explicit visual service and app readability | Inject the engine service into startup/session and paginated fitting; remove the functional global cache. Expand app wiring/callbacks without changing operation order. Document the vendor surface. Verify preparation, fitting, cancellation/retry, focus, mode changes and scrolling. | Merged through [PR #14](https://github.com/skypie0102/ShadowGarden/pull/14); verified below |
| M2 — Page-map measurement boundary | Extract sandbox measurement/disposal while retaining map generation/cache and lookup contracts. Verify sandbox failure, source bounds, encoded paths, long books and cache reuse. | Merged through [PR #15](https://github.com/skypie0102/ShadowGarden/pull/15); verified below |
| M3 — Shared pure helpers | Consolidate identical href/spine helpers while preserving fragment, encoded-path and iframe-local differences. Verify links, notes, TOC and page/final-section navigation. | Merged through [PR #16](https://github.com/skypie0102/ShadowGarden/pull/16); verified below |
| M4 — Vendor state ownership | Consolidate shared Continuous manager state one concern at a time. Verify partial renders, buffer/trim races, late media, resize and native input. | Complete: M4a through [PR #17](https://github.com/skypie0102/ShadowGarden/pull/17), M4b through [PR #18](https://github.com/skypie0102/ShadowGarden/pull/18), M4c through [PR #19](https://github.com/skypie0102/ShadowGarden/pull/19); verified below |
| M5 — Presentation and timing | Separate cohesive TOC search presentation; name media deadlines and replace polling only with equivalent readiness coverage. Keep expected quiet teardown distinct from actionable diagnostics. | M5a merged through [PR #20](https://github.com/skypie0102/ShadowGarden/pull/20); M5b timing cleanup merged through [PR #21](https://github.com/skypie0102/ShadowGarden/pull/21), M5c diagnostic cleanup in progress |

## M1 implementation

The engine creates one visual-page service per vendor runtime and passes it to
paginated fitting. Bootstrap supplies the same instance to the authorized session
and preparation-error classification. Runtime/book scopes keep their release
ownership. Session preparation remains abortable and cannot leave renewal
listeners active after cancellation.

`window.__sgVisualPageCache` is removed. The visual manifest and canonical page-map
globals remain instrumentation snapshots; production modules do not consume them
as services. Tests use the engine service for instrumentation/fault injection.

The app expands element/state declarations, controller dependencies, callbacks
and startup/mode-recovery statements. Its normalized JavaScript is unchanged.
README, package identity, CI name and active docs describe the maintained
project. Build metadata retains original source provenance and drops the
project-wide `reconstructed` label. The EPUB.js render sequence, Continuous
geometry, accepted image CSS, authorization requirements, configuration and
persistence formats are unchanged.

## M1 validation and publication

The recovered candidate is commit
`c93477a7a055a6978c5d753cb6014e9c2e06df03`, with Git tree
`18dc7828905ef28be8e5430c929c94552e623c3e`. The uploaded tree exactly matches
the local candidate. All **167 Node tests**, the asset audit, static build,
binding-aware Functions package, documentation links and normalized application
comparison pass on that source.

The complete [push run 39027795834](https://github.com/skypie0102/ShadowGarden/actions/runs/39027795834)
passes **277 browser cases** across five profiles with eight existing platform
skips:

| Profile | Passed | Skipped |
| --- | ---: | ---: |
| Desktop Chromium | 57 | 0 |
| Mobile Chromium | 57 | 0 |
| Firefox | 55 | 2 |
| Desktop WebKit | 55 | 2 |
| Mobile WebKit | 53 | 4 |

The parallel [PR run 39027804840](https://github.com/skypie0102/ShadowGarden/actions/runs/39027804840)
initially failed the mobile-WebKit scroll-continuation cancellation assertion.
The same source passed that case and the complete mobile-WebKit suite in the
push run. Its trace shows a fixed 80 ms wait before renewal is released; a
short restoration-suppression window exists in the unchanged reader boundary.
That timing overlap is a diagnostic lead, not an established product defect or
confirmed root cause. The single failed job passed on rerun with unchanged source:
53 mobile-WebKit cases, four existing platform skips, including the original
scroll-continuation assertion. The final PR run is successful.
M5 retains follow-up work to give this check explicit setup/event-settlement
conditions if the nondeterminism persists; no production scroll behavior or
assertion has been weakened for this cleanup.

[PR #14](https://github.com/skypie0102/ShadowGarden/pull/14) merged into `main`
as `84f0442b20e1a9a789f02b584115552a46a942f9`. Its tree exactly matches the
CI-verified candidate. A documentation/comment-only follow-up records these
results and retains explanatory navigation-ownership notes in `reader/app.js`;
normalized JavaScript remains identical to the tested source. The provenance
asset audit and local Markdown links also pass for that follow-up.

M1 is complete. M2 follows below.
Production remains the separately recorded v2.12.5 release; this source-maintenance
merge is not another deployment.

## M2 — page-map measurement boundary

`reader/page-map-measurement.js` owns isolated iframe/runtime setup, media/font
settlement, visual-page classification, section layout/CFI sampling, bounded
source release and sandbox disposal. `reader/page-map.js` imports those operations
and retains generation revisions/cancellation ownership, section order, fallback
policy, cache identity/retention, map activation/indexes and position lookup.

The moved function bodies are unchanged. The controller still creates/records
its sandbox before awaiting startup, releases prior section sources at the same
point after successful measurement or a recoverable section fallback, and
destroys it on cancellation and final settlement. The abortable task helper is
shared with the controller's existing cooperative yield; no new scheduler or
service layer is introduced. Vendor URLs, iframe geometry, media deadlines,
page-map version/fingerprint, cache data and progress formats are preserved.

The controller falls from 729 to 486 lines; measurement is a cohesive 257-line
module. These counts describe the split, not a complexity or speed claim.
Exact source-block comparison and existing integration/profile checks validate
that the extraction preserves behavior. Local `npm run check` passes all 167 Node tests, the asset audit and both builds.
The paired profiles below and the complete five-profile browser matrix pass.
Production remains the separately verified v2.12.5 deployment.

### M2 paired publication profiles

The three baseline/candidate profile pairs pass with identical canonical totals,
normalization counts, source/view counters and retained views. Every cached
reopening performs zero conversions. Raw observations and exact source identities
are in [reader-measurement-profiles.json](reader-measurement-profiles.json).

| Generated publication | Pages before / after | Conversions before / after | Map peak sources | Reader peak sources |
| --- | ---: | ---: | ---: | ---: |
| Long prose — 80 chapters | 1761 / 1761 | 1 / 1 | 1 / 1 | 10 / 10 |
| Repeated plates — 40 chapters | 261 / 261 | 1 / 1 | 1 / 1 | 10 / 10 |
| Unique plates — 40 chapters | 261 / 261 | 21 / 21 | 1 / 1 | 10 / 10 |

These are single paired local samples for preservation checks. Timing differences
are recorded without a speed claim; generated publications do not replace genuine
provider/physical-phone acceptance.

### M2 CI and merge

[CI run 39029387678](https://github.com/skypie0102/ShadowGarden/actions/runs/39029387678)
passes the asset audit, all **167 Node tests**, both builds and **277 browser
cases** across five profiles on the first run, with eight existing platform skips.
Desktop/mobile Chromium pass 57 cases each, Firefox and desktop WebKit pass 55
each with two skips, and mobile WebKit passes 53 with four skips. No assertions,
timeouts or compatibility rules were changed for this extraction.

The tested PR head is `ebd802e89c89c1c1215fc1ef246097b9a1980b7f`, tree
`e5f89a5cdb9b1c7ad6b73b4465733e4722ba8d27`.
[PR #15](https://github.com/skypie0102/ShadowGarden/pull/15) merged as
`c5440eaa1bc6ae6a7c8c79187fc566676c5ea0eb` with that exact tree. A documentation-only
follow-up publishes this result and the paired profile observations.

M2 is complete. M3 follows below. No production rollout, catalog edit,
migration or storage/configuration change is part of this maintenance increment.

## M3 — shared section helpers

`reader/sections.js` consolidates five equivalent href-normalization/matching
implementations used by Continuous completion, paginated navigation, the visual
cache, page maps and TOC. It also shares the linear-spine selection previously
repeated in both navigation modes, page maps and the two progress adapters.
Rendition consumers pass their book explicitly.

Section identity still removes literal query/fragment suffixes before decoding
once, tolerates malformed escapes and preserves case. Matching still requires a
nonempty path and accepts equality or directory-boundary suffixes. Spine selection
preserves publication order and section objects, with the existing href-bearing
fallback when every entry is non-linear.

Internal links and footnotes keep their relative-path, decoded-fragment and
iframe-local marker contracts. Legacy progress href matching, TOC's full-spine
navigation and mobile-pagination decisions remain with their existing owners.
No navigation revision, source lease, cache/persistence format, layout or image
behavior changes as part of this extraction.

Focused tests cover encoded nested paths, query/fragment order, single decoding,
malformed escapes, path boundaries, empty identities and both spine-selection
branches. A paginated controller regression verifies completion on the final
encoded linear section before trailing auxiliary entries. Local `npm run check`
passes all **175 Node tests**, the asset audit, static build and binding-aware
Functions package. Local Markdown links resolve.

A direct comparison against pre-M3 `main`
(`0671523c0c1bfe9491c7fae66691eec8baf6fa29`) gives identical normalization and
matching results for 117 inputs across all five old implementations (68,445
matching pairs). All six old spine selections agree on six book shapes, including
empty and entirely non-linear spines. All **12 targeted desktop/mobile Chromium
cases** pass for EPUB 2 encoded nested paths, TOC, notes, internal links, search,
seeking, mode switches and reopening through the production reader entry point.
That local run substitutes technical-publication network responses and serves
static assets; the full CI run below also uses disposable Pages/D1 state.

### M3 CI and merge

[CI run 39032042519](https://github.com/skypie0102/ShadowGarden/actions/runs/39032042519)
passes the audit, all **175 Node tests**, both builds and **277 browser cases**
across five profiles on the first run. Desktop/mobile Chromium pass 57 cases each;
Firefox and desktop WebKit pass 55 each with two skips; mobile WebKit passes 53
with four skips. These are the same eight existing platform skips. No assertions,
timeouts or compatibility rules were changed for this cleanup.

The tested PR head is `dd0a62dc03611f4e4de6f0f4d19a129fa8fd88a4`, tree
`c606a3b36aa31c86c06084b1b9ace226ed4740d5`.
[PR #16](https://github.com/skypie0102/ShadowGarden/pull/16) merged as
`7d4a2986b6018fa43b4c0304f9bb9437383a5951` with that exact tree. A documentation-only
follow-up records the final validation and merge.

M3 is complete. M4 follows below. Production remains the separately recorded
v2.12.5 deployment; no production rollout, catalog edit, migration or
storage/configuration change is part of this source-maintenance increment.

## M4 — Continuous manager state ownership

Keep this work incremental so that each state concern remains reviewable and
independently verified.

| Step | Boundary | Status |
| --- | --- | --- |
| M4a | Generation and destruction shared by core buffering, layout, image return and delayed scroll/media work. | Merged through [PR #17](https://github.com/skypie0102/ShadowGarden/pull/17); verified below |
| M4b | Buffer/trim task ownership and scheduling state. | Merged through [PR #18](https://github.com/skypie0102/ShadowGarden/pull/18); verified below |
| M4c | Input/scroll suppression shared by core and rendition; retain layout anchors with their layout owner. | Merged through [PR #19](https://github.com/skypie0102/ShadowGarden/pull/19); verified below |

### M4a implementation

`reader/continuous-state.js` owns generation and destruction data in a private
WeakMap. Continuous core initializes that data and owns navigation-generation
advancement and destruction marking. Core buffering, layout transactions, image
return, rendition scroll/trim guards and delayed compatibility-media work share
its read accessors. The old `__sgGeneration` and `__sgDestroyed` properties have
no remaining production or test consumers.

Reads do not install a manager or create state. A generation stays undefined
until core initialization; disposal marks it destroyed and advances the counter
at each existing teardown boundary. The state is retained while its manager is
reachable so late callbacks cannot observe a fresh lifetime. Reader scopes still
own cancellation/resource release; the new module owns only these shared values.

All five production consumers match pre-M4 `main`
(`12f7e8f65bd00e08c63bca95c7c2d2cefaa18490`) after reversing the state-access and
transition substitutions and normalizing JavaScript. This confirms unchanged
consumer control flow and operation order. The three new regressions also pass
against both the baseline and candidate: an old buffer cannot show its late view
or clear a newer task, destroyed-manager settlement cannot publish late work,
and a layout transaction cannot compensate after destroying its manager.
Existing image-return/navigation regressions use the same state boundary.

All **24 targeted desktop/mobile Chromium cases** pass for focus/zoom/return,
late chapter expansion, partial-cover return, mode switches/reopening, repeated
disposal, render-hook cancellation, height-only viewport changes, slow prepends
and section/iframe removal. This local run uses static assets and technical
publication/fixture responses; full CI also uses disposable Pages/D1 state.

Buffer promises/generations, trim scheduling, user-input suppression, geometry,
view/source lifetimes, render/hook order, cache/persistence formats and diagnostic
classification retain their existing behavior. Local `npm run check` passes all
**178 Node tests**, the asset audit, static build and binding-aware Functions
package. Local Markdown links resolve.

Buffer promises/generations, repeated-neighborhood requests and the trim timer
remain with core for M4b. The suppression deadline shared by core and rendition
is a later M4c concern. Layout transactions and content anchors already belong
privately to `reader/continuous-layout.js` and retain that owner.

### M4a CI and merge

[CI run 39034528553](https://github.com/skypie0102/ShadowGarden/actions/runs/39034528553)
passes the audit, all **178 Node tests**, both builds and **277 browser cases**
across five profiles on the first run. Desktop/mobile Chromium pass 57 cases each;
Firefox and desktop WebKit pass 55 each with two skips; mobile WebKit passes 53
with four skips. These are the same eight existing platform skips. Browser
assertions, timeouts and compatibility rules were unchanged.

The tested PR head is `345aab49421199ac8f1f5c965cb00fd358efbfd6`, tree
`6a56a4cca069a3abf0c6bf93c5e9d78456df189f`.
[PR #17](https://github.com/skypie0102/ShadowGarden/pull/17) merged as
`bfb6f606a814838edc3aedc794bde0a152833543` with that exact tree. A documentation-only
follow-up records targeted/CI validation and the remaining state boundaries.

M4a is complete; M4 remains in progress. M4b follows below.
Production remains the separately recorded v2.12.5 deployment. This source
maintenance does not change catalog data, migrations, storage or configuration.

### M4b implementation

The private manager record in `reader/continuous-state.js` now groups the active
buffer promise, its generation, repeat-request flag and trim timer. Only core
obtains the mutable buffer group. It remains the same object across navigation
and teardown, so captured tasks retain their ownership comparison against the
current promise. The old `__sgBufferPromise`, `__sgBufferGeneration`,
`__sgBufferAgain` and `__sgTrimTimer` properties have no remaining production or
test consumers.

`pendingContinuousBuffer(manager)` returns the exact current promise without
creating state, queueing work or requesting another pass. Node and browser test
waiters use that accessor; their assertions, explicit delays and paint counts
remain unchanged. Core keeps the existing buffering/trim algorithm, generation resets,
repeat-request coalescing, old-task completion guard, timer clear points, 1400 ms
idle trim deadline, recent-input gate and four-neighbor retention policy.

After reversing only state bindings and normalizing JavaScript, the core matches
pre-M4b `main` (`9410ae6b63ce11b52ae7c613051430b656991a66`). All seven buffer/lifetime
regressions pass before and after the change; the baseline test adapter maps only
the passive promise accessor back to its old field. Four new cases verify
repeat-request coalescing, replacement of a pending trim deadline and pending
trim cancellation at manager and rendition teardown.

Lifetime transitions, input suppression, vendor scroll bookkeeping, layout/view
geometry, source leases, render order and persistence/cache formats retain their
existing owners. Local `npm run check` passes all **182 Node tests**, the asset
audit, static build and binding-aware Functions package. Local Markdown links
resolve. The complete browser matrix also passes below.

All **24 targeted desktop/mobile Chromium cases** pass for focus/zoom/return,
late chapter expansion, partial-cover return, mode switches/reopening, repeated
disposal, render-hook cancellation, height-only viewport changes, slow prepends
and section/iframe removal. This local run serves static assets with technical
publication/fixture responses; full CI also uses disposable Pages/D1 state.

### M4b CI and merge

[CI run 39045832988](https://github.com/skypie0102/ShadowGarden/actions/runs/39045832988)
passes the audit, all **182 Node tests**, both builds and **277 browser cases**
across five profiles on the first run. Desktop/mobile Chromium pass 57 cases each;
Firefox and desktop WebKit pass 55 each with two skips; mobile WebKit passes 53
with four skips. These are the same eight existing platform skips. Browser
assertions, timeouts, explicit delays and paint counts were unchanged; test
instrumentation now reads the pending task through its passive accessor.

The tested PR head is `10fcbdbf5fe68fb61226f2bf129adcde806fc9ee`, tree
`76d49499c487e71eadd1c2a50b3134d95afa020c`.
[PR #18](https://github.com/skypie0102/ShadowGarden/pull/18) merged as
`7196ae7d13c6797369c31e0bf8158c97fd2bbc73` with that exact tree. A documentation-only
follow-up records targeted/CI validation and the remaining state boundary.

M4b is complete; M4c follows below. Production remains the separately recorded v2.12.5 deployment, with
catalog data, migrations, storage and configuration unchanged by this maintenance.

### M4c implementation

The private manager record now groups the restoration-suppression deadline,
recent-user-input timestamp, owned scroll reporter and defensive-wrapper
installation flag. `continuousInputState(manager)` gives core and rendition the
same stable group. The old `__sgSuppressScrollUntil`, `__sgLastUserScrollAt`,
`__sgContinuousScrolled` and `__sgSafeScrollLifecycle` properties have no remaining
production or test consumers.

Core still invalidates navigation before recording user input. Explicit gestures
clear suppression immediately, and subsequent native movement can cancel newer
stale navigation without another gesture. Restoration and the defensive wrapper
keep their existing clocks and comparisons, 320 ms correction window and 30 ms
debounce. The trim scheduler retains its 650 ms recent-input gate and 1400 ms idle
deadline. The owned reporter survives the vendor's boolean `scrolled` flag, while
the wrapper still supports a callable vendor reporter before core installs one.

Vendor scroll coordinates/deltas, timers, flags and patch-installation markers
remain on their existing objects. Gesture coordinates stay in listener closures;
layout transactions and block anchors remain private to their layout owner.
No lifetime transition, buffering algorithm, view/source geometry, render order,
cache/persistence format or compatibility rule changes in this increment.

Five new regressions cover continuation at the exact correction deadline,
explicit-input cancellation followed by native continuation, recent-input trim
deferral, idempotent wrapper installation with vendor-reporter fallback, and the
shared image-return scroll/trim correction window. Browser instrumentation resets
the deadline through its new state group; assertions and explicit waits remain
unchanged.

After reversing only input-state bindings and normalizing JavaScript, both core
and rendition match pre-M4c `main`
(`cdcde090e6bb13b05fe2ef8cd35a60d732bd99c6`). All **31 focused Node cases** pass
against both baseline and candidate. The baseline adapter maps only test access
to the four old fields; it does not alter production source or assertions.
Local `npm run check` passes all **187 Node tests**, the asset audit, static build
and binding-aware Functions package. All 78 local Markdown file links resolve.

All **30 targeted desktop/mobile Chromium cases** pass for focus/zoom/return,
late chapter expansion, partial-cover return, mode switches/reopening, repeated
disposal, render-hook cancellation, height-only viewport changes, slow prepends,
section/iframe removal, native-scroll cancellation, scroll continuation and the
vendor boolean reporter. This local run serves static assets with technical
publication/fixture responses; full CI also uses disposable Pages/D1 state.

### M4c CI and merge

[CI run 39048269555](https://github.com/skypie0102/ShadowGarden/actions/runs/39048269555)
passes the audit, all **187 Node tests**, both builds and **277 browser cases**
across five profiles on the first run. Desktop/mobile Chromium pass 57 cases each;
Firefox and desktop WebKit pass 55 each with two skips; mobile WebKit passes 53
with four skips. These are the same eight existing platform skips. The original
mobile-WebKit scroll-continuation assertion passes. Browser assertions, timeouts,
explicit waits and paint counts were unchanged.

The tested PR head is `4c3efc571e3645aa8f8a0f29ec0adf8e6c03c1b2`, tree
`d93780d4da1b29d5f0c4afc4155decdd771bd9c3`.
[PR #19](https://github.com/skypie0102/ShadowGarden/pull/19) merged as
`6d4692471a85e4727714b9f29dd1a709a1059c3a` with that exact tree. A documentation-only
follow-up records targeted/CI validation and completion of M4.

M4 is complete. Shared lifetime, buffer/trim and input state now have explicit
private groups; layout anchors retain their existing private owner, and required
vendor geometry/bookkeeping stays on vendor objects. M5 is next, starting with
TOC search presentation while preserving query cancellation and stale-result
ownership. Timing/readiness changes remain separately reviewable work.

Production remains the separately recorded v2.12.5 deployment. This maintenance
does not change catalog data, migrations, storage or configuration.

## M5 — presentation and timing

| Step | Boundary | Status |
| --- | --- | --- |
| M5a | Cohesive TOC book-text search presentation, preserving cancellation, scope ownership, status and navigation. | Merged through [PR #20](https://github.com/skypie0102/ShadowGarden/pull/20); verified below |
| M5b | Name/document the adapter's 300/1200/2600/4200 ms media fallback passes and 150 ms reconciliation debounce; evaluate readiness or polling changes only against equivalent coverage. | Timing cleanup merged through [PR #21](https://github.com/skypie0102/ShadowGarden/pull/21); scroll-stress cause remains open |
| M5c | Keep expected cancellation/quiet teardown distinct from actionable diagnostics. | M5c1 merged through [PR #22](https://github.com/skypie0102/ShadowGarden/pull/22); bookmark and app callbacks follow separately |

### M5a implementation

`reader/toc-book-search.js` groups the book-text results section, status messages,
query debounce/serial guards and replaceable result listeners. The TOC supplies
its existing root/UI scopes, chapter-label lookup and application navigation.
`reader/toc.js` retains its public controller methods, chapter tree, label filter,
current/active chapter controls, page numbering, toolbar and location matching.
The bounded text engine and its section-source lease ownership remain unchanged.

The five moved normalization/query/result/section function bodies match pre-M5
`main` (`0f86868557596a8282934ffa76f07be2e92a3839`). Restoring the delegations and
render-reset assignments also makes normalized TOC JavaScript match that baseline.
The same 180 ms debounce, minimum-query fallback, stale-result/progress checks,
result navigation/failure diagnostic and drawer-close liveness check remain.
Contents label folding and book-query whitespace normalization keep their
intentional differences. DOM identity, text-only excerpts, accessible status
messages and chapter-label fallbacks are preserved.

Each query replaces its result-listener scope. Re-rendering disposes the old UI
scope, creates its replacement, then resets query state before replacing DOM.
The reset's private assignments now sit together at that boundary; cancellation
still precedes DOM replacement. Closing a drawer cancels pending work while
retaining current results. Parent disposal invalidates query publication before
disposing its root scope. This extraction adds no new vendor patch or scheduler.

Five browser regressions exercise the public TOC controller with real DOM,
controlled time and a provider that can complete after cancellation. They cover
distinct label/query normalization and the exact debounce, stale progress/results,
minimum/unavailable/empty/capped status, result fallbacks, pending cancellation,
rerendered/retired controls, disposal and awaited/failed result navigation.
Existing production-reader assertions, waits and timeouts remain unchanged.

Local `npm run check` passes all **187 Node tests**, the asset audit, static build
and binding-aware Functions package. All 78 local Markdown file links resolve.
All **10 new desktop/mobile Chromium search cases** pass against both baseline
and candidate, using the identical tests and public controller without adapters.
All **22 targeted desktop/mobile Chromium cases** pass on the candidate, including
the new cases, real publication text search/navigation, encoded EPUB 2 paths,
notes/progress reopening, damaged artwork, mode changes, repeated disposal and
partial-startup recovery. The local runs serve static assets with technical
publication/fixture responses; full CI also uses disposable Pages/D1 state.

### M5a scroll-stress follow-up

The initial [CI run 39049912277](https://github.com/skypie0102/ShadowGarden/actions/runs/39049912277)
fails the existing mobile-Chromium fast-upward-scroll assertion. Its attached
passage trace contains 163 samples and one -56 px reversal (sample 89) as the
captured section changes from 17 to 18. The numeric trace and source identities
are retained in [reader-scroll-stress-m5a.json](reader-scroll-stress-m5a.json).
The failure occurs before the five new
TOC tests run. Scroll/layout production modules and that regression are unchanged
by M5a.

Thirteen additional local mobile-Chromium repetitions pass on the candidate, and
thirteen pass on pre-M5 `main`, with the original wheel inputs, waits and assertions.
These static-fixture runs do not reproduce the CI reversal or establish its
cause. The similar magnitude to the earlier overlapping-chapter observation in
the [scroll audit](READER_SCROLL_AUDIT.md) is a lead, not proof of the same fault.
M5b retains an open reproduction task for section-transition/reframe timing;
an unchanged-source rerun does not establish a scroll fix. The
original 3 px assertion threshold and all production timing rules remain intact.

### M5a CI and merge

The final [CI run 39049912277](https://github.com/skypie0102/ShadowGarden/actions/runs/39049912277)
passes the audit, all **187 Node tests**, both builds and **302 browser cases**
across five profiles. Desktop/mobile Chromium pass 62 cases each; Firefox and
desktop WebKit pass 60 each with two skips; mobile WebKit passes 58 with four
skips. These are the same eight existing platform skips. The five new TOC cases
pass in every profile, adding 25 cases to the previous 277-case matrix.

The single failed mobile-Chromium job described above passes on an unchanged-source
rerun: all 62 cases, including the original fast-upward-scroll assertion. The
other four browser profiles pass on their first attempt. The numeric trace,
13 baseline/candidate local repetitions each and rerun identity remain archived;
the cause is unconfirmed and the follow-up stays open. Existing assertions,
timeouts, explicit waits and tolerances were unchanged.

The tested PR head is `b7fd48451015090f145e487a0aaf3e250b17cd3c`, tree
`1037646a98fdbd20d2ee83ac6dff30c9cd46a277`.
[PR #20](https://github.com/skypie0102/ShadowGarden/pull/20) merged as
`81da5dd6e52766c5b37c84a9bce2ebfcff732019` with that exact tree. A documentation-only
follow-up records final validation, the archived stress evidence and next scope.
Its local Markdown file links and numeric evidence also validate.

M5a is complete; M5 remains in progress. M5b begins with names/documentation for
the adapter's media fallback passes and reconciliation debounce, with the open
scroll-stress reproduction tracked alongside readiness work. Replacing a timer or
poll still requires equivalent regression coverage. M5c's diagnostic review follows.

Production remains the separately recorded v2.12.5 deployment. This maintenance
does not change catalog data, migrations, storage or configuration.

### M5b implementation and readiness assessment

`reader-epub-adapter.js` names its four one-shot requests as
`MEDIA_HEIGHT_RECHECK_DELAYS_MS` and the shared trailing reconciliation window as
`FRAME_HEIGHT_SYNC_DEBOUNCE_MS`. Their values remain 300/1200/2600/4200 ms and
150 ms. With no intervening requests, the four resulting sweeps occur at
450/1350/2750/4350 ms. All contents in a manager still share its pending sweep;
contents retirement cancels that document's fallback/listeners without cancelling
a queued manager sweep for remaining live views.

Deferred rendered work, captured image/SVG load handling, manager-view filtering,
the two-pixel height threshold, width fallback, stale-inline-top cleanup and
owned synchronous layout transaction are unchanged. After reversing only the
constant declarations/names and normalizing JavaScript, the complete adapter
matches pre-M5b `main` (`cb027d6575c08e98909bd8c0225fdbbc916e66fd`).

Seven new Node regressions run through the public compatibility extension and
existing resource scopes. They verify late sizing without another observed load,
shared request coalescing across contents, undisplayed-view exclusion, SVG loads
from the contents realm, idempotent reconciliation, contents retirement, manager
disposal, flow changes and cancellation before rendered work binds media hooks.
All seven pass against baseline and candidate with identical tests and no adapters.
Local `npm run check` passes all **194 Node tests**, the asset audit, static build
and binding-aware Functions package.

No readiness replacement or polling removal is justified by this increment.
Captured loads do not cover the tested no-new-load sizing path. The existing
25 ms installation retry addresses a manager/container/views that is not yet
available, and stops after binding or rendition disposal. It remains separate
from media sizing. Keep these fallbacks until a demonstrated replacement covers
the same lifecycle and late-layout cases.

### M5b scroll-stress evidence

The [M5a numeric witness](reader-scroll-stress-m5a.json) remains unchanged, with
its single -56 px reversal and unconfirmed cause. The existing native upward
regression now records timestamps, current and prior frame geometry, prior block
positions and passive `resized` payloads, including whether a view was displayed.
Its existing geometry reads are reused; resize listeners add no layout reads.
Creation/listener instrumentation is test-only and removed when capture stops.
The original 32 wheel events, -180 px input, 12 ms waits, 500 ms final wait,
surviving-block predicate, 3 px reversal threshold and trim assertions remain.
This is additional investigation evidence, not a claimed scroll correction.

Three mobile-Chromium stress repetitions pass against pre-M5b `main`, and three
pass against the candidate, using the enriched observer and original assertions.
The candidate reports confirm that the new evidence is populated:

| Candidate repetition | Passage samples | Resize payloads | Reversals below -3 px |
| --- | ---: | ---: | ---: |
| 1 | 196 | 48 | 0 |
| 2 | 228 | 58 | 0 |
| 3 | 209 | 52 | 0 |

These are local static-fixture observations, not performance measurements or a
reproduction of the original CI failure. The observer adds test work even while
reusing existing geometry reads. The cause remains unconfirmed; retain the
original witness and use the additional fields if the reversal recurs.

All **36 targeted desktop/mobile Chromium cases** pass for native scrolling and
trim, delayed prepends, late growth above/below the passage, image focus/return,
partial-cover return, mode switches/reopening, height-only viewport changes,
native/continued-scroll cancellation, mutation-free location reporting, pending
section/iframe removal and repeated/racing disposal. The local run serves static
assets with technical publication/fixture responses. The original native input,
waits and stress/trim assertion blocks match pre-M5b byte for byte; all 81 local
Markdown file links resolve. Full CI also uses disposable Pages/D1 state.

Passing local traces also contain 12/17/14 displayed-view height decreases of
56 px across the three repetitions, with intervening increases. Samples tracking
a surviving block remain at 0 or +180 px passage movement. The pinned vendor's
vertical view expands using `Contents.textHeight()` (the rounded bottom of a
content Range), whereas the compatibility sweep uses the maximum document/body
scroll height. Comparing these measurements at a failing section transition is
the next concrete reproduction task. The two measurement paths and matching
magnitude are a lead; they do not establish the cause of the earlier reversal.

### M5b CI and merge

[CI run 39052142447](https://github.com/skypie0102/ShadowGarden/actions/runs/39052142447)
passes the audit, all **194 Node tests**, both builds and **302 browser cases**
across five profiles on the first attempt. Desktop/mobile Chromium pass 62 cases
each; Firefox and desktop WebKit pass 60 each with two skips; mobile WebKit passes
58 with four skips. These are the same eight existing platform skips. The upward
scroll assertion passes in all profiles where it runs. No assertion, timeout,
explicit wait or tolerance was weakened.

The tested PR head is `f5e804af8802c7ca44d9a01eb12b1f4414d5fbc7`, tree
`ce9eede1a1e6b0b9d373781e280833bbc9791680`.
[PR #21](https://github.com/skypie0102/ShadowGarden/pull/21) merged as
`0f01ab2ae1863a273156375c5394d1f9caae3e8a` with that exact tree. A
documentation-only follow-up records final validation and the measurement lead.

M5b's timing cleanup and readiness assessment are complete. The scroll-stress
cause remains open; retain the original witness and the enriched observer.
M5c follows with diagnostic classification for expected cancellation and quiet
teardown versus actionable failures.

Production remains the separately recorded v2.12.5 deployment. This maintenance
does not change catalog data, migrations, storage or configuration.

### M5c1 — search and TOC diagnostic ownership

A cancelled, disposed or superseded book query could still record
`search.sectionFailed` when its outstanding section load rejected. Shared source
loads can fail for both old and current queries; only the query that still owns
its run records the failure. The existing run ID now guards that diagnostic.
Cancellation results, progress guards, result limits, pacing and source leases
retain their existing behavior. The source is still released after rejection.

Chapter and book-result click handlers now guard `navigation.tocFailed` and
`navigation.searchFailed` with their existing root scope. A rejected navigation
after controller disposal is quiet. An active rejection still records the same
fixed diagnostic. Success, drawer-close behavior and navigation ownership are
unchanged. This is ownership-based classification: an active failure remains
visible even if its error is named `AbortError`; there is no blanket name filter.
Actual resource-release failures remain actionable during disposal.

Four Node regressions cover cancelled/disposed/superseded search loads, shared
load failure ownership, source release and continued scanning after an active
failure. On pre-M5c `main` (`d6a7d5afc1bc7926acf3fe0ba2f695ea732851af`),
the three stale-owner cases fail while the active-failure case passes. All four
pass on the candidate. Two browser regressions exercise active rejection followed
by disposal/rejection through the public TOC controller, one each for chapter and
book-result navigation. Both fail on that baseline in mobile Chromium because
the post-disposal diagnostic count increases. Existing assertions and waits are
unchanged.

The review also identified the bookmark navigation catch and app-level asynchronous
callbacks as separate follow-up boundaries. M5c remains in progress; this increment
covers search and TOC ownership only. Media timing/readiness policy and the open
scroll-stress investigation retain their existing records.

Local validation passes the asset audit, all **198 Node tests**, static build and
binding-aware Functions package. All **14 desktop/mobile Chromium TOC/search
cases** pass, including the two new cases. A final four-case rerun confirms that
active failures named `AbortError` still report while disposed failures do not.
The complete five-profile CI matrix is required before merge. Production remains
v2.12.5; this increment changes source diagnostics, not deployment or data.

### M5c1 CI and merge

[CI run 39074208919](https://github.com/skypie0102/ShadowGarden/actions/runs/39074208919)
passes the audit, all **198 Node tests**, both builds and **312 browser cases**
across five profiles on the first attempt. Desktop/mobile Chromium pass 64 cases
each; Firefox and desktop WebKit pass 62 each with two skips; mobile WebKit passes
60 with four skips. These are the same eight existing platform skips. The two
new navigation diagnostic cases pass in every profile, adding ten browser cases.
Existing assertions, explicit waits, timeouts and tolerances are unchanged.

The tested PR head is `b068d1139acb6c8bf17bb435e4514dc4bf53324f`, tree
`efe5e29462205b9967eb3a5dc92e41bd9580e54e`.
[PR #22](https://github.com/skypie0102/ShadowGarden/pull/22) merged as
`8ac6b0e315eca32319490c0fcabd8a3793295153` with that exact tree. A documentation-only
follow-up records final validation and groups ownership guidance with the existing
architecture diagnostics section. All 81 local Markdown file links resolve.

M5c1 is complete; M5c remains in progress. Next, reproduce and cover bookmark
lookup/navigation rejection after disposal, including its diagnostic and toast.
Review app callbacks against their own scope, rendition and operation ownership
before extending guards. Do not suppress active failures or actual cleanup errors.

Production remains the separately recorded v2.12.5 deployment. This maintenance
does not change catalog data, migrations, storage or configuration. The earlier
scroll-stress cause remains open and its archived witness is unchanged.

## Scroll follow-up — shared intrinsic sizing

The owner requested resolution of the earlier scroll reversal before further
cleanup. Investigation on `80025883330a8a1a38a186980f117c48ed7ac673` reproduces
a competing-height defect in the original generated publication. Vendor expansion
uses a Range bottom of 1311 px; compatibility reconciliation uses a 1367 px
scroll extent. An unchanged chapter repeatedly loses/regains 56 px. The
[scroll audit](READER_SCROLL_AUDIT.md) records the evidence and the limit of the
older witness, whose single reversal has no resize payloads.

Vertical, reflowable Continuous contents now share one intrinsic measurement for
vendor expansion/polling and adapter reconciliation. It includes body padding
and overflow, translates viewport-relative geometry to document coordinates,
and avoids the current iframe viewport floor so real shrinkage remains possible.
It is installed before initial layout. Other layouts retain their existing path.
Body CSS, fallback timings, reconciliation debounce, layout-transaction ownership,
source lifetimes, persistence and navigation cancellation remain unchanged.

Five Node cases cover measurement agreement, growth/shrinkage, iframe scrolling,
overflow, idempotence and fallback. Two production-reader browser cases fail on
the baseline: unchanged chapter sizing differs by 56 px, and a 120 px image
shrink produces only 64 px of frame reduction after reconciliation. Both pass
locally on the candidate, including passage preservation within 2 px. The
original upward-scroll and trim assertions are unchanged.

The historical reversal does not recur in 20 ordinary, 40 loaded and 10 throttled
baseline repetitions or the synchronous transition sweep. This fixes its proven
height-oscillation lead; the sparse old trace cannot prove the cause of that
individual event. Keep the original witness and enriched stress tracing.

Local `npm run check` passes the audit, all **203 Node tests**, static build and
binding-aware Functions package. Raw baseline/candidate height phases are in
[reader-height-contract.json](reader-height-contract.json). Full browser validation
follows before merge.
Production remains v2.12.5; source maintenance does not deploy or alter data.

All **48 targeted desktop/mobile Chromium cases** pass across Continuous scroll
stability, image focus/return and lifecycle suites. The original native upward
scroll/trim test is byte-identical to the baseline. All 86 local Markdown file
links resolve; the numeric height evidence and production-source hashes validate.

### Intrinsic-sizing CI and merge

[CI run 39075906419](https://github.com/skypie0102/ShadowGarden/actions/runs/39075906419)
passes the audit, all **203 Node tests**, both builds and **322 browser cases**
across five profiles on the first attempt. Desktop/mobile Chromium pass 66 cases
each; Firefox and desktop WebKit pass 64 each with two skips; mobile WebKit passes
62 with four skips. These are the same eight existing platform skips. Both new
sizing regressions pass in every profile. The original native upward-scroll test
passes wherever native input is supported, with its assertion and waits intact.

The tested PR head is `81b2e61f289550eec8ba291161541483b977443c`, tree
`fe26f991541f15b2daa1306739ddbb2bdcf827ae`.
[PR #23](https://github.com/skypie0102/ShadowGarden/pull/23) merged as
`8be8e7903deb6034bd7daca73a83563a4aa72cb8` with that exact tree. A documentation-only follow-up
archives the additional stress observations and final publication identities.

Ten additional candidate mobile-Chromium native-scroll repetitions pass, with
185–205 passage samples per run and no reversal below -3 px. Each trace contains
ten resize payloads: initial media growth remains, while repeated 56 px shrink/
growth disappears. The twenty ordinary baseline traces contain 239 shrink events
of 56 px; the ten candidate traces contain none. Per-run counters are archived
with the existing height phases and matching production-source hashes in
[reader-height-contract.json](reader-height-contract.json). These local fixture
observations are not performance measurements or proof of the older event's cause.

The demonstrated competing-height defect is fixed. The historical single
reversal remains causally unattributed because its witness lacks resize data;
retain that distinction, the original witness and the unchanged stress assertion.
Production remains the separately recorded v2.12.5 release; this source fix does
not deploy or change catalog data, migrations, storage or configuration.


### Original scroll artifact investigation

Recovered the full failed M5a Playwright artifact and decoded its DOM snapshot
references. The [scroll audit](READER_SCROLL_AUDIT.md#original-failure-artifact-follow-up)
records the exact 56 px frame transition and its limits. The artifact hash,
selected snapshots, original passage samples and matched-font attempts are in
[reader-scroll-original-investigation.json](reader-scroll-original-investigation.json).
The offline decoder reproduces all seven selected snapshots. The README now
explicitly separates the unresolved automated event from ordinary phone acceptance
and the demonstrated sizing fix.

Original Chromium/font geometry is reproduced with a private fontconfig. The
original case passes 20 cold repetitions and its historical position after 40
preceding tests in the original 62-case Pages/D1 suite. Thirty richer cold probes
and 24 setup-phase variations also pass. These results do not prove resolution.
The maintained test only adds already-computed geometry and document identity to
its saved diagnostics; three focused current-source mobile runs and 203 Node
tests pass. Reader source, release version and production data are unchanged.


The complete original-source run finishes with 92/92 passing: all 62 original
cases plus 30 warm-browser rich probes. Their 5,829 samples and 1,200 anchor
transactions show no reversal below -3 px, node/frame document mismatch or
saved-y/snapshot-top discrepancy above 0.01 px. This does not identify the cause
of the historical failure; it closes the known font/harness/warm-up gaps in the
local reproduction attempts.

[PR #24](https://github.com/skypie0102/ShadowGarden/pull/24) passes its first
[CI run 39078286263](https://github.com/skypie0102/ShadowGarden/actions/runs/39078286263):
203 Node tests, asset/dependency/route checks, static build and binding-aware
Functions packaging, plus 322 browser cases across five profiles. Desktop and
mobile Chromium each pass 66; Firefox and desktop WebKit each pass 64 with two
existing skips; mobile WebKit passes 62 with four existing skips. The native
scroll input, waits, predicate and tolerances remain unchanged.

Tested head `e05554f611b923b066954aa63c6173d9205180c9`, tree
`6842b9bead55b68410935f1780d80804e0acc270`, merges as
`403565664675512a9e0d50a4bb8b74609f623b65`. A documentation-only follow-up records
these final results and updates the architecture/review evidence limits. The
original reversal remains open. No reader behavior, deployment, catalog data,
storage, migrations or configuration changes are part of this investigation.

### Original reversal: recorded CI comparison

Added an opt-in [scroll recording harness](READER_SCROLL_DIAGNOSTICS.md) and a
separate CI workflow comparing original M5a source with current source. The native
case keeps its original suite position and gains correlated anchor/correction/
scroll-write evidence; 30 probes follow the normal suite in the same browser.
The normal five-profile suite is unchanged. No production source is edited.

Local matched-font checks pass three recorded native cases on each source: the
suite-position case and two appended probes. The original source records 125
complete anchor transactions and 42 repeated 56 px shrinks; current source
records 68 transactions and zero such shrinks. Neither shows a reversal or
geometry/document mismatch. These are harness validation, not causal resolution.
All 204 Node tests pass, including a regression verifying that the summary
retains the real historical sample 89 / -56 px witness.


[PR #25](https://github.com/skypie0102/ShadowGarden/pull/25) merges after its first
normal [CI run 39079730562](https://github.com/skypie0102/ShadowGarden/actions/runs/39079730562)
passes 204 Node tests and 322 browser cases across five profiles, with eight
existing skips. The paired [recorded run 39079730631](https://github.com/skypie0102/ShadowGarden/actions/runs/39079730631)
passes 92 original-source and 96 current-source cases. Each includes the native
case in its normal suite position plus 30 appended probes.

Downloaded artifacts are verified against their published SHA256 digests;
summaries are recomputed byte-for-byte from full reports. Their 62 recorded
traces retain 11,473 passage samples, 1,932 complete anchor transactions and 925
correlated scroll writes. Anchor identities, correction deltas and write
arithmetic are consistent. No reversal, geometry disagreement or document
mismatch recurs. Original source records 393 repeated 56 px shrinks; current
source records none. All anchors are semantic blocks, leaving the view-anchor
fallback path unexercised. This gap is the next controlled investigation target;
it is not an identified cause.

Provenance, per-trace summaries and integrity checks are permanent in
[reader-scroll-recorded-ci.json](reader-scroll-recorded-ci.json). Tested head
`fb9240e23e123a5d6468f483362e745892c76d9f`, tree
`10d3bacf795818fe31bcb2d7f9666934a5f8a094`, merges as
`d8de2c19de9bf08403bf73759b9cd11bd6714c90`. CI tested synthetic merge
`83024dcfac6e32855baa738934921c8673d7476f`; its current-source provenance is retained
alongside the original source identity. A documentation-only follow-up publishes
these final results. The historical reversal remains open; no deployment or
production data/configuration changes were made.


### RDR-054: controlled fallback and chapter-boundary investigation

The two pending-upward-scroll controls exercise real view-anchor fallback and
pass for earlier-view height changes of -56 and +56 px. Boundary coverage then
exposes a distinct deterministic -56 px movement on current source `78a9c12`:
removing/restoring trailing body padding and paragraph margin changes the actual
content height. After shrink, the remembered anchor switches from the nearby
footnote to a farther heading in the next chapter. Restoration preserves that
heading and pulls the footnote upward. The failing-before browser regression
uses normal contents expansion, rather than forcing an inconsistent frame size.

The candidate chooses the closest visible semantic block across chapter padding;
a block containing the tracking line still returns immediately. The demonstrated
footnote stays at 222.5 px through both phases instead of ending at 166.5 px.
The original native-scroll test and its input, waits and thresholds are unchanged.
Local validation passes 204 Node tests, 18 mobile scroll/focus/fallback cases and
three final settled fallback/boundary cases. Before/after traces and source hashes
are in [reader-boundary-anchor.json](reader-boundary-anchor.json). Full CI is pending.

This fixes a demonstrated boundary mechanism; it does not prove that the older
M5a witness followed the same sequence. No deployment or production data changes
are included.
