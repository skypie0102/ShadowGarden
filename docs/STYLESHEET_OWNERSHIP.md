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

These controls do not establish exhaustive viewport/animation-frame equivalence
or physical-device/provider acceptance. No real CAPTCHA, upload or live catalog
mutation is performed. Full CI, artifact review and production verification are
pending for this release.
