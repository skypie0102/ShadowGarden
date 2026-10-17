# Reader maintainability review — v2.12.5

Baseline: `main` at `05c489461cc3d8697e4627247239680dcec26bc6`, with deployed
reader source `8a7e07fc06fdcd38a3fafcaed1f0baff44584d75`. Reviewed 2026-10-17.

The reader is substantially better organized. Startup, navigation, resource
lifetime and Continuous layout have clear owners and regression coverage. It
still contains a complex, version-specific EPUB.js integration. The review does
not establish that every publication and browser is free of defects.

| Concern | Owner |
| --- | --- |
| Engine/startup | `reader/engine.js` validates and initializes the runtime and installs six explicitly ordered extensions. |
| App composition | `reader/app.js` wires controllers with dependencies and disposal contracts. |
| Navigation | `reader/navigation-state.js` owns revisions, abortable intent and queued vendor moves; newer movement invalidates stale restoration. |
| Resource lifetime | Lifecycle and section-source modules own listeners, partial views, delayed work and parsed-source leases. |
| Continuous layout | `reader/continuous-layout.js` compensates actual structural changes synchronously at the current reading line. |

## Maintenance priorities

| Priority | Baseline finding | Direction |
| --- | --- | --- |
| 1 | Prototype/method overrides and a copy of the pinned IframeView render sequence remain tightly coupled to EPUB.js internals. | Document the vendor contract and consolidate adaptation/state boundaries in small steps, preserving hook order and source lifetimes. |
| 2 | Page map, rendition and TOC combine several responsibilities; app wiring contains dense multi-action callbacks. | Expand orchestration, then extract cohesive measurement/search boundaries. Preserve persistence and exported behavior. |
| 3 | Startup/session/fitting use a global visual cache although the engine already exposes that service; Continuous fields are shared on vendor managers. | Inject the visual service and later consolidate manager state. Keep diagnostic snapshots separate. |
| 4 | Media-size checks at 300/1200/2600/4200 ms and manager polling coexist with quiet fallback paths. | Document deadlines, prefer demonstrated readiness signals, and distinguish actionable diagnostics from expected cancellation. |
| 5 | Href normalization/matching, spine selection and mobile-pagination helpers are repeated. | Consolidate identical behavior while retaining intentional fragment, encoded-path and iframe-local differences. |

These are separate, behavior-preserving maintenance increments. Existing scroll
corrections fix demonstrated ownership/geometry faults; the Soul filter reset
is a narrow compatibility rule. Preserve their reproductions during cleanup.

## Acceptance and follow-up

The v2.12.5 release passed 166 Node tests and 277 browser cases across five
profiles, with eight platform skips, in CI run
[39001700811](https://github.com/skypie0102/ShadowGarden/actions/runs/39001700811).
The owner subsequently reported: “Tested the reader, works great so far, no more
jumping and dimming.” This passes ordinary-use Android/Soul acceptance of those
reported problems. RDR-045's earlier first-open partial-cover cycle remains a
specifically tracked intermittent case; that exact reproduction was not repeated
independently by the general phone report.

M1 removes the functional visual-cache global, expands app wiring without changing
normalized JavaScript behavior, and documents the vendor contract. See
[maintenance](READER_MAINTENANCE.md), [architecture](READER_ARCHITECTURE.md),
[scroll audit](READER_SCROLL_AUDIT.md) and [release evidence](READER_RELEASE.md).

M2 extracts the existing iframe/runtime, media-settlement and section-measurement
functions to `reader/page-map-measurement.js`. Generation/cache/lookup policy
remains in the controller. The function bodies and operation order are retained;
[maintenance](READER_MAINTENANCE.md) records final validation and merge status.

M3 shares identical section href identity/matching and linear-spine selection in
`reader/sections.js`. Relative links, notes, legacy progress href matching and
mobile-pagination rules retain their existing behavior. The architecture records
that boundary; maintenance tracks its checks and merge status.

M4a centralizes Continuous generation/destruction state in a private WeakMap,
with core-owned transitions and shared readers for buffering, layout, image
return and delayed scroll/media work. Buffer/trim scheduling and input/layout
state remain separate increments. The existing transition order and lifecycle
scope ownership are preserved; maintenance records validation and publication.

M4b groups buffer promise/generation, repeat requests and trim timer in that
private manager record. Core remains the only mutating consumer. Test waiters
observe the exact pending promise through a passive accessor. The scheduling
algorithm and operation order match the baseline; repeat-request, trim-deadline
and teardown regressions preserve the prior behavior.

M4c moves shared input suppression, recent-input timing, the owned scroll reporter
and defensive-wrapper installation state into that private record. Core and
rendition retain the same writers, readers, clocks and deadlines. Native movement
still cancels stale navigation; a vendor boolean cannot replace the owned
reporter. Vendor geometry/bookkeeping and private layout anchors retain their
owners. M4 is complete; maintenance records its validation and merges.

M5a separates book-text query/results presentation into
`reader/toc-book-search.js`. TOC tree/filter/location controls and the bounded
text-search engine retain their owners. The moved query/result/section functions
keep their bodies; root/UI scopes, stale-query guards, the 180 ms debounce,
accessible status and navigation behavior are preserved. Maintenance tracks
validation and publication. Media timing/readiness and diagnostic classification
remain later M5 increments.

M5b names the existing media recheck sequence and manager reconciliation debounce.
Seven scheduling regressions cover late sizing without another load, shared
request bursts, contents-realm SVG targets, retirement, disposal and flow changes;
they pass against both the previous and named-constant source. The existing
installation retry and fallback policy are retained because equivalent readiness
coverage for a replacement has not been established. The native scroll trace now
includes frame changes and resize payloads without changing its assertion or
adding geometry reads. The earlier 56 px observation remains unconfirmed and
tracked; M5c's diagnostic classification review is still separate work.

M5c1 applies existing query-run and TOC-root ownership to failure diagnostics.
Late rejected search loads and disposed chapter/result clicks stay quiet; active
failures still report fixed messages, and source release remains unchanged.
Failing-before regressions establish these specific reporting faults. Bookmark
and app callback ownership remain separate M5c follow-up work; maintenance records
validation and merge status.
