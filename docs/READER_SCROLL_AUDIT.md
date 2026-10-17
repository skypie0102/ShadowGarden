# Reader scroll-stability audit

**Phone acceptance — 2026-10-17:** after v2.12.5 the owner reports no more jumping
or dimming in ordinary Android/Soul use. This passes general phone acceptance;
the separate first-open partial-cover cycle RDR-045 remains tracked in the
[release record](READER_RELEASE.md). Current cleanup is in
[maintenance](READER_MAINTENANCE.md). The dated investigation below retains its
original reproductions and automated evidence.


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
| Focus / notes / settings / flow | Existing callbacks share navigation/lifecycle ownership. | The complete five-profile matrix passes focus return, notes, settings, mode changes, width reflow, BFCache and disposal. RDR-045's intermittent real-cover return remains open pending a faithful live reproduction/acceptance. |

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
