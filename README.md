# ShadowGarden — reconstructed source

Repository: https://github.com/skypie0102/ShadowGarden

This repository reconstructs the 2.11.0 Cloudflare Pages deployment from the
supplied recovery archives. The recovered browser app is retained, with a new
backend derived from its request/response contracts. It is **not the original
lost repository or Git history**.

148 deployed files were recovered. Of those, 146 remain byte-identical; two admin
scripts have documented compatibility/safety changes. The archive contains one
cataloged series, five opaque book IDs and ten cover images. **The five EPUBs,
private object mappings, production credentials and original server code were
not in the archive.** Reading those books cannot work until the private assets
and mappings are restored.

## Local development

Use Node.js 24 (minimum 22.16).

```sh
npm ci
npm run db:local
npm run seed:local
npm run dev
```

Open the URL printed by Wrangler. The recovered public catalog and covers work
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

## Layout

| Path | Purpose |
| --- | --- |
| `public/` | Recovered static deployment, plus routing/header rules |
| `functions/` | All 15 routes from the recovered route inventory |
| `server/` | New backend, auth, B2 access, catalog transactions and EPUB checks |
| `migrations/` | New D1 schema, explicitly not the original database schema |
| `recovery-info/` | Recovery reports, hashes and idempotent public catalog seed |
| `scripts/` | Build, audit and private mapping migration generator |
| `tests/` | Isolated tests with real SQLite and mocked provider APIs |
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
snapshots. Book replacements use fresh object keys and retain old bytes.

Catalog editing, translations, banners, upload, backups, restore, taxonomy,
cover optimization, object checks and basic cooldown telemetry are reconstructed.
Permanent B2 purge and the undocumented `POST /admin-api/recovery` operation
return explicit 501 errors. The purge controls are disabled. Original tripwire
scoring and recovery policies have not been recovered.

See [RECONSTRUCTION_LOG.md](RECONSTRUCTION_LOG.md),
[the API contracts](docs/API_CONTRACTS.md), [deployment steps](docs/DEPLOYMENT.md),
and [the audit](docs/AUDIT.md) before reconnecting a production Pages project.
