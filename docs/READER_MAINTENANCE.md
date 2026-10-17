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
| M4 — Vendor state ownership | Consolidate shared Continuous manager state one concern at a time. Verify partial renders, buffer/trim races, late media, resize and native input. | M4a merged through [PR #17](https://github.com/skypie0102/ShadowGarden/pull/17), M4b through [PR #18](https://github.com/skypie0102/ShadowGarden/pull/18); M4c planned |
| M5 — Presentation and timing | Separate cohesive TOC search presentation; name media deadlines and replace polling only with equivalent readiness coverage. Keep expected quiet teardown distinct from actionable diagnostics. | Planned |

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
| M4c | Input/scroll suppression shared by core and rendition; retain layout anchors with their layout owner. | Planned |

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

M4b is complete; M4c shared input/scroll suppression is next. M4 remains in
progress. Production remains the separately recorded v2.12.5 deployment, with
catalog data, migrations, storage and configuration unchanged by this maintenance.
