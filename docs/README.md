# ShadowGarden documentation

[Keeper workflow cleanup](KEEPER_WORKFLOWS.md) is deployed in **v2.18.2**
through [PR #41](https://github.com/skypie0102/ShadowGarden/pull/41), source
`c4f697b`. Seven expanded controllers retain
[formatting-stage equivalence](keeper-readability-equivalence.json), with the
reproduced banner-editor ownership correction recorded separately. Final PR and
main CI pass 325 Node tests and 551 browser cases, with nine documented skips
and zero test retries.

[Automatic live deployment](AUTO_DEPLOYMENT.md) is active. Checked `main` pushes
publish to the existing `shadowgarden` live project after access, verification
and all five browser profiles pass. The [current main release](https://github.com/skypie0102/ShadowGarden/actions/runs/39768639346)
verifies both catalogs, all seven changed assets and exact catalog/snapshot/
settings preservation. Revision 9 and all
9 snapshots are unchanged. The retained rollback is v2.18.1.
See [current sanitized verification](keeper-workflow-verification.json).
The test project's automatic main preview is a separate deployment.

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
| [Upload memory](UPLOAD_MEMORY.md) | Workerd upload measurements, declared-length buffering and remaining limits |
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
