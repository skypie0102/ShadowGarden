# Keeper Upload presentation — v2.18.9

This batch expands the remaining dense Upload preflight-report and similar-volume
helpers, then fixes two reproduced presentation boundaries. Similarity remains
a non-blocking warning. Duplicate decisions, validation, immutable upload keys,
session/revision ownership and the serial upload transaction retain their owners.
No API, backend, schema, dependency, setting or reader behavior changes.

## Readability and corrections

`admin/upload-preflight-report.js` and `admin/upload-similar-volume.js` now use
expanded statements and blocks. Pinned Prettier 3.6.2 runs outside the application
dependency graph. The mechanical stage preserves normalized Babel syntax trees
and ordered normalized comments; lines over 180 columns decrease from 17 to 3.
Remaining long lines contain preserved markup. Both final modules additionally
contain the functional corrections below, recorded separately in
[source evidence](keeper-upload-presentation-equivalence.json).

The similar-volume helper annotated action rows and the summary before the
stateful Upload view rebuilt them. A queue render could erase the explanatory
warning and its count while leaving the SIMILAR badge. It now annotates after
the existing `upload:view-rendered` event. Aggregate reporting also observes that
event, so it sees the freshly calculated match. Matching thresholds, scope
boundaries and upload decisions are unchanged.

The aggregate report cached a hand-maintained list of inputs that omitted visible
values. A catalog refresh could rename a matched series without changing the
warning reasons, leaving the report's old label in place. The report now compares
the generated, escaped HTML with its last rendered value. It updates changed
output and preserves the report node and Review control when the output is
unchanged. This removes the separate signature-input list rather than extending
it with another partial copy of presentation state.

## Validation and release

Twelve controls run the real report/similarity modules in disposable DOM fixtures,
including composition with the real Upload view. Detached baseline `ece9309`
passes six and fails six; all twelve pass after correction. Isolated cache cases
cover changed titles, errors, match labels and readiness. Comparisons retain
escaping, unchanged-node reuse, validation details, duplicate decisions, queue
clear/repopulation, scope boundaries and catalog refresh behavior. The focused
Upload/session suite passes all 24 cases.

Three browser cases use actual Keeper markup, local EPUB inspection, metadata
edits and the real catalog-refresh method with intercepted API responses. They
cover warning/count persistence, clearing and restoring matches, switching scope,
renaming a matched series without changing its reasons, and preserving Review
focus when a refreshed report is unchanged. These fixtures make no live uploads
or production catalog/provider writes.

Local `npm run check` passes the asset/provenance audit, all 436 Node tests,
static build and binding/compatibility-aware Functions package. Full PR/main CI
and production verification are pending. No performance improvement, complete
Keeper coverage or new physical-device/credential/provider acceptance is claimed.
