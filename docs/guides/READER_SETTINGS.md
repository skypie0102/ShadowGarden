# Reader settings

Reading settings are grouped as Reading mode, Typography, Layout and Appearance.
Changes apply immediately and are saved for every book in this browser. The existing
`sg-reader-settings` and legacy swipe-preference keys retain their formats;
Read aloud has its own settings and drawer.

Pages uses page-turn buttons and Left/Right arrow keys. Continuous scroll uses a
scrolling canvas. Maximum prose width is offered only in Continuous; artwork
continues to use the full reading canvas. Swipe turns are adjustable only in
Pages. Their saved choice is retained while that control is disabled in
Continuous and becomes available again when returning to Pages.

Default typeface and paragraph alignment retain the book's styles. Numeric
controls show their current value and expose percent, text-size multiplier or
pixel units to assistive technology. Groups have native fieldset/legend names,
descriptions are associated with their controls, and settings inputs/Reset retain
44px targets. The drawer remains scrollable on narrow screens and follows
the current Reader theme and Main/Adult palette.

Before Reset, the drawer describes the canonical defaults for the current
device: Continuous on mobile/narrow screens or Pages otherwise, Shadow Garden theme, Default
typeface/alignment, 100% text, 1.6 line height, 760px maximum prose width and swipe
turns enabled. The copy is generated from the same defaults used by Reset and
refreshes on opening and resize without saving settings. Explicit flow choices
remain authoritative until changed or reset.

Reset applies immediately and does not clear the reading position, bookmarks,
Finished records or separate Read aloud choices. Reflow can refresh the saved
page count and layout metadata; the reading location is retained. When Reset
changes mode, the normal flow switch captures the old layout before committing
the new mode's styles. Reader
startup completes saved Continuous CFIs through the normal navigation path after
the rendition is ready; a nominal restored CFI must also show the saved section.
Continuous navigation waits for pending buffer content styles before correcting
the target, including styles introduced by the final buffer update. Newer
navigation still cancels an older correction.
Image focus, page measurement and scrolling keep their existing
contracts in the [architecture guide](READER_ARCHITECTURE.md).

This increment implements the settings grouping and Reset-clarity items in the
[UI/UX roadmap](../plans/UI_UX_ROADMAP.md). Progress/navigation explanations and
first-use image-focus guidance remain separate work. Source validation and
guarded production acceptance are recorded independently.
