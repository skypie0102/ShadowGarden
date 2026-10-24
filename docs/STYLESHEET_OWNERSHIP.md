# Remaining Keeper and shared/public styles — v2.18.13

This batch expands all 21 remaining non-reader stylesheets with lines longer
than 180 columns. The inventory covers 28 non-reader sheets; seven already fit
that readability boundary, including the four sheets expanded in v2.18.12.
Long lines in this batch decrease from 147 to one: an intact embedded SVG data
URL in `ui-symbols.css`. No rule or declaration is removed, merged or reordered.

## Ownership

| Stylesheets | Existing responsibility |
| --- | --- |
| `admin-batch`, `admin-preflight`, `admin-import-report` | Queue rows, local inspection and aggregate Upload report |
| `admin-maintenance` | Maintenance, readiness, operation queue and history panels |
| `admin-series-editor`, `admin-security`, `admin-motion` | Editor/scroller/checkbox geometry, authentication safety and Keeper feedback/motion |
| `site`, `site-theme`, `nav`, `ui-symbols` | Shared defaults, midnight theme, navigation and control symbols |
| `library-layout`, `library-features`, `library-motion` | Library layout, search/filter/list controls and state transitions |
| `public-artwork`, `public-components` | Shared covers, public content and component presentation |
| `series-extra`, `series-motion` | Series metadata, volume cards and Series transitions |
| `reading-status`, `volume-actions` | Public reading-state controls and per-volume actions |
| `garden-pass` | Human-verification dialog and Main/Adult palettes |

Names in the table refer to `.css` files in `public/assets/css`. Their existing
consumers, stylesheet order, responsive rules, priorities, overlapping selectors
and motion declarations remain. Shared sheets are also used by the reader; its
dedicated stylesheets and JavaScript are outside this batch.

## Source preservation

Pinned external Prettier 3.6.2 expands the files without adding a project
dependency. Original `font` shorthand value text is retained after formatting:
the parser otherwise represents compact `rem/line-height` text differently from
the spaced form, despite equivalent CSS. Retaining the original spelling lets
the strict parsed-tree comparison remain unchanged.

Ordered parsed CSS trees and comment text match. The normalizer excludes source
positions, whitespace metadata and duplicate aggregate raw copies, and represents
numeric tokens canonically. Selector/value tokens, declaration priorities,
rules and media-query children retain their order. The evidence records original
and final hashes, canonical AST/comment hashes, formatter settings and every
file's measurements. Source bytes increase; this is a maintainability change.

See [source evidence](stylesheets-equivalence-2.18.13.json). Original provenance
hashes stay intact; the asset audit explicitly records the changed recovered
files. Dated v2.18.12 CSS inputs live only in the browser test fixture and are
excluded from production.

## Browser comparisons

Five added cases cover Keeper dashboard/authentication, maintenance/history,
Upload/preflight/report with Main/Adult controls and a 349-pixel width, an
expanded Series/translation draft, and both Main/Adult public libraries,
navigation, Series and Garden Pass. Public libraries include default, 349 and
761-pixel widths. Each comparison keeps the same DOM and stylesheet positions,
captures served candidate, applies dated CSS and restores candidate. Only
changed sheets loaded by that page are replaced; the active paths are recorded.

The shared fixture compares full rendered-element geometry, selected computed
properties and pseudo-elements, focus/hover identity, scroll state and decoded
RGBA screenshot hashes. Baseline/candidate PNGs and comparison JSON accompany
each case. Settled frames consistently disable animation, transition and caret
painting; ordered source syntax and the normal integration suite retain motion
scope. The existing first CSS batch retains its separate v2.18.11 baseline.

An initial WebKit control after resizing from collapsed mobile filters to a
761-pixel layout reported six select controls as `inline-block` for the served
candidate and `block` after reinserting the same candidate. Baseline and
candidate computed hashes matched, and all three decoded pixel hashes were
identical. Public width states now load a fresh document after selecting each
viewport, while each three-frame comparison retains its same DOM. All computed
style, geometry, pixel and served/restored assertions remain. No application CSS
or JavaScript changed for this fixture correction. This controls page entry at
each width; it is not a resize-transition equivalence claim.

These controls do not establish exhaustive viewport/animation-frame equivalence
or physical-device/provider acceptance. No real CAPTCHA, upload or live catalog
mutation is performed. The tested candidate is `eee9f03e382fe5cd7a3b7f658184f369c101c078`, tree
`b001b1aee4080a0cba250e0d79fb403b3c0e8059`. Squash merge `8d500eb163edad0f8e2d4639e365504e1bddee51` has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40065545158) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40066899682) both pass
**471 Node tests** and **821 browser cases** across five profiles, with nine
documented platform skips and zero test retries. All five new CSS cases, ten
queue-lifecycle cases and six Library readiness cases pass in every profile.
The separate Chromium Library-startup profile passes on the PR and is excluded
from the 821 cases.

All **95 new same-DOM comparisons** match decoded RGBA pixels and computed-style/
geometry hashes, including the served/restored candidate control. All 21 changed
sheets are loaded across each profile's compared states. Six representative
desktop/mobile captures were visually reviewed. Settled frames and the recorded
default/349/761 widths define this scope; no exhaustive viewport, animation-frame
or resize-transition equivalence is claimed.

The workflow publishes **v2.18.13**, source `8d500eb`, deployment
`828bb91c-d3b1-450d-91db-27b199c9b5af`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
Publication completes in one attempt; the version check uses one request over
204 ms. All **27 production checks** pass: canonical source/version,
both D1-derived catalogs and all 24 changed CSS/JavaScript assets. The exact
revision-9 catalog document, all 9 snapshots and recorded settings remain
unchanged, with zero database writes. The retained v2.18.12 rollback is
`f75b7696-25f3-4ce4-8a3a-4b54846e340e`, source `e531786`.
See [verification evidence](keeper-target-stylesheets-verification.json).

The interrupted independent checks were completed after the workspace was
restored. Public HTTP reads confirm v2.18.13/source `8d500eb` and exact bytes for
all 24 changed assets. The downloaded production artifact matches the sanitized
logged report and GitHub's SHA-256 archive digest. The follow-up results and the
original publication/rollback records are retained in the verification evidence.

The public readiness assertion also exposed the existing Library grid's busy
state never being cleared after load. The assertion is retained and the
[loading-state correction](LIBRARY_READINESS.md) has independent dated-controller
controls for populated, empty and failed catalogs. This changes the public
controller's loading semantics without altering the CSS preservation proof.
