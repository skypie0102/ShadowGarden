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

Current source changes are tracked in the [UI/UX plan](../plans/UI_UX_ROADMAP.md).
Source tests, merge and live acceptance are recorded separately.
