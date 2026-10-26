# ShadowGarden deployment configuration

The existing site uses maintained source in `skypie0102/ShadowGarden`, its
initialized D1 database and existing B2 bucket. [Production operations](../archive/recovery/PRODUCTION_TAKEOVER.md)
identify those resources and guarded packaging/verification. This guide covers
local or deliberately isolated new-environment configuration.

## Build configuration

- Framework preset: None.
- Root directory: repository root.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node: 24.
- Functions directory: root `functions/`, automatically discovered by Pages.
- Compatibility date: `2026-09-23`, pinned in `wrangler.jsonc`.
- Do not upload only `dist/` through the dashboard: the Pages Functions must be
  compiled/deployed via Git integration or Wrangler Pages deployment.

The committed `wrangler.jsonc` identifies the production Pages project, D1 and
B2 bucket. Local development uses local D1 state. For a different remote target,
use an isolated checkout with reviewed values in the standard `wrangler.jsonc`.
The historical database name `shadowgarden-test` now identifies production;
it is not a disposable test target.

The pinned Pages dev/deploy CLI does not support an alternate config path; D1
commands do. The automated harness creates a separate local project/database,
ignoring developer secrets. `npm run check:functions` compiles the project config
and checks actual release-bundle bindings.

## Database and secrets

For a genuinely new environment, bind an isolated database as `DB`, apply all
migrations and initialize an empty library with `recovery-info/empty-seed.sql`.
Use `recovery-info/seed.sql` only for optional demo metadata. Seeds use
`INSERT OR IGNORE`. Production is already initialized and must not be reseeded
during an upgrade. Local equivalents are in the README.

The schema includes `0002_media_purge.sql` for cleanup jobs, upload leases and
retirement guards. Check pending migrations for the intended target when future
changes add one. The browser harness applies every migration to its disposable
local database.

Keep the existing project's encrypted names and B2 bucket. Separate remote
environments require deliberate provider/database configuration and do not
inherit the live site's settings. Automated tests use fixtures; genuine provider
checks are recorded separately.

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

B2 API/download endpoints use `*.backblazeb2.com`, while the upload URL returned
by `b2_get_upload_url` can use `pod-*.backblaze.com`. The upload-only validator
accepts these documented pods and preserves the returned URL, path and query.
HTTPS, credential-free URLs, standard ports and redirect refusal remain required;
API/download requests do not inherit the upload-host exception. See Backblaze's
[native upload guide](https://www.backblaze.com/docs/cloud-storage-upload-files-with-the-native-api).

The backend requires `DB` and an independent `SESSION_SECRET`. Encrypted names
alone cannot establish value validity, media signing length or B2 permissions.
Sessions must be issued by this backend even when a bearer token is retained.

Canonical aliases remain supported: `ADMIN_TOKEN` overrides `SG_ADMIN_TOKEN`,
`BOOK_SIGNING_SECRET` overrides `SG_MEDIA_SIGNING_SECRET`, and
`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` override their `SG_` versions.
An explicitly configured canonical value wins even when empty or invalid, so
avoid stale duplicate settings. For B2, each complete role-specific pair takes
precedence. Only when neither member of that role's pair is present does it use
the shared `B2_APPLICATION_KEY_ID` / `B2_APPLICATION_KEY` pair. Partial pairs
fail configuration checks; failed reads never retry with write credentials.

Before switching traffic, review the standard `wrangler.jsonc` against the target
project's settings. Pages treats that file as the configuration source of truth
when deploying with it; compare project/database/bucket values with the intended
environment before publishing. See Cloudflare's
[Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
and [secrets and bindings](https://developers.cloudflare.com/pages/functions/bindings/).

## Optional legacy mapping import

The owner confirmed that the five recovered book records were test data. Their
EPUBs and mappings are not required by the current application. Upload new books
normally, or initialize a new isolated library with the empty seed. The
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
real provider configuration remains a deployment check. See [the audit](../archive/audits/AUDIT.md)
for the latest verified CI and browser evidence.

Keeper's Catalog History remains available when a live catalog is structurally
damaged. A valid snapshot can be restored from Catalog History or Recovery Readiness;
the recovery endpoint requires the displayed revision and snapshot checksum; the current
record is retained byte-for-byte in a safety snapshot. Damaged snapshots are
marked and cannot be restored, but may be explicitly deleted. Snapshot restore
changes metadata only. Run recovery readiness to check media for both active
entries and Trash, including recovered covers served by static hosting.

Retain the old Cloudflare deployment and B2 objects while validating the new
project. The current D1 catalog is authoritative for ShadowGarden; other
consumers that directly read the original B2 catalog JSON will not see edits.
Export D1 regularly alongside B2 inventory for an off-service backup. There is
no automatic remote backup job. Trash cleanup runs only on an explicit purge or
continuation request; snapshots and referenced media remain protected. Failed
cleanup is visible in Keeper and can resume after configuration is corrected.
