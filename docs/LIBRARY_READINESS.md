# Public Library loading state — v2.18.13

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

Full CI and production verification are pending. See the [source and local
evidence](keeper-target-context-source.json), [target ownership](KEEPER_TARGET_CONTEXT.md)
and [stylesheet scope](STYLESHEET_OWNERSHIP.md).
