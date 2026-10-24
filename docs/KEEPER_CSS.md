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
build and binding/compatibility-aware Functions build. The tested candidate is
`708b90c7c94cf050aa752297ad1aaab957c88677`, tree `14e1ee24854a0d9bd86415c785eaf7aa4f3b7e44`.
Squash merge `e5317866f0c0384961ca818c71fdbbe4d03a3ca6` has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40057285978) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40058525055)
both pass **463 Node tests** and **746 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All four new CSS
cases pass in every profile. The separate Chromium Library-startup profile passes
on the PR and is excluded from the 746 cases.

All **45 same-DOM comparisons** in the PR artifacts match decoded RGBA pixels,
computed-style/geometry hashes and the served/restored candidate control.
Representative desktop/mobile captures were also visually reviewed. Settled-frame
comparisons cover the profile defaults and widths 349/600/761; they do not claim
animation-frame or exhaustive viewport equivalence.

The automatic workflow publishes **v2.18.12**, source `e531786`, deployment
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.11 rollback. The version check uses one request
over 205 ms. Canonical source/version, both D1-derived
catalogs and all four changed CSS files pass verification. Independent public
HTTP checks match the same version/source and exact CSS bytes. The exact
revision-9 catalog document, all nine snapshots and recorded settings remain
unchanged, with zero database writes. The retained rollback is
`c1fa8f80-6803-4d80-9d1f-834570a5b1b7`. See
[verification evidence](keeper-css-verification.json).

## Follow-up status

The subsequent [v2.18.13 stylesheet batch](STYLESHEET_OWNERSHIP.md) completes
the remaining dense Keeper/shared/public review, expanding 21 sheets while
retaining their ordered parsed CSS, comments and cascade. The separate
[Upload target investigation](KEEPER_TARGET_CONTEXT.md) is also reproduced,
corrected and released. The validation above retains this first batch's dated
v2.18.12 scope. See the
[current audit status](CODEBASE_AUDIT_2026-10.md#current-work-and-retained-decisions)
for completed work and retained contracts.
