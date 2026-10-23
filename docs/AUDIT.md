# ShadowGarden project audit

## Upload buffer admission released — 2026-10-23

The latest production release is **v2.18.8**, deployed on 2026-10-23 from
`2f81371` through [PR #48](https://github.com/skypie0102/ShadowGarden/pull/48).
[Upload buffer admission](UPLOAD_BUFFER_BUDGET.md) reduces retained unknown-length
input and prevents overlapping large uploads from consuming unbounded application
buffer capacity in one isolate. Excess requests receive a retryable busy response;
input interruption/deadline and provider failures release capacity. The 50 MiB
EPUB and 10 MiB cover limits remain. Twelve controls give three passes/nine failures
before correction and all 28 focused cases pass afterwards.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39943827702) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39945575580)
both pass **424 Node tests** and **666 browser cases** across five profiles,
with nine documented platform skips and zero test retries. The separate Chromium
Library-startup profile passes on the PR and is excluded from the 666 cases.

The automatic workflow publishes **v2.18.8**, source `2f81371`, deployment
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.7 rollback. The version check uses one request
over 165 ms. Canonical source/version, both D1-derived
catalogs and the stable footer module pass verification. Independent public HTTP
checks match the same version/source and footer bytes. The exact revision-9
catalog document, all nine snapshots and recorded settings remain unchanged,
with zero database writes. The retained rollback is
`359ab672-1d56-4439-86f2-ea80d8b0cc75`. See
[verification evidence](upload-buffer-verification-2.18.8.json).

The preceding [v2.18.7 volume-removal release](KEEPER_VOLUME_REMOVAL.md)
preserves sibling metadata/translation drafts, expanded editors, focus and text
selection when another volume moves to Trash. Its
[dated evidence](keeper-volume-removal-verification.json) retains the checked
source, 412 Node tests, 666 browser passes and unchanged production state.

## Keeper sibling volume drafts released — 2026-10-23

The latest production release is **v2.18.7**, deployed on 2026-10-23 from
`85f72c0` through [PR #47](https://github.com/skypie0102/ShadowGarden/pull/47).
[Keeper volume removal](KEEPER_VOLUME_REMOVAL.md) keeps sibling forms alive when
one volume moves to Trash. Metadata and translation drafts, expanded editors,
focus and text selection are preserved; subsequent writes use updated indices.
All ten baseline controls fail and all 64 final focused Keeper cases pass.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39935879782) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39937777426)
both pass **412 Node tests** and **666 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All six new removal
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 666 browser cases.

The automatic workflow publishes **v2.18.7**, source `85f72c0`, deployment
`359ab672-1d56-4439-86f2-ea80d8b0cc75`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.6 rollback. The version check uses 2 requests.
Canonical source/version, both D1-derived catalogs and the changed Library
workflow bytes pass verification. Independent public HTTP checks match the same
version/source and asset bytes. The exact revision-9 catalog document, all nine
snapshots and recorded settings remain unchanged, with zero database writes.
The retained rollback is `9ba29d34-3d73-401f-8dd3-d4abb5c15fc4`.
See [verification evidence](keeper-volume-removal-verification.json).

The preceding [v2.18.6 release](PRODUCTION_VERSION_CONVERGENCE.md) added bounded
served-version polling within one publication attempt, retaining the original
baseline, reviewed assets and rollback. Its
[dated evidence](production-version-convergence-verification.json) records
402 Node tests, 636 browser passes and unchanged production state.

## Production version convergence released — 2026-10-23

