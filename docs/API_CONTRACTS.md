# API reconstruction contracts

Implementations are inferred from the recovered client or explicitly designed as
replacement contracts. Purge and recovery mutations use the replacement policies below. The only server evidence in the archive
is `recovery-info/FUNCTION_ROUTES.md`, a transcription of the deployment routing
manifest. Actual worker code and the raw manifest were not supplied.

All handlers enforce their methods and return JSON errors with `ok: false`,
`code`, and `error`. Admin routes require both a bearer token and an unexpired,
revocable Keeper session. Writes reject cross-origin requests. No secrets are
returned in error payloads. Success payloads include `revision` when applicable.

| Route | Methods | Evidence and reconstructed behavior |
| --- | --- | --- |
| `/admin-access` | GET, POST, DELETE | `admin/auth-session.js`: challenge `{siteKey,action}`; POST `{adminToken,turnstileToken}`; DELETE revokes cookie/session |
| `/human-access` | GET, POST | `book-access.js`: POST `{token}`; Siteverify action/hostname validation; 12-hour human cookie |
| `/book-access` | POST | `book-access.js`: `{bookId}` or same-origin `{book}`; `{url,bookId,expiresAt,ttlSeconds}`; 428 challenge; 503 missing config/mapping |
| `/media/:path*` | GET, HEAD | Public main/adult catalogs and covers; object-scoped ticket required for EPUBs; supports one byte range |
| `/admin-api/status` | POST | `admin/core.js`: validates bearer + session, returns configuration status and `catalogReadable`; damaged catalog data does not prevent authenticated recovery |
| `/admin-api/library` | GET, POST | `admin/library-workflow.js`: `{main,adult,counts}`; update/delete series or volume; deletion moves metadata to trash |
| `/admin-api/catalog` | POST | `admin-batch.js`: uploaded EPUB/cover keys and metadata; duplicate reject/replace/separate; returns `seriesId,bookId` |
| `/admin-api/upload` | POST | `admin/core.js`: raw bytes with query `key`; B2 upload with bounded body, extension/signature checks, ZIP structure checks for EPUBs and unique key reservation |
| `/admin-api/translations` | POST | `admin/translation-workflow.js`: series/volume credits; sanitized HTTP(S) links |
| `/admin-api/series-banner` | GET, POST | `admin/library-workflow.js`: GET `id` returns `choices,current`; POST `{id,bannerBookId}` |
| `/admin-api/maintenance` | GET, POST | Health/taxonomy/backups/trash; actions listed below |
| `/admin-api/backup` | POST | `admin/history-workflow.js`: `{action:"delete",id}` removes selected snapshot only |
| `/admin-api/recovery-readiness` | GET | `admin/recovery-readiness-workflow.js`: catalog structure, snapshot checksums and active/trash media presence; static recovered covers or B2, protected EPUBs only B2 |
| `/admin-api/abuse` | GET, POST | `admin/abuse-workflow.js`: pseudonymous cooldown events; `{action:"release",clientId}` releases public limits only |
| `/admin-api/recovery` | GET, POST | Route exists in inventory but no client call was recovered. GET exposes readiness; POST `{action:"restore-snapshot",id,sha256}` restores validated metadata with required `If-Match` and a safety backup |

Maintenance actions: `create-backup`, `restore-backup`, `restore-trash`,
`normalize-taxonomy`, `check-objects` (up to 25 keys),
`apply-cover-optimizations` (up to 100 updates), `purge-trash` and `continue-purge`.
The last two use the explicit replacement retention policy below.

## Snapshot validation and damaged-catalog recovery

The replacement storage schema requires main/adult series lists, a private book
map and a trash list. Series and volumes need valid identities, titles and volume
numbers; active identities and mapped EPUB keys must be unique. Media coordinates
and embedded trash records are checked before writes or snapshot restoration.
Missing private mappings remain valid metadata and block object-complete readiness.
This is a reconstruction contract, not evidence of the original database schema.

Maintenance returns `catalog.readable` and snapshot entries with `restorable`,
`integrity: {status,detail}`, and `counts` (null for damaged snapshots). A bad
snapshot remains listed without breaking the rest of history. Restore verifies
both its checksum and structure before mutation; failure returns 409
`backup_damaged`. Explicit snapshot deletion remains available for damaged items.

