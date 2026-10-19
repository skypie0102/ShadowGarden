# Bounded Keeper history and recovery readiness

Baseline: v2.15.0, app source `5718ace`; implementation targets v2.16.0.
Production remains v2.15.0 until release verification is recorded below.

## Ownership and limits

| Owner | Contract |
| --- | --- |
| `server/snapshot-history.js` | Ten snapshot summaries per page; metadata-only lookahead and total; checksum/structure inspection one document at a time |
| `server/state.js` | Shared full-record lookup, live catalog persistence, snapshot validation and bounded recovery metadata query |
| `server/catalog-health.js` | Existing catalog/reference health calculation, extracted without changing its contract |
| `server/recovery-readiness.js` | Readiness report, presence checks and a request-owned 20-second deadline |
| `server/storage.js` | Caller cancellation reaches provider authorization, object reads and Assets; late/discarded responses release bodies |
| `admin/history-workflow.js` | Page loading, retry, refresh, retained count and rejection of obsolete results |

History reads metadata for at most eleven entries: ten rows and one lookahead.
It then loads/validates only the selected documents, one at a time, retaining
summaries rather than an array of serialized catalogs. `GET /admin-api/maintenance`
and mutation responses include the first page and `history` metadata. Authenticated
`GET /admin-api/backup?cursor=…` retrieves another page without repeating the health,
taxonomy or purge-job reports. Existing snapshot creation, deletion, checksum
validation and revision/safety-backup behavior remain.

The opaque cursor carries the last selected timestamp and ID. Ordering is
`created_at DESC, id DESC`; values are validated and bound as SQL parameters.
Equal timestamps are deterministic, and deleting the boundary snapshot does not
skip the next page. A metadata-only count and page selection share one statement,
including empty pages. A snapshot deleted between metadata selection and full-row
lookup is omitted. Concurrent edits remain live: newer entries appear on refresh;
separate pages do not represent one frozen database transaction.

The panel loads older summaries on explicit request, preserves existing rows and
the cursor after a failed page, and exposes refresh/retry controls. Refresh or
session lock cancels an obsolete page and prevents it from appending later.
Snapshot retention is unchanged; the old copy claiming only fifteen were kept is
removed. Paging does not limit references protected by Trash/purge operations.

Readiness retains its three-candidate and 25-keys-per-candidate limits (75 maximum).
It counts all retained snapshots while fetching only candidate metadata and one
full snapshot at a time. Its overall asynchronous deadline covers authentication, live/metadata
reads, checksum work and media probing, including storage authorization and Assets.
The request signal and deadline propagate to read transports. A provider/binding
that ignores abort cannot keep the report waiting or turn a late result into a
recovery anchor. Late response bodies are discarded.

An exhausted media check returns a partial report with
`readiness.budget: {limitMs:20000,exhausted:true}`. Unfinished candidates remain
uncertain with `mediaStatus: "unverified"`; they are not declared missing or READY.
If the deadline expires before a report can be constructed, the endpoint returns
408 `readiness_timeout`; caller cancellation returns 408 `readiness_cancelled`.
Readable live data and a fully validated, object-complete anchor are still required
for READY. Catalog-only recovery remains an explicit checksummed/revision-guarded
choice. The UI distinguishes unverified media from media proven incomplete.

The deadline bounds asynchronous waiting; it does not preempt synchronous
JavaScript or forcibly terminate a D1 query already running. In-flight operations
are signalled where supported and late results are ignored. These endpoints do
not add background jobs or perform media/database writes as part of inspection.
Deep B2 check and destructive cleanup retain their separate existing contracts.

## Reproduction and measurements

The disposable SQLite fixture contains 205 valid snapshots. Each serialized
snapshot is 62,872 bytes. Instrumentation measures documents returned by D1-style
calls, not HTTP response size, browser traffic or peak V8 heap.

| First history request | v2.15.0 control | Corrected implementation |
| --- | ---: | ---: |
| Largest batch of full documents | 200 | 1 |
| Largest full-document payload in one D1 result | 12,574,400 bytes | 62,872 bytes |
| Total serialized document bytes read | 12,574,400 bytes | 628,720 bytes |
| Documents inspected | 200 | 10 |

The first-page document transfer falls 95%; the largest D1 document result falls
99.5%. These are payload/retention measurements, not a claimed wall-time or heap
benchmark. Larger histories remain accessible through subsequent explicit pages.

Four initial controls fail on the baseline: the bulk history result, stalled B2
authorization, stalled B2 object read, and stalled Assets read. Deterministic clocks
advance beyond 20 seconds while the transport deliberately ignores abort; the
corrected response completes, signals cancellation and rejects/discards late
successful responses. Additional tests cover tied dates, concurrent inserts and
boundary deletion, damaged older pages, malformed cursors, authorization/method
checks, caller cancellation and stalled metadata.

## Validation and release

Local asset/provenance audit, 250 Node tests, static build and the binding-aware
Wrangler 4.151.1 Functions package pass. Twelve focused desktop/mobile Chromium cases pass: six new UI cases and six
existing real Pages/D1 history, recovery and purge cases. The full five-profile CI
matrix is pending. Browser cases cover page failure/retry,
refresh versus a pending old page, and honest time-limit/unverified presentation.
The existing real Pages/D1 recovery and purge cases remain required.

No schema, binding, compatibility date/flag, credential, storage format, book ID,
reader layout or image-gesture change is included. Release verification refreshes
and compares the production catalogs, exact D1 document/snapshots and saved/active
configuration. No production seed, restore, deletion or media upload is required.
The next audit priority is measuring the existing large-upload memory behavior.
