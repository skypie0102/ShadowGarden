# Keeper CSS readability and ownership — v2.18.12

This batch expands four stylesheets while retaining the current appearance,
responsive rules and stylesheet order. It removes one superseded checkbox rule
with two declarations. It does not redesign Keeper or change application logic.

## Ownership and retained overlap

| Stylesheet | Owner / retained responsibility |
| --- | --- |
| `admin.css` | Base Keeper page, authentication card, shared controls, cards, grids and dialog defaults |
| `admin-layout.css` | Dashboard tool layout, Keeper dialog dimensions, contextual Add Books target and responsive workspace layout |
| `admin-components.css` | Upload queue controls, collapsed preflight, upload/completion states, series chooser, snapshot-list layout and translation components |
| `admin-presentation.css` | Banner preview, Series Editor action bar, genre picker and aggregate Upload review presentation |
| `admin-series-editor.css` (unchanged) | Modal/scroller structure, accessible hidden checkbox input, target-scope presentation and toasts |
| `admin-motion.css` (unchanged) | State feedback, transitions and reduced-motion rules |

The base sheet supplies defaults; later layout/component rules specialize them.
The existing `!important` declarations, responsive overrides and dialog selectors
have specific consumers and remain. Stylesheet order, media-query order,
selector order and declaration order are preserved by the formatting stage.
No stylesheet is renamed, merged or moved between contexts.

`public/admin.html` is the only current first-party consumer of `admin.css`.
It always loads `admin-series-editor.css` later. Both contain the exact selector
`.adult-toggle > input`. The old base rule specifies `position: absolute` and
`opacity: 0`; the later sheet supplies the same values with `!important` alongside
the input's accessible one-pixel geometry. Removing those two earlier declarations
therefore preserves both value support/fallback behavior and the winning cascade.
The now-empty old rule is removed. Other overlaps remain.

## Formatting evidence

Pinned external Prettier 3.6.2 expands the four files. Their formatting-stage
parsed CSS trees and ordered comments match after excluding source locations,
whitespace metadata and duplicate raw aggregate fields; numeric tokens use
canonical numeric text. Selector/value tokens, priorities, rule order and parsed
media-query order remain. The final rule deletion is separately checked against
the formatted tree. Lines over 180 columns decrease from 21 to zero.

[Source evidence](keeper-css-equivalence.json) records hashes for the original,
formatted and final files, shape measurements, stylesheet order and the unchanged
winning checkbox sheet. This is a readability change; source bytes increase and
no performance improvement is claimed. The asset audit explicitly records the
two newly changed recovered CSS files without altering their original provenance.

## Visual and interaction validation

Four browser cases exercise the real Keeper interface with disposable APIs and
generated technical EPUBs. They compare dashboard/locked states, an expanded
Series/translation editor with a retained draft, Upload/main/adult controls and
targeted Adult Upload. The latter also compares widths 349, 600 and 761 pixels
in addition to each profile's normal viewport.

Each comparison keeps the same DOM and stylesheet positions: served candidate,
dated v2.18.11 CSS, then restored candidate. It compares rendered-element
geometry, selected computed properties (including pseudo-elements) and exact
decoded RGBA screenshot hashes. The served/restored pair is a control for the
comparison mechanism. Images use the browser's PNG decoder and Canvas API;
no new image-comparison dependency is added. The dated CSS fixture is test-only
and is not included in the production build.

Settled screenshots disable animation/transition/caret painting consistently in
all three frames. The syntax comparison preserves motion declarations, and the
normal integration suite retains its motion/interaction coverage. This is not
an animation-frame equivalence proof, an exhaustive CSS conformance test or a
claim about every viewport. Baseline/candidate PNGs and comparison JSON are
attached to each browser report for review. Inputs retain their real read-only,
scope, checked and editable behavior. No upload action or live catalog/provider
write is performed by these cases.

The initial Firefox control detected a hover-state change between the served and
reinserted candidate: scrolling placed a translation-row remove button under the
last click position, and style recalculation activated its hover colors. The
fixture now parks the pointer at a neutral location before every capture and
records focus/hover state. Application CSS is unchanged by this fixture correction.
The initial run and trace artifact are retained in the release evidence.

Local `npm run check` passes all 463 Node tests, asset/provenance audit, static
build and binding/compatibility-aware Functions build. Full PR/main CI and
production verification are pending. The release still requires source/version,
both catalogs, all changed CSS bytes and preservation of the existing catalog,
snapshots and recorded settings to pass verification.

## Remaining work

The remaining dense Keeper preflight, batch, maintenance, report and related
stylesheets can be reviewed in later scoped batches. Preserve their current
cascade until a concrete redundancy or behavior defect is established. The
[current audit status](CODEBASE_AUDIT_2026-10.md#current-work-and-retained-decisions)
separates these maintainability tasks from completed fixes and retained contracts.
