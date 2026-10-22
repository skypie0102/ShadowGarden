# Keeper core and Upload — v2.18.3

This batch expands eight shared Keeper/Upload modules and corrects a reproduced
queue decision bug. The shared API client, upload transaction order, immutable
object coordinates, revision preconditions and existing replacement guard retain
their current ownership.

## Readability scope

| Module | Responsibility |
| --- | --- |
| `admin/core.js` | Shared state, workflow registration, API/session/revision owner and cover helpers |
| `admin/upload-fields.js` | Upload metadata fields installed before the engine |
| `admin-batch.js` | Local inspection, queue/editor state and serial EPUB → cover → catalog writes |
| `admin-batch-editor.js` | Active EPUB selector |
| `admin-upload-workflow.js` | Queue removal, duplicate decisions, progress and completion screens |
| `admin-upload-presentation.js` | Editor restoration and uploaded-series cover presentation |
| `admin/upload-safety.js` | Replacement guard and actionable queue guidance |
| `admin/upload-events.js` | Library snapshot and upload completion events |

The mechanical formatting stage reduces lines over 180 columns from **71 to 19**.
Remaining long lines contain preserved markup/copy. No dependency is added and
no performance improvement is claimed. Pinned Prettier 3.6.2 runs outside the
application dependency graph.

[Equivalence evidence](keeper-core-upload-equivalence.json) records baseline
`78456d8`, formatter options, per-file source shape/hashes, normalized Babel AST
hashes and ordered normalized comment hashes. All eight mechanical stages retain
ASTs and comments. Seven final modules match that formatting stage exactly.
The final Upload workflow additionally contains the functional correction below;
its final source hash is distinct from its formatting-stage hash.

## Explicit Skip survives queue removal

An EPUB skipped automatically because it duplicates another queued EPUB can
become uploadable once that matching entry is removed. An explicit user choice
to Skip must survive the same removal.

The engine already records explicit choices in `userChoseSkip`. The presentation
workflow's duplicate reconciliation ignored that field: removing another entry
could change an explicit Skip to Upload and increase the upload count. For
example, choose Add separate and then Skip for one of two duplicate EPUBs, remove
its matching entry, and upload the other ready EPUB. The skipped book was also
included before this correction.

Reconciliation now keeps explicit Skip choices, matching the engine's existing
decision rule. Automatic duplicate defaults can still clear after removal;
failed validation/upload entries retain Skip and active uploads still prevent
queue removal. No API, storage, backend or session contract changes are included.

## Validation and release state

Seven focused Node controls execute the real Upload workflow with disposable
queue/DOM fixtures. Baseline source fails three explicit-Skip controls and passes
the four existing-policy comparisons. All seven pass after correction. The
controls inspect the resulting action, upload count/button state, automatic
duplicate release, failed-item behavior and active-upload removal guard.

Local validation passes the asset/provenance audit, all **332 Node tests**, static
build and binding/compatibility-aware Functions package. The browser regression
uses actual Keeper markup/controllers, actual EPUB selection/local inspection,
an explicit duplicate Skip, partner removal, review counts and the subsequent
catalog request. All admin API calls are disposable responses; the test verifies
that only the remaining ready EPUB is submitted. It uses no production login or
catalog/object writes. The existing matrix retains session, retry, replacement,
revision, recovery and reader coverage.

The local browser runtime is unavailable, so browser validation runs in GitHub CI.
v2.18.3 is prepared; live production remains v2.18.2 until the complete checked
main workflow publishes and verifies the release. Final CI and release results
are recorded in [verification evidence](keeper-core-upload-verification.json).

Further work includes the remaining dense Keeper UI/session helpers, broader
asynchronous queue/session fixtures and the separately deferred unknown-length/
concurrent upload memory design. This batch does not claim complete Keeper
coverage or new physical Android/Soul or live credential acceptance.
