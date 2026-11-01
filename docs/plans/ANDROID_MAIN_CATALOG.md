# Android Main catalog

The early Android library reads the public Main catalog from the fixed HTTPS URL
`https://shadowgarden-bon.pages.dev/media/shadow-garden/data/catalog.json`.
It shows series and volume covers when available, author, status and volume titles,
and searches series titles, authors and volume titles. The website currently obtains this same route through
`/data/source.json`; the app does not yet read that configuration dynamically.
If the website changes its catalog source, update and test the Android client.

Only the Main catalog is requested. There is no Adult catalog, age-gate flow,
complete website search/filter parity, download, reader or Keeper access.
After the first successful fetch, the app stores a validated snapshot of those
display fields in private app storage. It loads that snapshot while trying to
refresh, including after an offline restart, and labels it as potentially out of
date until a live fetch succeeds. A refresh failure retains the displayed list and
shows an error; an empty catalog and a failed request are separate states. The
snapshot contains no EPUBs or reading positions and is removed with the app.
Browser progress and Android reading positions are not involved.

The client allows HTTPS only, uses the fixed origin and path, sends no credentials
or app cookies, refuses redirects, and has connection, read and total timeouts.
It requires a full 200 response, limits the decoded body to 2 MiB and nesting to
64 levels, and validates the identities and fields it displays before showing
any series. Cover requests accept only validated relative paths under the site's
public `/media/shadow-garden/covers/` route; arbitrary URLs, book paths, query
strings and redirects are not followed. The
normal debug and release apps request Internet permission; cleartext traffic is
disabled. No catalog is written to personal backup files.

The catalog cache stores validated series and volume identities, titles, author,
status and supported relative cover paths. It does not persist arbitrary URLs,
cookies, credentials, descriptions or other catalog fields. It serializes and revalidates a bounded replacement before
using Android `AtomicFile` to replace the previous snapshot. Invalid responses or
failed replacement do not intentionally discard the last good snapshot; errors
are shown, and corrupt cached data are not silently presented. Writes are
serialized within the app process. A future multi-process design must revisit
that coordination. A stale listing does not authorize a book download: the
server's current access and active-catalog checks still apply.

Cover responses are limited to supported image types, 2 MiB of encoded data,
8,192 pixels per source dimension and 32 million source pixels. They are sampled
to a small display size and held in an 8 MiB in-memory cache, with at most four
loads in flight per library instance. After one hour, a new request tries to reload
the image and keeps the old in-memory image as a fallback if that fails. Canceling a visible-item load cancels its
HTTP call; refreshing the library retries previously failed covers. A failed, unsafe or missing cover
shows a placeholder without blocking the library. Image bytes are not yet stored
on disk, so covers not already in memory require network access even when the
catalog snapshot is available.

Reader experiments use the explicit `-PofflineReaderTests=true` Gradle property,
which selects a debug manifest without Internet permission. The manual emulator
script applies this property to preserve the existing generated-book offline
checks. Normal debug builds retain Internet access; running those reader tests
without the property does not meet their offline preconditions. Routine
instrumentation uses synthetic catalog responses. An optional manual emulator
probe installs the network-enabled debug app after the offline suite and reads
the live public Main catalog and one available cover; it is off by default.
Different Android versions and physical-device behavior require separate
evidence before treating this as complete library acceptance.

The [API 28 emulator run 41226805876](https://github.com/skypie0102/ShadowGarden/actions/runs/41226805876)
at source `fbbfede` passed the synthetic catalog and UI tests, the existing
offline reader/access suite and the two staged process-recovery invocations.
After installing the normal network-enabled debug app, the optional live probe
successfully fetched and parsed the deployed public Main catalog. The ordinary
suite skipped that live-only test, its separate process probe and the previously
documented strict Readium reflow case. The retained detailed instrumentation
report could not be downloaded in this environment; the run log reports the
suite and each separately invoked probe passing. The live probe exercised the
client, while the screen tests used synthetic data; this is not a real-device
or end-to-end live UI acceptance test.

The follow-up [offline API 28 run 41227620084](https://github.com/skypie0102/ShadowGarden/actions/runs/41227620084)
at source `766eacc` passed the suite and staged reader process probe after adding
a screen test for a selected series while a new catalog model loads. It did not
repeat the optional live request. The ordinary suite again skipped the live-only
test, manual process stage and known strict Readium reflow case.

The [offline API 28 run 41264933696](https://github.com/skypie0102/ShadowGarden/actions/runs/41264933696)
at source `72eae51` passed the suite with ten additional app tests covering
snapshot persistence, corruption, interrupted replacement, concurrent access,
offline display and search, refresh, retry and storage errors. Its two-stage
probe saved a generated catalog, force-stopped the app, and loaded that snapshot
through the library model in a new process without Internet permission. The
ordinary suite skipped the live-only test, manual process stage and known strict
Readium reflow case. The retained detailed report could not be downloaded in this
environment; the run log reports the suite and both separately invoked stages
passing. This does not establish behavior under real disk exhaustion, system
eviction, actual network toggling, or on physical devices.

The [API 28 emulator run 41268523144](https://github.com/skypie0102/ShadowGarden/actions/runs/41268523144)
at source `4ca0d2f` passed the Android suite with ten additional app tests for
cover-path validation, image bounds, cancellation, retry, cache expiry,
concurrency, catalog-cache compatibility and screen fallback. The offline
reader and staged process-recovery tests also passed. After installing the normal
network-enabled debug app, the opt-in live probe fetched the public Main catalog
and decoded an actual public cover. The ordinary suite skipped the live-only test,
manual process stage and known strict Readium reflow case. The retained detailed
report could not be downloaded in this environment; the run log reports the
suite and separately invoked probes passing. Screen tests used synthetic images;
this is not a real-device visual acceptance or an offline image-storage test.
