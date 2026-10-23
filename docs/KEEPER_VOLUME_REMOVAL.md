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

## Checked release — 2026-10-23

The tested source is `7870509ab0b07ef2c02679496d3716301c5ab72a` and tree
`e829d7ca118fa57191cac68e28c40fd7aac9fb1b`. Squash merge `85f72c0f566bb820f166456918e2ffa4f0743ca0`
has that exact tested tree. The application change is confined to
`public/assets/js/admin/library-workflow.js`; its reviewed SHA-256 is
`bbc72fb529b9a06c5e5771e3b58b5307f4d470b2a2f161be6901a311cad00389`.

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

The version verifier used two checks over 5358 ms in the same publication
attempt, retaining the original before-capture time, changed-asset selection
and rollback identity.

Browser routes and Node fixtures are disposable. No real Keeper authentication,
CAPTCHA, EPUB/provider writes or new physical-device acceptance is claimed.
Production preservation compares the authenticated before/after captures;
HTTP checks and captures are separate reads, not an atomic transaction.
