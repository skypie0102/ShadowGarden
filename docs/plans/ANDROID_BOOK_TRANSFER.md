# Android signed-book transfer foundation

An internal transfer component accepts a server-issued book ticket and streams
the response into the checked [private book store](ANDROID_BOOK_STORAGE.md).
It is not connected to a user interface, ticket acquisition or Garden Pass.
There is no background queue, transfer-progress UI or automatic ticket renewal.
Users cannot yet download or read books in the app.

The caller supplies the expected catalog book ID, a ticket containing the same
ID, the server's relative signed URL and expiry in Unix seconds, and optionally
an independently trusted edition fingerprint. The component rejects expired or
mismatched tickets and URLs outside the fixed site's protected book-path format.
It does not validate the ticket's signature or independently bind its path to
the supplied book ID; the future ticket provider must obtain the response from
the trusted same-origin server and check its ID. The server remains responsible
for ticket signature, scope, expiry, active-catalog and access checks. Ticket
values are kept in memory, omitted from object and error messages, and must not
be logged or included in backups.

The client uses platform HTTPS, bounded timeouts, no cookie jar, no HTTP cache,
no automatic redirects or retry, and requests an identity-encoded EPUB response.
Only a full 200 response with the expected media type is accepted. A 403 is
reported separately so a future access flow can renew the ticket; 404 and other
failures are also reported without including the signed URL. Body length, when
known, is checked; private storage enforces the 50 MiB limit, the optional
trusted fingerprint and a bounded ZIP structure check before replacing any
existing copy. A locally computed fingerprint alone cannot prove completeness or
content authenticity. A coroutine cancellation cancels the HTTP call and is
checked during storage; cancellation racing the final file rename cannot undo a
replacement that has already committed. A future download manager must report
that outcome and coordinate concurrent operations and app lifecycle.

Before release, integrate Garden Pass and ticket issuance, handle session expiry
and bounded renewal, background work and progress, verify EPUB compatibility
with the chosen reader, and test real network interruption, storage exhaustion,
physical devices and the live protected flow with authorized test content. The
component does not share browser progress or carry Keeper credentials.

## Verification

Local JVM tests use synthetic OkHttp responses to cover ticket/path rejection,
HTTP failures, media type, content length, oversized and unknown-length bodies,
invalid EPUBs, cancellation and preservation of an existing file. The
[offline API 28 emulator run 41318204653](https://github.com/skypie0102/ShadowGarden/actions/runs/41318204653)
at source `13e6511` passed an Android synthetic-response transfer and rejected
ticket test. Its staged probe transferred a generated EPUB through an interceptor,
force-stopped the app and reopened the stored bytes in a new process without
Internet permission. The ordinary suite skipped the live-only test, manual process
stage and known strict Readium reflow case; both process stages passed separately.
The detailed report could not be downloaded here; the run log records the suite
and both stages passing. Interceptors bypass the real network and TLS: this is
not a live ticket, server authorization, real interruption, low-storage or
physical-device test.
