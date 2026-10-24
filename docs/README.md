# ShadowGarden documentation

[Focused UI/UX roadmap](UI_UX_ROADMAP.md) tracks the work following the completed
codebase audit, beginning with Library discovery and reading-action clarity.

The latest production release is **v2.19.1**, deployed on 2026-10-24 from
`57d6b89` through [PR #55](https://github.com/skypie0102/ShadowGarden/pull/55).
[Mobile Series layout](UI_UX_ROADMAP.md) places reading/pin/audio actions
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
See [release evidence](series-mobile-layout-release-2.19.1.json).

The preceding production release is **v2.19.0**, deployed on 2026-10-24 from
`af3c7bd` through [PR #54](https://github.com/skypie0102/ShadowGarden/pull/54).
[UI/UX Phase 1](UI_UX_ROADMAP.md) adds a compact Library introduction,
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
See [release evidence](library-discovery-release-2.19.0.json).

The preceding production release **v2.18.13** was deployed on 2026-10-24 from
`8d500eb` through [PR #53](https://github.com/skypie0102/ShadowGarden/pull/53).
[Upload target ownership](KEEPER_TARGET_CONTEXT.md) uses the engine's reset/
cancellation owner and retains the queue's target while its dialog is closed.
Six baseline controls fail; all 23 corrected queue controls pass.
[Stylesheet ownership](STYLESHEET_OWNERSHIP.md) expands 21 remaining dense Keeper/
shared/public sheets with ordered parsed CSS/comments preserved and no removals.
Long lines decrease from 147 to one intact SVG URL.
[Library readiness](LIBRARY_READINESS.md) clears busy after populated, empty or
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
See [verification evidence](keeper-target-stylesheets-verification.json).

The interrupted independent checks were completed after the workspace was
restored. Public HTTP reads confirm v2.18.13/source `8d500eb` and exact bytes for
all 24 changed assets. The downloaded production artifact matches the sanitized
logged report and GitHub's SHA-256 archive digest. The follow-up results and the
original publication/rollback records are retained in the verification evidence.

The preceding [v2.18.12 CSS release](KEEPER_CSS.md) expands four base/layout/
component/presentation sheets and removes two superseded checkbox declarations.
Its [dated evidence](keeper-css-verification.json) retains 463 Node tests, 746
browser passes, 45 visual comparisons and production preservation.

The preceding [v2.18.11 queue lifecycle release](KEEPER_QUEUE_LIFECYCLE.md)
owns pending file selections across Clear/lock, serializes preparation, gates
early uploads and retries failed duplicate lookup on the next selection. Its
[dated evidence](keeper-queue-lifecycle-verification.json) retains 463 Node tests,
726 browser passes and production preservation checks.

The preceding [v2.18.10 EPUB inspection release](EPUB_INSPECTION.md)
corrects false missing-file results for encoded archive names and expands the
data-only inspection service. Its [dated evidence](epub-inspection-verification.json)
retains 448 Node tests, 696 browser passes and production preservation checks.

The preceding [v2.18.9 Upload presentation release](KEEPER_UPLOAD_PRESENTATION.md)
preserves similar-volume guidance after queue renders, refreshes aggregate labels
after catalog changes and keeps Review focus when report output is unchanged. Its
[dated evidence](keeper-upload-presentation-verification.json) retains 436 Node
tests, 681 browser passes and the production preservation checks.

The preceding [v2.18.8 upload-buffer release](UPLOAD_BUFFER_BUDGET.md)
reduces retained unknown-length input and adds a conservative per-isolate
admission budget, preserving file-size limits. Its
[dated evidence](upload-buffer-verification-2.18.8.json) retains the workerd
samples, 424 Node tests, 666 browser passes and production preservation checks.

The preceding [v2.18.7 volume-removal release](KEEPER_VOLUME_REMOVAL.md)
preserves sibling metadata/translation drafts, expanded editors, focus and text
selection when another volume moves to Trash. Its
[dated evidence](keeper-volume-removal-verification.json) retains the checked
source, 412 Node tests, 666 browser passes and unchanged production state.

The preceding [v2.18.6 release](PRODUCTION_VERSION_CONVERGENCE.md) added bounded
served-version polling within one publication attempt, retaining the original
baseline, reviewed assets and rollback. Its
[dated evidence](production-version-convergence-verification.json) records
402 Node tests, 636 browser passes and unchanged production state.

The preceding [Keeper volume/translation release](KEEPER_VOLUME_OWNERSHIP.md),
**v2.18.5** through [PR #45](https://github.com/skypie0102/ShadowGarden/pull/45),
preserves editor ownership and series drafts. Its [dated evidence](keeper-volume-ownership-verification.json)
retains both publication attempts, the original rollback selection and the retry
baseline distinction. The convergence correction addresses that operational
follow-up without changing the Keeper workflows.

The preceding [Keeper UI/session batch](KEEPER_UI_SESSION.md) shipped in
v2.18.4 through [PR #44](https://github.com/skypie0102/ShadowGarden/pull/44),
source `9ccfa89`. Its five expanded modules, editor/upload continuation and
Upload/Skip fixes retain their [dated evidence](keeper-ui-session-verification.json).
The [core/Upload batch](KEEPER_CORE_UPLOAD.md) shipped in v2.18.3 and the
[data/maintenance batch](KEEPER_WORKFLOWS.md) in v2.18.2.
[Browser CI runtime](CI_BROWSER_RUNTIME.md) retains the pinned dependency-image
contract and original v2.18.3 provisioning diagnosis.

The [activation run 39758249662](https://github.com/skypie0102/ShadowGarden/actions/runs/39758249662)
published v2.18.1 after the missing-secret and Pages-authorization blockers were
resolved. Its [dated activation evidence](automatic-deployment-verification.json)
remains available separately from this release.

[Public controller readability](PUBLIC_READABILITY.md) shipped in
v2.18.1: seven formatted modules, matching executable syntax trees and preserved
comment text. Its [source hashes](public-readability-equivalence.json) and
[original pre-release checkpoint](public-readability-verification.json) retain
review provenance separately from the successful live release.

The preceding **v2.18.0** [public-boundary release](PUBLIC_BOUNDARIES.md) added
native Garden Pass modality/focus restoration and measured Library startup
changes: 29 → 26 scripts and no duplicate module paths. Its
[dated release evidence](public-boundaries-verification-2.18.0.json) and
[raw profile](library-startup-profile-2.18.0.json) preserve measurement scope,
24 samples and the controlled Firefox frame-traversal limitation.

The [read-only production verifier](PRODUCTION_VERIFIER.md) now checks fresh D1
baselines, actual/saved settings, canonical catalogs/version and reviewed served
assets. Its twelve regression cases bring the Node suite to 305; the
[live verification](production-tooling-verification.json) passes against existing
v2.17.1 with revision 9 and nine snapshots preserved. No application release
is needed for this tooling increment. The API guide records the
[legacy revision-header contract](API_CONTRACTS.md#revision-header-compatibility).


[Protected source transport](PROTECTED_SOURCE_TRANSPORT.md) maps the visual
scanner, main EPUB.js and isolated page-map consumers. **v2.17.1 shipped** on
2026-10-20: the scanner uses an explicit transport and global fetch remains native.
All 293 Node tests and 502 browser cases pass (eight existing skips).
[Release evidence](protected-source-verification-2.17.1.json) records the matching
served modules/catalogs, both Library footers and unchanged revision-9 document,
nine snapshots and production configuration.

[Browser persistence](BROWSER_PERSISTENCE.md) records the merged v2.17.0
increment: checked grouped writes, conditional rollback, compound Read Again,
285 Node tests and 492 browser passes. It first shipped as v2.17.0 on 2026-10-20.
[Verification evidence](persistence-verification-2.17.0.json) records the deployment,
matching live assets/catalogs, unchanged production baseline and Web Storage limits.
[Pages upload transport](PAGES_UPLOAD_TRANSPORT.md) records the working local asset
helper using the existing plugin's short-lived token; no second sign-in was needed.

[Upload memory](UPLOAD_MEMORY.md) records the merged v2.16.1 audit increment:
47.9% less sampled backing storage for declared-length 50 MiB uploads, 259 Node
tests and 477 browser passes. It is included in the deployed v2.17.0 release.
The report retains remaining unknown-length/concurrency design work and links
[verification evidence](upload-verification-2.16.1.json).

The preceding maintenance release is v2.16.0, deployed on 2026-10-19.
[Maintenance budgets](MAINTENANCE_BUDGETS.md) and
[release evidence](maintenance-release-2.16.0.json) cover bounded history/readiness,
250 Node tests, 477 browser passes and six live Keeper frontend fixture cases.
The [whole-codebase audit](CODEBASE_AUDIT_2026-10.md) retains the twelve v2.15.0
corrections and remaining priorities; [its evidence](codebase-release-2.15.0.json)
records that earlier release. Production data/configuration are verified unchanged.
The [website release record](WEBSITE_RELEASE.md) retains the reset/theme fixes and
website ownership refactor. The [reader release record](READER_RELEASE.md) and
[gesture evidence](reader-release-2.14.1.json) retain double-tap/double-click image
focus and earlier reader maintenance. The owner manually accepted Keeper in
v2.12.8, and fast upward scrolling/image-focus return on Android/Soul in v2.12.6.
Those physical/provider observations keep their original release scope.

| Document | Use it for |
| --- | --- |
| [Whole-codebase audit](CODEBASE_AUDIT_2026-10.md) | Reproduced fixes, subsystem review and prioritized follow-ups |
| [Public boundaries](PUBLIC_BOUNDARIES.md) | Garden Pass keyboard ownership, module startup measurements and v2.18.0 validation |
| [Public readability](PUBLIC_READABILITY.md) | Scoped controller formatting, source/AST evidence and release state |
| [Maintenance budgets](MAINTENANCE_BUDGETS.md) | Bounded history/readiness contracts, measurements and rollout |
| [Keeper CSS ownership](KEEPER_CSS.md) | Readability, retained cascade, paired visual comparisons and source evidence |
| [Remaining stylesheet ownership](STYLESHEET_OWNERSHIP.md) | Keeper/shared/public formatting, source preservation and visual comparison scope |
| [Keeper target context](KEEPER_TARGET_CONTEXT.md) | Target-change cancellation, retained dialog ownership and regression controls |
| [Library loading state](LIBRARY_READINESS.md) | Busy/placeholder settlement on populated, empty and failed public catalogs |
| [Keeper queue lifecycle](KEEPER_QUEUE_LIFECYCLE.md) | File-selection ownership, preparation gating and source/CI evidence |
| [Local EPUB inspection](EPUB_INSPECTION.md) | Encoded archive paths, inspection boundaries and source/CI evidence |
| [Keeper Upload presentation](KEEPER_UPLOAD_PRESENTATION.md) | Similar-volume warning ownership, report refreshes and source/CI evidence |
| [Upload buffer admission](UPLOAD_BUFFER_BUDGET.md) | Unknown-length reader, per-isolate concurrency budget, workerd measurements and limits |
| [Historical upload memory](UPLOAD_MEMORY.md) | v2.16.1 declared-length buffering measurements |
| [Browser persistence](BROWSER_PERSISTENCE.md) | Failed-write rollback, compound Read Again and concurrency/crash limits |
| [Protected source transport](PROTECTED_SOURCE_TRANSPORT.md) | Explicit visual scanning and the pinned vendor's XHR/archive consumer map |
| [Pages upload transport](PAGES_UPLOAD_TRANSPORT.md) | Plugin-issued upload tokens, local asset requests and guarded release procedure |
| [Website architecture](WEBSITE_ARCHITECTURE.md) | Current public page, access, theme and Keeper upload ownership |
| [Website refactor](WEBSITE_REFACTOR_ROADMAP.md) | Website scope, ownership findings and tested increments |
| [Reader maintenance](READER_MAINTENANCE.md) | Current cleanup increments, completion checks and next priorities |
| [Reader architecture](READER_ARCHITECTURE.md) | Startup, service boundaries, navigation, layout and resource ownership |
| [EPUB.js contract](READER_VENDOR_CONTRACT.md) | Vendor surface, adaptation responsibilities and upgrade checks |
| [Code review](READER_CODE_REVIEW.md) | v2.12.5 baseline assessment and follow-up |
| [Release record](READER_RELEASE.md) | Production versions, verification, acceptance and tracked limitations |
| [Scroll audit](READER_SCROLL_AUDIT.md) | Demonstrated races, corrections and reproductions |
| [Performance](READER_PERFORMANCE.md) | Publication measurements, cache budgets and limits |
| [API contracts](API_CONTRACTS.md) | Routes, authorization, catalog mutations and media behavior |
| [Deployment configuration](DEPLOYMENT.md) | Local/new-environment setup, credentials and legacy imports |
| [Production verifier](PRODUCTION_VERIFIER.md) | Read-only D1 baselines, configuration guards and served-source checks |
| [Production operations](PRODUCTION_TAKEOVER.md) | Existing site identity, guarded rollout and rollback |

## Historical records

The [refactor roadmap](READER_REFACTOR_ROADMAP.md) preserves phased implementation
history; current work is in maintenance. [Project audit](AUDIT.md) retains dated
audit evidence. [Initial recovery history](../RECONSTRUCTION_LOG.md),
[recovery boundaries](MISSING_COMPONENTS.md) and `../recovery-info/` retain original
provenance. [Initial test deployment](TEST_DEPLOYMENT.md) records an earlier setup;
its database now serves production and is not a disposable test target. The
[binding incident](incidents/2026-10-16-pages-bindings.md) explains later release
safeguards.
