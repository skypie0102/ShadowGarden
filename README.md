# ShadowGarden

ShadowGarden is a web library with a mobile-friendly EPUB reader and Keeper,
its catalog administration interface. It runs on Cloudflare Pages and Pages
Functions, with D1 for catalog metadata and Backblaze B2 for private book files.

[Open ShadowGarden](https://shadowgarden-bon.pages.dev/) ·
[Documentation](docs/README.md) ·
[Codebase audit](docs/CODEBASE_AUDIT_2026-10.md) ·
[UI/UX roadmap](docs/UI_UX_ROADMAP.md) ·
[Website refactor](docs/WEBSITE_REFACTOR_ROADMAP.md) ·
[Reader maintenance](docs/READER_MAINTENANCE.md)

## Features

- Main and age-gated libraries with series, volumes, covers and reading status.
- Paginated and Continuous reading, chapter navigation, book search, bookmarks,
  saved progress, themes and layout preferences.
- Edge TTS read aloud with voice/speed preferences, pause/resume, passage controls
  and optional reading-position following.
- Double-tap/double-click image focus with zoom and return-position preservation, plus standalone
  cover/illustration preparation and bounded local caches.
- Protected book access through Turnstile sessions and object-specific tickets.
- Keeper catalog editing, uploads, translations, banners and taxonomy tools.
- Checksummed catalog snapshots, Trash, guarded recovery and retryable media
  cleanup that protects retained references.

## Project status

The latest production release is **v2.24.0**, deployed on 2026-10-25 (Asia/Manila)
from `32af1ce` through [PR #65](https://github.com/skypie0102/ShadowGarden/pull/65).
Read aloud now offers English voices grouped by region, smooth passage-following,
and floating Play/Pause, Previous, settings, Next and Stop controls. Saved non-English
voices fall back to Emma. Scrolling is cancellable and respects reduced-motion
preferences; chapter navigation and background listening retain their regressions.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40195102753)
passes 495 Node tests and 981 browser cases across five profiles, with nine
existing platform skips and zero retries. All 75 focused speech checks pass.
Five candidate captures were reviewed, including narrow 320px controls. Production
preserves the immediate revision-18 catalog, all 17 snapshots and configuration,
with zero database writes. All 7 version/catalog/asset checks and live voice/request
guards pass. Physical Android/Soul acceptance is separate.
[Read aloud guide](docs/READER_TTS.md) · [Release evidence](docs/reader-speech-controls-release-2.24.0.json).

The previous production release is **v2.23.0**, deployed on 2026-10-25 (Asia/Manila)
from `4de24e0` through [PR #63](https://github.com/skypie0102/ShadowGarden/pull/63).
Read aloud now centers the spoken passage in Pages and Continuous, highlights it
using the selected reader theme, and closes options on Start/Resume. Long paragraphs
have separate chunk positions; the first and last passages also center without
needing a cover or trailing content. Pause keeps the highlight. Stop, disabling
following and disposal release temporary viewport positioning. EPUB markup and
canonical pagination stay intact, and audio remains independent of rendering.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40177121119)
passes 494 Node tests and 961 browser cases across five profiles, with nine existing
platform skips and zero retries. All 55 focused TTS checks pass; eight candidate
captures were reviewed and the merged application tree is identical. Production
preserves the immediate revision-18 catalog, 17 snapshots and configuration,
with zero database writes. All 9 version/catalog/asset checks and the live voice
endpoint and request guards pass. Six additional mobile Chromium checks pass against
the deployed reader using a disposable EPUB fixture. Physical Android/Soul acceptance
is separate.
See the [read aloud guide](docs/READER_TTS.md) and
[release evidence](docs/reader-speech-position-release-2.23.0.json).

The previous production release is **v2.22.1**, deployed on 2026-10-25 (Asia/Manila)
from `4fb189a`. The reader implementation is [PR #62](https://github.com/skypie0102/ShadowGarden/pull/62).
The initial v2.22.0 publish omitted `/tts` from the Pages invocation manifest.
v2.22.1 corrects that route and verifies voice availability and rejection guards
during deployment.
The reader now offers **Edge TTS read aloud** through a themed headphone control:
voice and speed selection, pause/resume, previous/next passage, automatic chapter
progression and optional position following. Preferences persist; reopening never
starts speech automatically. Passages are sent to Microsoft for online speech.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40161223629)
passes 494 Node tests and 931 browser cases across five profiles, with
9 existing platform skips and zero retries. All 25 focused TTS checks pass,
including native MP3 playback. Five captures were reviewed. Production preserves
the immediate revision-18 catalog, 17 snapshots and
configuration with zero database writes. The live voice endpoint and rejection
guards pass. Offline providers are deferred.
See the [read aloud guide](docs/READER_TTS.md) and [release evidence](docs/reader-edge-tts-release-2.22.1.json).

An earlier production release is **v2.21.0**, deployed on 2026-10-25 (Asia/Manila)
from `293090c` through [PR #61](https://github.com/skypie0102/ShadowGarden/pull/61).
Reader settings now offer **Paragraph alignment: Default, Left, Justify and Right**.
Default is the initial/reset choice and follows the EPUB's own alignment. Choices
persist across reopening and reading modes; returning to Default restores the
publication's declarations. Page-number measurement follows the selected alignment.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40146284677)
passes 477 Node tests and 906 browser cases across five profiles, with 9
existing platform skips and zero retries. All ten focused alignment checks pass;
five captures were reviewed. All 9 production checks pass, preserving the
immediate revision-18 catalog, 17 snapshots and configuration with
zero database writes. See [release evidence](docs/reader-paragraph-alignment-release-2.21.0.json).

The preceding production release is **v2.20.1**, deployed on 2026-10-25 (Asia/Manila)
from `d4ac4b2` through [PR #60](https://github.com/skypie0102/ShadowGarden/pull/60).
Keeper's Series Editor now opens **Translation provenance** with only saved
credits. When there are none, the list stays empty until **Add translator** is
used. [Release checks](https://github.com/skypie0102/ShadowGarden/actions/runs/40142342699)
and production verification are recorded in the
[release evidence](docs/keeper-translator-empty-state-release-2.20.1.json).

The preceding production release is **v2.20.0**, deployed on 2026-10-25 (Asia/Manila)
from `0b687cf` through [PR #59](https://github.com/skypie0102/ShadowGarden/pull/59).
Keeper's Series Editor now offers **Replace EPUB** beside **Edit** on each
volume. It checks the selected file, confirms the replacement and shows inline
checking/upload/save/error feedback. The volume's identity, metadata, artwork
and editor drafts are retained. File-only replacement uses the existing
immutable upload, revision and snapshot guards.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40119056287) and
[main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40119539775)
pass **473 Node tests** and **896 browser cases** across five profiles, with nine
existing platform skips and zero retries. All **35 new focused replacement
controls** pass, covering both libraries, narrow layouts, invalid/cancelled
selection, retries, retained drafts and late responses. Five final captures
were reviewed across all profiles. All **seven production checks** pass:
version/source, both catalogs and all four changed assets. The immediate
revision-16 catalog, all 15 retained snapshots and configuration are preserved,
with zero database writes. Replacement tests use disposable EPUBs and mocked
storage; no live volume was replaced for verification. See
[release evidence](docs/keeper-volume-replacement-release-2.20.0.json) and the
[API contract](docs/API_CONTRACTS.md).

The preceding production release is **v2.19.4**, deployed on 2026-10-25 (Asia/Manila)
from `74397bd` through [PR #58](https://github.com/skypie0102/ShadowGarden/pull/58).
It replaces v2.19.3's red platform emoji with a monochrome SVG pin. The icon uses
the muted site color normally, and the Main lavender or Adult rose accent when
pinned, hovered or focused. Its pinned fill, border and background follow the
same theme. The 44px target, accessible labels and saved preference are retained.

The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40115389633)
passes **471 Node tests** and **861 browser cases** across five profiles, with nine
existing platform skips and zero retries. All 15 focused Series controls pass,
including rendered icon colors in both palettes and after reload. Four mobile
and desktop captures were reviewed. All **five production checks** pass:
version/source, both catalogs and both changed assets. Revision 12, all 12
snapshots and configuration are preserved against the immediate pre-deployment
baseline, with zero database writes. See
[release evidence](docs/series-themed-pin-release-2.19.4.json).

The preceding production release is **v2.19.3**, deployed on 2026-10-25 (Asia/Manila)
from `70e11fd` through [PR #57](https://github.com/skypie0102/ShadowGarden/pull/57).
The Series pin action is a compact **📌** button with a 44px target, a highlighted
pinned state, accessible Pin/Unpin labels, a tooltip and pressed state. Saved
pin preferences are retained.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40112683505) and
[main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40113065695)
pass **471 Node tests** and **861 browser cases** across five profiles, with nine
existing platform skips and zero retries. All 15 focused Series controls pass,
including keyboard pinning, reload persistence and unpinning. Three mobile and
desktop captures were reviewed. All **six production checks** pass: version/source,
both catalogs and the three changed assets. Revision 9, all nine snapshots and
configuration are preserved, with zero database writes. See
[release evidence](docs/series-pin-icon-release-2.19.3.json).

The preceding production release is **v2.19.2**, deployed on 2026-10-24 from
`c9425b0` through [PR #56](https://github.com/skypie0102/ShadowGarden/pull/56).
[Mobile Series flow](docs/UI_UX_ROADMAP.md) removes the remaining gap below
short titles/authors. Reading controls follow the metadata and wrap around or
below the cover; tags use the full width after the cover. The reported Main
metadata without a translator credit is now an explicit regression case.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40104546632) and
[main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40106036066)
pass **471 Node tests** and **861 browser cases** across five profiles, with nine
existing platform skips and zero retries. All 15 focused Series controls pass.
The exact v2.19.1 stylesheet reproduces a metadata-to-button gap over 30px;
the candidate is checked for an 8–20px gap. Seven captures were reviewed across
all five profiles. All **four production checks** pass: version/source, both
catalogs and the changed CSS. Revision 9, all nine snapshots and configuration
are preserved, with zero database writes. The live Main metadata and loaded
responsive rules are verified. See
[release evidence](docs/series-mobile-flow-release-2.19.2.json).

The preceding production release is **v2.19.1**, deployed on 2026-10-24 from
`57d6b89` through [PR #55](https://github.com/skypie0102/ShadowGarden/pull/55).
[Mobile Series layout](docs/UI_UX_ROADMAP.md) places reading/pin/audio actions
and tags across the full mobile header beneath the cover/title pair. It adds
compact padding, 44px action targets and bounded missing-cover placeholders,
while retaining desktop geometry.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40088319274) and
[main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40100935463)
pass **471 Node tests** and **861 browser cases** across five profiles, with nine
existing platform skips and zero retries. All 15 new Series cases pass; the
separate focused run repeats those 15 controls successfully. Eight final
captures were reviewed across all five profiles. All **five production checks**
pass: version/source, both catalogs and both changed assets. Revision 9, all nine
snapshots and production configuration are preserved with zero database writes.
Live Main Series markup and unchanged desktop geometry are verified.
See [release evidence](docs/series-mobile-layout-release-2.19.1.json).

The preceding production release is **v2.19.0**, deployed on 2026-10-24 from
`af3c7bd` through [PR #54](https://github.com/skypie0102/ShadowGarden/pull/54).
[UI/UX Phase 1](docs/UI_UX_ROADMAP.md) adds a compact Library introduction,
labeled mobile filters with active counts, larger changed controls, fewer
redundant shelves in single-series catalogs, and distinct reading suggestions,
saved progress and next-volume actions.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40081665674) and
[main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40082970117)
pass **471 Node tests** and **846 browser cases** across five profiles, with nine
existing platform skips and zero retries. All 25 new Library cases pass;
14 corrected-build captures were reviewed. All **11 production checks** pass:
version/source, both D1-derived catalogs and all eight changed assets. Revision 9,
all nine snapshots and configuration are preserved, with zero database writes.
Live Main Library search, Reset and the visible v2.19.0 footer are verified.
See [release evidence](docs/library-discovery-release-2.19.0.json).

The preceding production release **v2.18.13** was deployed on 2026-10-24 from
`8d500eb` through [PR #53](https://github.com/skypie0102/ShadowGarden/pull/53).
[Upload target ownership](docs/KEEPER_TARGET_CONTEXT.md) uses the engine's reset/
cancellation owner and retains the queue's target while its dialog is closed.
Six baseline controls fail; all 23 corrected queue controls pass.
[Stylesheet ownership](docs/STYLESHEET_OWNERSHIP.md) expands 21 remaining dense Keeper/
shared/public sheets with ordered parsed CSS/comments preserved and no removals.
Long lines decrease from 147 to one intact SVG URL.
[Library readiness](docs/LIBRARY_READINESS.md) clears busy after populated, empty or
failed catalog loads and removes stale failure placeholders.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40065545158) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40066899682) both pass
**471 Node tests** and **821 browser cases** across five profiles, with nine
documented platform skips and zero test retries. All five new CSS cases, ten
queue-lifecycle cases and six Library readiness cases pass in every profile.
The separate Chromium Library-startup profile passes on the PR and is excluded
from the 821 cases.

All **95 new same-DOM comparisons** match decoded RGBA pixels and computed-style/
geometry hashes, including the served/restored candidate control. All 21 changed
sheets are loaded across each profile's compared states. Six representative
desktop/mobile captures were visually reviewed. Settled frames and the recorded
default/349/761 widths define this scope; no exhaustive viewport, animation-frame
or resize-transition equivalence is claimed.

The workflow publishes **v2.18.13**, source `8d500eb`, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
Publication completes in one attempt; the version check uses one request over
204 ms. All **27 production checks** pass: canonical source/version,
both D1-derived catalogs and all 24 changed CSS/JavaScript assets. The exact
revision-9 catalog document, all 9 snapshots and recorded settings remain
unchanged, with zero database writes. The retained v2.18.12 rollback is
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786`.
See [verification evidence](docs/keeper-target-stylesheets-verification.json).

The interrupted independent checks were completed after the workspace was
restored. Public HTTP reads confirm v2.18.13/source `8d500eb` and exact bytes for
all 24 changed assets. The downloaded production artifact matches the sanitized
logged report and GitHub's SHA-256 archive digest. The follow-up results and the
original publication/rollback records are retained in the verification evidence.

The preceding [v2.18.12 CSS release](docs/KEEPER_CSS.md) expands four base/layout/
component/presentation sheets and removes two superseded checkbox declarations.
Its [dated evidence](docs/keeper-css-verification.json) retains 463 Node tests, 746
browser passes, 45 visual comparisons and production preservation.

The preceding [v2.18.11 queue lifecycle release](docs/KEEPER_QUEUE_LIFECYCLE.md)
owns pending file selections across Clear/lock, serializes preparation, gates
early uploads and retries failed duplicate lookup on the next selection. Its
[dated evidence](docs/keeper-queue-lifecycle-verification.json) retains 463 Node tests,
726 browser passes and production preservation checks.

The preceding [v2.18.10 EPUB inspection release](docs/EPUB_INSPECTION.md)
corrects false missing-file results for encoded archive names and expands the
data-only inspection service. Its [dated evidence](docs/epub-inspection-verification.json)
retains 448 Node tests, 696 browser passes and production preservation checks.

The preceding [v2.18.9 Upload presentation release](docs/KEEPER_UPLOAD_PRESENTATION.md)
preserves similar-volume guidance after queue renders, refreshes aggregate labels
after catalog changes and keeps Review focus when report output is unchanged. Its
[dated evidence](docs/keeper-upload-presentation-verification.json) retains 436 Node
tests, 681 browser passes and the production preservation checks.

The preceding [v2.18.8 upload-buffer release](docs/UPLOAD_BUFFER_BUDGET.md)
reduces retained unknown-length input and adds a conservative per-isolate
admission budget, preserving file-size limits. Its
[dated evidence](docs/upload-buffer-verification-2.18.8.json) retains the workerd
samples, 424 Node tests, 666 browser passes and production preservation checks.

The preceding [v2.18.7 volume-removal release](docs/KEEPER_VOLUME_REMOVAL.md)
preserves sibling metadata/translation drafts, expanded editors, focus and text
selection when another volume moves to Trash. Its
[dated evidence](docs/keeper-volume-removal-verification.json) retains the checked
source, 412 Node tests, 666 browser passes and unchanged production state.

The preceding [v2.18.6 release](docs/PRODUCTION_VERSION_CONVERGENCE.md) added bounded
served-version polling within one publication attempt, retaining the original
baseline, reviewed assets and rollback. Its
[dated evidence](docs/production-version-convergence-verification.json) records
402 Node tests, 636 browser passes and unchanged production state.

The preceding [Keeper volume/translation release](docs/KEEPER_VOLUME_OWNERSHIP.md),
**v2.18.5** through [PR #45](https://github.com/skypie0102/ShadowGarden/pull/45),
preserves editor ownership and series drafts. Its [dated evidence](docs/keeper-volume-ownership-verification.json)
retains both publication attempts, the original rollback selection and the retry
baseline distinction. The convergence correction addresses that operational
follow-up without changing the Keeper workflows.

The preceding [Keeper UI/session batch](docs/KEEPER_UI_SESSION.md) shipped in
v2.18.4 through [PR #44](https://github.com/skypie0102/ShadowGarden/pull/44),
source `9ccfa89`. Its five expanded modules, editor/upload continuation and
Upload/Skip fixes retain their [dated evidence](docs/keeper-ui-session-verification.json).
The [core/Upload batch](docs/KEEPER_CORE_UPLOAD.md) shipped in v2.18.3 and the
[data/maintenance batch](docs/KEEPER_WORKFLOWS.md) in v2.18.2.

[Public controller readability](docs/PUBLIC_READABILITY.md), merged through
[PR #39](https://github.com/skypie0102/ShadowGarden/pull/39), shipped in v2.18.1:
seven modules have expanded statements and matching executable syntax trees.
The earlier missing-secret and Pages-authorization blockers are resolved.

The preceding **v2.18.0** release, merged through
[PR #38](https://github.com/skypie0102/ShadowGarden/pull/38), added native Garden Pass
modality/focus restoration and parallel, canonical public imports. The controlled
Library profile recorded 29 → 26 script requests and no duplicate module paths.
See [public boundaries](docs/PUBLIC_BOUNDARIES.md) and
[its dated release evidence](docs/public-boundaries-verification-2.18.0.json) for
the measurements and controlled Firefox frame-traversal limitation.

The preceding protected-source release is **v2.17.1**, merged through
[PR #36](https://github.com/skypie0102/ShadowGarden/pull/36) and deployed on 2026-10-20.
The visual scanner calls an explicit book-access transport; global fetch remains
native, and pinned EPUB.js retains its XHR/session-cookie path. All 293 Node tests
and 502 browser cases pass across five profiles (eight existing skips). Both
live catalogs and footers, exact served modules, revision-9 document, nine
snapshots and production configuration are verified. See [the transport map](docs/PROTECTED_SOURCE_TRANSPORT.md)
and [release evidence](docs/protected-source-verification-2.17.1.json).

The preceding browser-persistence release is **v2.17.0**, deployed on 2026-10-20 through
[PR #35](https://github.com/skypie0102/ShadowGarden/pull/35): grouped browser
persistence and conditional rollback after failed saves. Read Again resets
progress and Finished status in one operation. All 285 Node tests and 492 browser
cases pass (eight existing skips). Existing formats remain; crash atomicity and
concurrent-writer isolation are not claimed. Both live catalogs match D1; the exact
catalog document, eight snapshots, bindings and secret-setting metadata are unchanged.
The existing Cloudflare plugin supplied the upload token; a local asset helper
completed the upload without another sign-in. See [browser persistence](docs/BROWSER_PERSISTENCE.md)
for contracts and evidence, and [the upload procedure](docs/PAGES_UPLOAD_TRANSPORT.md).

The preceding audit increment is merged for **v2.16.1** through
[PR #34](https://github.com/skypie0102/ShadowGarden/pull/34): measured large-upload
memory and direct buffering for declared-length bodies. A 50 MiB EPUB uses 47.9%
less sampled ArrayBuffer storage in the local workerd fixture. All 259 Node tests
and 477 browser cases pass (eight existing skips). The 50 MiB limit is unchanged;
unknown-length/concurrent buffering remains documented. This increment is included
in the live v2.17.0 release.
See [upload measurements](docs/UPLOAD_MEMORY.md) for evidence and scope.

The preceding maintenance release is **v2.16.0**, deployed on 2026-10-19.
Keeper history loads ten inspected summaries per page, one full snapshot at a
time. The large fixture reads 95% fewer document bytes for its first page.
Readiness has a 20-second deadline and preserves unfinished checks as unverified.
All 250 Node tests and 477 browser cases pass across five profiles (eight existing
platform skips), plus six live Keeper frontend fixture cases. Production data and
configuration are unchanged. See [maintenance budgets](docs/MAINTENANCE_BUDGETS.md)
and [release evidence](docs/maintenance-release-2.16.0.json).
The [whole-codebase audit](docs/CODEBASE_AUDIT_2026-10.md) retains the v2.15.0 fixes
and remaining priorities. Reader double-tap/double-click image focus is unchanged.

**Website refactor: v2.14.0**, deployed on 2026-10-18.
Mobile reset restores Continuous and desktop reset restores Pages; the main
Garden Pass uses midnight colors. The website now authors final copy directly,
owns themes separately from navigation, separates Library URL state and local
EPUB inspection, and uses explicit Keeper upload events. Global text/native-dialog
patches, obsolete button cloning and the polling completion shim are removed.
All 220 Node tests and 422 browser cases pass across five profiles (eight existing
platform skips). Live Library controls, Keeper sign-in styling, Garden Pass,
served files, unchanged data and bindings are verified. See the
[website release record](docs/WEBSITE_RELEASE.md) and
[architecture guide](docs/WEBSITE_ARCHITECTURE.md).

The completed reader baseline is **v2.12.8**, deployed on 2026-10-18.
It includes the gradual reader cleanup, shared intrinsic sizing and reproduced
chapter-boundary/pending-resume jump fixes (RDR-054/055). Bookmark lookup and
navigation failures now stay quiet after reader disposal. App startup, map refresh,
saved-page correction and flow recovery follow the same lifetime. All 211 Node tests and
387 browser cases pass across five profiles. Live source, version metadata,
catalog identity and production bindings are verified. Both rendered library
footers are verified in isolated Chromium. The owner manually checked Keeper
in v2.12.8 and reports it works correctly. Authenticated real-book opening remains
the outstanding release check.
On 2026-10-18 the owner manually verified fast upward scrolling and image-focus
return on Android / Soul Browser in v2.12.6; both work correctly. The requested
phone acceptance checks pass. The [release record](docs/READER_RELEASE.md)
preserves the earlier first-open cover-return observations and the exact scope
of this device result.
The historical single 56 px stress event has not been uniquely attributed.
See the [original-trace follow-up](docs/READER_SCROLL_AUDIT.md#original-failure-artifact-follow-up).

The completed M1–M5 maintenance covers reader simplification: explicit service
and state ownership, shared helpers, cohesive search presentation and documented
EPUB.js compatibility timing. Continuous sizing now shares one intrinsic-height
measurement across vendor expansion and media reconciliation. Layout anchors
also compare nearby visible blocks across chapter padding, and structural
bookkeeping retains native movement awaiting its scroll event. Cancelled search
and disposed TOC/bookmark navigation stay quiet while active failures remain visible.
The merged app callback checks also suppress obsolete TOC/map/startup/recovery
failures; 211 Node tests and 387 browser cases pass across five profiles. These
app changes are deployed in v2.12.8. See the
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

For isolated workerd upload measurements with generated files and a disposable
provider, run `npm run profile:uploads`. Optional arguments select a Git ref and
JSON report path; see [upload memory](docs/UPLOAD_MEMORY.md).

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
rollback. The [read-only verifier](docs/PRODUCTION_VERIFIER.md) checks fresh D1
baselines, production configuration, catalogs, version and reviewed served assets. Keep credential values and private exports outside Git.

## Project history

The project was restored from an archived deployment and has since gained a
maintained backend and a refactored reader. Original asset hashes and recovery
records remain in [the historical log](RECONSTRUCTION_LOG.md) and
`recovery-info/` for traceability. The documentation index identifies historical
reports and current operational guidance.
