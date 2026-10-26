# ShadowGarden documentation

Start with the [project README](../README.md) for development and validation.
Active plans contain unfinished work; guides describe maintained behavior;
operations explain checks and releases. Completed projects, dated audits and
release evidence live in the archive.

## Active work

| Document | Scope | Next step |
| --- | --- | --- |
| [UI/UX roadmap](plans/UI_UX_ROADMAP.md) | Library → Series → Reader journey and Keeper feedback | Validate and release consistent reading actions and explicit volume states, then refine saved-progress context and synopsis/list presentation |
| [Follow-ups and acceptance limits](plans/FOLLOW_UPS.md) | Work that needs a separate reproduction, design decision or physical device | Keep these limits visible without reopening completed refactors |

## Maintained guides

| Document | Use it for |
| --- | --- |
| [Website architecture](guides/WEBSITE_ARCHITECTURE.md) | Public pages, Garden Pass, Library state and Keeper upload ownership |
| [Public reading journey](guides/READING_JOURNEY.md) | Shared reading actions, saved state and next-volume selection |
| [Reader architecture](guides/READER_ARCHITECTURE.md) | Startup, navigation, layout, lifecycle, measurements and caches |
| [EPUB.js contract](guides/READER_VENDOR_CONTRACT.md) | Pinned vendor integration and upgrade checks |
| [Reader read aloud](guides/READER_TTS.md) | Speech behavior, buffering, playback and platform limits |
| [API contracts](guides/API_CONTRACTS.md) | Authentication, revisions, catalog writes, uploads, snapshots and cleanup |

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
