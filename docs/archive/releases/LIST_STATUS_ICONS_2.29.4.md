# List status icons — v2.29.4

[PR #96](https://github.com/skypie0102/ShadowGarden/pull/96) merged as
`1197cea4af10cce4bfc2f3843e10041368c69c2e` on 2026-10-28.

A follow-up in [PR #99](https://github.com/skypie0102/ShadowGarden/pull/99)
corrects two presentation details: this release still included a checkmark
character in Grid Finished text and clipped List labels with CSS. The follow-up
removes the checkmark and completely hides List label elements, with explicit
assertions for the visible content in both views.

List volume covers use compact 22px SVG badges: a green check for Finished,
a closed book for Unread, an open book for In progress and a turning arrow for
the unread Up next volume. The full state remains in accessible descriptions
and cover tooltips. Grid retains its text badges. The icons share rounded lines
and the existing Main/Adult theme colors.

Library compact covers use the matching green check and filled pin for Finished
and Pinned series. The pin appears only on Library series covers, as requested.
Volume-count and Adult chips retain their text. The Series header, Grid/List
preferences, Read/Download markup and styling, saved progress and bookmarks
retain their released behavior. Both page entries, renderers, the shared icon
module and affected stylesheets use fresh URLs for returning browsers.

The [reviewed-head gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40637947683)
passes **545 Node tests** and **1,241 browser cases**, with 9 platform skips and
zero retries across 15 shards (13m 27s). The reviewed source is
`24c4f19731eaf20386e11004635c0a438aa37c2c`; PR #96’s merged tree matches it exactly.
Sixteen focused desktop/mobile Chromium and WebKit cases also pass, covering
both themes, all five icons, 22px bounds, accessible states, Grid text labels,
reading-state transitions, cancellation preserving storage and the exact pre-80
Read/Download style comparison. All 702 then-existing local documentation links
resolve. Preview checks independently match 14 served assets to source, including
all five inspected stylesheets and seven retained assets.

The first merged run exposed a test setup race: the reload event could finish
before the asynchronous Library controller bound its Compact listener.
[Test-only PR #97](https://github.com/skypie0102/ShadowGarden/pull/97) waits for
catalog readiness, confirms Compact is selected and scrolls the card into view
before checking badge roles. Eight Main/Adult desktop/mobile Chromium and WebKit
cases pass with the renderer deliberately held through DOMContentLoaded. Its
code/build gate also passes all 545 Node tests, and its
[full gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40640682059)
passes all five browser profiles. Source
`558f1b7efed9593e265e5dae7c9a0412c6aee494` includes this correction; application
assets remain byte-identical to the reviewed icon implementation.

The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40640994351)
passes its full gate and ten production checks. An unrelated Keeper comparison
needed one isolated Chromium batch rerun: its baseline and candidate PNGs were
identical, while the initial paint differed by one RGB step on 299,830 of 921,600
pixels; computed styles and native-control properties matched. The same strict
guard passed on rerun, along with all 85 cases in that batch. No tolerance or
layout assertion was loosened.

Live verification completed on 2026-10-28 as deployment
`ab66c2c4-f8d1-48da-a5be-8a20959b2437`, serving v2.29.4 from
`558f1b7efed9593e265e5dae7c9a0412c6aee494`. Catalog revision 18, all 17 snapshots
and configuration are preserved with zero database writes.

Independent public checks match all 14 inspected assets to source, including
all five checked stylesheets, the shared icon module and seven retained assets.
The live Series stylesheet fingerprint is `fc370ee24fe1`. The maintained
[reading guide](../../guides/READING_JOURNEY.md) documents the List icon contract.
