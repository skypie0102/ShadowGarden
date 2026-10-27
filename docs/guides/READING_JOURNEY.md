# Public reading actions

The Library reading banner, Recently Added and Series hero/cards use
`public/assets/js/public/volume-actions.js` for their action and destination.
`domain/reading-state.js` owns the browser-local reading state and series snapshot.

| State/context | Action | Effect |
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

Series cards show Volume N of total independently of the title, and explicit
Unread / In progress / Finished labels. “Up next” is an additional recommendation,
not a substitute for reading state. Progress percentages stay between 0 and 100.
Storage keys, identity aliases, saved progress, bookmarks and the Read again
confirmation/reset pipeline retain their existing contracts.

## Synopsis, volume navigation and downloads

The hero's **Browse volumes** link moves keyboard focus to the volume section.
**Find Volume N** then targets the volume selected by the same reading context
as the hero. Cards retain catalog order and expose their titles as their
accessible names; their jump targets do not add stops to normal Tab navigation.

Long synopses start with a six-line preview. **Show full synopsis** and **Show
less** work with the keyboard, expose their expanded state and retain the
current choice during reading-state refreshes. A short synopsis stays fully
visible without a toggle. The preview adapts to the current width, preserves
paragraph breaks and retains the complete escaped text. Expansion belongs to
the current page only and does not write browser storage.

At widths up to 520px, volume entries use a compact cover beside their full
title and metadata. Reading actions appear first; the underlined **Download
EPUB** link follows separately, with both retaining at least 44px targets.
Download links name their volume and retain the existing signed-ticket flow.
An unavailable EPUB has a plain availability message and no reading, cover or
download link. Its metadata and reading state remain visible. An empty series
states that no volumes have been added.

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
