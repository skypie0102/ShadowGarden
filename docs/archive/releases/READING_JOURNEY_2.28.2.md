# Reading journey complete — v2.28.2

[PR #82](https://github.com/skypie0102/ShadowGarden/pull/82) merged as
`79d7bab7312a91b2da3625c8882c84b31eb1bdfd` on 2026-10-27. The merged tree matches
the reviewed source. The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40448854275)
passes every browser shard, the aggregate gate and guarded publication.

This completes phase 2 of the public UI/UX roadmap:

- Consistent Start reading, Continue reading, Read next volume and Read again
  across the Library banner, Recently Added, Series hero and volume links
  ([v2.28.0](PUBLIC_READING_ACTIONS_2.28.0.md)).
- Explicit catalog order and Unread / In progress / Finished volume states, with
  the next-volume indication kept separate from reading state.
- Mobile metadata/actions flowing around the cover, full-width tags and compact
  themed pins (v2.19.1–v2.19.4), plus proportional reading-banner artwork (v2.27.1).
- Reliable, wrapping saved page/chapter/percentage context, including page-only
  and timestamp-free saves ([v2.28.1](SAVED_PROGRESS_2.28.1.md)).
- Expandable six-line synopsis previews and Browse volumes / Find Volume links
  that move keyboard focus without reordering the catalog.
- Readable narrow-screen volume entries, full titles and distinct state badges.
  Card contents keep their intrinsic height during deferred WebKit relayout.
- Reading actions before separate underlined downloads, with 44px targets and
  volume-specific download names. Missing EPUBs have no dead links; empty series
  state that no volumes have been added. Signed-ticket authorization is retained.

The [reviewed PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40445919539)
passes **535 Node tests** and **1,111 browser cases**, with nine existing platform
skips, zero failures and zero retries, in **10m 42s**. All 30 added browser cases
and the Library startup comparison pass. Focused desktop/mobile Chromium and
WebKit each pass 34 cases. Controlled regressions reproduce the unavailable-EPUB
and WebKit context-sizing faults before their corrections.

Acceptance covers Main/Adult, unread/saved/Finished/out-of-order/missing states,
matching Library/Series destinations, unchanged Read again confirmation and
bookmarks, responsive long context, keyboard synopsis expansion and volume
jumps, real cross-tab refresh and downloads through ticket authorization.
Desktop/mobile captures, 670 documentation links and the 73-entry pre-release
archive checksum manifest were checked. The maintained [reading journey guide](../../guides/READING_JOURNEY.md)
records the final behavior; earlier layout evidence remains in the [dated history](UI_UX_PROGRESS_2.27.1.md).

Deployment `821dd2a8-7cb5-4aa9-b32d-63ecabc8c20c` serves the exact merged source
as **v2.28.2**. The [sanitized report](../evidence/reading-journey-release-2.28.2.json)
passes six production checks: version/source, both catalogs and all three changed
assets. Its fresh pre/post-release comparison preserves catalog revision 18, all
17 snapshots and configuration, with zero database writes. Reader speech guards
also pass. An independent public version GET confirms source/version/main.
