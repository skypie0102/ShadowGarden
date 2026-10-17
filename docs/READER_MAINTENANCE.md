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
| M2 — Page-map measurement boundary | Extract sandbox measurement/disposal while retaining map generation/cache and lookup contracts. Verify sandbox failure, source bounds, encoded paths, long books and cache reuse. | Next |
| M3 — Shared pure helpers | Consolidate identical href/spine helpers while preserving fragment, encoded-path and iframe-local differences. Verify links, notes, TOC and page/final-section navigation. | Planned |
| M4 — Vendor state ownership | Consolidate shared Continuous manager state one concern at a time. Verify partial renders, buffer/trim races, late media, resize and native input. | Planned |
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

## Validation and publication

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

M1 is complete. M2, the cohesive page-map measurement boundary, is next.
Production remains the separately recorded v2.12.5 release; this source-maintenance
merge is not another deployment.
