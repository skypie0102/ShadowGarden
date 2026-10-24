# Keeper Upload target ownership — v2.18.13

The Upload engine now owns every queue reset, including a confirmed change
between general Upload and a specific Main/Adult series. Closing the dialog
preserves the queue and its target. Reopening that target continues the queue;
opening a different target asks before clearing it. Declining keeps the original
queue and target. An active upload still blocks context changes.

## Reproduced failures

The shell previously cleared visible rows and editor state itself. It did not
invalidate the engine's selection context. A held inspection or catalog lookup
therefore kept the old selection alive. A fresh selection could wait behind
obsolete work, remaining files from the old selection could enter the new queue,
and the old lookup could supply its catalog to that queue. A selection awaiting
its first microtask also had no row, so the old row-count guard missed it.

The close handler independently cleared `addBookTarget` while retaining the
queue. Reopening the same target prompted to discard its queue, and reopening
general Upload failed to recognize the target change.

The engine exposes the narrow `keeper.uploadQueue.reset()` operation. Both Clear
and the shell use that owner. It cancels pending selections and edit timers,
clears rows/catalog/editor state, releases the preview URL and restores waiting
feedback. The shell requests this reset after confirmation and retains target
ownership when the dialog closes. Pending work is checked even before a row
exists. Obsolete local ZIP/XML work is allowed to finish, but its result cannot
publish state or continue the old file selection.

## Validation

Eight new Node controls compose the actual engine, Upload view, safety guidance,
library bridge and shell. They hold asynchronous inspection/catalog results and
check queued-before-start cancellation, immediate fresh preparation, late lookup
success/failure, declined changes, same-target reopening, general Upload after a
targeted queue and the active-upload guard. The v2.18.12 baseline fails six of
the 23 queue controls and passes 17; the corrected implementation passes all 23.

Four added browser cases exercise the actual close/open controls, generated
technical EPUB inspection and the client with intercepted disposable APIs. They
check held inspection, old lookup success/failure and close/reopen/decline/
confirmed-reset behavior. No upload action or live catalog/provider write is
performed. Full CI and production verification are pending for this release.

The first browser run correctly blocked the fresh targeted EPUB because that
disposable series already contained volume 1. The new fixture now verifies
that duplicate guard, then explicitly chooses Add separate before expecting
Upload to enable. Application code and the target-cancellation checks are
unchanged by this fixture correction.

[Source hashes and local evidence](keeper-target-context-source.json) record
the baseline and correction. Local `npm run check` passes 471 Node tests,
asset/provenance audit, static build and binding-aware Functions build.

The Upload changes are confined to `admin-batch.js` and `admin/shell.js`; the accompanying
[stylesheet batch](STYLESHEET_OWNERSHIP.md) preserves its ordered CSS syntax.
Its new public checks also reproduce and correct the separate
[Library loading state](LIBRARY_READINESS.md).
No backend/API/schema/dependency/storage-format/reader-logic/upload-limit change
or performance improvement is claimed.
