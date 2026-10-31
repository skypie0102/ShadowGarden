# Android Main catalog

The early Android library reads the public Main catalog from the fixed HTTPS URL
`https://shadowgarden-bon.pages.dev/media/shadow-garden/data/catalog.json`.
It shows series, author, status and volume titles, and searches series titles,
authors and volume titles. The website currently obtains this same route through
`/data/source.json`; the app does not yet read that configuration dynamically.
If the website changes its catalog source, update and test the Android client.

Only the Main endpoint is requested. There is no Adult catalog, age-gate flow,
cover loading, website search/filter parity, download, reader or Keeper access.
Catalog results are held in memory only; after a process restart an Internet
connection is needed to reload them. A refresh failure retains the last successful
in-memory list and shows an error; an empty catalog and a failed request are
separate states. Browser progress and Android reading positions are not involved.

The client allows HTTPS only, uses the fixed origin and path, sends no credentials
or app cookies, refuses redirects, and has connection, read and total timeouts.
It requires a full 200 response, limits the decoded body to 2 MiB and nesting to
64 levels, and validates the identities and fields it displays before showing
any series. The app does not open catalog-provided URLs or request covers. The
normal debug and release apps request Internet permission; cleartext traffic is
disabled. No catalog is written to backup files or persisted for offline use.

Reader experiments use the explicit `-PofflineReaderTests=true` Gradle property,
which selects a debug manifest without Internet permission. The manual emulator
script applies this property to preserve the existing generated-book offline
checks. Normal debug builds retain Internet access; running those reader tests
without the property does not meet their offline preconditions. Routine
instrumentation uses synthetic catalog responses. An optional manual emulator
probe installs the network-enabled debug app after the offline suite and makes
one read-only request to the live public Main catalog; it is off by default.
Different Android versions and physical-device behavior require separate
evidence before treating this as complete library acceptance.
