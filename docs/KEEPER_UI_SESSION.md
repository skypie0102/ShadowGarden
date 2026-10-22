# Keeper UI/session ownership — v2.18.4

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
[Source evidence](keeper-ui-session-equivalence.json) records the stages and
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
selector, allowing a later user choice of Upload or Skip. Unprepared/completed
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
credentials, catalog writes or provider writes are used by these fixtures.

Local validation passes the asset/provenance audit, all **348 Node tests**, static
build and binding/compatibility-aware Functions package. The complete five-profile
browser matrix remains pending.
v2.18.4 is prepared; production remains v2.18.3 until checked main CI publishes
and verifies the release. [Verification](keeper-ui-session-verification.json)
records the final outcome.

The separate unknown-length/concurrent upload-memory design, broader volume and
translation editor races, and remaining dense upload presentation helpers remain
follow-ups. This batch makes no new physical Android/Soul or live credential
acceptance claim.
