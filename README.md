# ShadowGarden

ShadowGarden is a web library with a mobile-friendly EPUB reader and Keeper,
its catalog administration interface. It runs on Cloudflare Pages and Pages
Functions, with D1 for catalog metadata and Backblaze B2 for private book files.

[Open ShadowGarden](https://shadowgarden-bon.pages.dev/) ·
[Documentation](docs/README.md) ·
[Maintenance roadmap](docs/READER_MAINTENANCE.md)

## Features

- Main and age-gated libraries with series, volumes, covers and reading status.
- Paginated and Continuous reading, chapter navigation, book search, bookmarks,
  saved progress, themes and layout preferences.
- Image focus with zoom and return-position preservation, plus standalone
  cover/illustration preparation and bounded local caches.
- Protected book access through Turnstile sessions and object-specific tickets.
- Keeper catalog editing, uploads, translations, banners and taxonomy tools.
- Checksummed catalog snapshots, Trash, guarded recovery and retryable media
  cleanup that protects retained references.

## Project status

The latest verified production release is **v2.12.5**. Android / Soul Browser
acceptance confirms that the reported image dimming and upward-scroll jumps are
resolved in ordinary use. The [release record](docs/READER_RELEASE.md) separates
that device result from automated checks and the remaining intermittent
first-open cover-return case, RDR-045.

Current development focuses on gradual reader simplification: explicit service
boundaries, shared section helpers, private Continuous task/input state, cohesive
search presentation, readable orchestration and documented EPUB.js compatibility
contracts. See the
[code review](docs/READER_CODE_REVIEW.md) and
[maintenance roadmap](docs/READER_MAINTENANCE.md) for completed increments and
next steps. Verified changes are merged into `main`; a merge and a production
deployment are recorded separately.

## Local development

Use Node.js 24; the minimum supported version is 22.16.

```sh
npm ci
npm run db:local
npm run seed:empty
npm run dev
```

Open the local URL printed by Wrangler. These commands use local D1 state.
`npm run seed:local` optionally loads the demo catalog; both seed commands
preserve an existing library. Demo metadata does not include protected EPUBs.

Copy `.env.example` to `.dev.vars` and configure your own development credentials
for Keeper, Turnstile and B2. A dedicated development Turnstile widget must allow
the development hostname. Protected flows require their normal configuration;
provider responses are mocked only by the isolated test harness.

The committed `wrangler.jsonc` identifies the existing production resources.
Use the [production guide](docs/PRODUCTION_TAKEOVER.md) for that site and
[deployment guide](docs/DEPLOYMENT.md) for configuration. The automated browser
harness creates its own disposable Pages project and database.

## Validation

```sh
npm run check
npx playwright install --with-deps chromium firefox webkit
npm run test:browser
```

`check` audits asset provenance, dependencies and routes, runs the Node contract
and reader tests, builds `dist/`, and compiles a Pages Functions package while
checking its actual D1 and variable bindings. It does not access production.

The browser suite runs the production reader entry point with generated EPUBs
and isolated Pages/D1 state across desktop/mobile Chromium, Firefox and
desktop/mobile WebKit. It covers navigation, scrolling, focus return, late
layout changes, settings, caching, cancellation and resource cleanup, alongside
catalog and Keeper flows. Live Turnstile/B2 and physical-device acceptance are
recorded separately. GitHub Actions retains browser reports for seven days.

For repeatable long/illustrated-book profiles:

```sh
npm run profile:reader -- --repeat-each=3
```

The [performance report](docs/READER_PERFORMANCE.md) records measured results,
cache budgets and measurement limits.

## Code layout

| Path | Responsibility |
| --- | --- |
| `public/` | Library and Keeper UI, reader modules, pinned vendor assets and static routing/header rules |
| `public/assets/js/reader/` | Reader engine, application/controllers, navigation, layout, lifecycle and cache services |
| `functions/` | Pages route handlers |
| `server/` | Authorization, catalog transactions, B2 access, EPUB validation and cleanup |
| `migrations/` | Versioned D1 schema migrations |
| `scripts/` | Build, asset audit, binding-aware release packaging and local test harness |
| `tests/` | Node contract/reader tests and isolated browser integration tests |
| `docs/` | Architecture, maintenance, API, deployment and release records |
| `recovery-info/` | Historical provenance, original file hashes, demo seeds and route inventory |

## Data and operations

D1 is authoritative for the live catalog. Missing database bindings or an
uninitialized catalog fail explicitly; archived demo catalogs are never used
as a substitute. Private EPUBs and uploaded covers live in B2. Bundled cover
assets remain available as static files. Catalog edits are not mirrored to
legacy B2 catalog JSON objects.

Keeper uses a bearer token and revocable signed session after Turnstile
verification. Reader access uses a human session and short-lived book tickets.
Catalog writes require revision checks; snapshots must pass checksum and
structural validation before restoration. Book replacement uses fresh object
keys, and cleanup protects live metadata, retained snapshots and active uploads.

[API contracts](docs/API_CONTRACTS.md) describe these behaviors.
[Production operations](docs/PRODUCTION_TAKEOVER.md) describe release checks and
rollback. Keep credential values and private exports outside Git.

## Project history

The project was restored from an archived deployment and has since gained a
maintained backend and a refactored reader. Original asset hashes and recovery
records remain in [the historical log](RECONSTRUCTION_LOG.md) and
`recovery-info/` for traceability. The documentation index identifies historical
reports and current operational guidance.
