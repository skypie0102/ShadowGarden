# Reader scroll-stability audit

**Phone acceptance — 2026-10-18:** the owner manually checked fast upward
scrolling and image-focus return on Android/Soul in v2.12.6 and reports that
both work correctly. This completes the requested device acceptance, following
the successful v2.12.5 ordinary-use report. Earlier RDR-045 first-open cover
observations remain regression evidence; the report does not separately isolate
that exact historical cycle. See the [release record](READER_RELEASE.md).
Current cleanup is in [maintenance](READER_MAINTENANCE.md). The dated investigation
below retains its original reproductions and automated evidence.


Opened 2026-10-17 after the owner confirmed that v2.12.4 resolves Soul Browser
image dimming and reported intermittent jumps while scrolling quickly upward.
The starting source is `8324e78dad81031a370e28ab26abd54a655e47d6`.

The immediate scope is every reader path that can change the visible passage:
Continuous buffer growth and trimming, iframe sizing, vendor location queries,
viewport recovery, deferred navigation, image/footnote return, settings reflow,
and rendition replacement/disposal. Findings must distinguish demonstrated faults
from risks that still need reproduction. Passing a generated publication test
does not establish physical-phone acceptance or prove that no other bug exists.

## Investigation inventory

| Area | Ownership and current finding | Evidence / next check |
| --- | --- | --- |
| Earlier-chapter buffering | An anchor saved before asynchronous prepends replays the reader's old viewport after newer scrolling. | Demonstrated on v2.12.4 with native upward input: repeated backward movements of 855 px and a 149 px correction in the recorded generated-book run. Replace asynchronous replay with synchronous structural transactions. |
| Prepend resize compensation | The vendor permanently counters every resize of a prepended view, including one now below the reader. | Demonstrated: adding 320 px to a previously prepended chapter below the viewport shifts the visible passage. Remove that counter; preserve the current reading-line chapter at each actual reframe. |
| Overlapping visible chapters | Anchoring the first intersecting chapter can preserve an edge while moving the passage in the next chapter. | The first candidate still moved backward 56 px when that edge chapter shrank. The final transaction selects the chapter at the same 30% tracking line used by Continuous position capture; native stress now passes. |
| Native scroll anchoring | The parent container allows native anchoring in addition to explicit compensation. | Disable native anchoring on the managed scroller and retain the existing EPUB-document opt-out, so each structural change has one compensation owner. This is a prevention measure, not a separately established browser defect. |
| Buffer request coalescing | Requests received while loading can describe a newer neighborhood. | Retain a trailing request and re-evaluate after the pending pass. A slow-prepend regression checks buffer coverage after movement without another gesture. This guards a static scheduling gap; the original stale-anchor fault can mask it in the baseline test. |
| Idle trimming / view lifetime | Vendor view removal skips destruction if its first display has not finished. | Demonstrated with a delayed Section render: removal leaves an iframe reference and an unsettled display promise. Cancel view-owned callers immediately, block late loads/events, retain source leases until vendor work settles, and clean up partial frames. Idle trimming also waits for active buffering. |
| Late iframe sizing | Adapter height writes bypass the view's `_height`, `prevBounds` and resize ownership, and scan the entire page. | Reconcile only this manager's displayed views through `view.reframe()` inside one synchronous transaction; coalesce manager-owned timers. Existing late-media/focus-return coverage remains required. |
| Media growth inside the visible chapter | Preserving a chapter wrapper alone cannot preserve a paragraph when an image above it changes height. | Demonstrated with a real 320 px image-height increase (the test verifies that growth occurred). Remember document-local block geometry, derive its expected position from the current frame/scroll, and compensate once after reframe. A block no longer at the tracking line cannot override newer scrolling into the image. |
| Location reporting | Vendor Continuous `currentLocation()` calls `updateLayout()` before querying location. | Query `scrolledLocation()` directly for the supported nonpaginated Continuous manager. Check formatting calls as well as DOM mutations; an idempotent style write alone is insufficient evidence. |
| Window resize / browser chrome | Height-only stage resize clears/reopens live chapters; app recovery also replays a snapshot. | Demonstrated on v2.12.4: a 100 px height-only viewport change disconnects the original chapter. Keep live frames when width is unchanged, refresh stage metrics, and remember the new height without starting semantic recovery. Width/orientation recovery retains its existing path. |
| User input versus delayed work | Only explicit navigation previously invalidated ownership. | Demonstrated with both wheel input and scroll continuation while access renewal waits. Native movement now invalidates older work. Track owned scroll writes synchronously so buffer compensation is not mistaken for user movement; cover wheel, touch, keyboard, scrollbar and inertia paths. |
| Focus / notes / settings / flow | Existing callbacks share navigation/lifecycle ownership. | The complete five-profile matrix passes focus return, notes, settings, mode changes, width reflow, BFCache and disposal. The owner manually accepts image-focus return on Android/Soul in v2.12.6 on 2026-10-18; earlier RDR-045 first-open observations remain regression evidence with the scope recorded above. |

