# ShadowGarden documentation

[Focused UI/UX roadmap](UI_UX_ROADMAP.md) tracks the work following the completed
codebase audit, beginning with Library discovery and reading-action clarity.

The latest production release is **v2.26.0**, deployed on 2026-10-26 (Asia/Taipei)
from `a453fb3` through [PR #69](https://github.com/skypie0102/ShadowGarden/pull/69).
Scrolling away suspends screen-following while narration and preloading continue.
Tap the floating status to return to the spoken passage and resume following,
without restarting audio or resuming an explicit pause. Pages-mode wheel/swipe
browsing keeps narration playing. Controls are status/return, Previous,
Play/Pause, Next, Stop, settings cog. Narrow screens use two rows with 44px targets.
WebKit viewport observation supports script-disabled EPUB frames.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40248916576)
passes 501 Node tests, 1,006 full browser cases and all 100 focused speech checks
across five profiles, with nine existing skips and zero retries. Eight direct
live Reader checks pass across desktop/mobile Chromium with disposable original
EPUBs and mocked speech; 320px/1280px toolbar captures are reviewed. The verified
merged tree matches the candidate. Production preserves catalog revision 18,
all 17 snapshots and configuration, with zero database writes. Served assets,
voice metadata and request guards pass. Physical Android/Soul acceptance is separate.
[Guide](READER_TTS.md) · [Evidence](reader-speech-browsing-release-2.26.0.json).

The previous production release is **v2.25.0**, deployed on 2026-10-25 (Asia/Manila)
from `e5fcf05` through [PR #67](https://github.com/skypie0102/ShadowGarden/pull/67).
BrianMultilingual · Male is the default Edge voice; saved English choices remain
selected. Read aloud prepares four upcoming passages across chapter boundaries
with at most two background requests. Advancing reuses ready or in-flight audio
and refills the window; Pause/Resume retains it. Stop, Previous, voice changes
and restarting elsewhere cancel and clear it.

The [release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40206473400)
passes 501 Node tests and 991 browser cases across five profiles,
with 9 existing platform skips and zero retries. All 85 focused speech checks
pass. The prior live release fails the four-passage buffer check; the candidate
passes it in every profile. Two direct live Reader checks pass after deployment
using a disposable original EPUB and mocked audio. Production preserves the
immediate revision-18 catalog, all 17 snapshots and configuration, with zero
database writes. All 5 version/catalog/asset checks and live voice/request guards
pass, including Brian as the API default. Android/Soul hardware acceptance is
separate. Startup or a depleted buffer can still require network preparation.
[Read aloud guide](READER_TTS.md) · [Release evidence](reader-speech-buffer-release-2.25.0.json).

The previous production release is **v2.24.0**, deployed on 2026-10-25 (Asia/Manila)
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
[Read aloud guide](READER_TTS.md) · [Release evidence](reader-speech-controls-release-2.24.0.json).

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
See the [read aloud guide](READER_TTS.md) and
[release evidence](reader-speech-position-release-2.23.0.json).

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
See the [read aloud guide](READER_TTS.md) and [release evidence](reader-edge-tts-release-2.22.1.json).

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
zero database writes. See [release evidence](reader-paragraph-alignment-release-2.21.0.json).

The preceding production release is **v2.20.1**, deployed on 2026-10-25 (Asia/Manila)
from `d4ac4b2` through [PR #60](https://github.com/skypie0102/ShadowGarden/pull/60).
Keeper's Series Editor now opens **Translation provenance** with only saved
credits. When there are none, the list stays empty until **Add translator** is
used. [Release checks](https://github.com/skypie0102/ShadowGarden/actions/runs/40142342699)
and production verification are recorded in the
[release evidence](keeper-translator-empty-state-release-2.20.1.json).

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
[release evidence](keeper-volume-replacement-release-2.20.0.json) and the
[API contract](API_CONTRACTS.md).

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
[release evidence](series-themed-pin-release-2.19.4.json).

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
[release evidence](series-pin-icon-release-2.19.3.json).

The preceding production release is **v2.19.2**, deployed on 2026-10-24 from
`c9425b0` through [PR #56](https://github.com/skypie0102/ShadowGarden/pull/56).
[Mobile Series flow](UI_UX_ROADMAP.md) removes the remaining gap below
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
[release evidence](series-mobile-flow-release-2.19.2.json).

The preceding production release is **v2.19.1**, deployed on 2026-10-24 from
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
