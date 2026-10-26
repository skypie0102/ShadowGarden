# Bounded Keeper history and recovery readiness

> Archived dated record. Historical versions, completion counts and pending statements retain their original scope. See the [documentation index](../../README.md) for active work and current operations.

Baseline: v2.15.0, app source `5718ace`. Deployed as **v2.16.0** on 2026-10-19,
source `4b2aed1`. Exact release evidence is linked below.

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

Merged through [PR #33](https://github.com/skypie0102/ShadowGarden/pull/33) as
`4b2aed1a8f75dc5ad50df5cb5bc8f0d7443488ae`. Its tree exactly matches tested source `e111ee8f099ad192ffa98ee3d49bb49b8482596e`.
[CI](https://github.com/skypie0102/ShadowGarden/actions/runs/39236613307) passes on attempt 1 with zero automatic retries:

- Asset/provenance audit, 250 Node tests, static build and binding-aware Functions package.
- 477 browser passes across desktop/mobile Chromium, Firefox and desktop/mobile
  WebKit, plus eight existing platform skips.
- Twelve focused local Chromium cases: six new UI cases and six existing real
  Pages/D1 history, recovery and purge cases. The existing damaged-snapshot fixture
  now browses older pages before asserting the same restore/delete guards.

Production **v2.16.0** is deployed as `8212de19-5ccb-40bd-9241-14b9427ea565` at
`2026-10-19T10:35:06.445657Z`. Six live desktop/mobile Chromium cases exercise
the deployed Keeper frontend with disposable API responses. They verify pagination,
failed-page retry, refresh cancellation and honest time-limit/unverified copy.
They do not perform a real login or authenticated production snapshot operations.
Actual live endpoint checks verify unauthorized denials for Library, the new
history GET and readiness, plus public challenges, raw EPUB denial and missing
cover behavior. Served source hashes match the built merge.

Both catalogs retain their exact hashes. The refreshed D1 document and all
eight snapshots are exactly unchanged at revision 8. Saved/active bindings, nine
encrypted setting names/types and compatibility settings match the pre-deploy
baseline. No production seed, migration, restore, deletion, media upload or
credential change was performed. [Release evidence](../evidence/maintenance-release-2.16.0.json)
records IDs, hashes, profile counts, measurements, rollback and verification scope.

The asynchronous deadline does not establish a measured peak-heap or CPU bound;
its cancellation limits are described above. Physical Android/Soul and owner
Keeper acceptance retain their earlier release scope. The next audit priority
is profiling the existing large-upload memory behavior.
