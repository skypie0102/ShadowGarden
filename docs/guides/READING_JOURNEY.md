# Public reading actions

The Library reading banner, Recently Added and Series hero/cards use
`public/assets/js/public/volume-actions.js` for their action and destination.
`domain/reading-state.js` owns the browser-local reading state and series snapshot.

| State/context | Library / Series hero action | Effect |
| --- | --- | --- |
| Unread, no preceding completed-volume continuation | Start reading | Open the selected volume normally |
| In progress | Continue reading | Open the saved reading position |
| Unread next volume after the last Finished mark, with no active volume | Read next volume | Open the next catalog-ordered volume |
| Finished | Read again | Confirm before clearing its progress/Finished aliases and reopening at the beginning; retain bookmarks |

The Series hero prefers the most recently active available volume, then the
same next-volume choice as the Library, then another unread available volume,
and finally a finished available volume. Missing EPUBs are not hero destinations.
An out-of-order Finished mark does not make the hero disagree with the Library's
next-volume suggestion. Renderers share one series snapshot while drawing cards.

Series cards show Volume N of total independently of the title, with one badge
over the top-right of each volume cover, including cover placeholders. Grid
shows only Unread / In progress / Finished text, with no checkmark or other
icon. List hides the text label completely and uses a 22px icon badge:
a closed book for Unread, an open book for In progress, a green check for Finished
and a turning arrow for the unread Up next volume. Accessible descriptions and
cover tooltips retain the full state. The metadata
line keeps the date, file size and saved progress details; it does not repeat
Unread or Finished. “Up next” is an additional recommendation,
not a substitute for reading state. Progress percentages stay between 0 and 100.
Storage keys, identity aliases, saved progress, bookmarks and the Read again
confirmation/reset pipeline retain their existing contracts.

The Library’s compact view uses the same green check and filled pin icons on
series covers for Finished and Pinned series. Its volume-count and Adult chips
retain their existing text; Grid uses a Finished text badge without a checkmark.

## Series presentation

PR #82 is reverted. The original full synopsis is displayed directly; Browse
volumes, Find Volume and the expandable synopsis are removed.

On phones, a larger proportional cover stays beside the title and details.
Reading/pinning controls sit directly below the details in the column beside
the cover, wrapping within that column on narrow screens. Tags span the row
below the cover and details/actions.
The pin icon is solid when pinned and outlined when unpinned in both themes.
Grid is the default volume layout. The explicit **Grid / List** buttons switch
the same catalog-ordered volumes in place. List puts a small cover beside the
volume details; it does not replace Grid automatically on phones.

The Series choice is saved separately for Main and Adult under
`sg-view:series:main` / `sg-view:series:nsfw`. It does not change the Library view,
progress, bookmarks or Finished state. Reload, reading-state refresh and
cross-tab view changes retain the selected mode.

Volume links keep the restored compact **Read / Continue / Read Again** and
bordered **Download EPUB** presentation from before PR #80. Series styles and
rendering modules use fresh asset URLs so the requested view reaches returning
browsers. Release records separate source validation, merge and production acceptance.

## Saved-progress context

`public/reading-progress.js` formats the same saved-record summary for the Library
banner, Recently Added, Series hero and volume metadata. A finite stored
percentage is rounded and bounded to 0–100. Missing, null, blank, boolean and
non-finite percentages stay unknown; page counts are not converted into a
percentage. Unknown progress has no percentage rail or synthetic `0%` badge.

Positive saved page numbers appear as **Saved page N**, with **of total** only
when the stored total is valid and at least N. These describe the last saved
layout, rather than a new measurement for the current device. Available chapter
text follows the numeric context. Missing numeric data can retain its chapter
or the plain **Saved reading position** fallback. Chapter text is escaped as
text by each renderer and wraps without a progress-context line clamp.

Legacy records without an update timestamp still qualify for Continue reading;
explicit timestamps retain their existing ordering priority. Recently Added
links expose the complete summary as their accessible description. Existing
cross-tab storage events refresh Library and Series summaries. Viewing or
formatting progress never rewrites saved progress, Finished state or bookmarks.

Current source changes are tracked in the [UI/UX plan](../plans/UI_UX_ROADMAP.md).
Source tests, merge and live acceptance are recorded separately.
