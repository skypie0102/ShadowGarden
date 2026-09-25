# Configure a recovered Pages deployment

No production deployment or remote database changes were made during reconstruction.

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

The committed Wrangler file is for local reconstruction. Its all-zero D1 ID is
an intentional placeholder, not a usable remote database. Make a private copy
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
`recovery-info/seed.sql`. Seeding uses `INSERT OR IGNORE` and never overwrites an
existing library. Local equivalents are in the README. For a configured remote
target, use Wrangler D1 migration/execute commands with `--remote` and your
production config after verifying the database name.

Set secrets through Cloudflare's secret controls, never Git:

| Name | Required for |
| --- | --- |
| `ADMIN_TOKEN` | Keeper bearer/login token, at least 32 random characters |
| `SESSION_SECRET` | Independent HMAC secret, at least 32 random characters |
| `BOOK_SIGNING_SECRET` | Independent ticket secret, at least 32 random characters |
| `TURNSTILE_SECRET_KEY` | Server-side Siteverify |
| `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY` | B2 authorization |

Set non-secret environment values `TURNSTILE_SITE_KEY`, `TURNSTILE_HOSTNAME`
(optional exact override), `B2_BUCKET_ID`, and `B2_BUCKET_NAME`. The widget must
permit the actual hostname. Use bucket/prefix-scoped B2 keys with read/write
capabilities. No account key, bucket identifier, widget key or original binding
name was recovered from the public archive.

## Restore private books

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

Run `npm run check`; test an actual Turnstile unlock on the intended hostname;
check unauthenticated admin and raw EPUB URLs are denied; test one upload,
replacement, backup and restore against non-production B2/D1 resources; verify
all five original EPUBs in the reader after restoring their mappings. Exercise
desktop and mobile layouts in a real browser. GitHub Actions run `36123630092`
passed all ten automated desktop/mobile workflows against real local Pages/D1.
The CI report includes successful-page screenshots for visual review. These
isolated checks do not authenticate to the original Cloudflare/B2 account or
verify the missing original books and live Turnstile flow.

Retain the old Cloudflare deployment and B2 objects while validating the new
project. The current D1 catalog is authoritative for this reconstruction; other
consumers that directly read the original B2 catalog JSON will not see edits.
Export D1 regularly alongside B2 inventory for an off-service backup. There is
no reconstructed automatic remote backup job or media purge policy.
