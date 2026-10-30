# Reader controls

The contents drawer separates **Current chapter** from **Volume progress**.
The chapter is the EPUB's current contents label, or “Unlabeled section” if no
label is available. Percentages refer to the whole
volume. Page numbers come from the current device's page map and can change with
screen size or text settings; they are not publisher print-page numbers.
The footer, contents summary, accessible slider value and Continuous rail use
the existing progress controller. Compact phone/rail labels keep their page
fraction; the drawer shows the current chapter and volume progress.

Contents opens chapters and bookmarks; Search finds chapter labels and text in
the book. In Pages, Previous/Next and Left/Right turn pages. The progress slider
seeks within the whole volume. In Continuous, scroll to read; when the rail has
keyboard focus, Up/Down seeks 1%, Page Up/Down 10%, and Home/End the start/end.
Selecting a chapter or its page number closes the contents drawer and opens the
selected location. Screen-reader descriptions remain attached to the progress and
page controls.

When a substantial illustration is visible, a small first-use tip explains
**double-click** for a fine pointer or **double-tap** for touch. It never takes
focus, blocks the illustration's gestures, or edits publication markup. The
dismiss button remains keyboard accessible. The tip is suppressed while loading,
a drawer/dialog is open, or the tab is hidden. Buffered offscreen images do not
consume it. Closing the blocking UI or returning to the image can reveal it.

The tip disappears after eight uninterrupted visible seconds, explicit dismissal
or successful image-focus opening. `sg-reader-image-focus-tip-seen = 1` records
that it has been learned for this browser, shared across books, modes and
Main/Adult; a cross-tab update dismisses another open tip. Rejected storage writes
still hide it for the current Reader session. Reading progress, bookmarks,
Finished records, settings and separate Read aloud choices are not cleared.
Reset reader settings does not reset this tip preference.

The focused viewer keeps its existing zoom, pan and position-preserving return.
Its own gesture hint remains available on each opening. Tip observers, listeners
and timers are released with the Reader or its content documents.

See [Reader settings](READER_SETTINGS.md) for grouping and Reset, and
[Reader architecture](READER_ARCHITECTURE.md) for navigation/restoration ownership.
Historical v2.29.0 release evidence is recorded separately. Automated browser
coverage does not substitute for physical-device acceptance.
