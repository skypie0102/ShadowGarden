# Whole-codebase audit — October 2026

Baseline: main `5e55290`, production v2.14.1 (`7d50991`). Reviewed 2026-10-19.
The baseline passes 224 Node tests and 432 browser cases across five profiles,
with eight existing platform skips. The audit preserves production data,
book/series identities, storage formats and accepted reader scrolling/image behavior.

## Current work and retained decisions

This table is the current work list. The original ledger and dated release
records below retain their historical counts and scope.

| Status | Boundary | Next action / retained evidence |
| --- | --- | --- |
| Completed in v2.18.12 | First Keeper CSS batch | Four base/layout/component/presentation sheets are expanded; one superseded checkbox rule is removed. All 45 PR visual comparisons match, representative captures are reviewed and production preservation is verified. See [CSS ownership and validation](KEEPER_CSS.md). |
| Completed in v2.18.13 | Remaining dense Keeper/shared/public CSS | All 21 sheets are expanded with ordered parsed CSS/comments preserved and no removals. All 95 new comparisons match; representative captures and production preservation are verified. One intact SVG URL remains long. See [stylesheet ownership](STYLESHEET_OWNERSHIP.md). |
| Completed in v2.18.13 | Upload target ownership | Confirmed target changes use the engine's reset/cancellation owner; closing retains the queue's target. Six baseline controls fail; all 23 corrected queue controls and ten browser lifecycle cases per profile pass. See [reproduction and scope](KEEPER_TARGET_CONTEXT.md). |
| Completed in v2.18.13 | Public Library loading state | Busy clears after populated/empty/error settlement; error placeholders are removed. Six dated-controller baseline/candidate controls pass in every profile. See [reproduction and scope](LIBRARY_READINESS.md). |
| Completed | Initial cross-subsystem defects and startup/access fixes | v2.15.0–v2.18.0 records retain their reproductions, fixes and acceptance scope. |
| Completed | Keeper JavaScript readability and reproduced ownership defects | v2.18.2–v2.18.11 records cover workflow/editor/upload ownership, presentation, encoded EPUB paths and queue preparation. They do not claim exhaustive coverage or an absence of further defects. |
| Completed with measured limits | Maintenance and upload budgets | v2.16.0/v2.18.8 retain bounded history/readiness and measured buffering/admission changes. Total native memory and unchanged concurrent throughput were not established. |
| Completed | Release verification and automatic publication | Existing trusted-main deployment checks source, assets, both public catalogs and production preservation. No additional login or test project is required by that workflow. |
| Retained compatibility decision | Revision headers | Current Keeper forms send displayed revisions. Legacy writes retain their documented optional-header contract; making headers mandatory needs an explicit migration/deprecation decision. |
| Retained acceptance limits | Browser storage, platform skips and physical/provider checks | Grouped writes do not provide crash atomicity/cross-tab isolation. Existing conditional skips and historical Android/Soul/owner acceptance keep their dated scope. |

## Coverage and method

The baseline has 100 first-party frontend JavaScript files, 39 stylesheets,
11 server modules, 15 Pages entry points and nine operational scripts. The review
covers public pages/navigation/access, domain/persistence services, reader startup,
lifecycle/navigation/cache/vendor boundaries, Keeper/session/upload/maintenance,
backend authorization/media/catalog/cleanup, schema transactions, accessibility,
asset/build/release guards, dependencies and test gaps.

This is a cross-subsystem source and contract review, followed by reproductions;
it is not a claim that every third-party source line was independently audited or
that passing tests prove the absence of bugs. Pinned vendor distributions retain
provenance and integration coverage. npm audit covers the development dependency
graph, not browser-vendored EPUB.js/JSZip. Live data is never seeded, migrated,
restored or edited as part of this review, and no book objects are created/deleted.

