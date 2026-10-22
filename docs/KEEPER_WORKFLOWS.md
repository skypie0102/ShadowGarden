# Keeper workflows — v2.18.2

This increment expands seven dense Keeper data/maintenance controllers and fixes
a reproduced banner-editor race. Existing workflow registrations, API routes,
revision preconditions, maintenance queue order and destructive confirmations stay
with their current owners. No new runtime dependency is introduced.

## Readability scope

| Module | Review boundary |
| --- | --- |
| `admin/library-workflow.js` | Catalog loading, series/volume forms and banner selection |
| `admin/maintenance-workflow.js` | Health, taxonomy, cover optimization and the serial operation queue |
| `admin/history-workflow.js` | History paging, backup creation, restore and deletion |
| `admin/recovery-readiness-workflow.js` | Readiness results, uncertainty and recovery choices |
| `admin/trash-workflow.js` | Recoverable Trash, purge jobs and selected-item actions |
| `admin/translation-workflow.js` | Series credits and volume overrides |
| `admin/abuse-workflow.js` | Abuse reports and response controls |

The mechanical formatting stage reduces lines over 180 columns from 114 to 30.
Remaining long lines are preserved markup/copy, including template literals.
This is a readability change; no performance improvement is claimed.

[Equivalence evidence](keeper-readability-equivalence.json) records baseline
`fc5dfca`, pinned Prettier 3.6.2 options, per-file source hashes, source shape,
normalized Babel AST hashes and ordered comment hashes. All seven mechanical
formatting steps preserve ASTs/comments. Six final files match that formatted
stage exactly. The final Library file additionally contains the separately
recorded functional correction below; its final hash is explicitly distinguished
from the formatting-stage hash. The temporary formatter is outside the application
dependency graph. This comparison does not prove arbitrary future refactors safe.

## Reproduced banner-editor race

1. Save a banner in series A, leaving its response pending.
2. Close that editor and open series B.
3. Deliver A's older response after B's choices load.
4. Change B's banner to Random.

The old success handler restored the shared banner-series ID to A, so step 4
sent another write for A. An older rejection also restored A's previous selection
and status into B's form. Reopening the same series or locking while a request
was pending could likewise let obsolete results overwrite the fresh form.

Each editor opening now owns a banner context containing the target series,
choices, random preview and saved selection. Reads, writes, rejection handlers
and final control restoration retain that context and act only while it is the
current open editor. Opening the same series creates a distinct context. Closing
or locking invalidates ownership. A queued native close event only clears a
context while the dialog is closed, preserving an immediately reopened dialog.
The obsolete closed-editor banner-ID assignment is removed.

The existing revision-aware client remains the only API transport. This UI
ownership correction neither bypasses stale-revision conflicts nor cancels a
server write that already started. Its late result cannot redirect a subsequent
write or change another opening's controls.

## Validation and release state

Seven focused Node controls execute the real Library workflow with disposable
DOM/API fixtures. On baseline source, six controls fail and the pre-existing late
choice-read guard passes. With the correction all seven pass. They cover late
success/rejection, another series, the same series reopened, lock/reopen,
subsequent write identity and obsolete choice reads.

Local validation passes the asset/provenance audit, all **325 Node tests**, static
build and binding/compatibility-aware Functions packaging. Two browser cases use
the real Keeper markup/controllers with fully disposable API responses; they hold
successful/failed banner writes while switching editors and verify both the new
form and the next write target. They do not authenticate to or mutate production.
The existing browser matrix retains upload retries, locking, revision conflicts,
history, recovery, purge and reader coverage.

The local browser archive download is unavailable in this host, so browser
validation is delegated to GitHub CI. The first desktop WebKit job spent 9m43s
installing dependencies and hit its 20-minute overall limit after reaching case
101 of 112. Both new banner cases passed and no assertion failed before the
cancellation. The browser job now allows 30 minutes for installation plus the
complete suite; individual test timeouts, cases and assertions are unchanged.
v2.18.2 is prepared for the fresh matrix; live
production remains v2.18.1 until the checked main workflow publishes and verifies
the release. [Verification evidence](keeper-workflow-verification.json) records
the final CI and deployment state as it becomes available.

Remaining audit work includes readability review of Keeper's shared core/upload
layers, broader editor/maintenance failure fixtures and the separately deferred
unknown-length/concurrent upload memory design. This increment does not claim
complete Keeper coverage or new physical-device/live credential acceptance.
