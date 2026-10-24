# Focused UI/UX roadmap

The codebase audit is complete at v2.18.13. This roadmap improves the everyday
Library → Series → Reader journey and Keeper's existing workflows. Each phase
ships as a small, independently verified release. Main keeps its midnight
palette; Adult keeps its rose palette.

## Delivery order

| Phase | Outcome | Status |
| --- | --- | --- |
| 1. Library discovery | Find books sooner and understand filters and reading suggestions | Complete — v2.19.0 |
| 2. Reading journey | Recognize saved progress and the next volume across Library and Series | In progress — compact mobile Series header in v2.19.1 candidate |
| 3. Reader controls | Find and understand reading preferences and navigation | Planned |
| 4. Visual consistency | Read labels and operate controls comfortably across screens | Planned; apply relevant improvements in each phase |
| 5. Keeper feedback | Understand upload destinations, duplicate decisions and per-file results | Planned |

## Phase 1 — Library discovery

- [x] Reduce introductory spacing and heading size; review desktop/mobile layouts.
- [x] Give the existing mobile filter toggle a visible **Filters** label and active count.
- [x] Retain search, selected-filter chips and individual removal while filters are collapsed.
- [x] Improve filter-label readability and the touch size of the changed controls.
- [x] Hide Recently Added when the catalog contains only one series, avoiding a redundant shelf.
- [x] Distinguish **Continue reading**, **Next in series** and **Reading suggestion** in the banner.
- [x] Keep banner titles/progress readable and offer another suggestion only when an alternative exists.

Phase 1 is merged through [PR #54](https://github.com/skypie0102/ShadowGarden/pull/54)
for v2.19.0. The PR [verification run](https://github.com/skypie0102/ShadowGarden/actions/runs/40081665674)
passes the asset audit, all **471 Node tests**, the static build and binding-aware
Functions compilation. All **846 browser cases** pass across five profiles, with
nine existing platform skips and zero retries. All 25 new Library cases pass.
The separate Chromium startup profile also passes.

The new cases cover both Library scopes, filtering across responsive widths,
sparse/empty catalogs and the saved-progress/next-volume/Read again journey.
They verify that the mobile Filters label, count and arrow fit inside the button,
including two active filters. Representative desktop, tablet, narrow-screen and
reading-banner captures were reviewed across Chromium, Firefox and WebKit.
The four intentionally redesigned stylesheet owners use these new layout checks;
the historical pixel/cascade comparisons retain the other 17 sheets.

Merged source `af3c7bd` has exactly the reviewed tree. The
[main release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40082970117)
passes the same 471 Node/846 browser checks and publishes **v2.19.0** to the
existing live project. All 11 production checks pass: version/source, both
D1-derived catalogs and all eight changed assets. The exact revision-9 document,
nine snapshots and production configuration are preserved, with zero DB writes.

Live Main Library search, Reset and the visible version footer are verified.
At the same 1363×936 desktop viewport and unchanged single-series catalog, the
first catalog book moves from y=759.8 to y=369.0 pixels (390.8 pixels higher).
This is one observed desktop layout, not a general performance measurement.
[Release evidence](library-discovery-release-2.19.0.json) retains source identities,
CI/report hashes, visual review and independent preservation digests. Phase 2
is next: consistent reading actions and clearer Series/volume presentation.

Acceptance: Main and Adult; empty, single-series and larger catalogs; narrow
mobile, tablet and desktop; filtering/reset/history; keyboard operation; no
horizontal page overflow. Existing saved reading and filter preferences remain
compatible. New interaction/layout controls replace visual-equivalence claims
for intentionally redesigned styles.

## Phase 2 — Reading journey

- [ ] Use consistent Start reading / Continue reading / Read next volume / Read again actions.
- [ ] Show volume order and Unread / In progress / Finished states clearly on Series pages.
- [ ] Balance the mobile series header, synopsis and volume list around the next reading action.
  - v2.19.1 candidate: place reading/pin/audio actions and tags across the full
    mobile header beneath the cover/title pair. Reduce header padding and remove
    the unused cover-column gap. Desktop retains its current layout.
    Verify both palettes, breakpoint resizing, long metadata, missing cover,
    keyboard pinning and optional audio links before publication.
- [ ] Show reliable saved progress without truncating its useful context.
- [ ] Keep download actions visually secondary and easy to find.

Acceptance: new reader, partially read book, finished volume with a successor,
completed series, missing/unreadable volume and long titles. Read again retains
its explicit confirmation and existing bookmarks.

## Phase 3 — Reader controls

- [ ] Review live reader screens and group settings by mode, typography, layout and appearance.
- [ ] Make current choices and Reset behavior understandable before applying changes.
- [ ] Clarify chapter/book progress and the purpose of navigation controls.
- [ ] Add discreet first-use guidance for image double-tap/double-click focus.

Acceptance: Continuous and Pages; mobile defaults/reset; TOC/search/bookmarks;
image focus/return; keyboard use. Exercise fast upward scrolling and position
restoration in the automated fixture; record Android/Soul acceptance separately.

## Phase 4 — Visual consistency

- [ ] Review muted text and control boundaries against both public palettes.
- [ ] Review filter density in stacked tablet layouts and keyboard reachability of collapsed sections.
- [ ] Align spacing, button hierarchy, icons and touch targets across public pages.
- [ ] Review dialog, loading, empty, failure and success presentation.
- [ ] Retain visible keyboard focus, reduced motion and forced-colors support.

Acceptance: representative Main, Adult, Series, Reader and Keeper states at
mobile/desktop widths, including long content and increased text size.

## Phase 5 — Keeper feedback

- [ ] Walk through the existing upload/target/duplicate flow before selecting changes.
- [ ] Make the selected destination and consequences of each duplicate choice explicit.
- [ ] Present per-file preparation, upload, failure and retry states consistently.
- [ ] Make completion summaries and the next useful action easy to understand.

Acceptance: new/existing series, Main/Adult targets, mixed valid/invalid files,
duplicates, partial failure, retry, cancellation and reopening a queued batch.
Use disposable fixtures for catalog mutations.

## Release discipline

Run the asset/Node/build/Functions checks and relevant browser cases before a PR.
Review representative desktop/mobile captures. The full five-profile CI suite
must pass before merging. Checked main publishes through the existing guarded
production workflow; record canonical source/version, served assets and
catalog/configuration preservation separately from the merge. No production
seeding or migration is part of these presentation releases.

## Initial observations — 2026-10-24

The live v2.18.13 Library repeats the single Main title in its suggestion,
Recently Added and catalog. Desktop filters have substantial vertical spacing;
the mobile collapse toggle and removable filter chips already exist. The
initial review reached the Series page; live book content required Garden Pass
verification. Reader/Keeper changes need their own walkthrough before design.
