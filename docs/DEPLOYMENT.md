# Configure a recovered Pages deployment

The owner authorized production takeover on 2026-10-02. The original site is now
running the reconstruction with its existing B2 bucket and encrypted secrets.
Follow [PRODUCTION_TAKEOVER.md](PRODUCTION_TAKEOVER.md) for the current project,
database, deployment command and verification status. The general setup guidance
below also documents the earlier isolated-test plan.

## Build configuration

- Framework preset: None.
- Root directory: repository root.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node: 24.
- Functions directory: root `functions/`, automatically discovered by Pages.
- Compatibility date: `2026-09-23`, newly selected; original date unknown.
- Do not upload only `dist/` through the dashboard: the Pages Functions must be
  compiled/deployed via Git integration or Wrangler Pages deployment.

On the reconstruction and compatibility branches, the committed Wrangler file
uses an all-zero D1 ID as a local placeholder, not a usable remote database.
On `deploy/shadowgarden-test`, it instead targets the owner's new test database;
follow [the test setup](TEST_DEPLOYMENT.md) for its initialization and resource
boundaries. For a different deployment target, make a private copy
as `wrangler.production.jsonc`, replace the Pages project name and database
identifiers with the actual target values. D1 commands support `--config` for
this private file. Pages dev/deploy do **not** support a custom config path in
the pinned Wrangler version: use an isolated checkout with the reviewed values
in its standard `wrangler.jsonc` when deploying manually.
For Git-based Pages builds, deliberately update the committed non-secret config
to the intended resource names/IDs before reconnecting the production branch.
Do not apply this new schema to an unidentified original database.

## Database and secrets

Create a new D1 database, bind it as `DB`, apply `migrations/`, and explicitly seed
`recovery-info/empty-seed.sql` for a new library. Use `recovery-info/seed.sql`
only when the recovered five-volume demo catalog is wanted. Seeding uses `INSERT OR IGNORE` and never overwrites an
existing library. Local equivalents are in the README. For a configured remote
target, use Wrangler D1 migration/execute commands with `--remote` and your
production config after verifying the database name.

Upgrades must apply `0002_media_purge.sql` before deploying the new Functions.
It adds durable cleanup jobs, upload activity leases and retirement guards.
The test harness applies both migrations to its disposable database.

The owner supplied eight encrypted variable names on 2026-10-01. The backend
now accepts those exact names; no rename or disclosure of their values is needed.
This establishes name compatibility, not proof of valid credentials, permissions
or original session compatibility. Keep the live project while testing a separate
Pages project with its own D1 database and disposable B2 bucket/keys. Configure the
test project's secrets separately; do not assume it inherits the live project's
settings or that production and preview environments have identical settings.

Set secrets through Cloudflare's secret controls, never Git:

| Name | Required for |
| --- | --- |
| `SG_ADMIN_TOKEN` | Existing nonempty Keeper bearer/login token; preserved and matched exactly |
| `SESSION_SECRET` | Independent HMAC secret, at least 32 random characters |
| `SG_MEDIA_SIGNING_SECRET` | Existing media ticket secret, at least 32 characters |
| `SG_TURNSTILE_SECRET_KEY` | Server-side Siteverify |
| `B2_READ_KEY_ID`, `B2_READ_APPLICATION_KEY` | B2 downloads and existence checks; `readFiles` |
| `B2_WRITE_KEY_ID`, `B2_WRITE_APPLICATION_KEY` | B2 uploads; `writeFiles`; cleanup additionally needs `listFiles` and `deleteFiles` |

Set non-secret environment values `SG_TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAME`
(optional exact override), `B2_BUCKET_ID`, and `B2_BUCKET_NAME`. The widget must
permit the actual hostname. An existing encrypted `SG_TURNSTILE_SITE_KEY` works;
it does not need to be recreated as plaintext. The site key is intentionally
returned to the browser for the widget; the Turnstile secret is never returned.
Use bucket/prefix-scoped B2 keys for the same bucket. Authorization uses B2 v4,
which supports both legacy keys and current bucket-group keys. The configured
bucket must be present in the returned restrictions; known bucket names must
also match. Do not grant governance-bypass permission for cleanup.

