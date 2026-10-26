# Keeper Upload target ownership — v2.18.13

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

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
performed. The tested candidate is `eee9f03e382fe5cd7a3b7f658184f369c101c078`, tree
`b001b1aee4080a0cba250e0d79fb403b3c0e8059`. Squash merge `8d500eb163edad0f8e2d4639e365504e1bddee51` has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40065545158) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40066899682) both pass
**471 Node tests** and **821 browser cases** across five profiles, with nine
documented platform skips and zero test retries. All five new CSS cases, ten
queue-lifecycle cases and six Library readiness cases pass in every profile.
The separate Chromium Library-startup profile passes on the PR and is excluded
from the 821 cases.

All **95 new same-DOM comparisons** match decoded RGBA pixels and computed-style/
geometry hashes, including the served/restored candidate control. All 21 changed
sheets are loaded across each profile's compared states. Six representative
desktop/mobile captures were visually reviewed. Settled frames and the recorded
default/349/761 widths define this scope; no exhaustive viewport, animation-frame
or resize-transition equivalence is claimed.

The workflow publishes **v2.18.13**, source `8d500eb`, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
Publication completes in one attempt; the version check uses one request over
204 ms. All **27 production checks** pass: canonical source/version,
both D1-derived catalogs and all 24 changed CSS/JavaScript assets. The exact
revision-9 catalog document, all 9 snapshots and recorded settings remain
unchanged, with zero database writes. The retained v2.18.12 rollback is
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786`.
See [verification evidence](../evidence/keeper-target-stylesheets-verification.json).

The interrupted independent checks were completed after the workspace was
restored. Public HTTP reads confirm v2.18.13/source `8d500eb` and exact bytes for
all 24 changed assets. The downloaded production artifact matches the sanitized
logged report and GitHub's SHA-256 archive digest. The follow-up results and the
original publication/rollback records are retained in the verification evidence.

The first browser run correctly blocked the fresh targeted EPUB because that
disposable series already contained volume 1. The new fixture now verifies
that duplicate guard, then explicitly chooses Add separate before expecting
Upload to enable. Application code and the target-cancellation checks are
unchanged by this fixture correction.

[Source hashes and local evidence](../evidence/keeper-target-context-source.json) record
the baseline and correction. Local `npm run check` passes 471 Node tests,
asset/provenance audit, static build and binding-aware Functions build.

The Upload changes are confined to `admin-batch.js` and `admin/shell.js`; the accompanying
[stylesheet batch](STYLESHEET_OWNERSHIP.md) preserves its ordered CSS syntax.
Its new public checks also reproduce and correct the separate
[Library loading state](LIBRARY_READINESS.md).
No backend/API/schema/dependency/storage-format/reader-logic/upload-limit change
or performance improvement is claimed.
