# Protected EPUB source transport

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

The v2.17.1 audit increment removes the global `window.fetch` override from
`book-access.js`. The visual scanner explicitly calls
`ShadowGardenBookAccess.fetch(input, init)`. The bundled EPUB.js runtime and its
archive decoder are unchanged.

## Consumer map

The map is based on the pinned local bundle, not another EPUB.js release.

| Consumer | Transport and authorization owner |
| --- | --- |
| Visual-page archive scan | The explicit book-access fetch resolves opaque identities or authorizes legacy media paths before the native fetch. |
| Main EPUB.js archive open | The vendor's `Book.open()` requests `binary` through its XMLHttpRequest helper, after `createAuthorizedBookSession()` has awaited the initial ticket and its path-scoped cookie. |
| Isolated page-map archive open | The sandbox's own EPUB.js runtime uses XMLHttpRequest after session authorization. It never inherited the parent window's fetch override. |
| EPUB package, sections, navigation and embedded resources | An opened archive uses `archive.request()` / JSZip for its entries. Reader extensions retain their existing source leases and disposal. |
| Downloads | `book-access.js` explicitly resolves a ticket and follows its signed URL. The download event handler and bypass marker are unchanged. |
| Catalogs, version metadata and Keeper requests | These keep native fetch. They were not protected-EPUB consumers. |

The backend issues the existing path-scoped book cookie when it returns a
ticket. Removing the global fetch override does not alter that cookie, signed
URL, session renewal, vendor request parser or archive loading order. A future
vendor upgrade must recheck this map before changing request injection.

## Explicit fetch contract

`ShadowGardenBookAccess.fetch` accepts the same input/init forms as the removed
compatibility hook. Opaque same-origin book URLs resolve to the authorized raw
source path. Legacy same-origin unsigned EPUB paths authorize first, then retain
the caller's original URL and query. Already signed, cross-origin and unrelated
requests pass through without book authorization.

Request rewriting preserves method, headers, credentials, cache, redirect,
referrer, integrity, keepalive, body and signal, including init overrides. A
protected request checks cancellation before requesting a ticket and again after
authorization, so a cancelled caller cannot start a later EPUB fetch. The shared
ticket request can still finish and populate the existing ticket cache; this
increment does not make authorization itself caller-cancellable or coalesce
concurrent uncached ticket requests.

Visual cache keys, storage identities, source URLs and existing release/cancellation
ownership remain unchanged. No vendor file, request-method adapter, layout,
scrolling, image gesture, access rule or storage format changes.

## Validation

The before/after control shows that v2.17.0 replaced global fetch and exposed no
explicit fetch API; the updated code leaves the original function intact and
exposes the explicit method. Ten focused Node cases cover the transport contract,
including authorization denial, cancellation during authorization, encoded legacy
paths, ticket reuse and Request body transfer. The complete local check passes
293 Node tests, asset/provenance validation, the static build and compiled
Functions binding checks.

Two browser cases exercise opaque and legacy URLs through real production
startup and EPUB.js, observing the explicit visual fetch, main-reader XHR and
isolated page-map XHR. They check the visual manifest, completed page map, intact
global fetch and absence of page errors. All ten profile/case combinations pass.
[CI run 39355776707](https://github.com/skypie0102/ShadowGarden/actions/runs/39355776707)
passes on attempt 1 with zero automatic test retries:

| Profile | Passed | Existing skips |
| --- | ---: | ---: |
| Desktop Chromium | 102 | 0 |
| Mobile Chromium | 102 | 0 |
| Desktop Firefox | 100 | 2 |
| Desktop WebKit | 100 | 2 |
| Mobile WebKit | 98 | 4 |

The total is 502 browser passes and eight existing platform skips, alongside all
293 Node tests. Tested source `ef1625ef204454317308e9e0008e7de1570ffc18` and merge
`01b57f9f3586839a48c56969799d897bcedf0b64` have the identical tree
`1023da0730bcdc52d80a4773494f04ddbf57ea32`.

## Production release

**v2.17.1** is deployed on 2026-10-20 as
`39c54372-231f-4a6d-880b-48f1a3710b57`, clean main source `01b57f9`.
Both changed static modules match the built source, both public catalogs match
D1, both Library footers show the new release, challenge configuration responds
and unauthenticated Keeper access returns 401. The Adult content warning remains
visible; no acknowledgement was submitted.

The baseline was refreshed immediately before publication: revision 9, the
exact document and all nine snapshots/checksums are unchanged afterward.
Actual/saved D1, bucket, compatibility and encrypted-setting metadata also match.
The existing plugin supplied the short-lived token to the local asset helper;
three changed assets uploaded, with all 164 unique hashes revalidated. No new
sign-in, production database, book-object, credential or configuration writes
were required. The rollback target is v2.17.0 deployment
`f86f42ef-b710-40f8-bf6a-011c47b875e5`.

This release adds no physical Android/Soul, owner Keeper, live CAPTCHA or
authenticated real-book acceptance claim. CI browser publications and provider
responses are disposable fixtures. [Machine-readable evidence](../evidence/protected-source-verification-2.17.1.json)
records the release, CI matrix, before/after baseline and live checks. The
[whole-codebase audit](../audits/CODEBASE_AUDIT_2026-10.md) retains the maintenance-consistency
and release-verifier tasks.