The latest production release is **v2.18.6**, deployed on 2026-10-23 from
`e2d3d00` through [PR #46](https://github.com/skypie0102/ShadowGarden/pull/46).
[Served-version convergence](PRODUCTION_VERSION_CONVERGENCE.md) waits within the
same publication attempt when valid version JSON identifies the captured previous
production source. It retains the original baseline, selected assets and rollback
identity. Other verification errors remain immediate. Seven baseline controls
fail; all thirteen final convergence controls pass.

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

## Keeper volume/translation released — 2026-10-23

[PR #45](https://github.com/skypie0102/ShadowGarden/pull/45) merges as `cfcbcb4`.
Two already-expanded workflows share per-opening ownership; Keeper form
scrolling also settles immediately. Volume operations
also retain their original card; current volume writes preserve series drafts,
and refreshes cannot redraw current series credits. The 41-control baseline
passes nine and fails 32; all 41 pass after correction.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39905484804) and [checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39906804272)
both pass **389 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All eleven new Keeper
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 636 browser cases.

The automatic workflow publishes **v2.18.5**, source `cfcbcb4`, deployment
`ee0503a8-826c-46d6-9fc5-3536c70e6b9a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The workflow verifies canonical source/version and both D1-derived catalogs.
Independent public HTTP checks confirm the same source/version and all four
changed assets (three JavaScript modules and the Keeper layout stylesheet)
against the reviewed source. The catalog, all nine snapshots and recorded
settings match the pre-release baseline at revision 9, with zero database writes.
The retained rollback is v2.18.4, deployment
`1367c2ab-0daa-4ab0-8083-534d71edd611`.
See [contracts and limits](KEEPER_VOLUME_OWNERSHIP.md),
[source hashes](keeper-volume-ownership-source.json) and
[verification](keeper-volume-ownership-verification.json).

## Keeper UI/session released — 2026-10-23

[PR #44](https://github.com/skypie0102/ShadowGarden/pull/44) merges as `9ccfa89`.
Five mechanical formatting stages retain normalized Babel ASTs/comments; four
final modules remain formatting-only. Lines over 180 columns decrease from 33
to 3. Dirty-state baseline timing, failed-save presentation, per-opening series
save ownership, upload session generation and queue-action visibility are recorded
separately. The 30-control baseline passes 19 and fails 11; all 30 pass after correction.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39900413507) and [checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39901498092)
both pass **348 Node tests** and **581 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All five new Keeper
cases and the enhanced Skip-choice case pass in every profile. The separate
Chromium Library-startup profile also passes on the PR and is excluded from the
581 browser cases.

The automatic workflow publishes **v2.18.4**, source `9ccfa89`, deployment
`1367c2ab-0daa-4ab0-8083-534d71edd611`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The verifier checks canonical source/version, both D1-derived catalogs and all
nine changed assets (eight JavaScript modules and the queue-control stylesheet).
The catalog, all nine snapshots and recorded settings match the pre-release
baseline at revision 9, with zero database writes. Independent public HTTP checks confirm source/version
and all nine reviewed asset hashes. The retained rollback is v2.18.3, deployment
`c327c36c-fe9d-4c48-becd-9199a2f18057`.
See [scope and contracts](KEEPER_UI_SESSION.md),
[source evidence](keeper-ui-session-equivalence.json) and
[verification](keeper-ui-session-verification.json).

## Keeper core/Upload released — 2026-10-23

[PR #42](https://github.com/skypie0102/ShadowGarden/pull/42) merges the application
changes as `05a22d2`. [PR #43](https://github.com/skypie0102/ShadowGarden/pull/43)
adds the pinned browser runtime and corrects its WebKit image visibility helper.
The [automatic main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39846590733)
publishes **v2.18.3**, source `2fa066f`, deployment
`c327c36c-fe9d-4c48-becd-9199a2f18057`. Its tree matches the reviewed runtime PR tree;
application modules match PR #42. Final PR and main CI pass 332 Node tests and 556 browser cases across
five profiles, with nine documented platform skips and zero test retries. The
new queue case passes in every profile; the separate PR startup profile also
passes.

The original main mobile WebKit job and its fresh-runner retry both exhausted the 30-minute job
window while installing Ubuntu dependencies; browser tests never started in either job. PR #43
replaces per-job OS/browser installation with a version- and digest-pinned Playwright runtime; the
final PR and main runs pass all five profiles.

Eight core/Upload modules have expanded statements. All eight mechanical stages
preserve Babel ASTs and ordered normalized comments; seven final files remain
formatting-only. Lines over 180 columns decrease from 71 to 19. The final Upload
workflow separately preserves explicit `userChoseSkip` decisions when removal
clears another queued EPUB's duplicate. Automatic duplicate defaults still clear
when appropriate. Three baseline controls fail; all seven focused controls pass.

Live source/version, both catalogs and all eight changed assets verify. Exact
catalog serialization, all 9 snapshots and saved/runtime
settings are preserved at revision 9, with zero database
writes. Independent HTTP checks confirm all eight reviewed assets. The retained
rollback is v2.18.2, `85a31e3a-43d3-4044-b7cf-026452b00c1e`. See
[scope and contracts](KEEPER_CORE_UPLOAD.md),
[source equivalence](keeper-core-upload-equivalence.json) and
[sanitized verification](keeper-core-upload-verification.json).

## Keeper workflows released — 2026-10-22

[PR #41](https://github.com/skypie0102/ShadowGarden/pull/41) merges as `c4f697b`
and the [automatic main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39768639346) publishes **v2.18.2**,
deployment `85a31e3a-43d3-4044-b7cf-026452b00c1e`. The merged tree exactly matches the
reviewed PR tree. Both final PR and main CI pass 325 Node tests and 551 browser
cases, nine documented platform skips and zero test retries. Both new banner
cases pass in every profile; the separate PR startup profile also passes.

Seven data/maintenance controllers have expanded statements. All seven mechanical
formatting steps retain their Babel ASTs and ordered normalized comments; six
final files remain formatting-only. Library additionally fixes a reproduced
banner-editor race: a late save from series A could reset shared identity and
send series B's next banner write to A. Per-opening contexts guard reads, writes,
failure restoration and cleanup across close/reopen and locking. Six baseline
controls fail; all seven focused controls pass with the correction.

The first desktop WebKit attempt hit the overall 20-minute job limit after a
9m43s dependency installation, with both new cases passing and no assertion
failure. The fresh 30-minute-budget matrix passes in full; per-test timeouts,
cases and assertions are unchanged. Local browser download remains unavailable;
browser results above are from CI.

The first main WebKit job spent 21m45s downloading/installing dependencies,
including slow Ubuntu archive responses. It hit the 30-minute job limit after
case 96/112, with both banner regressions passing and
no assertion failures. A retry of that job and its dependent deployment succeeds;
the Node/access checks and four successful browser profiles are retained. The
application source, job budget and per-test timeouts are unchanged by the retry.
This infrastructure retry is separate from the zero test retries reported above.

Source/version, both catalogs and all seven changed assets verify live. Exact
catalog serialization, all 9 snapshots and saved/runtime
settings are preserved at revision 9, with zero database
writes. Independent HTTP checks confirm all seven reviewed assets. The retained
rollback is v2.18.1, `2fed005d-bdb3-4a5f-a6c7-6e34ad7f578d`. See
[scope and contracts](KEEPER_WORKFLOWS.md),
[source equivalence](keeper-readability-equivalence.json) and
[sanitized verification](keeper-workflow-verification.json).

## Automatic live deployment activated — 2026-10-22

The saved token's Pages authorization is corrected. The [successful activation run 39758249662](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662)
(attempt 2) passes both resource-access checks and the guarded production job,
retaining successful 318-Node and 541-browser results with nine documented
platform skips and no test retries. That activation published **v2.18.1**, source
`a3f1b95`, deployment `2fed005d-bdb3-4a5f-a6c7-6e34ad7f578d`.

The verifier confirms both D1-derived catalogs, all seven changed JavaScript
assets and exact catalog/snapshot/settings preservation. Revision 9 and all nine
snapshots are unchanged, with zero database writes. Independent public HTTP
checks confirm the release version/source and all seven reviewed Git blob
identities. The retained rollback is v2.18.0, `8c87a0ed`.

Checked main pushes now publish automatically to the existing live Pages project.
No migration, catalog/book-object mutation or runtime-secret change was needed.
[The activation guide](AUTO_DEPLOYMENT.md) and
[sanitized evidence](automatic-deployment-verification.json) preserve the exact
run, profile counts, deployment, rollback and earlier resolved authorization
failures. The older entries below retain their dated checkpoints.

## Earlier live-deployment credential diagnosis — 2026-10-22

The repository Actions token is now configured. Fresh main activation run
[39755380834](https://github.com/skypie0102/ShadowGarden/actions/runs/39755380834)
passes 318 Node tests and all 541 browser cases with nine documented skips and
no retries, then stops at a Cloudflare baseline HTTP 403 before publication.

A main-only read-only access job now checks Pages and D1 separately before
production can run. Its [first check](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662) confirms D1 SELECT succeeds but the existing
Pages project GET returns HTTP 403, Cloudflare error 10000 (Authentication error).
The token value is never printed. The workflow YAML/embedded JavaScript parse,
and its verification job passes 318 Node tests; its browser matrix was still
running at this checkpoint. The original successful full matrix remains recorded
against its exact source.

The live site remains v2.18.0 / `8e34ced`. Plugin reads recovered and confirm the
same canonical deployment; read-only D1 checks show revision 9 and nine snapshots.
No deployment, migration, catalog/book-object mutation or runtime-secret change
was attempted. [The setup guide](AUTO_DEPLOYMENT.md) and
[sanitized evidence](automatic-deployment-verification.json) record the Pages
authorization change required before activation can finish.

## Automatic live-deployment workflow — 2026-10-21

[PR #40](https://github.com/skypie0102/ShadowGarden/pull/40) merged as `aed4f06`.
The workflow targets the existing live `shadowgarden` project after successful
verification and all browser profiles, with trusted-main, source, baseline and
post-publication guards. Thirteen operational regression cases bring the Node
suite to 318; all 541 browser cases pass with nine documented skips.

[The first main run](https://github.com/skypie0102/ShadowGarden/actions/runs/39593282242)
passes those checks and the binding-aware build, then its production job fails
before any API request with `Set the production CLOUDFLARE_API_TOKEN Actions
secret before deployment.` The secret is empty in the job environment. The
workflow is installed; automatic publication remains blocked pending that scoped
repository credential and a fresh successful main run. Production remains v2.18.0.
No production data, configuration, book-object or credential writes occurred.
[Activation instructions](AUTO_DEPLOYMENT.md) record the exact remaining setup.

## Public readability — 2026-10-21

[PR #39](https://github.com/skypie0102/ShadowGarden/pull/39) merged as `ba71f00`,
preparing v2.18.1. Seven public controllers/loaders have expanded statements;
their executable Babel syntax trees and normalized comment text match the
baseline. Lines over 180 columns decrease from 24 to five. No new runtime
dependency or performance improvement is claimed.

[CI run 39542225261](https://github.com/skypie0102/ShadowGarden/actions/runs/39542225261)
passes 305 Node tests and 541 browser cases with the same nine skips, on attempt 1
without retries. The 24-sample startup profile retains 26 script requests and
zero duplicate paths in every baseline/current sample. The tested, profiled and
merged tree is `5bad162d9d0b106e130cff8cc0c54c6475c198e1`.

Production remains v2.18.0. The connected Cloudflare runtime returns internal
errors before even a no-API-call request can complete, blocking fresh baseline
capture and guarded deployment. Ten public HTTP checks confirm the existing
version, both catalogs and seven previous-release module hashes. There were no
production data, book-object, migration or credential writes. [The report](PUBLIC_READABILITY.md)
and [verification](public-readability-verification.json) preserve exact release
state; Keeper's dense data/maintenance workflows are the next readability batch.

## Public boundaries and startup — 2026-10-20; records recovered 2026-10-21

[PR #38](https://github.com/skypie0102/ShadowGarden/pull/38) merged as `8e34ced`
and shipped v2.18.0 in deployment `8c87a0ed-acf5-4083-a305-c9f5988f8da1`.
Garden Pass now uses native modality and restores focus on exit. Five independent
Library imports start together, and canonical module URLs remove three duplicate
requests. The [24-sample raw profile](library-startup-profile-2.18.0.json) records
29 → 26 script requests; controlled 80 ms JS-response delays improve median
readiness from about 0.95 s to 0.38–0.41 s. This is not production CWV or mobile
performance evidence.

CI run 39434636935 passes 305 Node tests and 541 browser cases on attempt 1,
without retries. Nine skips comprise eight prior platform skips and one Firefox
remote-frame traversal case whose ordinary-page control also fails. All other
Garden Pass checks remain required in Firefox. The exact cause is unresolved;
the related Mozilla issue is already marked fixed in an earlier Firefox version.

The release session verified revision 9, nine snapshots, exact catalog/settings
preservation, served assets, both Library footers and the genuine modal. After
the local checkpoint restored, source/CI/raw profile were recovered from GitHub;
fresh public checks again pass on 2026-10-21. Cloudflare connector internal errors
blocked new D1/configuration reads, and the private prior baselines were absent.
[Public boundaries](PUBLIC_BOUNDARIES.md) and [sanitized evidence](public-boundaries-verification-2.18.0.json)
distinguish those dates and limits. No data/provider/credential writes were needed.

## Release verification and revision contracts — 2026-10-20

Production at this tooling checkpoint was v2.17.1, source `01b57f9`, deployment
`39c54372-231f-4a6d-880b-48f1a3710b57`. The older blocked-upload entries below
are historical; the existing plugin supplied the working upload token and no
additional sign-in was needed. See [current operations](PRODUCTION_TAKEOVER.md).

The [production verifier](PRODUCTION_VERIFIER.md) adds read-only baseline capture,
strict canonical catalog/version checks and reviewed served-asset comparison.
Bundle and deployment guards check compatibility date/flags as well as bindings.
Twelve new regression cases bring the Node suite to 305. The live report checks
both catalogs and the two v2.17.1 changed modules, with exact D1 revision-9 data,
nine snapshots and configuration preserved. This tooling/documentation increment
requires no application deployment. [Evidence](production-tooling-verification.json)
contains only sanitized identities, counts and hashes.

[PR #37](https://github.com/skypie0102/ShadowGarden/pull/37) merged as `75b6eb7`.
[CI](https://github.com/skypie0102/ShadowGarden/actions/runs/39412104343) passes
305 Node tests and 502 browser cases with eight existing skips, on attempt 1
with no retries. The merge tree exactly matches tested source `e1903ea`.

The [revision contract matrix](API_CONTRACTS.md#revision-header-compatibility)
records optional legacy headers and mandatory purge/recovery guards. Existing
Keeper forms already send revisions. Compatibility is retained until a deliberate
client migration; the audit does not infer that unseen external callers are gone.


## Browser persistence continuation — 2026-10-20 (Asia/Manila)

The v2.17.0 persistence increment is merged through
[PR #35](https://github.com/skypie0102/ShadowGarden/pull/35) as `129a1d2`.
Checked grouped writes and conditional rollback cover aliases, Finished state,
settings and migration. Both Read Again entry points reset progress/Finished
state in one operation. Eight failing-before controls pass; final CI has 285
Node tests and 492 browser passes, eight existing skips and no test retries.
[The report](BROWSER_PERSISTENCE.md) records the limits of rollback and preserves
the distinction from crash atomicity or concurrent-writer isolation.

The merged main build is ready. A fresh documented Pages JWT still receives
403 on a real asset check; dashboard fallback requires sign-in. Production
remains v2.16.0. Refreshed revision-8 D1 data matches the verified release, all
eight snapshot checksums match their actual documents, and the live main
library loads with its v2.16.0 footer. No production write was performed.
Next independent audit item: map vendor protected-fetch consumers before
replacing the compatibility hook with explicit authorized-source transport.

## Audit continuation — 2026-10-20 (Asia/Manila)

The v2.16.1 upload-memory increment is merged through
[PR #34](https://github.com/skypie0102/ShadowGarden/pull/34) as `a862ad5`.
The real local workerd handler transfers exact 50 MiB fixtures with matching
provider hashes; one byte above the limit fails before provider access or a
reservation. Direct buffering reduces sampled declared-length backing storage
from 100.27 MiB to 52.21 MiB (47.9%). Unknown-length input remains around 104 MiB.
All 259 Node tests and 477 browser cases pass, with eight existing skips and no
test retries. [Measurements and validation](UPLOAD_MEMORY.md) distinguish
allocation samples from total production memory.

Production remains v2.16.0: the current Cloudflare connection returned 403 for
the required Pages asset-upload operation. No new deployment or production
data/configuration write occurred. The next independent audit item is browser
persistence transactions in `domain/progress.js`, `domain/bookmarks.js`,
`domain/reading-state.js` and `reader/storage.js`; preserve existing identity
aliases and storage formats while defining partial-write behavior.

## Current status — 2026-10-19

Production is v2.16.0, source `4b2aed1`, with 250 Node tests and 477 browser
passes across five profiles (eight existing platform skips). [Maintenance budgets](MAINTENANCE_BUDGETS.md)
close the first [codebase audit](CODEBASE_AUDIT_2026-10.md) follow-up: paginated,
one-document-at-a-time history and a request-owned readiness deadline. Six live
Keeper frontend fixture cases, served-source checks and exact pre/post data/
configuration comparisons pass. [Release evidence](maintenance-release-2.16.0.json)
records deployment independently of implementation.

The documented reader/website ownership refactors and double-activation image
focus are deployed. The owner manually accepted Android/Soul scrolling and focus
return in v2.12.6, and Keeper in v2.12.8. Those physical/provider checks retain
their original scope; isolated test EPUBs are not real-book authorization proof.
Historical checkpoints below preserve their original counts and observations.

## Reader rendering and diagnostics — 2026-10-16 (Asia/Manila)

Phase 4 is verified and merged into `main` through
[PR #5](https://github.com/skypie0102/ShadowGarden/pull/5) as
`0d33b7220e500e4e2225fd8044486bf226faeff6`. Generated long/illustrated-book profiles identified retained
Section source documents and repeated normalization of one illustration.
Source leases now cover live views, search, notes, location generation and
target resolution; replaced map/view sources are released. One scan shares
normalized assets without losing each illustration page's metadata.

The existing IndexedDB stores now prune old versions, damaged/expired entries
and excess records. Page maps have a 24-record, four-layout-per-publication,
8 MiB JSON budget; visual caches have an eight-publication, 64 MiB Blob-payload
budget. Both expire records after 30 days. Oversized results still work in the
current reader without being persisted. Progress/bookmark storage is unchanged.

Engine/controller diagnostics use fixed codes and numeric fields, retain 64
events, distinguish expected cancellation/fallback from failure, and do not log
raw Error objects or protected source paths. A failed map-sandbox archive open
now exits into ordinary reader navigation with a sanitized diagnostic.

Both clean CI runs
[38828402947](https://github.com/skypie0102/ShadowGarden/actions/runs/38828402947)
and [38828428816](https://github.com/skypie0102/ShadowGarden/actions/runs/38828428816)
pass all 146 Node tests, all 68 desktop/mobile Chromium browser cases, the asset
audit and both builds against source `9b59c5ce5e207e539c9c3b939010707ceb6b012b`.
All nine final local profile runs pass, as do the six final focused cache,
rendering and recovery browser cases. The earlier full rendering run passes all
68 cases. The published public tree matches the locally verified source exactly.

The long fixture's peaks fall from 81 to 2 map source documents and from 33–34
to 10 reader sources. Repeated-plate median startup falls from 1653 to 704 ms,
with one conversion instead of 21. Distinct artwork, canonical totals and cached
reopening remain intact. See the [performance report](READER_PERFORMANCE.md)
and [raw measurements](reader-performance-results.json) for the three-run
comparisons and limits. Phases 0–4 are complete for the documented matrix;
broader release verification and deployment remain Phase 5 work. No production
deployment has been performed.

## Reader lifecycle refactor — 2026-10-16 (Asia/Manila)

The lifecycle milestone is merged into `main` through
[PR #4](https://github.com/skypie0102/ShadowGarden/pull/4) as
`61a487502248882e02bcd9bd8d8903fcdad7bdbb`: explicit
session/application/controller disposal, engine-instance and Contents ownership,
owned compatibility work, canceled access/resume/visual preparation, completion
confirmation cleanup and retryable startup failure. Progress/bookmark identities,
security boundaries and backend/provider configuration are unchanged.

All 128 Node tests, the recovered-asset audit, static build and Functions
compilation pass locally and in CI. All 62 desktop/mobile Chromium browser cases
pass in a clean 4.1-minute local run against the same tree as published source
`1456fa12259e3d37c56d757d7f445e57cc3c3406`, including fourteen new lifecycle
cases. The suspension fixture now explicitly uses `persisted:true`, and the
lifecycle matrix separately checks non-persisted departure cleanup. These checks
account for owned resources and late callbacks, not all browser/vendor heap
allocations. See the
[reader architecture](READER_ARCHITECTURE.md) and
[roadmap](READER_REFACTOR_ROADMAP.md) for ownership and remaining scope.

Clean push and pull-request CI runs
[38819451742](https://github.com/skypie0102/ShadowGarden/actions/runs/38819451742)
and [38819468106](https://github.com/skypie0102/ShadowGarden/actions/runs/38819468106)
both pass all 128 Node tests, all 62 browser cases, the audit and both builds.
The workflow was unchanged at the lifecycle checkpoint, with Phases 0–3 complete
for its documented Chromium matrix. The subsequent Phase 4 verification is
recorded above. No production deployment occurred at either checkpoint.

The older reconstruction checkpoints below retain their historical test counts;
`npm run audit` reports current recovered-file modification counts.

## B2 upload pod compatibility — 2026-10-03

The owner confirmed production Keeper login and then reported an upload failure.
A read-only D1 check showed one upload reservation at 11:30 UTC, an empty catalog,
and no active upload lease. The request had passed EPUB validation and the B2
read/existence check, narrowing the failure to the write step.

The provider URL validator allowed only `*.backblazeb2.com`, but Backblaze's
[upload URL API](https://www.backblaze.com/apidocs/b2-get-upload-url) returns
`pod-*.backblaze.com`. Both a regression test and the pinned Cloudflare runtime
reproduced `storage_error` before the upload POST. The corrected validator
permits HTTPS pod hosts only for upload URLs; account/download credentials
remain restricted to their existing hosts. Lookalike domains, unrelated
Backblaze hosts, URL credentials, nonstandard ports, HTTP and redirects are
still rejected before upload credentials or bytes can reach them.

All 63 backend/client tests pass, including documented upload URL formats,
unsafe endpoint rejection, upload-pod redirects and complete upload/catalog
fixtures using a realistic pod hostname. The Cloudflare runtime completed the
mocked upload with the expected bytes, content length and upload-specific token.
No real B2 object was created or deleted, and no secrets or bucket settings were
changed. A live authenticated retry remains the final provider integration check.

## Existing Keeper credential compatibility — 2026-10-03

The owner reported `security_not_configured` when logging into production.
Read-only checks showed a working session/Turnstile challenge and configured
`SG_ADMIN_TOKEN`, while the protected library endpoint failed the admin-token
configuration gate. The reconstruction had applied its 32-character HMAC key
minimum to the existing login credential even though an independent session
key signs the comparison.

Separated credential validation from signing-key validation. Keeper preserves
the exact nonempty stored token, including existing shorter credentials. Empty,
whitespace-only and non-string values still fail closed; canonical overrides
remain explicit. Session/media signing keys retain their length checks. The
admin challenge now validates credential presence, and configuration errors
are rejected before counting failed login attempts.

All 61 backend/client tests pass. Added full login/session checks for an existing
shorter token, wrong-token and failed-Turnstile rejection, and invalid-credential
configuration checks. No stored secret was read, changed or rotated.

## Production takeover and storage runtime correction — 2026-10-02

The owner authorized taking over `shadowgarden-bon.pages.dev` using its existing
secrets and B2 bucket. Production deployment `e9d4306a-a4db-4aed-a4a9-d3b28458dc39`
served commit `26bacb7`. Live HTTP checks verified the homepage, version, both
Turnstile challenge endpoints and empty D1 catalogs. All eight original secrets
were retained; an independent `SESSION_SECRET`, D1 binding and bucket variables
were added. See `PRODUCTION_TAKEOVER.md` for the exact resources and rollback.

A real storage probe exposed a runtime compatibility bug: workerd rejects
`redirect: 'error'` before contacting B2. Node fetch mocks had not exposed this.
The pinned Cloudflare runtime reproduced the old 502 with zero provider calls.
The fix uses `manual` and explicitly rejects every 3xx response without following
the destination. The same runtime then served fixture media and refused a 307.
All 59 backend/client tests pass, including authorization and file-operation
redirect guards. On 2026-10-03, corrected production deployment
`f8844be0-ae68-4e72-969d-c0812f03109d` passed the live read-only B2 probe: provider
authorization and a missing-object lookup now return the expected 404. Actual
EPUB upload/read and real write/delete permissions still require Keeper checks.

The orphaned Workers build configuration was confirmed to reference a deleted
Worker. Its previews are disabled and production builds exclude all paths;
Pages deployment configuration is independent of this cleanup.

## Test deployment and B2 authorization compatibility — 2026-10-02

The isolated Pages project now serves the initialized empty D1 catalogs.
After the owner configured security and redeployed, independent HTTP checks
confirmed both challenge endpoints return 200. The owner confirmed Keeper
login opens normally. Actual B2 upload/read, media signing and cleanup remain
pending the separate test bucket and credentials.

Changed B2 authorization from v2 to v4 so current bucket-group keys work along
with legacy keys. Nested provider endpoints and returned bucket restrictions
are validated before storage operations. Malformed authorization fails closed;
the split credentials, rotation checks and exact-version cleanup remain intact.
All 57 local backend/client tests, asset audit, build and Functions compilation
pass. Four additional cases cover bucket groups/unrestricted responses,
bucket mismatches, malformed responses and untrusted nested endpoints. Existing
upload, reader, recovery and cleanup fixtures now use the documented v4 shape.
No browser assets, database schema, live project settings or B2 objects changed.

## Existing deployment configuration compatibility — 2026-10-01

The owner supplied the eight encrypted variable names already configured in
Cloudflare. Added aliases for the four `SG_*` security settings and separate B2
read/write credential selection. Reads never retry with write credentials,
partial role pairs fail closed, canonical overrides remain explicit, and cached
B2 authorization rechecks bucket restrictions and credential rotation.

Local `npm run check` passes all 53 backend/client tests, the recovered-asset
audit, static build and Pages Functions compilation. Six new regression tests
cover actual login/book-access handlers, precedence/strength checks, split B2
operations, partial pairs, rotation/bucket changes and denied read authorization.
No browser assets or schema changed. The previous verified fourteen browser
cases are recorded below; the compatibility branch's Actions run checks them
again before adoption.

This change is prepared on `fix/existing-cloudflare-secrets`, separately from
main and the live deployment. No Cloudflare settings, secret values, remote
database records or B2 objects were changed. The screenshot does not establish
the presence of `SESSION_SECRET`, bucket identifiers or `DB`, nor the secret
lengths, B2 permissions or live provider compatibility. Follow the deployment
guide with separate test resources before switching production traffic.

## Scope and outcome

The recovered static site was preserved and all 15 observed function routes
were reconstructed. This is a tested reconstruction checkpoint, **not proof of
production equivalence or complete private-data recovery**.

| Check | Result |
| --- | --- |
| Archive integrity/provenance | SHA-256 recorded for both source archives and all 148 recovered public files |
| Retained public files | 148/148 present; 139/148 byte-identical; 9 intentional browser script edits |
| Syntax, JSON, literal static dependencies | Passed; 207 checked literal references resolve |
| Route coverage | 15/15 recorded function paths exist; client endpoint literals covered |
| Catalog evidence | Main empty; one adult series, five unique book IDs, ten cover files |
| HTML structural inspection | Six documents parsed; no duplicate IDs |
| Automated backend/client tests | 47/47 passed locally and in run 36375221866; real SQLite, isolated sessions, mocked B2/Turnstile |
| Private mapping migration generator | Successful restore and stale rerun verified against SQLite |
| Static build | Passed; `dist/` contains public assets, no server/private files |
| Pages Functions compilation | Passed with pinned Wrangler 4.136.3 |
| Local D1 migration and seed | Passed under Wrangler; no remote database touched |
| Dependency audit | `npm audit`: zero reported vulnerabilities on 2026-09-25, including the new Playwright dependency graph |
| Real-browser workflow checks | 14/14 passed in run 36375221866 at be25028; zero failed, flaky or skipped cases |
| Manual visual review | Established public/recovery views plus four new purge/recovery-control captures reviewed; latest run 36375221866; scope below |
| Original EPUB rendering | Out of scope: owner confirmed disposable test data; original files are not a recovery gate |
| Pages/D1 runtime | HTTPS Pages Functions and local D1 verified in CI; this workspace's preview still fails on interface enumeration |
| Live provider integration | Isolated Pages/D1 and owner-reported Keeper login confirmed; B2/media flows pending |
| Remote Git commit/push | Reconstruction and browser fixes published to skypie0102/ShadowGarden main; remote Git trees checked against local source |

## Defects found and fixed during reconstruction

1. Snapshot checksum fidelity: the original stored JSON serialization is retained
   when checksumming snapshots, avoiding a false corruption report after reading
   whitespace-formatted seed JSON. Tested.
2. Banner API fidelity: the recovered client expects `current`, not just
   `bannerBookId`, in the choice payload. Both are returned. Tested.
3. Destructive replacement risk: the recovered uploader reused an existing EPUB
   key. It now uploads to a fresh opaque key; catalog replacement preserves the
   public book ID, while old snapshots keep their old object mapping. Tested.
4. Concurrent catalog writes: a revision-guarded D1 transaction snapshots the
   old state and updates the new state; losing writers receive HTTP 409. Tested.
5. Concurrent object uploads: D1 reserves object keys before upload; a reused key
   is rejected. Existing B2 objects are not deliberately overwritten.
6. Permanent purge now uses a documented replacement contract: selected Trash
   removal, durable cleanup, reference protection, exact B2 version deletion and
   visible continuation/errors. No deletion is reported complete without verification.
7. Public/protected storage boundary: private EPUB requests cannot reach the
   static fallback; public catalogs strip private paths and upload bookkeeping.
   Tested, including invalid tickets, raw paths and retired book identities.
8. Stale editor revision: a background banner/history/status read previously
   advanced the shared client revision, letting old forms submit with a newer
   precondition. Editor requests now retain the revision of the displayed data;
   successful edits advance that form's revision. Caller-supplied `If-Match`
   headers are preserved. Three client-to-backend regression tests pass.
9. Adult-gate return navigation: browser testing exposed a recovered client race.
   Catalog initialization rewrites the URL, discarding the requested series
   before the acknowledgement click. The gate now captures the destination
   before initialization and permits only same-origin paths. The browser case
   explicitly waits for catalog initialization before acknowledging.
10. EPUB mapping collision: replacing one volume with an object mapped to another
    identity could make valid reader tickets unusable. Catalog writes now reject
    that alias with 409 without changing metadata or snapshots.
11. Trash identity collision: restoring a trashed series or volume could introduce
    a book ID already active under a different series. Restores now check both
    libraries and reject conflicting identities without consuming the trash item.
    Both collision regressions failed before the guards and pass afterwards.
12. Terminal reader error overwritten by loading updates: visual review found
    that background preparation replaced the failure advice with a progress
    message and left the header claiming the volume was opening. Progress now
    updates only the startup paragraph; terminal failures replace placeholder
    header text. The browser case exercises a late preparation after failure.
13. Structurally damaged snapshots: a matching checksum previously allowed
    invalid catalog shapes to be stored before the restore response crashed.
    Snapshots now pass structure/identity validation before restore. Damaged
    records are marked in history, cannot be restored, and can be explicitly
    deleted without affecting other data. New regression cases failed before
    the correction and pass afterwards.
14. Recovery blocked by damaged live data: maintenance previously assumed the
    live document could be parsed and traversed. It now keeps authenticated
    history and revision-guarded restore usable, while ordinary reads/writes
    fail explicitly. Unknown counts and disabled operations are shown in Keeper;
    restore preserves the exact damaged serialization in a safety snapshot.
15. False or incomplete readiness: trash-only books were omitted; static
    recovered covers were treated as absent unless also in B2; uninspected
    candidates after an early match were undercounted. Readiness now checks
    active and trash references, accepts only image asset responses for covers,
    requires B2 for EPUBs, and reports every uninspected candidate as uncertain.
    Retained totals include history beyond the panel's 200-item display limit;
    only the newest three candidate payloads are loaded for readiness. A damaged
    live record always reports recovery required.

## Important remaining limits

- All backend source is new. Original algorithms, bindings, retention rules,
  protection policies and runtime behavior have not been reproduced exactly.
- Five original books are disposable test data, confirmed by the owner; they
  are outside the reconstruction completion criteria.
- D1 is a new authoritative metadata store; it does not update legacy B2 catalog
  JSON. A deployment must explicitly initialize and bind a new database.
- Purge and recovery use new documented semantics. Only explicit Trash jobs
  delete media; orphan uploads are not automatically swept. Retained snapshots
  intentionally keep referenced media until explicitly removed.
- Abuse Watch implements basic persistent rate limits, not the original scoring
  and tripwire system. Operational event retention and limits are new policy.
- Readiness checks are bounded and can report uncertain for large libraries.
- EPUB validation covers ZIP structure/signatures/size limits; semantic EPUB
  correctness and real-book reader behavior still require EPUBCheck/browser QA.
- Vendor bundles were recovered, not rebuilt from original dependency manifests.
  Their original source maps, lockfiles and complete provenance are missing;
  npm's zero-vulnerability result covers the new dependency graph only.
- High-volume/load testing, real 50 MB upload memory behavior, production rate
  limits and cross-device reader behavior were not verified in this environment.

## Intentional edits to recovered files

`public/assets/js/admin/core.js`: record catalog revisions, send `If-Match`, map
EPUB uploads to fresh object keys and rewrite the catalog upload payload. Open
editors retain their own revision across background reads.

`public/assets/js/admin/library-workflow.js`: retain the loaded library revision
and bind it to the series editor when opening a form.

`public/assets/js/library.js`: preserve the adult-gate return destination across
filter URL rewrites and reject external return destinations.

`public/assets/js/admin/trash-workflow.js`: enable guarded purge, display durable
cleanup progress/errors and retry controls; show unreadable Trash honestly.

`public/assets/js/admin/recovery-readiness-workflow.js`: select a validated recovery
candidate, preserve its displayed revision/checksum and restore with explicit
metadata-only scope and a safety backup.

`public/assets/js/admin/history-workflow.js`: show damaged snapshot status,
disable invalid restores and backup creation from unreadable live data, and
refresh maintenance state after a successful snapshot restore.

`public/assets/js/admin/maintenance-workflow.js`: show unavailable taxonomy and
cover checks when live data is unreadable; preserve access to Catalog History
and refresh health after Trash changes.

`public/assets/js/reader-visual-cache.js`: limit loading messages to the startup
paragraph, leaving nested terminal-error advice untouched.

`public/assets/js/reader/error-presentation.js`: replace the opening placeholder
in the header with a terminal failure label; preserve real book titles.

`recovery-info/_recovery-log.tsv` was normalized to deployment URL/path fields;
the original workstation directory strings were removed from the committed log.
Original archive hashes preserve evidence identity. The historical recovery
report's “missing literal references” are retained as evidence; most are variable
names misidentified by the crawler. The new audit checks actual imports and
HTML/CSS asset references instead.

## GitHub verification

[Reconstruction commit](https://github.com/skypie0102/ShadowGarden/commit/20dd2ec78939f42638e0758f8f510f21675372f4)
and [successful CI run](https://github.com/skypie0102/ShadowGarden/actions/runs/35930710273).

Git tree `4e5be36752df1177242f40a374eb7fa0c7295737` matched the local
publication tree exactly. All 197 project files, including ten binary images,
were verified through Git hashes. The following documentation commit records
this outcome without changing application behavior.

## Browser verification scope added 2026-09-25

The pinned Playwright suite executes five workflows on desktop Chromium and
mobile Chromium. Its server harness copies the reconstructed app into a temporary
directory, initializes a separate local D1 database, and starts real HTTPS Pages
Functions with fixture credentials. Application API responses are not mocked.
Third-party browser requests are excluded. Authentication uses a normally signed,
D1-backed fixture session; this does not verify live Turnstile. The suite checks
the missing-book error rather than claiming actual EPUB reading was restored.
Run [36123630092](https://github.com/skypie0102/ShadowGarden/actions/runs/36123630092)
at commit `929c5d59142e2ce049085d0c9d347c3ad5ffe4d1` passed all ten cases
in 19.8 seconds, plus all 25 backend/client tests, the asset audit, static build
and Functions compilation. The previous eight-of-ten result is superseded by
this run. Both stale-editor cases now verify the 409 conflict and successful
save after reload without retries or forced clicks.

Successful runs now attach screenshots of the empty main library, adult
acknowledgement, recovered series, missing-book reader and Keeper series editor
on both screen sizes. These are render evidence, not pixel-baseline assertions.
Fonts and other third-party requests remain excluded by the isolated harness;
live-provider and original-EPUB checks remain separate.

Two subsequent collision regression tests bring the suite to 27. Runs
`36152617517`, `36316012764` and `36316245127` passed the full backend/client
suite and all ten browser cases. The CI workflow runs both suites on every push.

## Visual review completed 2026-09-27

Reviewed the ten captures in [run 36316245127](https://github.com/skypie0102/ShadowGarden/actions/runs/36316245127),
commit `a0b46328e8ad5580bd0d336738d6e810ec8a0281`. The source tree
`6e41d375e06e82b84bc6cceb1118676a82ca4ce0` exactly matched the local tree.
Desktop uses a 1280×720 CSS-pixel viewport; mobile uses Playwright's Pixel 7
profile at 412×839 CSS pixels and device scale 2.625. Six captures were
byte-identical to the already-reviewed reader-fix run; four were inspected anew.

| Screen | Desktop and mobile findings |
| --- | --- |
| Empty main library | Navigation, filters, counts and empty-state copy render as recovered |
| Adult acknowledgement | Notice and both navigation choices fit the viewport; the blank transition capture is resolved |
| Recovered series | Banner, metadata, five cover cards and primary read links render; mobile uses two card columns |
| Missing-book reader | Terminal header, full recovery advice and retry/return controls remain visible after late preparation |
| Keeper series editor | Inputs and footer actions fit the dialog; clean-state disabled save is expected and the workflow verifies later saves |

The screenshot harness waits for cross-document transitions and finite
animations, then captures the rendered page. It does not change application
motion behavior. Modal evidence uses viewport captures; library/series evidence
uses full-page captures. These checks found no additional blocking layout issue
in the reviewed states. They do not establish fidelity to an unrecovered
original screenshot baseline or validate every reader/admin screen.

Artifact `10931210518` (`browser-report`) was downloaded and its SHA-256
`d86611b5a6f8880d60497a8bf8601f473a2951bc1efbbdf96a82d361c595b484`
verified before review. GitHub reports expiry on 2026-10-04; later CI runs
regenerate the same evidence types. Original EPUB rendering, production fonts,
live Turnstile and real B2/D1 integration remain outside this fixture review.

## Recovery verification completed 2026-09-28

[Run 36353932405](https://github.com/skypie0102/ShadowGarden/actions/runs/36353932405)
at [887deb9](https://github.com/skypie0102/ShadowGarden/commit/887deb930e81a3bfab4699714d08876663dd80ec)
passed all 34 backend/client tests and fourteen browser cases in 37.7 seconds.
The report records fourteen expected results, no unexpected failures, flaky
cases or skips. The remote source tree `211b20e3731ed5d326e79533f937f9894ae657ec`
matched the local tree exactly.

The two added workflows run at both screen sizes. They verify that damaged
snapshots remain visible, cannot be restored, and can be individually deleted;
then deliberately damage the isolated fixture's live catalog and restore a
valid snapshot through the real Keeper interface. The tests verify unknown
counts, unavailable checks, recovery-required status, successful restore,
re-enabled controls, all five recovered volumes and an exact damaged safety copy.
Fault injection selects only the harness-created database containing its fixture
session; no app endpoint bypasses catalog validation.

Reviewed the four new viewport captures. Damaged snapshot labels, disabled
restore controls, available delete controls, unknown counts and catalog-recovery
advice are legible on desktop and mobile. This extends the previous five-screen
review; it does not establish an original screenshot baseline or verify every
maintenance state. Provider requests remain fixtures, and real EPUBs are absent.

Artifact `10943312219` contains fourteen successful-page captures. Its downloaded
SHA-256 is `afc51dc37f3f09d988f4c6d7e882051f2ba08b43064a61cd7b6ece8baea043fe`,
matching GitHub's digest. GitHub reports expiry on 2026-10-04 UTC.


## Purge and recovery completion verified 2026-09-28

[Run 36375221866](https://github.com/skypie0102/ShadowGarden/actions/runs/36375221866)
at [be25028](https://github.com/skypie0102/ShadowGarden/commit/be25028ca67f39db45f4dfa97a45901b3f9bf9de)
passed all 47 backend/client tests, the audit, static build, Functions compilation
and all fourteen desktop/mobile cases in 33.8 seconds. Browser results have no
unexpected failures, flaky cases or skips. Remote source tree
`b6b7473c97c36fa493fe8d6c5c239961342e4a74` matched the tested local tree.

The purge workflow removed a real fixture Trash entry, resumed bounded cleanup
through Keeper, retained all ten bundled covers, and restored the five-volume
fixture from a retained snapshot. The recovery workflow restored a damaged live
catalog through the new recovery POST and verified its exact safety copy. Both
migrations ran in real local D1 under Pages in CI. Mock-provider regressions
cover older B2 versions, neighbouring keys, partial failure, Object Lock, stale
requests, references in old/damaged snapshots, in-flight uploads, concurrent
adoption, request budgets and abandoned job leases. No live B2 deletion occurred.

Reviewed four new desktop/mobile viewport captures of completed cleanup and the
recovery action. Counts and explanatory text remain readable; controls fit both
viewports, with mobile actions stacked. Report artifact `10950078953` contains
18 successful-page captures. Its downloaded SHA-256
`4aeee997db1a8ddc4e5f1335c482a190ab1bab363e14194ffb7f5099fc416d5d`
matched GitHub's digest; expiry is 2026-10-05 UTC.

The five original EPUBs are disposable test data per the owner and are no longer
a completion gate. Reconstruction code is complete under the documented
replacement contracts. Production deployment requires migration 0002, configured
secrets/bindings and a B2 key with the required capabilities. Live provider
integration remains a deployment check, not a claim made by fixture tests.
