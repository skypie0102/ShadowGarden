# Phase 4 visual consistency — v2.29.1

[PR #90](https://github.com/skypie0102/ShadowGarden/pull/90) merged as
`483964d945dd7ce9e80441e64f42a9790f7d3a28`. Production verification completed on 2026-10-27. The merged tree
matches reviewed head `a8c871c32d80bddd63065cce668d0bb7c81a4ac5`.

The new versioned visual-accessibility stylesheet improves dim metadata,
search placeholders and filter boundaries in the midnight and rose palettes.
It repairs suppressed keyboard outlines, including Adult selects and Keeper's
Trash action. Reader focus keeps its existing theme accent, including Paper.
Selected controls remain distinguishable in contrast themes; existing reduced
motion is retained. The [maintained guide](../../guides/VISUAL_ACCESSIBILITY.md)
records the ownership and validation contract.

Every pre-existing CSS owner and application JavaScript file remains byte-for-byte
unchanged. HTML only adds the stylesheet link. The approved larger cover beside
details/actions, full-width tags, Grid/List controls, compact Read/Download buttons
and solid pinned icon retain their layout. Controlled comparisons disable only
the new sheet on the same DOM, require exact geometry/type equality, restore it
and repeat. Series reading/download and hero controls also retain their normal
colors, borders and type.

The [reviewed-head CI run](https://github.com/skypie0102/ShadowGarden/actions/runs/40602099989) passes **545 Node tests**,
**1,241 browser cases**, 9 platform skips
and zero retries across five profiles and 15 shards. **50 new visual cases**
pass. Local desktop/mobile WebKit passes all eight final Library/Reader comparisons;
Series, contrast selection and Keeper actions/feedback also pass focused checks.
The affected historical CSS suite passes all ten desktop/mobile Chromium cases.
Screenshots cover phone/tablet/desktop, long content, 125% text, collapsed filters,
empty/loading/failure feedback, both Series views, all four Reader themes and
Keeper clean/dirty/saving/success states using disposable fixtures.

Measured minimum Library contrast is **7.45:1** for placeholders, **3.67:1** for
control boundaries and **5.61:1** for representative metadata/status against a
conservative dark panel. The earlier placeholders measured 4.24:1 Main / 3.51:1
Adult. Historical screenshot comparisons retain exact geometry/component styles
and add exact native-control longhand checks; only native-corner raster rounding
of up to two RGB steps on 0.1% of pixels is allowed. The controlled Chromium
witness differs on 33 of 921,600 pixels.

The [main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40603670369) passes its full gate and
guarded deployment. Deployment `696d2c34-b215-44ce-b2c3-d98a94d994aa` serves v2.29.1
from the exact merged source. 4 production checks pass;
the fresh pre/post-release comparison preserves catalog revision 18,
all 17 snapshots and configuration with **zero database writes**.
Speech checks also pass. An independent public check verifies the new sheet on
all five pages and matches it plus 11 retained assets byte-for-byte with source.

The [sanitized evidence](../evidence/visual-accessibility-release-2.29.1.json)
retains source/deployment/rollback identities, test totals, served hashes and
preservation. Physical-device acceptance and the existing Continuous width-change
issue remain in [follow-ups](../../plans/FOLLOW_UPS.md). Active UI work proceeds
with [Keeper feedback](../../plans/UI_UX_ROADMAP.md#phase-5--keeper-feedback).
