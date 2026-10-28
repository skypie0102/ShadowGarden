# Volume cover badges — v2.29.3

[PR #94](https://github.com/skypie0102/ShadowGarden/pull/94) merged as
`23b92f7e5b17d43afbd7435bd72553fc77517ddc` on 2026-10-28.

Each volume shows one Unread / In progress / ✓ Finished badge over the top-right
of its cover in Grid and List, including cover placeholders. This replaces the
label beside the title and the old Finished-only cover checkmark. The dark
backing keeps text readable over artwork; longer labels wrap inside small covers.
The badge exposes the state as the cover link’s accessible description and lets
clicks/taps through to the existing reading action.

Series volume cards no longer use offscreen size containment: WebKit could reuse
List dimensions in Grid after resizing or switching views, collapsing titles and
overlapping actions. The same failure was reproduced with the released renderer
and styles. The fix retains the existing view-switch controller and card nodes.
The Series hero, compact Read/Download markup and styles, metadata, Grid/List
preferences and stored reading state retain their released contracts. Both
scripts use fresh v2.29.3 URLs and the Series stylesheet uses its build fingerprint.

The [reviewed-head gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40631979405)
passes **545 Node tests** and **1,241 browser cases**, with 9 platform skips and
zero retries across 15 shards (13m 39s). The reviewed source is
`19e4e73b61772e9f4f80397e28a5380a4043b269`; the merged tree matches it exactly.
Sixteen targeted desktop/mobile Chromium and WebKit cases also pass, including
Main/Adult, all three states, both views, narrow/tablet/desktop non-overlap checks,
badge-area mouse/touch activation, cancellation preserving storage and the exact
pre-80 Read/Download style comparison. All 700 then-existing local documentation
links resolve. Preview checks independently match 10 served assets to source.

The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40633346570)
passes its full gate and six production checks. Live verification completed on
2026-10-28 as deployment `cb40a67f-73a2-4cd2-ac17-5d2085cb8718`, serving v2.29.3
from the merged source. Catalog revision 18, all 17 snapshots and configuration
are preserved with zero database writes.

Independent public checks match both updated scripts, the updated Series
stylesheet and seven retained assets to source, including all four inspected
stylesheets. The live stylesheet fingerprint is `2518bd7f68f3`. The maintained
[reading guide](../../guides/READING_JOURNEY.md) documents the cover-badge contract.
