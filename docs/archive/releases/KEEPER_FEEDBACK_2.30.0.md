# Phase 5 Keeper feedback — v2.30.0

[PR #100](https://github.com/skypie0102/ShadowGarden/pull/100) implements the
Phase 5 upload-feedback pass. It merged as
`585d862d215f9ca4294c4110ae732f508d92462a`; the merged application tree matches
the reviewed source exactly:
`d0fe76569ecd985ef40dc26a32070a3a009e10a4`.

The walkthrough found three concrete gaps: upload request failures inherited
invalid-EPUB repair guidance, the upload stage hid per-file outcomes, and
successful completion could discard skipped/invalid files excluded from the
attempt. The change fixes those gaps using the existing upload engine and controls.

- [x] Walk through general/targeted selection, metadata, duplicates and completion.
- [x] Show the effective library/series/volume destination and duplicate-action consequences.
- [x] Distinguish per-file preparation, upload, catalog update, success, failure, skipped and invalid outcomes; provide retry guidance without resending successes.
- [x] Keep completion actions before detailed results, retain unattempted File objects/metadata, preserve chooser history and open the correct library.

Targeted replacement requires a match in the exact selected series and library.
Batch Replace existing updates the incoming EPUB and metadata while preserving
book identity/reading links; the separate Series Editor Replace EPUB operation
retains its metadata-preserving contract. Completion uses the locked destination
even when only a non-active imported file succeeds.

Existing control CSS, public Library/Series/Reader files, storage keys, book
identities, API authentication and catalog adoption remain with their existing
owners. New styling applies only to per-file result rows and retry feedback.
The maintained [Keeper upload guide](../../guides/KEEPER_UPLOADS.md) describes the
operator flow and ownership boundary.

Local validation passes all **556 Node tests**, audit, build and Functions checks.
Forty new feature cases pass across desktop/mobile Chromium, Firefox and WebKit,
alongside five existing queue/retry cases and six final WebKit completion-layout
checks. Screenshots were reviewed at 320px; headings and completion actions remain
in the viewport, ahead of the detailed results. All mutation scenarios use
disposable EPUBs and intercepted APIs. Existing lifecycle coverage retains
cancellation, destination confirmation, reopening, lock and stale-result cases.

The [reviewed-source full gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40675560898)
passes **556 Node tests** and **1,281 browser cases**, with nine platform skips
and zero retries across 15 shards (**11m 17s**). Independent preview verification
matches all 28 inspected assets to source: six changed Keeper assets, 14 retained
public assets and eight retained Keeper assets.


The [main release gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40677148035)
passes its full browser gate and **9 production checks**, on the first
attempt. Live verification completed on 2026-10-28 as deployment
`a8678919-22ba-4113-af13-423230b65bf8`, serving v2.30.0 from
`585d862d215f9ca4294c4110ae732f508d92462a`. Catalog revision 18, all 17 snapshots
and configuration are preserved with **zero database writes**.

Independent public verification matches all **28** inspected assets to source:
six changed Keeper assets, 14 retained public assets and eight retained Keeper
assets. The public reading buttons, Series cover/badge layouts, Reader behavior
and existing Keeper control styles retain their released assets.

The [sanitized release evidence](../evidence/keeper-feedback-release-2.30.0.json)
retains source/deployment identities, gate results, hashes and preservation.
Remaining Reader/device acceptance limits stay in
[follow-ups](../../plans/FOLLOW_UPS.md).
