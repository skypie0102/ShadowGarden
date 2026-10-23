# Keeper volume removal and sibling drafts

The v2.18.7 increment removes a trashed volume card without rebuilding the other
volume forms. It follows the deferred list-rebuild issue in
[volume/translation ownership](KEEPER_VOLUME_OWNERSHIP.md).

## Reproduction and correction

Open two volume editors, type unsaved metadata or translation credits in the
second, then move the first volume to Trash. The previous successful response
called `renderManagedVolumes` for the whole remaining series. That replaced
sibling cards and their inputs, collapsed their editors, discarded drafts and
invalidated pending controls. Series-level drafts were already preserved.

A successful removal now detaches only its original card. It updates the surviving
cards' `data-volume-index` values in their existing order and updates the volume
count. Sibling nodes, fields, translation rows, expansion state, focus and text
selection remain in place. New Save, Trash and translation requests read the
updated indices. Banner choices still refresh. Removing the last volume still
closes the removed series; failed removal retains the forms and permits a retry.

The per-opening/card ownership checks remain. Closing, reopening, locking or
replacing the volume list makes the old card's response obsolete. This correction
does not rebase an unrelated stale editor. All writes still pass through the shared
client and backend revision checks. A sibling write that loses a revision race
shows its conflict, restores its surviving control and retains its draft. A new
attempt reads the new index and the revision advanced by the owned removal.

Only `admin/library-workflow.js` changes application behavior. There are no API,
identity, schema, dependency, configuration, reader or storage-format changes.
No live catalog or provider writes are used for testing.

## Validation

Ten new Node controls fail against main `1a1696b` and pass after correction.
Together with existing Library and volume-ownership controls, all 64 focused
cases pass. They cover first/middle/last-card removal, every editable volume field,
translation-node retention, edits made while removal is pending, Save/Trash/
translation indices, pending sibling conflicts, failed removal and retry.

Six browser cases use the actual Keeper modules and disposable API routes. Three
cover removing each position from a three-volume list while preserving both sibling
forms, all five metadata fields, populated/blank translation rows, expansion,
focused text selection and series drafts. Subsequent metadata, translation and
series writes assert the original book identities, updated indices and revision
sequence. Two cover a pending sibling metadata/translation write losing the
revision race, retaining its form and retrying at the new index. One covers a
failed removal followed by a successful retry.

The existing ownership suite shares the same extracted fixture. Its ordinary
writes now enforce If-Match, and successful metadata responses carry all five
editable fields; deliberate held responses retain their explicit test behavior.
No live credentials, CAPTCHA or production book objects are used.

Complete PR/main CI and production verification will be recorded after release.
