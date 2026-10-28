# Series state labels — v2.29.2

[PR #92](https://github.com/skypie0102/ShadowGarden/pull/92) merged as
`24fcb1745344305acea6207ad4229ac54aed0c03`. Production verification completed on 2026-10-28.

Each volume keeps one Unread / In progress / Finished badge. The date/file-size
line no longer repeats Unread or Finished; in-progress percentage, saved page
and chapter remain. Main/Adult and Grid/List share the same renderer. No CSS,
button markup, cover placement, view preferences or stored reading state changes.
The entry and renderer use fresh v2.29.2 URLs for returning browsers.

The [reviewed-head gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40608216033) passes **545 Node tests** and
**1,241 browser cases**, with 9 platform skips and zero retries.
Eight targeted desktop/mobile Chromium cases also pass, including the exact
pre-80 Read/Download styling and unread/progress/finished transitions in both views.

The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40609609574) passes guarded publication as
deployment `d33e15a9-0904-4f8e-ac88-bb13076fdd45`. Catalog revision 18, all
17 snapshots and configuration are preserved with zero database writes.
Independent public checks match both updated scripts and eight retained assets,
including all four checked stylesheets. The maintained
[reading guide](../../guides/READING_JOURNEY.md) documents the single-state contract.
