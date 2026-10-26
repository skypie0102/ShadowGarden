# Keeper core and Upload — v2.18.3

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

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

[Equivalence evidence](../evidence/keeper-core-upload-equivalence.json) records baseline
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

The local browser runtime is unavailable; browser results come from GitHub CI.
[PR #42](https://github.com/skypie0102/ShadowGarden/pull/42) merges as
`05a22d2a72fbb4482d2d94a3109a53ab543a0c94`, with reviewed application tree
`64ab3e7347188cf90a0354e7324ea8c242940cce`. [PR #43](https://github.com/skypie0102/ShadowGarden/pull/43)
adds the pinned browser CI runtime and corrects the WebKit image visibility
helper (see [CI details](CI_BROWSER_RUNTIME.md)); the final release tree is
`e34deb2826897865f37fbf288d1f135651c5b8d4`. The [final runtime PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39844638581) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39846590733) both pass **332 Node tests** and
**556 browser cases** across five profiles, with nine documented platform skips
and zero test retries. The new queue regression passes in every profile. The
separate Chromium Library-startup profile also passes on the PR and is excluded
from the 556 browser cases.

The original main mobile WebKit job and its fresh-runner retry both exhausted the 30-minute job
window while installing Ubuntu dependencies; browser tests never started in either job. PR #43
replaces per-job OS/browser installation with a version- and digest-pinned Playwright runtime; the
final PR and main runs pass all five profiles.

The automatic workflow publishes **v2.18.3**, source `2fa066f`, deployment
`c327c36c-fe9d-4c48-becd-9199a2f18057`, to
[live ShadowGarden](https://shadowgarden-bon.pages.dev). The production verifier
checks source/version, both D1-derived catalogs, all eight changed JavaScript
assets and exact catalog/snapshot/settings preservation. Revision
9 and all 9 snapshots remain unchanged,
with zero database writes. Independent public HTTP checks confirm version/source
and all eight reviewed asset identities. The retained rollback is v2.18.2,
deployment `85a31e3a-43d3-4044-b7cf-026452b00c1e`.
[Sanitized verification](../evidence/keeper-core-upload-verification.json) records CI jobs,
the production report, artifact identity and independent checks.

Follow-up fixtures should cover changing a retained Skip after duplicate
classification changes, and lock/reopen boundaries while a multi-stage upload
is waiting between requests.

Further work includes the remaining dense Keeper UI/session helpers, broader
asynchronous queue/session fixtures and the separately deferred unknown-length/
concurrent upload memory design. This batch does not claim complete Keeper
coverage or new physical Android/Soul or live credential acceptance.
