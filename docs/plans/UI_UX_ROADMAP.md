# Focused UI/UX roadmap

This is the active work plan. Main retains its midnight palette and Adult its
rose palette. Preserve URLs, book identities, browser storage and the accepted
Reader scrolling/image-focus behavior. Each increment must have observable
acceptance criteria and pass the [CI gate](../operations/CI.md).

## Delivery order

| Phase | Outcome | Status |
| --- | --- | --- |
| 1. Library discovery | Find books and understand filters/suggestions | Complete in v2.19.0; [history](../archive/releases/UI_UX_PROGRESS_2.27.1.md#phase-1--library-discovery) |
| 2. Reading journey | Recognize saved progress and reach the next volume | Complete in v2.28.2; [release record](../archive/releases/READING_JOURNEY_2.28.2.md) |
| 3. Reader controls | Understand preferences and navigation | Active; alignment and Read Aloud released through v2.27.0 |
| 4. Visual consistency | Read labels and operate controls across screens | Planned; apply relevant improvements in each phase |
| 5. Keeper feedback | Understand destinations, duplicate choices and per-file outcomes | Planned; Replace EPUB and empty translator provenance already delivered |

## Phase 2 — Reading journey

Complete and released in [v2.28.2](../archive/releases/READING_JOURNEY_2.28.2.md).
The archived record contains the completed checklist, acceptance and production
evidence. The [reading journey guide](../guides/READING_JOURNEY.md) maintains the
shared action, saved-context, synopsis, navigation and download contracts.

## Phase 3 — Reader controls

Alignment, English Edge TTS, bounded preloading, independent browsing, SVG
controls and supported background playback are already implemented. See the
[read aloud guide](../guides/READER_TTS.md) and [release record](../archive/releases/READER_RELEASE.md).

- [x] Review the production Reader UI with disposable books and group settings by mode, typography, layout and appearance (v2.29.0 source).
- [x] Explain immediate changes, retained mode-specific choices, numeric units and device-default Reset scope before activation (v2.29.0 source).
- [ ] Clarify chapter/book progress and the purpose of navigation controls.
- [ ] Add discreet first-use guidance for image double-tap/double-click focus.

Acceptance: Continuous and Pages; mobile defaults/reset; TOC/search/bookmarks;
image focus/return; keyboard use. Keep automated fast-scroll and restoration
regressions. Physical-device checks retain their own dated evidence. The [settings guide](../guides/READER_SETTINGS.md)
documents the implemented grouping and Reset contract. Checkmarks identify
source implementation; PR validation and guarded production acceptance remain
separate records.

Reset retains the old mode until its normal flow switch captures the reading
anchor. Saved Continuous positions are also completed through the existing navigation
path on startup (v2.29.0 source). Validate actual visible reading text through
Reset/reload; a chapter label alone can describe an adjacent chapter in view.

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
