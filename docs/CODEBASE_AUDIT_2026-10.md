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
2. **Large-upload memory:** profile the published 50 MiB limit under workerd. The
   bounded byte reader concatenates chunks before ZIP validation and hashing;
   avoid changing the supported limit without measured memory evidence and a
   compatible upload/validation design.
3. **Browser persistence transactions:** progress/Finished/bookmark alias writes
   span multiple localStorage keys. A quota/security failure can leave only part
   of an update committed. Design rollback/canonical-write semantics separately;
   this audit fixes false bookmark success reports, not multi-key atomicity.
4. **Compatibility transport:** map remaining vendor consumers before replacing
   the global protected-fetch compatibility hook with explicit authorized-source
   transport. The present correction preserves its Request contract.
5. **Maintenance consistency:** consider mandatory If-Match on all legacy admin
   mutations after checking external-client compatibility. Current UI clients
   retain their existing revision checks; purge/recovery still require them.
6. **Release operations:** commit a read-only production verifier with canonical
   catalog URLs, strict HTTP/JSON baseline validation and served-source checks;
   add compatibility-date/flag checks to pre-publish bundle validation. Current
   rollout still compares actual/saved configuration and refreshed D1 before/after.
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
real CAPTCHA/credential flow. Maintenance budgets are completed in v2.16.0;
the other ordered follow-ups above remain open.
