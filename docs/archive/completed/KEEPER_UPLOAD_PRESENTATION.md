# Keeper Upload presentation — v2.18.9

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

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
[source evidence](../evidence/keeper-upload-presentation-equivalence.json).

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
static build and binding/compatibility-aware Functions package.

The tested source is `c34a2946be5e3bd07963276bccc8c1317664218e` and tree
`15bdec25cccacb80448de553e583694eae9a8036`. Squash merge
`7c54e89dcbb3cce5d856fd5a5637321d13e8f9d4`
has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39949717155) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39951611512)
both pass **436 Node tests** and **681 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All three new
presentation cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 681 cases.

The automatic workflow publishes **v2.18.9**, source `7c54e89`, deployment
`e5178997-51bf-4597-872b-181ba415e04a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.8 rollback. The version check uses one request
over 216 ms. Canonical source/version, both D1-derived
catalogs and both changed presentation modules pass verification. Independent
public HTTP checks match the same version/source and both module hashes.
The exact revision-9 catalog document, all nine snapshots and recorded settings
remain unchanged, with zero database writes. The retained rollback is
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`. See
[verification evidence](../evidence/keeper-upload-presentation-verification.json).

No performance improvement, complete Keeper coverage or new physical-device,
credential or provider acceptance is claimed.

The initial browser run stopped in the new scope-switch fixture because it clicked
the checkbox beneath its styled toggle track. The fixture now clicks the visible
label; application sources were unchanged. Final PR/main runs above use the
corrected fixture. The initial run is retained in the machine-readable evidence.
