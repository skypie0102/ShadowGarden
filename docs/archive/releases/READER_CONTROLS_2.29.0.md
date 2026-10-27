# Phase 3 Reader controls — v2.29.0

[PR #83](https://github.com/skypie0102/ShadowGarden/pull/83) merged as
`90997e396ce1790a8f5e75ef30fd0a0ae2dad478` on 2026-10-27. The merged tree
matches reviewed head `7ca68d5f10628d63b64e2be3c12f7eec60c251d9`.

The Reader now groups preferences into reading mode, typography, layout and
appearance. Copy explains immediate browser-wide changes, units, retained
mode-specific choices and device-default Reset. Reset preserves reading position,
bookmarks, Finished state and speech preferences through the normal flow switch.
Continuous restoration waits for buffer styles before target correction.

Contents separates Current chapter from Volume progress and offers collapsible,
keyboard-accessible Navigation help. A dismissible first-use illustration tip
explains double-tap or double-click focus after substantial artwork enters the
reading canvas. Eight visible seconds, dismissal or successful focus teach the tip
for this browser. Existing image gestures and return behavior remain intact.
The maintained [settings](../../guides/READER_SETTINGS.md) and
[controls](../../guides/READER_CONTROLS.md) guides document these contracts.

All Series assets remain identical to v2.28.7: larger cover beside details and
reading/pin actions, full-width tags, explicit Grid/List, restored compact volume
Read/Download controls and a solid pinned icon. PR #82's reverted UI is not restored.

The [reviewed-head CI run](https://github.com/skypie0102/ShadowGarden/actions/runs/40530019401)
passed in 12 minutes 15 seconds: audit, **545 Node tests**, build and Pages Functions
compilation; **1,191 browser tests**, with 9 existing platform skips and zero retries,
across five profiles and 15 shards. This includes **90 new Reader cases**. Local
desktop/mobile WebKit runs also passed 24 guidance and 12 settings/Reset cases;
both expanded desktop WebKit alignment cases passed. Checks assert actual visible
chapter text through navigation, Reset/reload and image focus/return. Mobile
navigation and Paper settings captures were reviewed against the released Reader.

The [production release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40534040129)
and [sanitized evidence](../evidence/reader-controls-release-2.29.0.json) record
publication, served assets and catalog/configuration preservation separately from
source validation.

Production deployment `56813a6e-7ab0-4eca-8358-253856be5794` serves v2.29.0 from
the exact merged source. All 15 main browser shards and the guarded release pass.
Eleven production checks verify version, catalogs and changed Reader assets.
The pre/post-release comparison preserves catalog revision 18, all 17 snapshots
and configuration, with zero database writes; the speech checks also pass.
An independent public check matches eight Reader assets and four retained Series
assets byte-for-byte with reviewed source, including the fresh settings/help
markup, stylesheet and focus script URLs.

Physical-device acceptance remains separate. The generated-book Continuous
393px → 320px width-change witness also reproduced section drift with the released
v2.28.7 Reader assets; this release does not claim resize-position acceptance.
Both limits remain in [follow-ups](../../plans/FOLLOW_UPS.md). Active UI work
continues with [visual consistency](../../plans/UI_UX_ROADMAP.md#phase-4--visual-consistency).