The screenshot did not show `SESSION_SECRET`, `B2_BUCKET_ID`, `B2_BUCKET_NAME`
or resource bindings. Verify those settings before deploying. This replacement
requires a D1 binding named `DB`; it does not imply the original app used D1.
The media signing secret length and B2 capabilities cannot be verified from an
encrypted-name inventory. `SESSION_SECRET` must be independently generated;
there is no fallback to the media or admin secret. New sessions must be issued
by this backend, even if an existing bearer token is retained.

The earlier reconstruction names remain supported: `ADMIN_TOKEN` overrides
`SG_ADMIN_TOKEN`, `BOOK_SIGNING_SECRET` overrides `SG_MEDIA_SIGNING_SECRET`,
and `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` override their `SG_` versions.
An explicitly configured canonical value wins even when empty or invalid, so
avoid stale duplicate settings. For B2, each complete role-specific pair takes
precedence. Only when neither member of that role's pair is present does it use
the shared `B2_APPLICATION_KEY_ID` / `B2_APPLICATION_KEY` pair. Partial pairs
fail configuration checks; failed reads never retry with write credentials.

Before switching traffic, review the standard `wrangler.jsonc` against the target
project's settings. Pages treats that file as the configuration source of truth
when deploying with it; the committed local database placeholder must be replaced
with the intended test or production database. See Cloudflare's
[Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
and [secrets and bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## Optional legacy mapping import

The owner confirmed that the five recovered book records were test data. Their
EPUBs and mappings are not required to complete this reconstruction. New books
can be uploaded normally, or a new library can start from the empty seed. The
following procedure is optional if preserving a known legacy identity is useful.

Obtain an authorized B2 object inventory or original private catalog/export.
Match the five public book IDs to their real private EPUB objects. Do not invent
paths from titles. The recovered ID algorithm is SHA-256 of
`shadow-garden-book-id-v1\n/media/<object-key>`, truncated to 16 bytes and encoded
as base64url with `bk_` prefix. That permits exact comparison with known keys;
it does not reverse a hash into a missing path.

Keep recovered mappings and exported database state in ignored `private/`.
Example mapping shape (substitute actual evidence-backed values):

```json
{"bk_A2yCOKedG1g4xXTJJhbEzA":"shadow-garden/books/ACTUAL-OBJECT.epub"}
```

Export `SELECT revision,document,updated_at FROM library_state WHERE id=1` using
Wrangler D1's JSON output to `private/state.json`. Generate a guarded migration:

```sh
node scripts/restore-book-map.mjs private/state.json private/book-map.json private/restore.sql
```

The generator performs no network calls or database writes. Inspect the output
and apply it to the same database with Wrangler D1 execute. Verify the final
`updated_rows` is 1; 0 means the export was stale, so export again and regenerate.
A checksummed safety snapshot is included. This updates mappings only; ensure
the referenced EPUB objects actually exist and are accessible using B2 first.

## Verification before production traffic

Run `npm run check` and `npm run test:browser`; test an actual Turnstile unlock on
the intended hostname and one authorized test EPUB upload/read/replace against
non-production resources. Check unauthenticated admin and raw EPUB URLs are
denied. Test backup, recovery and explicit purge with disposable media, including
a B2 key lacking delete permission so retry reporting is verified. Original test
EPUBs are not needed. The automated suite uses isolated sessions and B2 fixtures;
real provider configuration remains a deployment check. See [the audit](AUDIT.md)
for the latest verified CI and browser evidence.

Keeper's Catalog History remains available when a live catalog is structurally
damaged. A valid snapshot can be restored from Catalog History or Recovery Readiness;
the recovery endpoint requires the displayed revision and snapshot checksum; the current
record is retained byte-for-byte in a safety snapshot. Damaged snapshots are
marked and cannot be restored, but may be explicitly deleted. Snapshot restore
changes metadata only. Run recovery readiness to check media for both active
entries and Trash, including recovered covers served by static hosting.

Retain the old Cloudflare deployment and B2 objects while validating the new
project. The current D1 catalog is authoritative for this reconstruction; other
consumers that directly read the original B2 catalog JSON will not see edits.
Export D1 regularly alongside B2 inventory for an off-service backup. There is
no automatic remote backup job. Trash cleanup runs only on an explicit purge or
continuation request; snapshots and referenced media remain protected. Failed
cleanup is visible in Keeper and can resume after configuration is corrected.
