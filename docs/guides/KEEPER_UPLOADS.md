# Keeper upload feedback

New Books supports a general batch or a batch opened through an existing series’
Add books action. A targeted batch locks its series and library. Each ready row
shows the effective destination, volume number and whether the series already
exists. Metadata edits and duplicate choices update that explanation.

## Duplicate decisions

Duplicates start on **Skip**. The action explanation is associated with the
select for keyboard and screen-reader users.

| Choice | Effect |
| --- | --- |
| Upload | Add the EPUB to the displayed destination. A matching catalog volume is not replaced automatically. |
| Skip | Do not upload or replace this file. |
| Replace existing | Replace the matched volume’s EPUB and incoming metadata, preserving its book identity and reading links. A targeted batch permits this only for a match in that exact series and library. |
| Add separate | Add another volume entry and leave the existing matched volume unchanged. |

A duplicate found only inside the current batch offers Skip and Add separate.
It has no existing catalog volume to replace. Similar-volume warnings remain
advisory; they do not silently change the queue action.

Batch **Replace existing** uses the edited upload metadata. The Series Editor’s
separate **Replace EPUB** action preserves the existing metadata, as documented
in its [release evidence](../archive/evidence/keeper-volume-replacement-release-2.20.0.json).

## Upload and completion

The upload screen shows each file’s destination and current outcome: waiting,
preparing/uploading, catalog update, uploaded, upload failed, skipped or blocked
by invalid EPUB structure. The progress indicator describes batch processing,
with separate uploaded, failed and remaining counts; it is not a network-byte
measurement. A failed request never counts as an uploaded book.

A structurally invalid EPUB needs repair or replacement. A transport or catalog
failure instead retains the reported error and offers review/retry guidance.
Review upload queue returns to the existing metadata/action controls. Uploading
again retries eligible failed files and excludes successfully uploaded entries.

Successful completion removes completed entries only. Skipped and invalid files
remain in the queue, with their original File objects and edited metadata, until
the operator reviews or clears them. They are included in the completion report,
so a successful subset does not appear to upload or discard the rest. Closing
and reopening the same queued batch retains its ownership and action choices.
Changing its destination still requires the existing queue-reset confirmation;
an active upload cannot be retargeted.

Open uploaded series preserves the Main/Adult destination, including custom
series identifiers. A multi-series batch offers a chooser; Back retains the
per-file results, and Review upload queue returns to any remaining files.

## Ownership and checks

The upload engine still owns validation, object upload, catalog adoption and
retry eligibility. `admin-upload-workflow.js` presents effective destinations,
action consequences, per-file results and completion. `upload-safety.js` guards
replacement scope, and `upload-preflight-report.js` separates retryable upload
errors from EPUB structural blocks. The additional stylesheet styles only new
result rows; existing control dimensions and public Library/Series/Reader assets
are retained.

Browser fixtures cover new/existing Main/Adult destinations, duplicate choices,
cross-library replacement rejection, mixed valid/invalid/skipped files, held
catalog updates, partial failure, retry, completion, chooser Back and reopening.
Existing lifecycle regressions cover cancellation, destination-change confirmation,
session lock and stale inspection/catalog responses. All mutation checks use
disposable EPUBs and intercepted admin APIs.
