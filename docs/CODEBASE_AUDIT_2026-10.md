# Whole-codebase audit — October 2026

Baseline: main `5e55290`, production v2.14.1 (`7d50991`). Reviewed 2026-10-19.
The baseline passes 224 Node tests and 432 browser cases across five profiles,
with eight existing platform skips. The audit preserves production data,
book/series identities, storage formats and accepted reader scrolling/image behavior.

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

## Audit follow-ups, ordered

1. **Maintenance budgets — completed in v2.16.0:** ten-summary history pages
   inspect one document at a time; readiness has a 20-second request deadline.
   The 205-snapshot fixture reads 95% fewer first-page document bytes, and stalled
   provider/authentication tests preserve unverified outcomes. See [measurements
   and release](MAINTENANCE_BUDGETS.md).
2. **Large-upload memory — profiled; v2.16.1 increment deployed in v2.17.0:** the real workerd upload
   pipeline validates/transfers exact 50 MiB fixtures and rejects one byte above
   the limit before provider access/reservation. Declared-length input now copies
   into one destination, reducing sampled 50 MiB backing storage from about
   100.27 MiB to 52.21 MiB (47.9%). Unknown-length/concurrent buffering remains a separate
   design follow-up; the supported limits are unchanged. See [measurements and
   limitations](UPLOAD_MEMORY.md).
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
7. **Readability/accessibility:** format remaining dense recovered modules in
   reviewable batches. Review Garden Pass keyboard focus containment with the
   real third-party iframe before changing dialog mechanics.

8. **Website module startup:** measure the serial dynamic-import waterfall and
   duplicate versioned/unversioned module requests. Evaluate parallel loading and
   consistent module URLs while preserving initialization order and shared state.
   The live proxy trace identifies a startup sensitivity, not a measured production
   performance regression; profile realistic network conditions before changing it.

These are scoped engineering follow-ups, not demonstrated current production
outages. Avoid broad rewrites, arbitrary sleeps and replacing accepted EPUB.js
compatibility behavior without a failing reproduction.

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
consumer map, Request/cancellation contracts and acceptance limits. The remaining
ordered follow-ups now cover scoped readability, Garden Pass keyboard focus
and measured module startup; legacy mandatory-header migration and broader
upload buffering remain explicit design follow-ups.


The release-operations continuation adds twelve regression cases (305 Node tests
in total), with negative controls for stale/invalid baselines, configuration and
source drift, incorrect HTTP/JSON/catalogs, response bounds and unsafe asset paths.
The application source/version is unchanged; this is tooling/documentation work
and does not require a new production deployment. The read-only live report
[records verification](production-tooling-verification.json) against v2.17.1.
