# Android protected-access evaluation

Status: debug-only protocol sketch; end-to-end Android access is not yet proven.
The [Android roadmap](ANDROID_ROADMAP.md) tracks the remaining work.

## Existing server contract

Garden Pass and Keeper currently depend on same-origin HTTPS requests and
Secure, HttpOnly, SameSite=Strict cookies. Garden Pass posts a Turnstile token
to `/human-access`; only server-side Siteverify establishes a human session.
`/book-access` returns 428 if verification is needed, otherwise a signed,
15-minute object-scoped ticket and a book cookie. Downloads are denied when
the ticket is invalid or the catalog entry is no longer active. Keeper posts a
Turnstile token and user-provided Keeper key to `/admin-access`; subsequent
admin requests need both the bearer key and the revocable admin session cookie.
Lock uses DELETE `/admin-access`, which revokes the session when it reaches the
server. See the maintained [API contracts](../guides/API_CONTRACTS.md).

## Offline protocol sketch

`AccessPrototype` is a synchronous, debug-only Kotlin experiment with an
in-memory fake transport. It is not connected to the app UI, a WebView, a real
network or server, Android cookie storage, or a real Turnstile widget. It is not
a production authentication or download implementation. There are no real
credentials in the tests, and the experiment does not modify server code or
release permissions. Eight local JVM tests exercise:

- Server-side verification success or failure represented by the fake transport,
  cancellation, and rejection of an unexpected or repeated challenge.
- One ticket renewal after a rejected download, with no unbounded retry.
- Rejection of expired, mismatched, malformed or foreign-origin ticket URLs
  before invoking the fake downloader. This experimental validator rejects all
  percent-encoded paths; it is deliberately incomplete for real catalog keys.
- Keeper unlock, locally clearing the key before requesting revocation, expiry,
  server session rejection and unsuccessful revocation. Failed revocation is
  reported; it does not prove that an unreachable server revoked its session.

The tests model responses; they do not execute the actual server handlers or
validate cookie security, redirects, TLS, Turnstile, concurrency, cancellation of
in-flight requests, lifecycle persistence, local file storage or credential
handling on Android. In particular, this synchronous sketch does not address a
late unlock completing after a lock, and must not be used for production.

Local validation on 2026-10-29 passed all eight debug JVM tests, debug lint,
release assembly and the release unit-test task (which has no sources). The
unsigned release APK's three DEX files did not contain the prototype class.

## Next integration evidence

Use an isolated HTTPS test environment and test credentials with the real
handlers and an appropriate Turnstile test setup. Exercise real WebView origin,
verification, cookie and redirect behavior on Android; verify action and hostname
validation on the server, protected ticket expiry and renewal, and ensure
retired books remain inaccessible. Establish how an authorized download reaches
private local storage without leaking tickets or credentials. Separately exercise
Keeper unlock, bearer plus cookie, expiry, failed and successful revocation,
in-flight request cancellation and race-safe lock against an isolated session
store. Confirm that already downloaded books remain readable when access or the
network is unavailable. Review trust boundaries between remote verification,
untrusted EPUB content and app-private files before selecting an architecture.
