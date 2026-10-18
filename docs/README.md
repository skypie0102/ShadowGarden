# ShadowGarden documentation

The latest verified production baseline is v2.12.8, deployed on 2026-10-18.
Its [release record](READER_RELEASE.md) and [verification evidence](reader-release-2.12.8.json)
identify the exact source, automated results and live checks. On 2026-10-18
the owner manually verified fast upward scrolling and image-focus return on
Android/Soul in v2.12.6; both requested device checks pass.

| Document | Use it for |
| --- | --- |
| [Reader maintenance](READER_MAINTENANCE.md) | Current cleanup increments, completion checks and next priorities |
| [Reader architecture](READER_ARCHITECTURE.md) | Startup, service boundaries, navigation, layout and resource ownership |
| [EPUB.js contract](READER_VENDOR_CONTRACT.md) | Vendor surface, adaptation responsibilities and upgrade checks |
| [Code review](READER_CODE_REVIEW.md) | v2.12.5 baseline assessment and follow-up |
| [Release record](READER_RELEASE.md) | Production versions, verification, acceptance and tracked limitations |
| [Scroll audit](READER_SCROLL_AUDIT.md) | Demonstrated races, corrections and reproductions |
| [Performance](READER_PERFORMANCE.md) | Publication measurements, cache budgets and limits |
| [API contracts](API_CONTRACTS.md) | Routes, authorization, catalog mutations and media behavior |
| [Deployment configuration](DEPLOYMENT.md) | Local/new-environment setup, credentials and legacy imports |
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
