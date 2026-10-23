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
- A numeric X.Y.Z release version equal to `releaseVersion`, a full lowercase source,
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

## Checked release — 2026-10-23

PR #46 tested source `9127cc05b6ec5fedf7a61c5d218da59181597e78` and tree
`5a86be525f1326001597620dcf687de914e142d2`. The squash merge `e2d3d0030f213fcf3b2cb096b5599bcbdfdd424b`
has that exact tested tree. No application, configuration, dependency or database
schema changes are included in this tooling release.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39920449667) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39921815223)
both pass **402 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. The separate
Chromium Library-startup profile passes on the PR and is excluded from the
636 browser cases.

The automatic workflow publishes **v2.18.6**, source `e2d3d00`, deployment
`9ba29d34-3d73-401f-8dd3-d4abb5c15fc4`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The original pre-publication baseline and rollback are retained in one deployment
attempt. The version check completes in one request (361 ms), recorded in the sanitized report.
Canonical version/source, both D1-derived catalogs and the stable footer module
pass verification. Independent public HTTP checks confirm version/source and the
footer bytes. The exact revision-9 catalog document, all nine snapshots and
recorded settings remain unchanged, with zero database writes. The retained
rollback is v2.18.5, deployment `ee0503a8-826c-46d6-9fc5-3536c70e6b9a`.
See [verification evidence](production-version-convergence-verification.json).

The live check exercised the normal immediate-success path.
Deterministic fixtures establish stale-version polling, deadline handling and
failure behavior.
A successful release does not establish that production lag occurred on this run.
