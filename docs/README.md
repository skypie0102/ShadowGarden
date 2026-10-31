# ShadowGarden documentation

Start with the [project README](../README.md) for development and validation.
Active plans contain unfinished work; guides describe maintained behavior;
operations explain checks and releases. Completed projects, dated audits and
release evidence live in the archive.

## Active work

| Document | Scope | Next step |
| --- | --- | --- |
| [Android roadmap](plans/ANDROID_ROADMAP.md) | Current repository development cycle: reader, offline library, local progress backup and Keeper | Validate reader and access prototypes before committing to the integration approach |
| [Android parity inventory](plans/ANDROID_PARITY_INVENTORY.md) | Existing Library, Reader and Keeper workflows mapped to Android screens and acceptance cases | Use to track implementation and acceptance through later phases |
| [Android reader evaluation](plans/ANDROID_READER_EVALUATION.md) | Preliminary reader candidates, integration constraints and prototype protocol | Validate both approaches before choosing the reader |
| [Android reading-position foundation](plans/ANDROID_READING_STATE.md) | App-private progress storage, edition matching and current limitations | Integrate with the selected reader and design manual backup |
| [Follow-ups and acceptance limits](plans/FOLLOW_UPS.md) | Work that needs a separate reproduction, design decision or physical device | Keep these limits visible without reopening completed refactors |

## Maintained guides

| Document | Use it for |
| --- | --- |
| [Website architecture](guides/WEBSITE_ARCHITECTURE.md) | Public pages, Garden Pass, Library state and Keeper upload ownership |
| [Public reading journey](guides/READING_JOURNEY.md) | Shared reading actions, saved state and next-volume selection |
| [Reader architecture](guides/READER_ARCHITECTURE.md) | Startup, navigation, layout, lifecycle, measurements and caches |
| [Reader settings](guides/READER_SETTINGS.md) | Immediate changes, device defaults, mode-specific controls and Reset scope |
| [Reader controls](guides/READER_CONTROLS.md) | Chapter/volume progress, navigation and first-use image-focus guidance |
| [Keeper uploads](guides/KEEPER_UPLOADS.md) | Destinations, duplicate consequences, per-file outcomes, retries and retained queues |
| [Visual accessibility](guides/VISUAL_ACCESSIBILITY.md) | Readability, keyboard/contrast focus and checks that preserve the released layouts |
| [EPUB.js contract](guides/READER_VENDOR_CONTRACT.md) | Pinned vendor integration and upgrade checks |
| [Reader read aloud](guides/READER_TTS.md) | Speech behavior, buffering, playback and platform limits |
| [API contracts](guides/API_CONTRACTS.md) | Authentication, revisions, catalog writes, uploads, snapshots and cleanup |
| [Android development](../android/README.md) | Android scaffold, prerequisites, build commands and present limitations |

## Operations

| Document | Use it for |
| --- | --- |
| [GitHub checks](operations/CI.md) | Change selection, browser shards, reports and the required CI gate |
| [Automatic production deployment](operations/AUTO_DEPLOYMENT.md) | Existing main-only publication, credentials, preservation and rollback identity |
| [Deployment configuration](operations/DEPLOYMENT.md) | Bindings, database initialization and configuring a separate environment |
| [Read-only production verifier](operations/PRODUCTION_VERIFIER.md) | Fresh baselines, served assets, version, catalogs and settings |
| [Version convergence](operations/PRODUCTION_VERSION_CONVERGENCE.md) | Bounded polling of coherent release metadata |
| [Scroll diagnostics](operations/READER_SCROLL_DIAGNOSTICS.md) | Optional manual investigation with generated fixtures |

## Archive and documentation rules

The [archive index](archive/README.md) explains completed plans, audits, release
records, recovery history and evidence. Historical “pending” statements retain
their date; completion recorded later in the same history supersedes them.
The [path map](archive/path-map.json) maps moved documents to their new homes.

Keep one current plan per workstream. Move completed narratives to the archive,
link the final evidence, and leave only a concise completion entry in the active
plan. Retain useful architecture and operational contracts as guides. Record
source validation, merge and production acceptance separately; do not turn an
old deployment limitation into a current engineering task without checking
later releases. Preserve evidence JSON and original provenance files.
