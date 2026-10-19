# Large-upload memory

Baseline: v2.16.0, main `4143089`. Follow-up to the
[whole-codebase audit](CODEBASE_AUDIT_2026-10.md), measured on 2026-10-20
(Asia/Manila). The implementation is prepared for v2.16.1; production remains
v2.16.0 until the release verification below is recorded.

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

- [v2.16.0 control](upload-memory-baseline.json)
- [v2.16.1 implementation](upload-memory-2.16.1.json)

The representative 50 MiB declared-length case drops from about 101 MiB to
52–53 MiB of sampled ArrayBuffer backing storage, approximately 48% less.
The 10 MiB case also improves; small-case totals depend more on garbage
collection. Unknown-length 50 MiB inputs remain around 104 MiB.

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
byte above it in both transport modes. Full CI and rollout results will be
recorded here after they complete.

## Remaining work

Unknown-length requests still retain chunks and a contiguous validated file.
Avoid replacing that path with an unbounded native body reader or dropping ZIP
validation. A future streaming/spooling design must preserve immutable upload
coordinates, checksums, retries, provider contracts and catalog adoption rules.
Concurrent-upload memory should be measured as part of that design. The next
independent audit item is browser persistence transaction semantics.
