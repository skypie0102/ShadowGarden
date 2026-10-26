# Unknown-length and concurrent upload buffers

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Follow-up to the [large-upload measurements](UPLOAD_MEMORY.md), measured on
2026-10-23 (Asia/Manila) against v2.18.7 main `69e3fce`. Candidate v2.18.8
preserves the 50 MiB EPUB and 10 MiB cover limits.

## Finding and correction

Unknown-length input retained source chunks and then allocated a contiguous
validated file. The reader now copies each chunk immediately into a growable
ArrayBuffer and transfers it to fixed storage before validation and Web Crypto.
This also prevents corruption when a stream producer reuses its chunk array.
Declared lengths still allocate exactly once and must match the actual input.
Failed readers discard their destination; cancellation failures cannot replace
the intended size, length or interruption error.

Concurrent requests share an isolate's memory. Uploads now acquire an ephemeral
64 MiB admission budget before reading input. A declared length charges that
length; unknown-length input conservatively charges the endpoint's maximum.
Capacity remains held through validation, hashing, provider transfer and activity
cleanup, then releases on success or failure. The only module-level state is a
numeric allocation counter; it contains no request, credentials or durable quota.

Excess admission returns HTTP 503 `upload_busy`, `Retry-After: 5`, before reading
the request, reserving its key or contacting the provider. Keeper can use its
existing Retry action. There is no automatic queue. Input also has a three-minute
deadline, matching Keeper's existing upload timeout; interruption and timeout
return HTTP 408 `upload_interrupted` / `upload_timeout` and release capacity.

EPUB validation, SHA-1, immutable object reservations and catalog adoption remain
required. No bucket, spooling service, schema, binding, compatibility date,
dependency or production setting changes.

## Measurements

Both revisions use local workerd 1.20261012.1, compatibility date 2026-09-23,
Node v24.19.0 and generated valid stored EPUBs delivered in 64 KiB host chunks.
The real handler uses ephemeral migrated D1, disposable authentication and an
intercepted provider that independently checks the exact byte count and SHA-1.
No live objects or catalog writes are used. Profiling hooks exist only in the
disposable bundle. Successful cases retain one reservation per completed file
and no activity markers. The over-limit cases make no provider calls or
reservations.

Maximum sampled ArrayBuffer backing storage, MiB:

| Input | v2.18.7 | v2.18.8 | Result after correction |
| --- | ---: | ---: | --- |
| Single 10 MiB, unknown length | 21.09 | 11.06 | 200 |
| Single 50 MiB, known length | 51.82 | 52.38 | 200 |
| Single 50 MiB, unknown length | 104.01 | 57.08 | 200 |
| Two known 50 MiB inputs | 107.66 | 52.98 | One 200, one retryable 503 |
| Two unknown 50 MiB inputs | 153.97 | 57.56 | One 200, one retryable 503 |
| Unknown 50 MiB + known 14 MiB | 118.16 | 70.52 | Both 200 |

The old overlapping path sampled about 208 MiB in an exploratory run; the
retained final control sampled 153.97 MiB. Garbage collection and checkpoint
timing affect these values. The concurrency improvement partly comes from
admitting fewer simultaneous large uploads; it is not a same-throughput claim.

The 64 MiB budget accounts for admitted application upload buffers, not total
isolate memory. Runtime/transport/native allocations, other handlers and transient
allocations between checkpoints remain outside this accounting. These samples
are not RSS, a native peak, production throughput or a guarantee below
[Cloudflare's per-isolate memory limit](https://developers.cloudflare.com/workers/platform/limits/#memory).
Unknown-length small files reserve the full endpoint limit, conservatively
reducing concurrency. Admission is per isolate, not an account-wide quota.

Raw reports retain every sample and source/runtime metadata:

- [Single-file control](../evidence/upload-buffer-single-2.18.7.json) and
  [candidate](../evidence/upload-buffer-single-2.18.8.json).
- [Overlap control](../evidence/upload-buffer-overlap-2.18.7.json) and
  [candidate](../evidence/upload-buffer-overlap-2.18.8.json).

Reproduce with `npm run profile:uploads -- <ref> <output.json>` and
`node scripts/profile-upload-overlap.mjs <ref> <output.json>`. The overlap harness
holds buffered requests together in one isolate and also covers the exact
64 MiB admission boundary.

## Validation and release

Twelve new controls run against detached baseline `69e3fce`: three pass and nine
fail, with no cancelled cases. All twelve pass after correction; the focused
reader/upload suite passes all 28 cases. Controls cover admission before reads,
no provider/reservation work on rejection, exact budget sharing, capacity held
through provider completion, successful retry, auth/size error precedence,
input interruption/deadline, invalid media, provider failure, reused source
arrays and cancellation failures.

Local `npm run check` passes the asset/provenance audit, all 424 Node tests,
static build and binding-aware Pages Functions package. The tested candidate is
`88eb79ec4f6a79f4fa74c7dd138eba4ad3910e4e` with tree
`db1cddc049eee7a51e2ed7875e3de1945ac69b6f`. Squash merge
`2f81371d8c37ec7fff4e748c3fc77a13aad21812`
has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39943827702) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39945575580)
both pass **424 Node tests** and **666 browser cases** across five profiles,
with nine documented platform skips and zero test retries. The separate Chromium
Library-startup profile passes on the PR and is excluded from the 666 cases.

The automatic workflow publishes **v2.18.8**, source `2f81371`, deployment
`6cd6fd46-9892-43e1-98b0-be14dd9f387a`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.7 rollback. The version check uses one request
over 165 ms. Canonical source/version, both D1-derived
catalogs and the stable footer module pass verification. Independent public HTTP
checks match the same version/source and footer bytes. The exact revision-9
catalog document, all nine snapshots and recorded settings remain unchanged,
with zero database writes. The retained rollback is
`359ab672-1d56-4439-86f2-ea80d8b0cc75`. See
[verification evidence](../evidence/upload-buffer-verification-2.18.8.json).

There is no new live authenticated-upload, CAPTCHA/provider-write or
physical-device acceptance claim.
