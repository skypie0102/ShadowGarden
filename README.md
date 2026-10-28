# ShadowGarden

ShadowGarden is a web library with a mobile-friendly EPUB reader and Keeper,
its catalog administration interface. It runs on Cloudflare Pages and Pages
Functions, with D1 for catalog metadata and Backblaze B2 for private book files.

[Open ShadowGarden](https://shadowgarden-bon.pages.dev/) ·
[Documentation](docs/README.md) ·
[Codebase audit](docs/archive/audits/CODEBASE_AUDIT_2026-10.md) ·
[UI/UX roadmap](docs/plans/UI_UX_ROADMAP.md) ·
[Reader architecture](docs/guides/READER_ARCHITECTURE.md) ·
[Release history](docs/archive/releases/PROJECT_HISTORY.md)

[GitHub check selection and workflow timing](docs/operations/CI.md) documents focused
presentation checks, full regression shards and the stable required check.

## Features

- Main and age-gated libraries with series, volumes, covers and reading status.
- Paginated and Continuous reading, chapter navigation, book search, bookmarks,
  saved progress, themes and layout preferences.
- Edge TTS read aloud with English voices, Brian as the default, four-passage
  preloading, browser media controls, speed preferences, pause/resume, passage controls and position following.
- Double-tap/double-click image focus with zoom and return-position preservation, plus standalone
  cover/illustration preparation and bounded local caches.
- Protected book access through Turnstile sessions and object-specific tickets.
- Keeper catalog editing, uploads, translations, banners and taxonomy tools.
- Checksummed catalog snapshots, Trash, guarded recovery and retryable media
  cleanup that protects retained references.

## Project status

The current release is [**v2.30.0**](docs/archive/releases/KEEPER_FEEDBACK_2.30.0.md). Library discovery,
Reader controls, Phase 4 visual consistency, Phase 5 Keeper feedback, Reader
maintenance, Website refactor and the October codebase audit are complete.
Their dated release and verification records are in the [archive](docs/archive/README.md).

The [active UI/UX plan](docs/plans/UI_UX_ROADMAP.md) tracks the remaining reading
journey follow-ups and delivery history. Keeper uploads explain destinations and
duplicate choices, distinguish per-file failures and retries, and retain skipped
or invalid files for review. Reader controls now provide
grouped settings and device-default Reset, clearer chapter/volume navigation,
and first-use image-focus guidance. The Series layout and solid pinned icon retain
their released behavior. The release record separates source validation, production
verification and the remaining physical-device and width-change acceptance limits.

The v2.29.1 visual-accessibility pass provides readable
metadata/placeholders and filter boundaries, visible keyboard focus and selected
states in contrast themes. Existing layout styles and application JavaScript stay
intact; controlled browser comparisons check button, cover and reading/download
geometry against v2.29.0. See the [visual guide](docs/guides/VISUAL_ACCESSIBILITY.md).

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
Use the [production guide](docs/archive/recovery/PRODUCTION_TAKEOVER.md) for that site and
[deployment guide](docs/operations/DEPLOYMENT.md) for configuration. The automated browser
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

The [performance report](docs/archive/completed/READER_PERFORMANCE.md) records measured results,
cache budgets and measurement limits.

For isolated workerd upload measurements with generated files and a disposable
provider, run `npm run profile:uploads`. Optional arguments select a Git ref and
JSON report path; see [upload memory](docs/archive/completed/UPLOAD_MEMORY.md).

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

[API contracts](docs/guides/API_CONTRACTS.md) describe these behaviors.
[Production operations](docs/archive/recovery/PRODUCTION_TAKEOVER.md) describe release checks and
rollback. The [read-only verifier](docs/operations/PRODUCTION_VERIFIER.md) checks fresh D1
baselines, production configuration, catalogs, version and reviewed served assets. Keep credential values and private exports outside Git.

## Project history

The project was restored from an archived deployment and has since gained a
maintained backend and a refactored reader. Original asset hashes and recovery
records remain in [the historical log](docs/archive/recovery/RECONSTRUCTION_LOG.md) and
`recovery-info/` for traceability. The documentation index identifies historical
reports and current operational guidance.
