# Android signed-book transfer foundation

An experimental foreground download action obtains a book ticket through an
app-owned WebView and streams the response into the checked [private book store](ANDROID_BOOK_STORAGE.md).
The live Garden Pass and real protected download remain unverified. There is no
background queue, transfer-progress UI or automatic ticket renewal. A basic
[offline reader](ANDROID_OFFLINE_READER.md) can open saved books but does not yet
save reading positions.

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

An internal WebView ticket requester can call the website's existing
`ShadowGardenBookAccess.resolve(bookId, {force: true})` function from its HTTPS
`/series.html` page. The website owns the same-origin request and any Garden Pass
dialog; no JavaScript interface or native access to HttpOnly cookies is added.
The requester checks the page before and after each evaluation and validates the
returned ID, relative signed URL and expiry with the same rules as the transfer.
It keeps ticket values in memory and clears its transient page slot on completion.
The requester itself does not verify server signatures locally or establish that
the live page, widget and cookies work on Android.

The download screen supplies a visible WebView with JavaScript enabled, file and
content access disabled, no JavaScript interfaces and top-level navigation locked
to the trusted Main page. HTTPS resources are limited to the site and the
Turnstile host; the website's current Adult catalog paths are blocked. TLS errors
are cancelled. Changes to website catalog routing require another review.
The website's `resolve` function has no cancellation API, so the screen destroys
the WebView after completion, failure or cancellation. Leaving the screen stops
the foreground operation; retry starts again. Session isolation, lifecycle edge
cases, repeat attempts and live Turnstile behavior require further validation.

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

Before release, validate Garden Pass and ticket issuance, handle session expiry
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

The [API 28 pull-request emulator run 41322107663](https://github.com/skypie0102/ShadowGarden/actions/runs/41322107663)
at source `bed60e9` passed four WebView requester tests for valid and invalid
tickets, an untrusted page, timeout, cancellation and a synthetic transfer into
private storage. A test-only interceptor served the synthetic HTTPS page and
blocked all other WebView requests; the transfer also used a synthetic response.
The ordinary suite skipped the live-only test, manual process stage and known
strict Readium reflow case; both offline process stages passed separately. The
run log and retained instrumentation report record the suite passing. This does
not test the actual site script, live Turnstile, real HTTPS, production
navigation locking or physical-device behavior. Two earlier emulator runs failed
because the synthetic `loadDataWithBaseURL` page reported `about:blank`; the
passing test uses an intercepted normal HTTPS navigation instead.

The [offline API 28 emulator run 41334585522](https://github.com/skypie0102/ShadowGarden/actions/runs/41334585522)
at source `3051657` passed screen tests for the Main-volume download action,
saved indicator, download status and retry controls, plus WebView policy tests
for trusted and untrusted navigation, resource blocking and the non-exported
download activity. Local JVM tests cover the foreground ticket-to-transfer
sequence, failure messages and cancellation propagation. The ordinary suite
skipped the live-only test, manual process stage and known strict Readium reflow
case; both offline process stages passed separately. The detailed report could
not be downloaded in this environment; the run log records the suite and stages
passing. A read-only fetch confirmed the deployed series page still references
the book-access script and that it exposes `resolve`.

The screen, live verification and network transfer were not exercised together
in this run. This is not acceptance of live Garden Pass, background/rotation
lifecycle behavior, actual network interruption, low storage, EPUB reading or
physical devices. Those remain open before release.
