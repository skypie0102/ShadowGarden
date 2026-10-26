# Large-upload memory

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Historical v2.16.1 measurements follow. The deployed v2.18.8 continuation addresses the
unknown-length and concurrent-upload follow-up with a growable reader and
per-isolate admission accounting; see [current measurements](UPLOAD_BUFFER_BUDGET.md).

Baseline: v2.16.0, main `4143089`. Follow-up to the
[whole-codebase audit](../audits/CODEBASE_AUDIT_2026-10.md), measured on 2026-10-20
(Asia/Manila). Merged for v2.16.1 through
[PR #34](https://github.com/skypie0102/ShadowGarden/pull/34) as `a862ad5`.
Production remains v2.16.0; deployment status is recorded below.

## Finding and correction

The bounded reader retained every input chunk and then allocated another
file-sized array to concatenate them. A 50 MiB EPUB therefore occupied two
file-sized ArrayBuffer allocations before hashing and provider transfer.

`server/http.js` now copies declared-length bodies directly into one exact-size
destination. It continues to count actual bytes against the endpoint limit.
Understated or overstated Content-Length is rejected with 400
`invalid_body_length`, rather than truncating data or returning zero padding.
An actual body exceeding the endpoint limit still returns 413 `body_too_large`.
Unknown-length streams retain the existing bounded collection path.

The Keeper client sends Blob bodies; the HTTP transport supplies their length.
No client-controlled size field or new request header is required. JSON handlers
share this reader and retain their smaller endpoint budgets. The EPUB limit is
still 50 MiB and the cover limit is still 10 MiB. ZIP validation, SHA-1, immutable
coordinates, reservations and cleanup of active-upload markers are unchanged.

## Measurement method

`npm run profile:uploads -- <ref> <output.json>` bundles the real upload handler,
authentication, bounded reader, EPUB validator, hashing and B2 transport into
local workerd. It uses the committed compatibility date, an ephemeral migrated
D1 database, disposable signed sessions and an intercepted provider. The
provider streams the received bytes into an independent SHA-1 calculation and
checks both the hash and exact size. No real account, database or object is used.

Each case starts a fresh workerd process/isolate. Generated stored ZIPs contain
technical fixtures and padding with valid CRCs, not book text. Inputs arrive in
64 KiB host chunks; network/stream layers may reframe them. Cases cover 1, 10
and 50 MiB, with and without Content-Length. The 50 MiB + 1 byte cases must fail
before provider calls or D1 reservations. Successful cases must retain exactly
one immutable reservation and leave no active-upload marker.

The harness uses workerd's DevTools `Runtime.getHeapUsage` at request start,
collection/concatenation where applicable, final buffering, provider entry,
provider drain and completion. Awaited checkpoints exist only in the disposable
bundle. The application has no profiling route or global hook. Both sides use
the same harness and input generation. Raw reports retain all reported fields,
the source hash, Node/workerd versions and byte budgets:

- [v2.16.0 control](../evidence/upload-memory-baseline.json)
- [v2.16.1 implementation](../evidence/upload-memory-2.16.1.json)

Representative maximum sampled ArrayBuffer backing storage, in MiB:

| Input | Declared length | v2.16.0 control | v2.16.1 | Reduction |
| --- | --- | ---: | ---: | ---: |
| 1 MiB | Yes | 2.27 | 2.27 | 0.0% |
| 10 MiB | Yes | 20.35 | 14.74 | 27.6% |
| 50 MiB | Yes | 100.27 | 52.21 | 47.9% |
| 50 MiB | No | 103.91 | 104.00 | No improvement |

Small-case totals depend more on garbage collection. The remaining input sizes
and over-limit results are retained in the raw reports.

These are sampled local isolate allocation measurements, not a production
peak-memory guarantee, whole-process RSS, CPU or upload-speed benchmark.
`usedSize`, `totalSize`, embedder usage and backing storage are distinct fields;
the report does not add them into a claimed total. Garbage collection and
checkpoint timing affect observed values. Native/transient allocations between
checkpoints and concurrent requests are not fully measured.

[Cloudflare's memory limit](https://developers.cloudflare.com/workers/platform/limits/#memory)
applies per isolate, which may handle concurrent requests. The retained
unknown-length buffering and concurrent large uploads still require a compatible
streaming/validation design before claiming a bounded total below that limit.
Do not reduce the supported file limit based only on this experiment.
See also [Cloudflare's memory profiling guide](https://developers.cloudflare.com/workers/observability/dev-tools/memory-usage/).

## Validation and release

Eight reader contract cases cover fragmented input, exact limits, unknown-length
overflow/cancellation, malformed advertised lengths, mismatches, stream failures,
empty bodies and JSON. The real upload-handler tests cover declared-length
success/retry/replacement and reject mismatches before provider access or
reservation. The workerd profile covers exact-limit success and rejection one
byte above it in both transport modes.

[CI run 39332285024](https://github.com/skypie0102/ShadowGarden/actions/runs/39332285024)
passes on attempt 1: asset/provenance audit, 259 Node tests, static build,
binding-aware Functions package and 477 browser cases across five profiles,
with eight existing platform skips and no automatic test retries. The tested
source is `d259667b89820560587a892633264cb47e87c52b`; the merged tree is exactly
the same `3e0be156734af6c261831a697efe169c3efd25d4`.

| Profile | Passed | Existing skips |
| --- | ---: | ---: |
| Desktop Chromium | 97 | 0 |
| Mobile Chromium | 97 | 0 |
| Desktop Firefox | 95 | 2 |
| Desktop WebKit | 95 | 2 |
| Mobile WebKit | 93 | 4 |

This increment is deployed with browser persistence in **v2.17.0** on 2026-10-20,
deployment `f86f42ef-b710-40f8-bf6a-011c47b875e5`, clean source `129a1d2`.
The plugin's upload token worked through a local asset helper after its runtime's
asset requests returned 403. No second sign-in was needed; see
[the transport record](PAGES_UPLOAD_TRANSPORT.md). Both catalogs match D1, and the
exact document, eight snapshots and production configuration are unchanged.
No production database, book-object or credential writes were performed.
This increment adds no live authenticated-upload or physical-device acceptance
claim. [Verification evidence](../evidence/upload-verification-2.16.1.json) retains the tested
source, merge, counts and measurements; [release verification](../evidence/persistence-verification-2.17.0.json)
records the combined live release.

## Remaining work

Unknown-length requests still retain chunks and a contiguous validated file.
Avoid replacing that path with an unbounded native body reader or dropping ZIP
validation. A future streaming/spooling design must preserve immutable upload
coordinates, checksums, retries, provider contracts and catalog adoption rules.
Concurrent-upload memory should be measured as part of that design. The next
independent audit item, browser persistence semantics, is now included in v2.17.0.
The next ordered audit item maps protected-fetch compatibility consumers.
