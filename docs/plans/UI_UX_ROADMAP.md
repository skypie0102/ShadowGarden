# Focused UI/UX roadmap

This is the active work plan. Main retains its midnight palette and Adult its
rose palette. Preserve URLs, book identities, browser storage and the accepted
Reader scrolling/image-focus behavior. Each increment must have observable
acceptance criteria and pass the [CI gate](../operations/CI.md).

## Delivery order

| Phase | Outcome | Status |
| --- | --- | --- |
| 1. Library discovery | Find books and understand filters/suggestions | Complete in v2.19.0; [history](../archive/releases/UI_UX_PROGRESS_2.27.1.md#phase-1--library-discovery) |
| 2. Reading journey | Recognize saved progress and the next volume | Active; consistent actions/volume states released in v2.28.0; saved-progress context implemented for v2.28.1 |
| 3. Reader controls | Understand preferences and navigation | Implemented for v2.29.0; validation and production acceptance pending |
| 4. Visual consistency | Read labels and operate controls across screens | Planned; apply relevant improvements in each phase |
| 5. Keeper feedback | Understand destinations, duplicate choices and per-file outcomes | Planned; Replace EPUB and empty translator provenance already delivered |

## Phase 2 — Reading journey

Consistent actions and volume states [shipped in v2.28.0](../archive/releases/PUBLIC_READING_ACTIONS_2.28.0.md).
The current source adds saved-progress context for v2.28.1. Checkmarks identify
implementation; the PR and guarded release record validation and live acceptance
separately.

- [x] Keep shared reading destinations across Library and Series, with the user's restored compact Read / Continue / Read Again text on volume links.
- [x] Show explicit volume order and Unread / In progress / Finished states on Series pages. Keep the next-volume indication separate from reading state.
- [x] Let mobile metadata/actions flow around the cover, retain full-width tags and use compact themed pins (v2.19.1–v2.19.4).
- [x] Fill mobile reading-banner content height with proportional cover artwork (v2.27.1).
- [x] Revert PR #82; retain the full original synopsis, enlarge the cover beside details and provide explicit Grid/List controls (v2.28.5 source).
- [x] Show reliable saved progress without truncating useful context, including records with page-only progress: shared percentage/page/chapter summaries, timestamp-free legacy saves, accessible Recently Added descriptions and wrapping context (v2.28.1 source).
- [x] Preserve the compact Read/Download controls from before PR #80, restored at the user's request in v2.28.4.

Acceptance for this increment: Main and Adult; no progress, saved progress,
completion of the first volume, all volumes finished, out-of-order Finished marks
and missing EPUBs. The banner and Series hero must choose the same available
volume; matching card/cover and Recently Added keep the same destination.
Read again still requires confirmation, cancelling retains progress/bookmarks,
and reload preserves state. Check long titles, keyboard focus and page overflow
at 320px, tablet and desktop widths. Retain the catalog's volume order.

User-directed Series baseline: no Browse volumes, Find Volume or expandable
synopsis. Grid is the default; List is explicitly selected. Preserve the larger
cover beside details and reading/pinning actions, full-width tags below, and the
restored compact volume reading/download controls unless
the user requests a change. Source, PR checks and live acceptance stay separate.

The [reading journey guide](../guides/READING_JOURNEY.md) documents the shared
selection and action-copy contract. Earlier layout changes and their release
verification are in the [dated progress record](../archive/releases/UI_UX_PROGRESS_2.27.1.md).

## Phase 3 — Reader controls

Alignment, English Edge TTS, bounded preloading, independent browsing, SVG
controls and supported background playback are already implemented. See the
[read aloud guide](../guides/READER_TTS.md) and [release record](../archive/releases/READER_RELEASE.md).

- [x] Review the production Reader UI with disposable books and group settings by mode, typography, layout and appearance (v2.29.0 source).
- [x] Explain immediate changes, retained mode-specific choices, units and device-default Reset scope (v2.29.0 source).
- [x] Separate current chapter from whole-volume progress and explain chapter/search/bookmark, page-turn and seek controls (v2.29.0 source).
- [x] Add a dismissible first-use illustration tip for double-tap/double-click focus without changing image gestures (v2.29.0 source).

Acceptance: Continuous and Pages; mobile defaults/reset; TOC/search/bookmarks;
image focus/return; keyboard use. Keep automated fast-scroll and restoration
regressions. Physical-device checks retain their own dated evidence.
The [settings](../guides/READER_SETTINGS.md) and [controls](../guides/READER_CONTROLS.md)
guides describe the implemented contracts. Checkmarks identify source implementation;
PR validation and guarded production acceptance remain separate. Confirm visible
reading text through settings Reset/reload and image focus/return, rather than
using a chapter label alone as evidence of position preservation.

## Phase 4 — Visual consistency

- [ ] Review muted text and control boundaries against both public palettes.
- [ ] Review stacked tablet filters and keyboard reachability of collapsed sections.
- [ ] Align spacing, button hierarchy, icons and touch targets across public pages.
- [ ] Review dialog, loading, empty, failure and success presentation.
- [ ] Retain visible keyboard focus, reduced motion and forced-colors support.

Acceptance: representative Main, Adult, Series, Reader and Keeper states at
mobile/desktop widths, including long content and increased text size.

## Phase 5 — Keeper feedback

Direct volume EPUB replacement and empty-until-added translator provenance are
already released in v2.20.0/v2.20.1.

- [ ] Walk through the current upload/target/duplicate flow before selecting changes.
- [ ] Make the selected destination and consequences of duplicate choices explicit.
- [ ] Present per-file preparation, upload, failure and retry states consistently.
- [ ] Make completion summaries and the next useful action easy to understand.

Acceptance: new/existing series, Main/Adult targets, mixed valid/invalid files,
duplicates, partial failure, retry, cancellation and reopening a queued batch.
Use disposable fixtures for catalog mutations.

## Release discipline

Run asset/Node/build/Functions checks and relevant browser cases, then pass the
[CI gate](../operations/CI.md). Review representative desktop/mobile captures.
Checked main publishes through the [guarded workflow](../operations/AUTO_DEPLOYMENT.md).
Record canonical source/version, served assets and catalog/configuration
preservation separately from source validation. No production seed or migration
is part of these presentation increments.