If the live record is damaged, public catalog reads and ordinary catalog writes
return 503 `catalog_damaged`. Authenticated status, maintenance/history, readiness
and the existing `restore-backup` action remain available. Restore still observes
the revision guard and atomically preserves the exact damaged record in a safety
snapshot. That safety copy remains visible as damaged; it is not blindly restorable.
`POST /admin-api/recovery` accepts only `{action:"restore-snapshot",id,sha256}`.
`If-Match` must equal the displayed catalog revision (428 when absent, 409 when
stale). The checksum must equal the selected snapshot's stored SHA-256; a changed
snapshot returns 409 `backup_changed`. Checksum/structure validation still runs.
The transaction creates `before-recovery` with the exact current serialization,
then advances the catalog revision. The response includes maintenance data and
`recovery: {snapshotId,restored:true}`. No media is uploaded, recreated or deleted.
Keeper readiness exposes `revision` and a validated `readiness.candidate` with
`id,sha256,reason,createdAt,counts,mediaStatus`. It prefers an object-complete
anchor; otherwise metadata restoration remains available with explicit incomplete
or unverified media status. Unknown actions return 400, not an implicit restore.

Readiness reports `recovery-required` when the live record cannot be read, even
if a usable anchor exists. `ready` requires readable live data plus a checksummed,
structurally valid snapshot with every active and recoverable-trash media object
present. Recovered static images count only when the asset response is an image;
EPUBs never use the static fallback. The separate Deep B2 check remains B2-only.
An empty snapshot needs no provider access. Uninspected snapshots, provider
failures and over-limit candidates remain uncertain.
The history panel displays the newest 200 entries. Readiness counts the entire
retained history in the same query that loads its newest three candidates; its
totals do not inherit the panel's display limit or load older document payloads.

## Reconstructed security policy

- HMAC-SHA256 cookies and tickets; independent session/book secrets, minimum 32
  characters. Cookies are Secure, HttpOnly and SameSite=Strict.
- Admin bearer verification uses Web Crypto MAC verification. Sessions are stored
  in D1 so logout revokes replay of the same cookie.
- Turnstile response must succeed and match the requested action and configured
  hostname. Client-only verification is never accepted.
- Fixed windows: 5 admin attempts / 10 minutes; 20 human checks / 10 minutes;
  120 ticket requests / 10 minutes. These limits count attempts, including
  successes; the exact original tripwire policy is missing.
- HMAC-derived client IDs, not raw IPs, are stored. Events retain 30 days; the
  admin UI presents the newest 50. Rate limits are shared across worker instances.
- Book tickets expire after 15 minutes. The per-object cookie supports the
  recovered reader's fetch interceptor, which intentionally discards the URL
  signature and fetches the authorized pathname. Downloads retain the signature.
- Retired catalog entries cannot be downloaded even with an old valid ticket.
- D1 revision-guarded writes plus snapshots protect overlapping edits. `If-Match`
  adds a client revision guard. It does not implement a full multi-editor merge.
  Open admin forms keep the revision of their displayed data across background
  refreshes; successful form writes advance that revision.
- Catalog writes reject EPUB keys already mapped to another book identity (409
  `object_already_mapped`). Trash restores reject any book identity already active
  in either library (409 `restore_conflict`), leaving the trash item recoverable.
- No automatic expiry of media objects or snapshots. Only explicitly requested
  Trash cleanup deletes media. Uncataloged orphan uploads are not swept.

## Deployment configuration compatibility

`ADMIN_TOKEN`, `BOOK_SIGNING_SECRET`, `TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET_KEY` accept the owner's corresponding aliases
`SG_ADMIN_TOKEN`, `SG_MEDIA_SIGNING_SECRET`, `SG_TURNSTILE_SITE_KEY` and
`SG_TURNSTILE_SECRET_KEY`. An explicitly defined canonical setting takes
precedence, including an empty or invalid value. Existing strength requirements
still apply. `SESSION_SECRET` is independent and has no alias or fallback.

B2 GET/HEAD requests use `B2_READ_KEY_ID` / `B2_READ_APPLICATION_KEY`; uploads
and cleanup list/delete requests use `B2_WRITE_KEY_ID` / `B2_WRITE_APPLICATION_KEY`.
For each role, the shared `B2_APPLICATION_KEY_ID` / `B2_APPLICATION_KEY` pair is
used only if neither role-specific variable is defined. Partial role pairs fail
closed; read failures never escalate to write credentials. Authorization tokens
are cached separately by role/key ID, invalidated on key rotation, and checked
against the configured bucket restriction on both fresh and cached responses.
`B2_BUCKET_ID` and `B2_BUCKET_NAME` remain explicit requirements.

