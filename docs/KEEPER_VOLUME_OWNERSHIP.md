# Keeper volume and translation ownership — v2.18.5

This batch corrects reproduced editor races in the already-expanded Library and
translation workflows. It changes two frontend modules, with no backend, schema,
dependency, reader, credential or runtime-configuration change.
[Source evidence](keeper-volume-ownership-source.json) records the functional
before/after hashes; this batch makes no formatting-equivalence claim.

## Ownership and drafts

Volume metadata saves, volume Trash, series Trash and volume translation overrides
previously acted on shared editor state after awaiting their responses. Closing
and opening another editor, including the same series again, could let an older
result reset or close that form, show an obsolete alert, refresh its credits or
release a newer operation's control.

The Library workflow now exposes its existing per-opening context to the
translation workflow. Each operation captures that context and its target ID
before sending. Success, failure and control restoration require the same open
editor. Volume operations additionally require their original card to remain in
the volume list. A replacement list invalidates detached-card responses. Repeated
activation cannot duplicate a pending write for the same action.

An active volume save updates the returned catalog and its card's summary without
reopening the whole series editor. Unsaved series fields, series credits and edits
made to the volume while its save was pending remain in place. Volume deletion
rebuilds the volume list and banner choices, retaining the series draft; removing
the final volume still closes the removed series editor.

Series credits load once per editor opening. Catalog refreshes install missing
volume controls without redrawing the current series draft. Closing and reopening
loads saved credits again. A current translation override uses the complete
catalog already returned by its endpoint through the Library owner, avoiding the
old redundant refresh and its draft replacement.

The shared client still owns authorization, session aborts and displayed editor
revisions. Successful owned writes advance that editor's revision through the
existing client; background reads cannot authorize stale edits. An obsolete
presentation result does not undo a write that already committed on the server.
No live catalog or provider writes are used by the tests.

## Validation and release state

Forty-one focused Node controls run both real workflow modules with disposable
DOM/client fixtures. Baseline `4f91de3` passes nine and fails 32; the corrected
sources pass all 41. Controls include late success/failure into different and
reopened editors, detached cards, ordinary successes/failures, duplicate
activation, series drafts, edits during a pending volume save, refresh/reopen and
removing the final volume.

Eleven browser cases exercise actual Keeper markup, workflow composition,
disposable unlock and intercepted APIs. Eight hold success/failure for the four
write actions while switching editors. Three cover volume draft preservation,
translation failure/retry plus refresh, and volume removal/reindexing/last-volume
closure. Subsequent series writes must carry the advanced revision and original
draft payload. No forced interaction, global clock freeze, added skip or timeout
increase is used.

Local asset/provenance audit, all 389 Node tests, static build and the
binding/compatibility-aware Functions package pass. The complete browser matrix
and release remain pending. Production remains v2.18.4 until the checked main
workflow publishes and verifies v2.18.5. See
[verification](keeper-volume-ownership-verification.json).

Volume deletion still rebuilds the list because indices change; preserving other
unsaved volume forms remains a separate follow-up. Unknown-length/concurrent
upload memory and remaining dense upload presentation helpers also remain.
This batch makes no new physical Android/Soul or live credential acceptance claim.
