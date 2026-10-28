# List and Grid status badge correction — v2.29.5

[PR #99](https://github.com/skypie0102/ShadowGarden/pull/99) merged as
`bc43a9151fd7d36dd13f89fbad4817eb8b6d7f2e` on 2026-10-28. Its application tree
matches reviewed source `433eccd24045eefd08a1115bb68a501a181d866f` exactly.

List cover overlays show only the themed icons. The text span is completely
hidden with `display: none`, while the badge accessible name and cover description
retain the full state. Grid shows only Unread, In progress or Finished text, with
no SVG icon or checkmark character. Library Grid and Recently Added Finished
text also omit the checkmark. The pin remains limited to Library List covers.

The 22px List badge dimensions, existing palettes, hero controls, saved reading
state, bookmarks and Read/Download markup and styles retain their behavior.
Changed page entries and renderers use v2.29.5 URLs, and the Series stylesheet
uses content fingerprint `8b79a5b0e2d7` for returning browsers. The shared icon
module and artwork CSS remain at v2.29.4.

Validation before merge: all 545 Node tests, audit, build and Functions checks
pass. All 20 focused Main/Adult desktop/mobile Chromium and WebKit cases pass,
including visible List/Grid contents, icon/state mapping, accessible descriptions,
cover bounds, reading-state transitions and the exact pre-80 button/card
comparisons. Phone screenshots were reviewed. Preview verification independently
matches all 14 inspected assets to the reviewed source, including five stylesheets
and seven retained assets.

The [reviewed-source gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40665240409)
also passes all 545 Node tests and 1,241 browser cases, with nine platform skips
and zero retries across 15 shards.

The [main release gate](https://github.com/skypie0102/ShadowGarden/actions/runs/40665804373)
passes its full browser gate and eight production checks. Live verification
completed on 2026-10-28 as deployment
`bd7a79a8-ddee-4ae1-994a-418c432c4e0c`, serving v2.29.5 from
`bc43a9151fd7d36dd13f89fbad4817eb8b6d7f2e`. Catalog revision 18, all 17 snapshots
and configuration are preserved with zero database writes.

Independent public checks match all 14 inspected assets to source, including
five stylesheets and seven retained assets. The live Series stylesheet uses the
expected `8b79a5b0e2d7` fingerprint.

The [reading guide](../../guides/READING_JOURNEY.md) documents the corrected contract.
