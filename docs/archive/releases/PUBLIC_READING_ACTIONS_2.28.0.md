# Public reading actions — v2.28.0

[PR #80](https://github.com/skypie0102/ShadowGarden/pull/80) merged as
`eb5545c4833a298afc1283e00ccb0fe13470d0f4` on 2026-10-26. The merged tree matches
the reviewed PR tree. The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40418528698)
passes its browser/verification gate and guarded production publication.

Library banner, Recently Added, Series hero and volume links share Start reading,
Continue reading, Read next volume and Read again. Series and Library now agree
after out-of-order Finished marks. Volume cards expose order and explicit states;
narrow cards place the state badge below long titles and reading actions retain
44px targets. The documentation reorganization separates active plans, guides,
operations and completed records, preserving the 70 original evidence JSON files.

The [reviewed PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40413863695)
passes 527 Node tests and 1,061 browser cases across five profiles, with 9 existing
platform skips and zero retries. All 20 new browser cases pass; Main/Adult
desktop/mobile captures and 663 local documentation links/anchors are checked.

Production deployment `d49d291b-c39b-466c-9af8-5e53aacd578d` serves v2.28.0 from
the exact merged source. Eight production checks verify the public version,
both catalogs and five changed assets. The fresh pre/post-release comparison
preserves catalog revision 18, all 17 snapshots and production configuration,
with zero database writes. Reader speech request/voice guards also pass.
A separate public version GET confirms v2.28.0, the full source and `main`.

The [sanitized production report](../evidence/reading-journey-release-2.28.0.json)
retains deployment identity, checked hashes, preservation and the rollback
deployment/source. Current work continues in the [UI/UX plan](../../plans/UI_UX_ROADMAP.md).