## Release and evidence

v2.12.5 is merged through [PR #13](https://github.com/skypie0102/ShadowGarden/pull/13)
as `8a7e07fc06fdcd38a3fafcaed1f0baff44584d75` and live in deployment
`0ceadeec-4e53-4e20-a841-83c72bde66a2`. The merged tree exactly matches the
verified PR head. [CI run 39001700811](https://github.com/skypie0102/ShadowGarden/actions/runs/39001700811)
passes all **166 Node tests**, the asset audit, static build, binding-aware
Functions package and **277 browser cases** across all five profiles, with eight
intentional platform skips. Ten new production-reader regressions exercise real
EPUB.js views from an original disposable publication; fault injection uses no
real book data or production mutations. The final local three-profile reader
integration run passes 142 cases with two expected dark-mode skips.

The upward test follows the same visible DOM block across successive paints,
then samples a fresh visible block. Absolute scrollTop is deliberately unsuitable
because prepending and trimming legitimately change it. Comparing unrelated
block ordinals/offsets at paragraph boundaries also produced false reversals in
an early test; the final regression compares actual surviving content geometry.

The broader Chromium run passed 92 reader checks, plus six strengthened
upward/trim, location-query and slow-load checks. The first five-profile CI run
passed both Chromium profiles but exposed two candidate conflicts: WebKit's
focus-owned drift was incorrectly classified as user movement, and Firefox
reported an uncaught cancellation during teardown. The follow-up excludes
focus-owned drift from passive movement detection (real input still cancels)
and owns the complete render/display promise chain. Partial-view regression
coverage now includes both pending Section rendering and pending iframe load.

The first follow-up still exposed Firefox's vendor render rejection during a
background first-load cancellation. The final candidate owns the pinned
IframeView render sequence under the view lifetime rather than injecting an
abort into its detached rejection helper. Its previously failing Firefox
partial-startup teardown now passes locally. The late-artwork correction also
passes locally in both Chromium and Firefox, including newer movement before
the next scroll event can refresh the paragraph anchor.

Mobile WebKit's Playwright adapter explicitly rejects mouse.wheel and exposes
no native touch-drag API. Only its two wheel-dependent cases are skipped; its
scroll-continuation, resize, late-layout, slow-load and removal cases remain
enabled. Desktop WebKit, Firefox and both Chromium profiles retain native wheel
coverage. The generated-book navigation setup allows 30 seconds to finish
buffering rather than interpreting a five-second setup timeout as a resize fault.

The product source passed both Chromium profiles, Firefox and mobile
WebKit in run 39001079221. Desktop WebKit cancelled the stale resume correctly
but missed a new wrapper-position assertion by 3 px after a fixed 100 ms wait.
That regression now waits for native scroll offsets to be quiet for five paints
and compares the actual visible block; its two-pixel tolerance is unchanged.
This is a test-measurement correction, with no reader source change. The final
five-profile run above passes that assertion.

Post-deployment checks verify the source bytes, both version targets, actual and
saved D1/bucket/secret metadata, exact public catalogs, unchanged D1 revision 3
and all three snapshot IDs/hashes. The [release record](READER_RELEASE.md) contains
the complete identities and rollback target. A passing emulated browser test does
not replace Android / Soul acceptance. RDR-046 is resolved by the owner's explicit
confirmation; RDR-045 and physical acceptance of the new upward-scroll correction
remain open.

## Verification requirements

- Reproduce failures against the starting code before accepting a correction.
- Exercise native upward input, direction changes, slow neighbor rendering, late
  image growth, trimming, and viewport changes with the production reader.
- Preserve the passage through structural layout changes without replaying an old
  reading position over newer user movement.
- Keep deliberate chapter/seek, settings, flow, focus and lifecycle behavior
  covered by the complete browser matrix.
- Preserve the production database, catalog, media configuration and secrets;
  use only disposable generated publications for fault injection.
- Record exact CI/source/deployment identities and the remaining physical-device
  acceptance after publication.

## Follow-up — competing Continuous heights

The M5a witness in [reader-scroll-stress-m5a.json](reader-scroll-stress-m5a.json)
records one -56 px reversal at a section transition. The later investigation on
`80025883330a8a1a38a186980f117c48ed7ac673` reproduces a deterministic sizing
fault in the same generated publication: vendor expansion requests 1311 px while
the body/document extent is 1367 px. Adapter reconciliation restores 1367 px;
another vendor expansion removes those 56 px again without a content change.
This repeated resizing is a real defect regardless of whether a particular
transaction successfully compensates the visible passage.

A new height-contract browser regression fails on that baseline by exactly
56 px and passes with the shared intrinsic measurement. A real 120 px artwork
shrink also exposed the disagreement: the old frame shrank only 64 px after
reconciliation. The candidate shrinks by the actual content reduction and keeps
the following passage within 2 px. Five Node cases cover agreement, idempotent
installation, growth/shrinkage, iframe scroll offsets, overflow and unowned-layout
fallback. The original native input, waits and 3 px reversal assertion remain.

Twenty ordinary native-scroll repetitions, forty repetitions with four workers
and ten instrumented repetitions with CPU throttling pass on the baseline.
A synchronous sweep across section boundaries also does not reproduce its
historical single reversal. The older trace lacks resize/transaction payloads,
so it cannot uniquely establish that event's cause. The shared measurement fixes
the demonstrated 56 px resize cycle; retain the historical witness and enriched
native-scroll trace rather than treating these passing runs as proof of causality.

Raw baseline/candidate height phases and production-source hashes are retained in
[reader-height-contract.json](reader-height-contract.json). Validation and
publication are recorded in [maintenance](READER_MAINTENANCE.md).
This source fix is separate from physical-phone acceptance and deployment.

The shared measurement is merged through [PR #23](https://github.com/skypie0102/ShadowGarden/pull/23).
Its first CI attempt passes 203 Node tests and 322 browser cases across five
profiles, with eight existing skips. Ten further candidate native-scroll runs
pass without the repeated 56 px changes seen in the baseline traces (239 shrink
events across twenty ordinary runs; none across ten candidate runs). The numeric
evidence retains per-run counters and matching production-source hashes. This
establishes the sizing fix; it does not add missing causal data to the old trace.


## Original failure artifact follow-up

The full artifact from run `39049912277`, mobile-Chromium job `117446282103`,
was recovered and decoded rather than relying only on the saved passage samples.
Its provenance, selected frame snapshots and reproduction limits are retained in
[reader-scroll-original-investigation.json](reader-scroll-original-investigation.json).
The archived passage attachment agrees with the original M5a witness.

The snapshots locate a 1215 → 1159 px shrink of section 17 (Chapter 16) between
139812.394 and 139830.971 ms. Its iframe top remains -912 px and container
scrollTop remains 5716; section 18 moves upward by 56 px. The Chapter 16 child
DOM is unchanged across that interval. Adjacent screencast images show its final
footnote at the same painted position while the following chapter heading moves
upward. These are separate observations from the sampler's -56 px result:
screenshots cannot exclude an unpainted transient, and snapshots do not recover
the sampler's missing intermediate geometry or the transaction's chosen anchor.
There is not enough evidence to call the original report a false positive.

Earlier local stress runs used Nimbus Roman for Times New Roman fallback and
produced 1311/1367 px text/body measurements. A private fontconfig using
Liberation Serif reproduces the original browser's 1159/1215 px measurements,
including the final footnote's exact local top, 1132.9375 px. Chromium also matches
153.0.8010.12. No product CSS or system font configuration changed.

With that geometry, 20 repetitions of the original native case and 30 repetitions
with transaction/scroll-write diagnostics pass. Another 24 diagnostic runs sweep
setup timing from 0 to 1024 ms and pass. The input remains 32 native -180 px wheel
steps, 12 ms waits and the existing 3 px reversal threshold. Passing runs do not
prove resolution. The diagnostic callbacks can themselves affect scheduling.

The original full mobile suite also passes all 62 cases, including the historical
failure at case 41. Unlike
`repeat-each`, which starts fresh workers, that suite warms a shared browser with
40 earlier cases before that case. Its server uses disposable local
Pages/D1 state. A test-process loopback fallback handles the container's broken
network-interface enumeration; it does not touch production resources.

To inspect the same interval after extracting the failed artifact's `trace.zip`:

```sh
python3 scripts/inspect-reader-scroll-trace.py /path/to/trace.zip \
  --start-ms 139790 --end-ms 139881
```

The offline decoder reads Playwright's snapshot references and emits the original
timestamps, container scrollTop and iframe bounds. Its output for the seven
selected snapshots was checked against the archived interval. It performs no
browser actions and makes no causal classification.

The maintained native test now saves `y`, `nodeTop` and the node/frame document
identity check alongside its existing fields. It reuses the same geometry reads;
input, timing, predicates and tolerances are unchanged. Three focused current-source
mobile-Chromium runs pass, as do all 203 Node tests. This improves evidence on a
future recurrence and does not change reader behavior.

The full original-source run finishes with 92/92 passing: the original 62 cases
followed by 30 rich probes in the warm browser. Those probes retain 5,829 passage
samples and 1,200 anchor transactions, with no reversal below -3 px, node/frame
document mismatch or disagreement above 0.01 px between saved `y` and snapshot
top. The missing-measurement hypothesis is not reproduced either. Keep the
original event open; this round establishes better reproduction fidelity and
better evidence collection, not a confirmed root cause.

The next comparison uses the opt-in [recording harness](READER_SCROLL_DIAGNOSTICS.md)
on the original and current source in CI. It records the actual anchor choice,
post-change correction and scroll writes in the native case's original suite
position and in 30 later warm probes. Normal tests and production source retain
their existing behavior; the dedicated jobs explicitly account for logging overhead.


The first recorded CI comparison passes 92 original-source and 96 current-source
cases. Its 62 recorded traces contain 11,473 passage samples and 1,932 complete
anchor transactions, with no negative delta below -3 px. Original-source frame
cycling recurs (393 shrinks of 56 px); current source has zero such events.
All records select block anchors, leaving view-anchor fallback unexercised. The
[per-source evidence](reader-scroll-recorded-ci.json) and
[recording guide](READER_SCROLL_DIAGNOSTICS.md#first-recorded-ci-comparison)
retain that limitation. These results confirm recording fidelity and the earlier
height-cycle fix, not the cause or resolution of the original reversal.


## RDR-054 — chapter-padding anchor switch

Controlled tests now exercise the previously unrecorded view fallback through a
pending upward scroll: the saved block becomes stale before its scroll handler
runs, and an earlier chapter changes height by ±56 px. Both cases keep the
tracked passage stable. No anchor selector is replaced to force that path.

A separate boundary test reproduces a deterministic backward movement in current
source `78a9c129dec901bbe84eeec6be4515fbc4579771`. The tracking line is just below
the final footnote and inside the chapter's trailing padding. Removing 40 px of
body padding and 16 px of paragraph margin shrinks the frame by 56 px through
normal contents expansion. The footnote stays at 222.5 px. The new chapter
wrapper now contains the tracking line, so the next remembered anchor switches
to its heading at 309.4375 px, even though the preceding footnote is closer.
Restoring the padding/margin grows the frame; preserving that heading writes
scrollTop +56 and pulls the preceding footnote up to 166.5 px.

The candidate compares actual visible semantic blocks across a chapter gap,
keeping a block that contains the tracking line as the fast path. Layout anchor
selection now retains the nearby footnote through both content-height changes.
The same regression remains at 222.5 px after shrink and restoration. Persistent
progress/CFI view selection is unchanged. Full before/after transaction records
and source hashes are in [reader-boundary-anchor.json](reader-boundary-anchor.json).

This establishes a specific anchor-switch defect and a failing-before regression.
It does not uniquely attribute the older M5a witness to this sequence: that
artifact's missing sampler/transaction intermediates remain missing. Retain the
historical witness and its unresolved causal status. The latest separately recorded deployment is v2.12.5; this source change does
not perform a rollout.


## RDR-055 — layout synchronization consumes pending movement

The first PR #26 Firefox job fails the existing momentum-cancels-resume test:
the trace shows scrollTop 4240 → 4420 while renewal waits, then 4240 after the
stale resume is accepted. An unchanged rerun passes. That trace does not retain
the internal previous-offset writes, so its exact ordering cannot be asserted.

A deterministic control independently reproduces a bookkeeping defect. Native
scrollTop moves 5468 → 5648 before its scroll event; a synchronous layout
transaction then sets `prevScrollTop` to 5648. The event sees zero movement,
and pending resume incorrectly returns true. The control records suppression
already expired, separating the fault from intentional restoration suppression.

Layout transactions now retain the unhandled delta present at entry. Their final
observed baseline advances only by the transaction's own offset change. The
native scroll event can still see the user's 180 px movement and cancel resume.
Controls cover a no-op transaction and earlier-view ±56 px compensation; all
return false after correction. Navigation generation changes discard the old
pending delta. Existing native-wheel tests, timing and tolerances are unchanged.
Before/after values are retained with the boundary evidence in
[reader-boundary-anchor.json](reader-boundary-anchor.json).


RDR-054 and RDR-055 are merged through [PR #26](https://github.com/skypie0102/ShadowGarden/pull/26).
Updated-head CI passes 204 Node tests and 352 browser cases across five profiles,
with eight existing skips. Recorded CI passes 92 original-source and 102 current
cases. Verified current evidence keeps the same footnote at 221.9375 px through
shrink, restoration and rendering, and cancels resume in all three pending-movement
controls. The two controlled view-fallback cases also pass. Native stress traces
contain no reversal; that result alone is not used to claim historical causality.
The [permanent evidence](reader-boundary-anchor.json) includes artifact hashes,
source identities, full controlled results and recomputed native summaries.
