# EPUB.js integration contract

This describes the bundled runtime and existing adaptation behavior. It guides
maintenance; compatibility with another EPUB.js release requires a separate
review. See [architecture](READER_ARCHITECTURE.md) and
[maintenance](READER_MAINTENANCE.md).

## Runtime and extension order

`public/assets/vendor/epub.min.js` is the pinned bundle; its original hash is in
`recovery-info/provenance.json`. The engine checks the callable factory,
`VERSION === "0.3"`, `Book.prototype.renderTo` and
`Rendition.prototype.requireManager`. That is a coarse guard, not a validation
of every adapted internal field. Lifecycle integration installs once per runtime;
a WeakMap retains its engine and extension collection.

Each `engine.createBook()` invokes the vendor factory once and attaches:

1. Compatibility/layout and external-link behavior.
2. Footnotes/endnotes.
3. Internal publication links.
4. Visual-page preparation/cache.
5. Paginated visual fitting, supplied with the same visual service.
6. Continuous buffering/manager behavior.

Several extensions wrap `renderTo()`. Attachment order and wrapper nesting are
part of this contract. Feature modules do not replace the global EPUB factory.
The page-map sandbox has its own unextended runtime plus lifecycle integration,
without registering another application engine.

## Application-facing contracts

| Boundary | Contract |
| --- | --- |
| Book creation | Engine creation owns ordered adapters and rendition teardown through the book scope. |
| Visual service | One service per engine; bootstrap/session/fitting/error classification and disposal use that same instance. `prepare`, `summary`, `has` and `applyToContents` preserve existing identities, cancellation and fallback behavior. |
| Continuous settlement | Engine settlement checks manager generation/disposal while completing its current neighborhood. |
| Continuous lifetime state | `reader/continuous-state.js` owns private generation/destruction data. Continuous core retains initialization/display/teardown transitions; layout, image return and delayed work only read it. |
| Continuous buffer state | The same manager record groups the active buffer promise/generation, repeat requests and trim timer. Core owns mutations and scheduling; test waiters use a passive accessor to the exact current promise. |
| Continuous input state | Core and rendition share a private suppression deadline, recent-input timestamp, owned scroll reporter and wrapper-installation flag. Vendor coordinates, deltas, timers and boolean `scrolled` bookkeeping stay on the manager. |
| Navigation | Requests use registered navigators, revisions and ordered vendor moves; obsolete callbacks cannot navigate a replacement rendition. |
| Contents search | TOC tree/location ownership stays in `reader/toc.js`; `reader/toc-book-search.js` presents book-text queries/results using the same app navigator, root/UI scopes and bounded text-search engine. No additional vendor override is installed. |
| Sources/lifetime | Source leases outlive reads/serialization. Cancellation stops publication immediately; final release waits for pending source work. |
| Section identity | Pure helpers in `reader/sections.js` share existing section matching and linear-spine fallback selection. Link/footnote target resolution and iframe-local markers retain their separate contracts. |

The visual manifest and canonical page-map globals are instrumentation snapshots,
not production dependencies. The visual manifest contains publication metadata;
it is distinct from the sanitized numeric diagnostics API. There is no functional
global visual-cache export.

The page-map measurement operations live in `reader/page-map-measurement.js`.
They create the isolated unextended runtime with lifecycle integration, sample
paginated section geometry/CFIs and dispose the sandbox. Generation, fallback
and cache policy stay in the controller; the original operation order and
partial-startup cancellation handoff remain unchanged.

## Adapted vendor surface

