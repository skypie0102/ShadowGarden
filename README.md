# ShadowGarden — reconstructed source

Repository: https://github.com/skypie0102/ShadowGarden

This `deploy/shadowgarden-test` branch targets the owner's separate test D1
database. Follow [the test setup](docs/TEST_DEPLOYMENT.md) before connecting a
new test Pages project. Its resource configuration is not for the live project.

This repository reconstructs the 2.11.0 Cloudflare Pages deployment from the
supplied recovery archives. The recovered browser app is retained, with a new
backend derived from its request/response contracts. It is **not the original
lost repository or Git history**.

148 deployed files were recovered. Of those, 139 remain byte-identical; nine browser
scripts have documented compatibility/safety changes. The archive contains one
cataloged series, five opaque book IDs and ten cover images. The owner confirmed that the five EPUBs were disposable test data; their absence
is not a reconstruction blocker. Original server source and production credentials
were not in the archive. The backend is a documented replacement.

## Local development

Use Node.js 24 (minimum 22.16).

```sh
npm ci
npm run db:local
npm run seed:empty
npm run dev
```

Use `npm run seed:local` instead to initialize the recovered demo catalog. Both
seeds preserve any existing library. Open the URL printed by Wrangler. The recovered public catalog and covers work
without B2 credentials. Keeper unlock and protected book access intentionally
return configuration errors until configured; there is no development bypass.
Copy `.env.example` to `.dev.vars` and fill it with your own credentials when
testing those flows. For an end-to-end local unlock, use a dedicated development
Turnstile widget with an allowed development hostname; keep hostname and action
validation enabled. The automated tests mock the provider response, without
adding a bypass to the application.

```sh
npm run check
npm audit
```

`check` validates recovered assets, literal dependencies and route coverage;
runs the SQLite-backed contract/security tests; builds `dist/`; and compiles
the Pages Functions with Wrangler. It does not access production services.

For desktop and mobile Chromium checks against real local Pages/D1:

```sh
npx playwright install --with-deps chromium
npm run test:browser
```

The browser harness creates and removes a disposable project/database beneath
`.wrangler/`, with public fixture credentials. It never uses `.dev.vars`, the
developer database, or remote resources. It checks public navigation, the adult
gate, missing-book errors, admin edits/conflicts, trash restore/purge, cleanup continuation, damaged
snapshots and recovery of a damaged live catalog. Fault injection is restricted
to that disposable fixture database; the application has no test bypass. Admin
tests seed a signed test session; live Turnstile, B2 and actual EPUB reading remain
separate integration checks. GitHub Actions runs both test suites and retains
the browser report for seven days. Reports also include successful-page captures
of the public screens, Keeper editor and recovery states for desktop/mobile review.

## Layout

| Path | Purpose |
| --- | --- |
| `public/` | Recovered static deployment, plus routing/header rules |
| `functions/` | All 15 routes from the recovered route inventory |
| `server/` | New backend, auth, B2 access, catalog transactions and EPUB checks |
| `migrations/` | New D1 schema, explicitly not the original database schema |
| `recovery-info/` | Recovery reports, hashes and idempotent public catalog seed |
| `scripts/` | Build, audit and private mapping migration generator |
| `tests/` | SQLite/client contract tests and isolated Pages/D1 browser checks |
| `docs/` | API contracts, deployment setup and audit results |

## Backend behavior

Public catalogs come from D1 after initialization; otherwise the recovered
public snapshot is used. B2 stores private EPUBs and newly uploaded covers.
Recovered cover images remain available as static assets. This D1 design is
a reconstruction choice, not evidence of an original D1 binding. Catalog
changes are **not mirrored back into the original B2 catalog JSON objects**.

Keeper requests require a bearer token and a revocable, signed session created
after server-side Turnstile validation. Readers receive a 12-hour human session
and 15-minute, object-specific book tickets. Private objects never fall back to
public static hosting. Catalog writes use revision checks and create checksummed
snapshots, except explicit permanent Trash purge. Snapshots must pass checksum and structural validation before restore.
Keeper history stays accessible when the live catalog is damaged; restoring a
valid snapshot preserves the damaged record in an exact safety copy. Book
replacements use fresh object keys and retain old bytes.

Catalog editing, translations, banners, upload, backups, restore, taxonomy,
cover optimization, object checks and basic cooldown telemetry are reconstructed.
Trash purge now removes selected metadata and queues bounded, retryable B2
cleanup. Live references, all retained snapshots, active uploads and bundled
covers are protected. Recovery restores a selected validated snapshot with a
revision/checksum guard and an exact safety backup. These are explicit replacement
contracts; original tripwire scoring and retention policies remain unknown.

Apply **all D1 migrations, including `0002_media_purge.sql`, before upgrading**.
Media cleanup requires B2 `listFiles` and `deleteFiles` capabilities in addition
to the existing read/write access. Keeper shows failed or protected cleanup jobs
without claiming their files were deleted.

The owner's existing `SG_*` security names and separate `B2_READ_*` / `B2_WRITE_*`
credential pairs are supported. Keep those names; the replacement also needs an
independent `SESSION_SECRET`, explicit B2 bucket identifiers and the new `DB`
binding. The deployment guide explains precedence, permissions and test setup.

See [RECONSTRUCTION_LOG.md](RECONSTRUCTION_LOG.md),
[the API contracts](docs/API_CONTRACTS.md), [deployment steps](docs/DEPLOYMENT.md),
and [the audit](docs/AUDIT.md) before reconnecting a production Pages project.
