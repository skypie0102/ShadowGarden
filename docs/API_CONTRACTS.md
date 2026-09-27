# API reconstruction contracts

Every implementation here is inferred. The only server evidence in the archive
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
| `/admin-api/recovery` | GET, POST | Route exists in inventory but no client call was recovered. GET exposes readiness; POST returns 501 for unknown mutation contract |

Maintenance actions: `create-backup`, `restore-backup`, `restore-trash`,
`normalize-taxonomy`, `check-objects` (up to 25 keys),
`apply-cover-optimizations` (up to 100 updates). `purge-trash` is explicitly 501:
original object retention, snapshot reachability and B2 deletion rules are absent.

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
This does not add semantics to the undocumented recovery POST.

Readiness reports `recovery-required` when the live record cannot be read, even
if a usable anchor exists. `ready` requires readable live data plus a checksummed,
structurally valid snapshot with every active and recoverable-trash media object
present. Recovered static images count only when the asset response is an image;
EPUBs never use the static fallback. The separate Deep B2 check remains B2-only.
An empty snapshot needs no provider access. Uninspected snapshots, provider
failures and over-limit candidates remain uncertain.

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
- No automatic expiry or deletion of media objects or snapshots. Failed uploads
  can leave unused objects/reservations; cleanup requires a verified retention policy.

## Fidelity limits

The native B2 v2 API is used for authorization/download/upload; original provider
API choice is unknown. The B2 application key needs only read/write access within
the relevant bucket/prefix; no delete capability is required. Admin uploads check
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

These sources guided compatible replacements; they do not establish what the
lost ShadowGarden Functions originally implemented.
