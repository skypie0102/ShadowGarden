# Keeper file-selection and queue lifecycle — v2.18.11

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

File selection now belongs to a queue/session context. Within the current
context, selections run in order: local inspection remains serial, catalog lookup
runs alongside inspection, and Upload waits until preparation settles. Clearing
the queue or locking Keeper replaces the context, so old continuations cannot
append remaining files, change the active editor, publish status or replace the
catalog used by a new queue.

## Reproduced failures and correction

The previous `addFiles` loop retained its selected files across awaits without
checking whether Clear or lock had invalidated the selection. Clearing during
the first inspection could leave the old loop appending its second file into
the empty/new queue. Removing an individual entry also left the old inspection
free to mutate that detached item. Multiple selections could inspect concurrently.

The engine now serializes selections in a context-owned promise chain. Every
inspection result and lookup result checks the current context, and inspection
also checks that its entry remains attached. Clear invalidates queued work and
removes the old rows. Lock preserves ready entries and discards unfinished
checking entries; a new authorized selection can proceed without waiting for an
old inspection to return. Local ZIP/XML work already underway is not forcibly
interrupted; its obsolete result is discarded.

The engine, composed Upload view and safety guidance share the same `preparing`
state. The button stays disabled while inspection or duplicate lookup is pending,
and the upload handler enforces the same boundary even for a synthetic click.
File selection cannot modify a queue during an active upload. Existing serial
upload transactions, explicit Skip, replacement restrictions and session/revision
checks remain.

A duplicate lookup previously cached failures as an empty catalog, preventing
the next selection from retrying. Failures now leave the snapshot unavailable;
the next selection can retry. A late success/failure cannot overwrite a newer
queue, and a newer Library refresh wins over an older lookup. The existing
degraded behavior after a settled lookup failure remains: backend duplicate and
revision validation still apply. No automatic retry loop or new API is added.

## Validation and scope

Fifteen Node controls execute the actual engine, Upload view, safety guidance and
library-event bridge in disposable DOM fixtures. The detached baseline
`1df8bb6` passes three and fails twelve. All fifteen pass after correction; the
focused queue/inspection/Upload suite passes all 51 cases. The fixtures hold and
release asynchronous results explicitly and settle only the engine's zero-delay
yield as a microtask. They do not replace the selection or lookup implementation.

Six browser cases use actual Keeper markup and generated technical EPUBs. They
hold delivery of a real inspection result before the engine captures the service,
then verify Clear, overlapping selection order, lock/reopen, late catalog success
and failure, pending-upload gating and lookup recovery. ZIP/XML inspection and
hashing run normally. The actual client handles intercepted catalog responses;
all admin APIs are disposable, and no upload action is performed.

Local `npm run check` passes 463 Node tests, asset/provenance audit, static build
and binding/compatibility-aware Functions build.

The tested candidate is `c3e8b725a9f230ac938f046d25dc7eff51eca46f`, tree
`66578ae0ce7e9f8afbfcb5f5300a21a5135e3d37`. Squash merge `34eade0f2712442144eaaec49b8a088c74c35f07`
has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40050677211) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40051762262)
both pass **463 Node tests** and **726 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All six new queue
lifecycle cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 726 cases.

The automatic workflow publishes **v2.18.11**, source `34eade0`, deployment
`c1fa8f80-6803-4d80-9d1f-834570a5b1b7`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.10 rollback. The version check uses one request
over 148 ms. Canonical source/version, both D1-derived
catalogs and all three changed queue modules pass verification. Independent
public HTTP checks match the same version/source and exact module bytes. The
exact revision-9 catalog document, all nine snapshots and recorded settings
remain unchanged, with zero database writes. The retained rollback is
`a9acfe26-d51f-4fc6-821e-6b972234cafe`. See
[verification evidence](../evidence/keeper-queue-lifecycle-verification.json).

[Source hashes](../evidence/keeper-queue-lifecycle-source.json)
record the reviewed application files. No backend, API, schema, configuration,
dependency, storage format, reader behavior or upload limit changes. No new
physical-device, credential/CAPTCHA, provider-write acceptance or performance
improvement is claimed.
