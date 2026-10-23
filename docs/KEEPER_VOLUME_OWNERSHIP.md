# Keeper volume and translation ownership — v2.18.5

This batch corrects reproduced editor races in the already-expanded Library and
translation workflows. It changes two workflows, one shell scroll call and the Keeper layout stylesheet,
with no backend, schema,
dependency, reader, credential or runtime-configuration change.
[Source evidence](keeper-volume-ownership-source.json) records the functional
before/after hashes; this batch makes no formatting-equivalence claim.

The first candidate also exposed a missed editor-opening click in an existing
Firefox case, before any write was sent. Its trace shows inherited root smooth
scrolling continuing during the pointer action. Keeper now uses automatic root
scrolling for focus and form navigation, and its unlock reset follows that rule.
The rule is in its own layout stylesheet;
public-page and reader styles retain their existing behavior. The
[CSSOM scrolling contract](https://drafts.csswg.org/cssom-view-1/#scrolling) describes
the automatic/smooth distinction. The failed run and trace identity remain in
the verification record.

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
draft payload. No forced interaction or global clock freeze is used; existing
assertions, timeouts and skips are not relaxed.

Local audit, all 389 Node tests, static build and the binding/compatibility-aware
Functions package pass. Browser results come from GitHub CI because the local
browser runtime is unavailable.
[PR #45](https://github.com/skypie0102/ShadowGarden/pull/45) merges as `cfcbcb4036a1f4ee0284e34083b2500d96e901cc`;
release tree `7a1349fd13eb320014ed9f1807515a199e30cf87` matches the tested PR tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39905484804) and [checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39906804272)
both pass **389 Node tests** and **636 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All eleven new Keeper
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 636 browser cases.

The automatic workflow publishes **v2.18.5**, source `cfcbcb4`, deployment
`ee0503a8-826c-46d6-9fc5-3536c70e6b9a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The workflow verifies canonical source/version and both D1-derived catalogs.
Independent public HTTP checks confirm the same source/version and all four
changed assets (three JavaScript modules and the Keeper layout stylesheet)
against the reviewed source. The catalog, all nine snapshots and recorded
settings match the pre-release baseline at revision 9, with zero database writes.
The retained rollback is v2.18.4, deployment
`1367c2ab-0daa-4ab0-8083-534d71edd611`.
The downloaded production artifact matches GitHub's archive digest and the
successful logged report. See [sanitized evidence](keeper-volume-ownership-verification.json).

The first publication completed, but its immediate served-version check mismatched.
A later independent HTTP probe confirmed the expected version/source and all four
assets. Only the deployment job was retried; all passed test jobs were retained.
The successful retry report compares its own before/after baselines. Its immediate
pre-retry deployment is the first v2.18.5 publication; the retained rollback remains
the separately verified v2.18.4 deployment. The first attempt reached the version
check after its data/settings-preservation assertions, as established by the
reviewed verifier's execution order. No first-attempt report artifact was written.
Because the retry starts from the same application source, its automatic asset
selection checks the stable footer module; the four changed assets are verified
by the separate HTTP/source-hash check. This deployment-job retry is separate
from the zero browser test retries.
Bounded waiting for served-version convergence remains a release-tooling follow-up.

Volume deletion still rebuilds the list because indices change; preserving other
unsaved volume forms remains a separate follow-up. Unknown-length/concurrent
upload memory and remaining dense upload presentation helpers also remain.
This batch makes no new physical Android/Soul or live credential acceptance claim.
