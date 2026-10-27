# Visual accessibility without changing layout

Phase 4 preserves the user-approved v2.29.0 layouts. Main keeps its midnight
palette and Adult its rose palette. Series keeps the larger cover beside details
and reading/pin actions, full-width tags, explicit Grid/List and compact volume
Read/Download controls. The pinned head remains filled. No spacing, dimensions,
font metrics, ordering or destinations change in this increment.

`public/assets/css/visual-accessibility.css` is loaded last on Library, Series,
Reader and Keeper. It owns only readability colors, focus outlines and contrast-theme
selection. Existing layout and component styles remain intact. The versioned URL
ensures returning browsers load the new sheet.

## Readability and keyboard focus

Dim metadata uses a more readable violet or rose token. Library search
placeholders have explicit text color and opacity; search/select boundaries use
solid palette colors. The measured v2.29.0 placeholders were 4.24:1 in Main and
3.51:1 in Adult against their control backgrounds. The new browser checks require
at least 4.5:1 for these placeholders and representative metadata, and 3:1 for
the control boundaries. Metadata checks use a conservative dark panel color.

Every keyboard-focused link, button, input, select, textarea and summary has a
two-pixel outline outside its existing box. This repairs controls whose component
styles suppressed focus, including Adult selects, filter/suggestion actions and
Keeper's Trash action. Existing hover and disabled behavior remain. Reader focus
uses the selected interface theme's accent, including the dark Paper accent;
publication styles inside EPUB frames are unaffected.

In forced colors, controls use system border colors. Selected view buttons,
contents tabs, chapter links and filter chips retain an inset system outline and
underline, so selection survives the removal of background colors. Keyboard
focus uses an outer system outline. System colors remain under browser control.
Existing reduced-motion rules are retained.

## Validation contract

`tests/browser/visual-accessibility.spec.mjs` compares the served UI with this
one new sheet disabled on the same DOM. All other CSS and markup are retained
from v2.29.0 (`64c58af3eb0d841c745b7c9866f7b466e3f68212`), apart from the added
stylesheet links and release metadata. Comparisons check visible control/artwork
positions, sizes, spacing, type and layout properties, then restore the sheet
and repeat the capture. Series reading/download and hero actions also keep their
normal colors, borders and type. A changed button layout fails the comparison.

The historical stylesheet comparisons also retain exact geometry/style equality
and compare every computed native-control longhand. Their screenshot check allows
at most two RGB steps on 0.1% of pixels for native-corner raster rounding. The
reproduced Chromium difference was 33 of 921,600 pixels; larger changes still fail.

Fixtures cover Main/Adult, phone/tablet/desktop, larger text, collapsed and open
filters with real Tab/Space navigation, empty/loading/failure feedback, both
Series views, all four Reader interface themes, and Keeper clean/dirty dialog
actions without catalog writes, plus saving/success feedback with intercepted
fixture responses. Existing Series and Reader regression suites
remain required. Screenshot review, PR checks and guarded production verification
are recorded separately from implementation in the roadmap and release record.
