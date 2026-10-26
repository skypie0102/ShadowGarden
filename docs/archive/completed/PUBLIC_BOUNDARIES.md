# Public access and module startup — v2.18.0

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

[PR #38](https://github.com/skypie0102/ShadowGarden/pull/38) merged as
`8e34cedee712385103ee0116ca21f365b1c7e72d`. Production deployment
`8c87a0ed-acf5-4083-a305-c9f5988f8da1` succeeded on 2026-10-20 at
14:13:02 UTC. This increment addresses audit follow-ups 7 and 8: Garden Pass
focus containment and measured public module startup. General readability work
and the other explicitly deferred audit items remain open.

## Garden Pass ownership

The former ARIA-only overlay allowed a background navigation control to receive
focus while the challenge was open. The failing-before control reproduced that
problem across all five browser profiles. `public/garden-pass.js` now creates a
native `dialog` and calls `showModal()`. The browser makes the background inert,
including at the closed-shadow/cross-origin boundary used by the provider widget.
The existing midnight/rose presentation remains in `garden-pass.css`.

Cancel receives initial focus. Cancel clicks, parent-document Escape and native
cancel events share one dismissal path. Completion, cancellation and widget-render
failure remove the widget, close/remove the dialog and restore the prior focus
without scrolling. The existing verification service still owns server-side
Turnstile validation and session policy. No page-wide tabindex rewriting, custom
focus trap or production browser detection is introduced.

Five regression cases cover background focus/Cancel, provider-frame keyboard
traversal, parent Escape, successful cleanup and widget-render failure. A disposable
cross-origin iframe inside a closed shadow root exercises the observed widget
boundary. Tests mock the provider only in isolated fixtures; they do not complete
or bypass a real CAPTCHA. Keyboard events inside a remote frame belong to that
document; parent Escape is tested from the initial Cancel control, separately
from Cancel after clicking the frame.

The separate traversal case first runs the identical frame on an ordinary page.
Pinned Firefox 155 reports no widget Tab targets there either; only that case is
conditionally skipped when this control fails. Background focus, Cancel, parent
Escape, success and render-error cases remain required in Firefox. Chromium and
WebKit traverse both widget controls in both contexts. The exact cause of the
Firefox control result is unresolved and may involve the test environment.
[Mozilla bug 2037565](https://bugzilla.mozilla.org/show_bug.cgi?id=2037565) concerns
a related remote-frame/shadow-focus boundary but is marked fixed in Firefox 152;
it does not establish the cause of this later pinned-browser result.

Relevant contracts: [HTML modal dialogs and inert subtrees](https://html.spec.whatwg.org/multipage/interaction.html#modal-dialogs-and-inert-subtrees),
[W3C modal dialog keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
and [Turnstile widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/).

## Startup measurement and change

Library previously awaited five independent imports in sequence. It now starts
them with `Promise.all`, then installs controllers, preferences and events before
loading the catalog, in the same initialization order. Public entry points use
canonical unversioned module URLs. This removes duplicate instances of
`domain/index.js`, `library-model.js` and `public/volume-actions.js`. Series keeps
its existing lazy render order. JS/CSS cache revalidation and storage formats stay
as before.

The [raw profile](../evidence/library-startup-profile-2.18.0.json) contains 24 samples and source
hashes: three fresh contexts per variant, shelf and response delay, with interleaved
source order, a disposable one-series catalog and a 1280×900 Chromium viewport.
Readiness means insertion of the first fixture catalog card. The baseline is
`0044174`; the profiled CI checkout `a9f4fdf` has the same tree as tested PR head
`2829481` and merged source `8e34ced`. The pretty raw report SHA-256 is
`f48b88116d0cf6d83353a609ab163f8871798f720e6dbf80389060f73e3f669e`.

| Shelf | Artificial delay per JS response | Baseline median | Current median |
| --- | ---: | ---: | ---: |
| Main | 0 ms | 191.5 ms | 165.0 ms |
| Adult | 0 ms | 178.3 ms | 161.9 ms |
| Main | 80 ms | 945.0 ms | 409.1 ms |
| Adult | 80 ms | 948.0 ms | 378.0 ms |

Every sample changes 29 to 26 script requests and three to zero duplicate paths.
The 80 ms condition improves median readiness by 535.9 ms (Main) and 570.0 ms
(Adult). This artificial response delay is not realistic network/CPU/mobile
emulation, a production Core Web Vitals result or a reader performance claim.
Earlier zero-delay candidate samples were mixed, so a universal speedup is not
claimed. `npm run profile:library` retains the reproducible fixture and raw CI
artifact. Its compressed text-log payload also preserves the raw report when the
artifact download transport is unavailable.

## Validation and production

[CI run 39434636935](https://github.com/skypie0102/ShadowGarden/actions/runs/39434636935)
passes on attempt 1 with no test retries. The tested and merged tree is
`621b3cece20cb82fb3cd50c473899fcd9ba5cbb3`.

| Check | Result |
| --- | --- |
| Asset audit, Node suite, static and binding-aware Worker build | Passed; 305 Node tests |
| Desktop Chromium | 110 passed, 0 skipped |
| Mobile Chromium | 110 passed, 0 skipped |
| Firefox | 107 passed, 3 skipped |
| Desktop WebKit | 108 passed, 2 skipped |
| Mobile WebKit | 106 passed, 4 skipped |
| Separate startup profile | Passed; 24 measured samples |

The browser total is 541 passes and nine skips: eight prior platform skips and
the one narrowly controlled Firefox traversal case above. Local browser/workerd
execution was blocked by this host's socket restrictions; executable browser
validation came from CI.

The 2026-10-20 release checks compared a fresh pre-deploy baseline at 14:10:15 UTC
with post-deploy reads, last checked at 14:20:54 UTC. Revision 9, the exact catalog
serialization/timestamp, nine snapshot identities/checksums, actual/saved bindings,
compatibility settings and encrypted-setting names/types were unchanged. Document
SHA-256 was `56a5763ce9c4a166ffcf32ce5229b19444235d1bbfbf80fd162efa6a8a6b73f2`.
No production catalog, snapshot, book-object, credential or migration writes were
performed. The retained rollback is v2.17.1 deployment
`39c54372-231f-4a6d-880b-48f1a3710b57`.

The maintained production verifier passed ten checks: version/source, both catalogs
against D1 and exact bytes/types of six changed JS files plus Garden Pass CSS.
Live browser inspection confirmed both Library footers, the genuine modal and
initial Cancel focus, retained palette and parent Escape removal. The Adult age
warning was not acknowledged and no real CAPTCHA was completed. A background-tab
screenshot initially captured a different tab's gate; the matching foreground tab
and its DOM resolved the capture mismatch. It was not treated as an app defect.
Earlier owner acceptance on Android/Soul and Keeper retains its original release
scope; this release does not claim new physical-device or credentialed acceptance.

On resumption on 2026-10-21, the transient checkout had restored an older checkpoint.
The merged source and exact raw profile were recovered from GitHub and CI logs.
Fresh public HTTP checks again confirm v2.18.0/`8e34ced`, both catalogs, seven exact
changed assets, configured challenge endpoints and unauthenticated Keeper denial.
The Cloudflare connector's search and execution calls returned internal errors,
so D1/configuration reads were not repeated that day. The dated preservation result
above is retained as the prior session's release record, not presented as a new
database comparison. The private raw baselines did not survive the restored local
checkpoint. [Sanitized evidence](../evidence/public-boundaries-verification-2.18.0.json) clearly
separates recovered CI, prior release observations and fresh public HTTP results.
