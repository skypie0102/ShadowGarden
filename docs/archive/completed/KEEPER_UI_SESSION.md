# Keeper UI/session ownership — v2.18.4

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

This batch expands five Keeper UI/session modules and fixes reproduced editor and
upload continuation bugs. The shared API client still owns authorization,
request cancellation, immutable object coordinates and revision preconditions.
No backend, database schema, storage configuration or reader changes are included.

## Readability scope

| Module | Responsibility |
| --- | --- |
| `admin/app.js` | Ordered module loading and workflow composition |
| `admin/auth-session.js` | Verification, cooldown and lock/unlock ownership |
| `admin/shell.js` | Dialog focus and targeted-upload context |
| `admin/editor-interactions.js` | Dirty state, genre controls and upload review |
| `admin/motion.js` | Presentation-only motion observers |

All five mechanical formatting stages preserve normalized Babel ASTs and ordered
normalized comments. Lines over 180 columns decrease from 33 to 3. Four final
files remain formatting-only; the editor interaction module includes the separate
dirty-state correction. Pinned Prettier 3.6.2 runs outside the app dependencies.
[Source evidence](../evidence/keeper-ui-session-equivalence.json) records the stages and
final hashes, including the three already-expanded functional owners below.

## Reproduced corrections

The series form previously waited 80 ms before recording its initial values.
An edit during that window could become the supposedly unchanged baseline:
Save stayed disabled and closing skipped discard confirmation. The baseline now
captures after the composed fields settle in the opening's microtask turn. An
opening counter prevents an obsolete capture from applying to another opening.
A failed current save also returns its label from Saving to Unsaved changes.

Series metadata saves now belong to a particular editor opening, matching the
existing banner ownership rule. A late success or failure for a closed editor
cannot close another/reopened editor, overwrite its catalog view, show an obsolete
alert or release its Save control. The shared API still preserves the displayed
form revision; ignoring obsolete presentation does not authorize stale writes or
undo a write that already committed on the server.

Upload batches now retain the session generation in which they started. The
existing client aborts in-flight requests on lock; the engine additionally checks
its generation after local asynchronous preparation and before subsequent writes.
Locking and reopening while waiting for a wake lock or cover preparation cannot
resume the old batch with the new session's authorization. Stopped items remain
failed/reviewable, and an explicit retry can start in the new session. Completed
objects are not automatically deleted or rolled back. EPUB, cover and catalog
writes keep their existing serial order and immutable-key rules.

A retained Skip previously had no visible action control after its duplicate
partner was removed: the presentation workflow hid the entire selector when
there was no duplicate. Ordinary prepared entries now keep their Queue action
selector, allowing a later user choice of Upload or Skip. Its stylesheet follows
the owner’s explicit hidden attribute instead of hiding all nonduplicate rows. Unprepared/completed
entries keep their existing hidden presentation, and active uploads disable
these controls.

## Validation and release state

Thirty focused controls run the real editor, Library owner and upload engine
against disposable DOM/client/preparation fixtures. Baseline `35ece1e` passes 19
and fails 11; the corrected sources pass all 30. Comparisons retain ordinary
successful/failed saves, the existing banner races, unchanged/reverted fields,
banner exclusion and uninterrupted serial uploads.

Five new browser cases exercise the real Keeper UI with disposable API responses:
an immediate edit and failed-save retry, late save success/failure, and lock/reopen
during wake-lock/cover preparation followed by an explicit upload retry. The
existing duplicate-removal case also changes a retained Skip back to Upload and
back again, verifying that the user's later choice remains effective. No live
credentials, catalog writes or provider writes are used by these fixtures. The
early-edit case holds only the former named 80 ms baseline callback; UI timers
and animation frames run normally, and Save must remain enabled both before and
after releasing any held baseline callback.

Local validation passes the asset/provenance audit, all 348 Node tests, static
build and binding/compatibility-aware Functions package. Browser results come
from GitHub CI because the local browser runtime is unavailable.
[PR #44](https://github.com/skypie0102/ShadowGarden/pull/44) merges as `9ccfa8981d9d44530001dff2a5ea123e8bd097e8`;
its release tree `d2422ea958093a9d95d7d2f3a4ed6dad982cfd1c` matches the tested PR tree.

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
The retained production artifact matches the successful log. See
[sanitized evidence](../evidence/keeper-ui-session-verification.json).

The separate unknown-length/concurrent upload-memory design, broader volume and
translation editor races, and remaining dense upload presentation helpers remain
follow-ups. This batch makes no new physical Android/Soul or live credential
acceptance claim.
