# Public Library loading state — v2.18.13

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

The stylesheet comparison exposed an existing accessibility defect: Main and
Adult library markup starts with `aria-busy="true"`, but the controller never
cleared it after loading. The visible cards could be ready while assistive
technology still received a busy region. Failed loads also left loading
placeholders beside the error message.

The controller now clears `aria-busy` in the catalog initialization `finally`
block, after either rendering results or showing the failure. The failure path
also removes stale loading placeholders. Pending requests remain busy. This is
a loading-state correction; catalog source, filtering, incremental rendering,
sorting, reading state and storage contracts remain.

Six browser controls cover Main/Adult populated, empty and failed catalogs.
Each runs the actual dated v2.18.12 controller as an independent baseline, then
the served candidate with an independently held catalog response. The baseline
stays busy after every settled outcome; the candidate stays busy while pending
and clears it on settlement, with no residual loading placeholders. Both paths
use disposable intercepted catalogs and perform no live writes. The dated
controller fixture is test-only and is excluded from production.

The public stylesheet comparison retains its readiness assertion. The new CSS
cases are named `css-readability.spec.mjs`, placing them before the longer reader
suite in the normal test order so a fixture failure is found sooner.

The tested candidate is `eee9f03e382fe5cd7a3b7f658184f369c101c078`, tree
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
original publication/rollback records are retained in the verification evidence. See the [source and local
evidence](../evidence/keeper-target-context-source.json), [target ownership](KEEPER_TARGET_CONTEXT.md)
and [stylesheet scope](STYLESHEET_OWNERSHIP.md).
