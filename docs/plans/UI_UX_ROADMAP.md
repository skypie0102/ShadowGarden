# Focused UI/UX roadmap

This is the active work plan. Main retains its midnight palette and Adult its
rose palette. Preserve URLs, book identities, browser storage and the accepted
Reader scrolling/image-focus behavior. Each increment must have observable
acceptance criteria and pass the [CI gate](../operations/CI.md).

## Delivery order

| Phase | Outcome | Status |
| --- | --- | --- |
| 1. Library discovery | Find books and understand filters/suggestions | Complete in v2.19.0; [history](../archive/releases/UI_UX_PROGRESS_2.27.1.md#phase-1--library-discovery) |
| 2. Reading journey | Recognize saved progress and the next volume | Active; mobile Series header/pins and full-height reading covers released through v2.27.1 |
| 3. Reader controls | Understand preferences and navigation | Active; alignment and Read Aloud released through v2.27.0 |
| 4. Visual consistency | Read labels and operate controls across screens | Planned; apply relevant improvements in each phase |
| 5. Keeper feedback | Understand destinations, duplicate choices and per-file outcomes | Planned; Replace EPUB and empty translator provenance already delivered |

## Phase 2 — Reading journey

The current source implements the first two items below for v2.28.0. Checkmarks
identify implementation; the PR and guarded release record validation and live
acceptance separately.

- [x] Use consistent Start reading / Continue reading / Read next volume / Read again actions across the Library banner, Recently Added, Series hero and volume links.
- [x] Show explicit volume order and Unread / In progress / Finished states on Series pages. Keep the next-volume indication separate from reading state.
- [x] Let mobile metadata/actions flow around the cover, retain full-width tags and use compact themed pins (v2.19.1–v2.19.4).
- [x] Fill mobile reading-banner content height with proportional cover artwork (v2.27.1).
- [ ] Refine synopsis and volume-list presentation around the next reading action.
- [ ] Show reliable saved progress without truncating useful context, including records with page-only progress.
- [ ] Keep downloads visually secondary and easy to find after the reading actions have been reviewed.

Acceptance for this increment: Main and Adult; no progress, saved progress,
completion of the first volume, all volumes finished, out-of-order Finished marks
and missing EPUBs. The banner and Series hero must choose the same available
volume; the matching card/cover and Recently Added use the same action name.
Read again still requires confirmation, cancelling retains progress/bookmarks,
and reload preserves state. Check long titles, keyboard focus and page overflow
at 320px, tablet and desktop widths. Retain the catalog's volume order.

The [reading journey guide](../guides/READING_JOURNEY.md) documents the shared
selection and action-copy contract. Earlier layout changes and their release
verification are in the [dated progress record](../archive/releases/UI_UX_PROGRESS_2.27.1.md).

## Phase 3 — Reader controls

Alignment, English Edge TTS, bounded preloading, independent browsing, SVG
controls and supported background playback are already implemented. See the
[read aloud guide](../guides/READER_TTS.md) and [release record](../archive/releases/READER_RELEASE.md).

- [ ] Review live reader screens and group settings by mode, typography, layout and appearance.
- [ ] Make current choices and Reset behavior understandable before applying changes.
- [ ] Clarify chapter/book progress and the purpose of navigation controls.
- [ ] Add discreet first-use guidance for image double-tap/double-click focus.

Acceptance: Continuous and Pages; mobile defaults/reset; TOC/search/bookmarks;
image focus/return; keyboard use. Keep automated fast-scroll and restoration
regressions. Physical-device checks retain their own dated evidence.

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
