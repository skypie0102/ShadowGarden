# Served production version convergence

The v2.18.6 tooling increment keeps the pre-publication baseline, selected assets
and rollback identity while waiting for the public version to match successful
canonical production. It addresses the one-shot version-probe failure observed
in the [v2.18.5 release](KEEPER_VOLUME_OWNERSHIP.md). A later independent HTTP
read matched that release; this is consistent with a transient serving mismatch,
but does not establish its infrastructure cause.

## Release contract

After one publication and the existing authenticated canonical-source wait,
`deployAndVerify` captures the after-state once. The verifier first validates
that state, exact preservation against the original before-state, the canonical
source, local version and selected asset paths/bytes. Only then may the public
version check wait. It never republishes, replaces either baseline, recalculates
the asset selection or reruns catalog/asset verification.

A version response is retryable only when all these conditions hold:

- HTTP 200, JSON content type and valid UTF-8/JSON.
- A semantic release version equal to `releaseVersion`, a full lowercase source,
  its matching short source and branch `main`.
- That source equals the captured previous canonical production source and
  differs from the release being verified.

The loop checks immediately, then at five-second intervals, for at most twelve
checks and two minutes overall, whichever stops it first. The overall deadline
includes response and sleep time. Each GET has an abort timeout of at most
15 seconds, shortened to the remaining overall budget. Version bodies are
limited to 64 KiB; excess bodies are canceled. A matching response arriving
after the deadline is rejected. These are repository verification budgets,
not Cloudflare propagation guarantees.

Unexpected sources, inconsistent version metadata, redirects, failed HTTP
statuses, transport/timeouts, malformed content and excessive bodies fail
immediately. Preservation, local-build, catalog and asset errors are not retried.
Catalog/asset GETs retain their 15-second timeout and 4 MiB limit. The standalone
`verify:production` CLI retains its single-check behavior.

The sanitized report adds `versionCheck` (attempts and elapsed milliseconds),
`rollbackSource` and `beforeCheckedAt`. Its existing `rollbackDeploymentId`
continues to identify the original pre-publication deployment. `checkedAt` is
recorded after HTTP verification. Private baseline contents remain ignored and
are never uploaded. Captures and HTTP checks are separate reads, not an atomic
transaction or a guarantee against later owner edits.

## Regression evidence

Twelve disposable controls were run against main `7618e8c`: five passed and
seven failed. They reproduce the immediate stale-version failure, missing
convergence accounting, absent attempt/deadline handling, the missing tighter version
body budget and inability to proceed to catalog/asset checks after a stale
version. All twelve pass after correction. A thirteenth control verifies that
the final request receives only its remaining six-second budget.

Tests inject a monotonic clock, sleep and public responses. They perform no real
waiting or live writes. The integration controls retain the original before and
after records, one asset selection, one upload and the original rollback ID,
then verify both catalogs and the selected changed asset. Failure controls cover
bounded exhaustion, a late matching response, invalid release metadata,
HTTP/transport/JSON errors, stream cancellation, preservation/local-build failure
before polling and catalog/asset failure after convergence.

Release CI and production evidence will be recorded after the checked merge.