Workers APIs/configuration were checked against [Cloudflare best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
and current published Workers type definitions retrieved on 2026-10-19.
No compatibility date, production binding, secret or storage format is changed.

## Implemented corrections

| ID | Boundary | Reproduced problem and correction | Evidence |
| --- | --- | --- | --- |
| A01 | Keeper session | Locking left a disabled unlock button/completed widget, and late successful requests could escape the locked session. Lock resets widget/button state; session generations reject late results and abort owned requests. Old auth callbacks cannot reopen the interface. | Failing-before late-response control and lock/unlock browser cycle |
| A02 | Keeper uploads | Retrying a cover reused a successful or failed-reserved immutable coordinate. Every attempt now receives a fresh opaque key; logical mappings update only after success. | Two controls use the real upload handler, SQLite reservations and a disposable provider |
| A03 | Public/reader routes | Moving a series preserved its ID but routing used the old ID prefix. Explicit scope travels through links; catalog lookup resolves old links in either shelf; current scope owns themes, acknowledgement, reader return, next/restart links and Read Again. | Both move directions fail before; original IDs, old links and pre-EPUB acknowledgement verified |
| A04 | Protected fetch | Rewriting an opaque Request into a string lost method, headers and cancellation. Preserve Request options and reject already-aborted input before authorization. | HEAD/Range/credentials/signal and early-cancellation controls fail before |
| A05 | Provider resources | Discarded authorization, missing-object and error responses left bodies open. Cancel unused streams without replacing the intended provider error when cleanup itself fails. | 401/404/500 stream-cancellation controls fail before |
| A06 | Catalog source | Source configuration failure silently selected archived bundled catalogs. Fail explicitly and allow retry; bundled catalogs require explicit local configuration. | HTTP failure/retry and invalid/local configuration controls; browser asserts no archive request |
| A07 | Bookmarks | Failed writes still announced success; deleting a stale row could remove another tab's new bookmark by index. Respect save results and delete the displayed bookmark's identity. | Three failing-before storage/concurrent-tab controls |
| A08 | Accessibility | A second observer marked Series ready while the loading skeleton remained. Remove the observer; initial HTML and the Series controller exclusively own aria-busy. | Delayed-catalog browser control fails before |
| A09 | Keeper API | HTTP-200 HTML/malformed JSON became a successful empty result and could clear the UI. Reject invalid successful response bodies. | Failing-before API-response control |
| A10 | Backend work | Media lookup rebuilt the entire active-book set for each mapping; health used indexOf for each volume. Build the set once and iterate volume indices directly. | Existing access/health contract tests; no claim of a measured speedup |
| A11 | Toolchain | Wrangler 4.136.3's development graph contained affected sharp/undici dependencies. Pin 4.151.1 and validate the same binding-aware build. npm audit now reports zero advisories. | Lockfile, dependency report, full build/CI |
| A12 | Age gate startup | Enter was clickable before deferred Library imports installed its handler, losing an early mobile tap. Keep the button disabled until the handler is ready. | Mobile trace reproduces the missed tap; delayed-module browser check covers startup and return |

The sharp advisory is [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w);
the undici findings include [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3).
These findings concern development tooling; this review does not claim a production
exploit. The compatibility date stays 2026-09-23. Obsolete reconstruction wording in
live database/size errors is also removed without changing error codes or contracts.

## Structural review results

| Area | Retained boundary / result |
| --- | --- |
| Public catalog/domain | Shared escaping, translation normalization, identities and storage helpers remain. Current shelf scope is metadata; prefixes are compatibility hints. Live source errors never select archives. |
| Keeper | One API client owns request timeout/session rejection and revision bookkeeping. Editor revisions remain tied to displayed data. Explicit upload events and preflight remain intact. |
| Reader | Existing extension order, navigation ownership, source leases, cache budgets and cleanup scopes remain. Changes are limited to catalog context/return links, transport fidelity and bookmark persistence; layout/scroll/image gestures are unchanged. |
| Backend | HMAC verification, Turnstile action/hostname checks, origin checks, scoped credentials and public metadata stripping remain. Provider endpoint/redirect restrictions are retained. |
| D1/cleanup | Revision transactions, checksummed safety snapshots, immutable objects, upload reservations and retirement/reference triggers remain. Existing race/recovery/purge tests are required. |
| UI/accessibility | Existing main/adult themes and responsive controls remain; loading state now has one owner. Browser coverage includes real public/controller markup, not only unit mocks. |
| Tooling | Asset/provenance audit, exact package pins, isolated local D1 harness and actual Functions binding checks remain. New deliberate recovered-file changes are individually listed in the audit script. |

## Original follow-up ledger

This is the original ordered ledger with its release updates. Use the current
table above for outstanding work; older "follow-up" wording in dated records
does not reopen work completed by a later release.

1. **Maintenance budgets — completed in v2.16.0:** ten-summary history pages
   inspect one document at a time; readiness has a 20-second request deadline.
   The 205-snapshot fixture reads 95% fewer first-page document bytes, and stalled
   provider/authentication tests preserve unverified outcomes. See [measurements
   and release](MAINTENANCE_BUDGETS.md).
2. **Large-upload memory — v2.18.8 continuation deployed:** the real workerd upload
   pipeline validates/transfers exact 50 MiB fixtures and rejects one byte above
   the limit before provider access/reservation. The original v2.16.1 correction
   copied declared-length input into one destination. The
   [v2.18.8 continuation](UPLOAD_BUFFER_BUDGET.md) adds a growable unknown-length
   reader, a 64 MiB per-isolate admission budget and input cancellation/deadline
   handling. Single unknown-length 50 MiB input samples 104.01 → 57.08 MiB of
   backing storage. A second large input receives retryable 503; unknown 50 MiB
   plus declared 14 MiB still succeeds together. File-size limits remain unchanged.
   Twelve controls reproduce nine failures before correction; all 424 Node tests
   and 666 browser cases pass in PR/main CI. Production preservation is verified.
   These samples do not bound total runtime/native memory or establish unchanged
   concurrent throughput. Historical [measurements](UPLOAD_MEMORY.md) are retained.
3. **Browser persistence — deployed in v2.17.0:** progress/bookmark aliases, Finished
   map/markers and settings use checked grouped writes with conditional rollback.
   Public/startup Read Again resets progress and Finished state together. Eight
   baseline controls reproduce partial writes or false success; all 285 Node
   tests and 492 browser cases pass, including reload, concurrency and rollback
   refusal. Existing formats/identities
   remain. This does not provide crash atomicity or cross-tab isolation; see
   [contracts and limits](BROWSER_PERSISTENCE.md).
4. **Compatibility transport — deployed in v2.17.1:** the
   consumer map confirms that pinned EPUB.js uses XHR after session authorization,
   while the visual scanner needs explicit protected fetch. The scanner now calls
   `ShadowGardenBookAccess.fetch`; global fetch remains native. Request options,
   cancellation and existing cookie/download behavior are retained. See
   [the map and validation](PROTECTED_SOURCE_TRANSPORT.md).
5. **Maintenance consistency — compatibility review completed:** current Keeper
   forms send displayed revisions; legacy catalog/maintenance writes still accept
   missing headers. Purge/recovery require them. Backend fixtures exercise that
   legacy contract, and no complete external-client inventory establishes safe
   removal. Retain it and document the endpoint/action matrix; a mandatory-header
   migration remains a deliberate version/deprecation decision. See
   [revision compatibility](API_CONTRACTS.md#revision-header-compatibility).
6. **Release operations — implemented:** a read-only plugin-compatible collector
   records exact D1 serialization and snapshot checksums without encrypted values.
   The production verifier rejects stale/invalid baselines, configuration drift,
   incorrect canonical catalogs, bad HTTP/JSON, wrong version/source and changed
   served JS/CSS bytes. Bundle and actual-deployment validation now check the
   compatibility date/flag set. Live v2.17.1 checks pass with unchanged revision 9,
   nine snapshots and settings. See [procedure and limits](PRODUCTION_VERIFIER.md).
7. **Accessibility — Garden Pass completed in v2.18.0; readability remains:**
   a failing-before background-focus control supports native modal containment,
   Cancel/parent Escape and focus restoration. Closed-shadow remote-frame tests
   retain an ordinary-page control and one conditional Firefox traversal skip;
   the other modal checks run in every profile. Format remaining dense recovered
   modules in small, reviewable batches. The [public-controller batch](PUBLIC_READABILITY.md)
   is merged for v2.18.1 through PR #39 with seven formatted modules, equivalent
   executable syntax trees, 305 Node tests and 541 browser passes (nine existing
   documented skips). The batch is deployed in v2.18.1 through the checked
   [automatic production workflow](AUTO_DEPLOYMENT.md), activated on 2026-10-22. See [public boundaries](PUBLIC_BOUNDARIES.md) for the
   accessibility release.
8. **Website module startup — completed in v2.18.0:** five independent Library
   imports start together, with controller initialization order retained and
   canonical public module URLs. The 24-sample controlled profile changes 29 to
   26 script requests and removes three duplicate paths. Artificial 80 ms per-JS
   response delay lowers median readiness from about 0.95 s to 0.38–0.41 s.
   These are fixture measurements, not production/mobile Core Web Vitals or a
   universal speedup claim. [Raw timings and limits](PUBLIC_BOUNDARIES.md#startup-measurement-and-change)
   are retained.

These are scoped engineering follow-ups, not demonstrated current production
outages. Avoid broad rewrites, arbitrary sleeps and replacing accepted EPUB.js
compatibility behavior without a failing reproduction.

The [Keeper data/maintenance readability batch](KEEPER_WORKFLOWS.md) ships
in **v2.18.2** through [PR #41](https://github.com/skypie0102/ShadowGarden/pull/41):
seven expanded controllers and a reproduced banner-editor race corrected with
per-opening ownership. Six baseline controls fail; all seven focused cases pass.
Final PR and main CI pass 325 Node tests and 551 browser cases across five
profiles, with nine documented skips and zero test retries. The shared core/upload follow-up is recorded below; provider/physical-device
acceptance retains its recorded scope.

The [Keeper core/Upload batch](KEEPER_CORE_UPLOAD.md) ships in **v2.18.3**
through [PR #42](https://github.com/skypie0102/ShadowGarden/pull/42): eight
expanded modules and a reproduced explicit-Skip queue correction. Three baseline
controls fail; all seven focused controls pass. Final PR and main CI pass 332
Node tests and 556 browser cases across five profiles, with nine documented
skips and zero test retries. The UI/session follow-up is recorded below;
unknown-length/concurrent upload memory budgeting remains a separate design
follow-up.

The [Keeper UI/session batch](KEEPER_UI_SESSION.md) ships in **v2.18.4** through
[PR #44](https://github.com/skypie0102/ShadowGarden/pull/44): five expanded modules
and reproduced editor/upload ownership corrections. Eleven baseline controls fail;
all 30 focused controls pass. Final PR and main CI pass 348 Node tests and 581
browser cases, with nine documented platform skips and zero test retries.

The [Keeper volume/translation batch](KEEPER_VOLUME_OWNERSHIP.md) ships in
**v2.18.5** through [PR #45](https://github.com/skypie0102/ShadowGarden/pull/45).
It corrects late volume/translation/Trash responses and series-draft replacement.
Thirty-two baseline controls fail; all 41 focused controls pass.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39905484804) and [checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39906804272)
both pass **389 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All eleven new Keeper
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 636 browser cases.

The latest production release is **v2.18.13**, deployed on 2026-10-24 from
`8d500eb` through [PR #53](https://github.com/skypie0102/ShadowGarden/pull/53).
[Upload target ownership](KEEPER_TARGET_CONTEXT.md) uses the engine's reset/
cancellation owner and retains the queue's target while its dialog is closed.
Six baseline controls fail; all 23 corrected queue controls pass.
[Stylesheet ownership](STYLESHEET_OWNERSHIP.md) expands 21 remaining dense Keeper/
shared/public sheets with ordered parsed CSS/comments preserved and no removals.
Long lines decrease from 147 to one intact SVG URL.
[Library readiness](LIBRARY_READINESS.md) clears busy after populated, empty or
failed catalog loads and removes stale failure placeholders.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40065545158) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40066899682) both pass
**471 Node tests** and **821 browser cases** across five profiles, with nine
documented platform skips and zero test retries. All five new CSS cases, ten
queue-lifecycle cases and six Library readiness cases pass in every profile.
The separate Chromium Library-startup profile passes on the PR and is excluded
from the 821 cases.

All **95 new same-DOM comparisons** match decoded RGBA pixels and computed-style/
geometry hashes, including the served/restored candidate control. All 21 changed
sheets are loaded across each profile's compared states. Six representative
desktop/mobile captures were visually reviewed. Settled frames and the recorded
default/349/761 widths define this scope; no exhaustive viewport, animation-frame
or resize-transition equivalence is claimed.

The workflow publishes **v2.18.13**, source `8d500eb`, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
Publication completes in one attempt; the version check uses one request over
204 ms. All **27 production checks** pass: canonical source/version,
both D1-derived catalogs and all 24 changed CSS/JavaScript assets. The exact
revision-9 catalog document, all 9 snapshots and recorded settings remain
unchanged, with zero database writes. The retained v2.18.12 rollback is
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786`.
See [verification evidence](keeper-target-stylesheets-verification.json).

The interrupted independent checks were completed after the workspace was
restored. Public HTTP reads confirm v2.18.13/source `8d500eb` and exact bytes for
all 24 changed assets. The downloaded production artifact matches the sanitized
logged report and GitHub's SHA-256 archive digest. The follow-up results and the
original publication/rollback records are retained in the verification evidence.

The preceding [v2.18.12 CSS release](KEEPER_CSS.md) expands four base/layout/
component/presentation sheets and removes two superseded checkbox declarations.
Its [dated evidence](keeper-css-verification.json) retains 463 Node tests, 746
browser passes, 45 visual comparisons and production preservation.

This completes the remaining dense Keeper/shared/public CSS batch and the
controlled target-switch investigation/correction. The public Library loading
defect found by those checks is also corrected. Earlier releases retain their
dated scope; no complete Keeper/reader or physical/provider acceptance claim is
made.

## Validation and release

Merged through [PR #32](https://github.com/skypie0102/ShadowGarden/pull/32) as
`5718ace6b63fece04794561fa2d988410a6ae366`; its tree exactly matches tested source `c8382bfd14f5cce03422f06f291ca66d909a9564`.
[Final CI](https://github.com/skypie0102/ShadowGarden/actions/runs/39226860643) passes on attempt 1 with zero test retries:

- Asset/provenance audit, 240 Node tests, static build and binding-aware Functions package.
- 462 browser passes across desktop/mobile Chromium, Firefox and desktop/mobile
  WebKit, with eight existing platform skips.
- 32 focused local Chromium cases, plus four follow-up completion-link cases.
- Wrangler 4.151.1, zero npm audit vulnerabilities; compatibility date/flags verified.

Production **v2.15.0** is deployed as `710c6175-587f-40ff-899b-94b5c33e5be5` at
`2026-10-19T09:15:01.580677Z`. Sixteen live browser cases exercise the deployed
reader/public controllers with original disposable EPUBs, intercepted catalog/
authorization responses and isolated browser storage. They cover moves in both
directions, old links, age acknowledgement before EPUB fetch, delayed gate startup,
loading accessibility, source outages, double image activation and zoom/X return.
Served-file hashes match the built merge; public challenges, unauthorized admin,
raw EPUB denial and missing-cover behavior pass.

Both live catalogs retain their exact hashes. The refreshed D1 document and all
eight snapshots are exactly unchanged at revision 8. Actual/saved bindings, nine
encrypted setting names/types and compatibility settings match the pre-deploy
baseline. No database, book-object or credential writes were performed.
[Machine-readable evidence](codebase-release-2.15.0.json) records IDs, hashes,
profile counts, rollback and verification corrections. The initial new WebKit
assertion was changed to await the same asynchronous completion-link value; the
served-file probe uses Pages' canonical extensionless URLs. These harness
corrections are separate from application defects.

Earlier physical Android/Soul and owner Keeper acceptance retain their recorded
release scope. This rollout does not claim new physical acceptance or a completed
real CAPTCHA/credential flow. Maintenance budgets are completed in v2.16.0.
The measured upload increment is merged through PR #34 with 259 Node tests and
477 browser passes; [its verification](UPLOAD_MEMORY.md#validation-and-release)
records the measurement scope. Browser persistence is merged through PR #35;
[its report](BROWSER_PERSISTENCE.md) records 285 Node tests, 492 browser passes
and rollback limits. Both increments are live in v2.17.0, deployment
`f86f42ef-b710-40f8-bf6a-011c47b875e5`, clean source `129a1d2`, on 2026-10-20.
Live catalogs match D1, seven changed modules match the build, and the exact
production document, eight snapshots and configuration are unchanged. The existing
plugin supplied a valid upload token; [local asset requests](PAGES_UPLOAD_TRANSPORT.md)
completed the upload without another sign-in.

Compatibility transport is merged through PR #36 as `01b57f9` and deployed in
v2.17.1, `39c54372-231f-4a6d-880b-48f1a3710b57`, on 2026-10-20. All 293 Node tests
and 502 browser cases pass on attempt 1, with eight existing skips and no retries.
The two changed modules match the build; both catalogs match D1 and both Library
footers show the release. A fresh revision-9 baseline with nine snapshots is
exactly unchanged after publication, as are actual/saved production settings.
[The transport report](PROTECTED_SOURCE_TRANSPORT.md) and
[machine-readable evidence](protected-source-verification-2.17.1.json) retain the
consumer map, Request/cancellation contracts and acceptance limits. At that
release, the remaining ordered follow-ups covered scoped readability, Garden
Pass keyboard focus, module startup and broader upload buffering. Later release
records and the current table above supersede that historical work list;
mandatory revision headers remain a compatibility/deprecation decision.


The release-operations continuation adds twelve regression cases (305 Node tests
in total), with negative controls for stale/invalid baselines, configuration and
source drift, incorrect HTTP/JSON/catalogs, response bounds and unsafe asset paths.
The application source/version is unchanged; this is tooling/documentation work
and does not require a new production deployment. The read-only live report
[records verification](production-tooling-verification.json) against v2.17.1.

[PR #37](https://github.com/skypie0102/ShadowGarden/pull/37) merges this tooling as
`75b6eb7`; the merge tree exactly matches tested source `e1903ea`.
[CI](https://github.com/skypie0102/ShadowGarden/actions/runs/39412104343) passes
305 Node tests and 502 browser cases, with eight existing skips, on attempt 1
and no test retries. [The verifier report](PRODUCTION_VERIFIER.md#validation--2026-10-20)
records the profile counts, exact source/tree and live read-only scope.