## Permanent Trash purge and cleanup

`POST /admin-api/maintenance` with `{action:"purge-trash",ids:[...]}` requires
`If-Match` of the displayed live revision. An empty array means all displayed
Trash; duplicate or invalid IDs return 400, a changed selection returns 409.
Unreadable live catalogs cannot purge. D1 atomically removes the selected Trash,
prunes private book mappings no longer referenced by remaining catalog/Trash
metadata, advances the revision, and records a durable cleanup job. Purge does
not create another snapshot of the removed entries. Existing snapshots remain.

Every literal media reference in the live document and **all** retained snapshots
protects its key, including old maps, damaged snapshots and history beyond the
200-row display limit. SQL triggers atomically check references before reserving
a key for deletion. A permanent retirement record then prevents catalog writes,
restores, snapshot imports and uploads from reusing it while deletion is in
progress or afterwards. An active upload lease also defers deletion. Bundled
public cover assets are retained and never deleted through B2.

Cleanup lists versions for the exact object name and deletes up to five per key,
including older versions and hide markers, without following prefix neighbours
or bypassing Object Lock/legal holds. It verifies absence after deletion. Each
request handles at most three keys within a 20-second work budget; provider
requests use bounded timeouts. A job lease prevents routine duplicate workers;
immutable version IDs and persistent retirements make retries safe. The app must
be the only writer of these keys; external writers must also honor retired keys.

Responses include `purge` with job ID, counts (`deleted,staticAssets,retained,
failed,pending`), `running`, `complete`, and limited issue details. HTTP 200 means
cleanup is complete; 202 means metadata was removed but cleanup remains pending,
protected or failed. Storage errors never undo the metadata transaction or imply
successful file deletion. `{action:"continue-purge",jobId}` retries unfinished
work. Keeper shows errors and a continuation control, including after reload.
Maintenance lists up to 20 jobs, unfinished first and least recently attempted
first, so retrying rotates older work into view. Jobs do not run on a scheduler.

Retained snapshots are never deleted by cleanup. Owners may explicitly delete a
snapshot in Catalog History and then continue its cleanup job. Files stay while
any other reference exists. A protected job can therefore remain pending for as
long as recovery history is retained. Missing B2 configuration, missing delete
permissions and provider retention locks remain visible, retryable failures.

## Fidelity limits

The native B2 v4 API is used for authorization, including the nested
`apiInfo.storageApi` endpoints and `allowed.buckets` restrictions. It supports
legacy keys and current bucket-group keys; cached authorization rechecks the
configured bucket ID and any known name. Upload preparation, version listing and
deletion retain their v2 operations; downloads use the authorized download URL.
The original provider API choice is unknown. B2 keys need bucket/prefix-scoped access: `readFiles` for
the read pair and `writeFiles` for the write pair. Trash cleanup additionally
needs `listFiles` and `deleteFiles` on the write pair. Admin uploads check
ZIP structure and expansion bounds but do not replace a full EPUBCheck audit.

D1 holds private mappings and catalog revisions. The seed contains no invented
EPUB keys. D1 state is not an import of any original production schema. Backups
created here are a new history, not recovered B2 snapshots. Snapshot readiness is
bounded to the newest three candidates and at most 25 objects per candidate;
larger candidates remain uncertain, not falsely verified.

## Implementation references consulted

- [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [D1 transactions and batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [B2 account authorization](https://www.backblaze.com/apidocs/b2-authorize-account)
- [B2 upload URL](https://www.backblaze.com/apidocs/b2-get-upload-url)
- [B2 file upload](https://www.backblaze.com/apidocs/b2-upload-file)
- [B2 API version compatibility](https://www.backblaze.com/docs/cloud-storage-native-api-versions)
- [B2 file versions](https://www.backblaze.com/apidocs/b2-list-file-versions)
- [B2 version deletion](https://www.backblaze.com/apidocs/b2-delete-file-version)

These sources guided compatible replacements; they do not establish what the
lost ShadowGarden Functions originally implemented.