| Boundary | Existing adaptation and reason |
| --- | --- |
| Book/rendition prototypes | Lifecycle integration wraps `renderTo`/`requireManager` and rendition hooks to own per-rendition hooks/content continuations. |
| Default/Continuous managers | Lifecycle integration owns scroll/resize/orientation listeners, display/removal hooks and final source release. Inherited classes need distinct installation markers. |
| Continuous view display | Own the pinned IframeView render/display chain, abortable iframe loading and deferred destruction; vendor teardown alone leaves partial renders unresolved. |
| Continuous structure | `createView`, `prepend`, `append`, `erase`, `clear` and view `reframe` use live synchronous layout ownership at the reading line. |
| Location/resize | Nonpaginated location reporting reads `scrolledLocation` without reformatting buffered views. Height-only resize retains live chapters; width changes retain semantic recovery. |
| Paginated visuals | Fitting adapts expansion, document/frame geometry and manager display for one-page synthetic visuals, using the injected service. |
| Compatibility layout | Late-media measurement uses owned view reframing. `MEDIA_HEIGHT_RECHECK_DELAYS_MS` retains four contents-owned fallback requests; `FRAME_HEIGHT_SYNC_DEBOUNCE_MS` retains the manager's shared trailing sweep. Replace timers/polling only with equivalent readiness coverage. |

M4a moves generation/destruction state from vendor-manager properties into
`reader/continuous-state.js`. The original transition and observation points
remain unchanged, including undefined generations before core installation and
invalidation at both teardown boundaries. Reader scopes still own actual resource
disposal. M4b moves buffer/trim bookkeeping into the same private manager record,
retaining task-identity checks, repeat-request coalescing, deadlines and the core
scheduling algorithm. M4c groups shared input suppression and the scroll reporter
privately, preserving clock choices, the 320 ms correction window, 30 ms debounce
and 650 ms recent-input trim gate. Explicit input clears suppression and native
continuation invalidates older navigation at the same points. The defensive
wrapper keeps its callable vendor fallback before core installs a reporter and
remains idempotent. Live block anchors retain their existing layout owner.

The media fallback requests remain 300/1200/2600/4200 ms after first binding,
with a 150 ms manager debounce. Captured image/SVG loads and deferred rendered
work retain their existing ownership and guards. The separate 25 ms manager
installation retry also remains unchanged. The architecture records this timing
inventory; no equivalent replacement signal or additional vendor override is
introduced by naming the deadlines.

## Owned Continuous render order

1. Create/size the view and obtain its rendered section source.
2. Check cancellation, load the iframe, check cancellation again.
3. Derive axis from writing mode/flow and publish axis/writing-mode events.
4. Format contents, install listeners and expand the frame.
5. Apply force-right geometry when required and emit rendered.
6. The owning display continuation emits displayed, invokes `onDisplayed` and
   marks the view displayed while current.

The render promise owns final cleanup. Removal must cancel observed display,
suppress late callbacks, settle iframe loading and release source after
serialization. The Firefox rejection regression verifies the complete chain;
an unobserved rejected vendor promise cannot be left behind.

## Adapter-change completion checks

Run the Node suite and full five-profile matrix. Relevant cases cover pending
section/iframe removal, startup failure/retry, repeated open/dispose, source
bounds, late media, upward scrolling, height resize, width reflow, stale resume,
image fit/zoom/return, mode changes, footnotes/links and encoded paths. Include
sandbox recovery and long-publication/cache profiles when those boundaries change.

For a vendor upgrade, inspect the actual bundle and every adapted method above
before changing the startup guard. Compare visible passages as well as saved
progress/promises. Record provider/physical-phone results and unresolved RDR-045
separately from fixtures in the release record.

## Continuous height measurement

For vertical reflowable Continuous views, the owned render path installs a
contents-local `textHeight()` measurement before initial formatting/expansion.
It retains the pinned Range measurement for overflow and includes the body's
natural box/scroll overflow in document coordinates. Compatibility reconciliation
shares this measurement. Using document scroll height as the sole measurement
would retain the iframe viewport floor and prevent genuine shrinkage; using the
Range bottom alone omits trailing body space. Paginated/horizontal/fixed-layout
contents keep vendor measurement. No bundled vendor file or timing value changes.


RDR-054/055 preserve the same structural owner and timing inventory. A tracking
line in chapter padding now selects the nearest actual visible block across the
gap. A layout transaction retains any unhandled native movement when advancing
`prevScrollTop`/`prevScrollLeft`: only its own offset changes are accounted for,
so a later scroll event can still invalidate pending resume/navigation. A new
generation discards movement from the old lifetime. Explicit owned movement APIs
and restoration suppression retain their existing ownership boundaries. Six
fallback/boundary/pending-movement controls pass across all five profiles.
