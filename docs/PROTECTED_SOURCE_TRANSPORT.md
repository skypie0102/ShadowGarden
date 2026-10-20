# Protected EPUB source transport

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
global fetch and absence of page errors. The full five-profile CI matrix and
production publication must pass before this increment is marked deployed.

The last verified production release is v2.17.0. The [whole-codebase audit](CODEBASE_AUDIT_2026-10.md)
retains the next maintenance-consistency and release-verifier tasks.
