# Android experimental offline reader

Saved Main-library EPUBs can be opened in an early local reader. It uses the
website's pinned EPUB.js and JSZip files packaged in the app, with previous/next
buttons, a table-of-contents selector and experimental offline book-text search.
It saves position after user navigation
and resumes an exact matching book, EPUB edition and reader format. The existing
position-only backup screen can export and restore these app-local positions.
Website browser progress stays separate. Bookmarks and preferences are not yet
saved. Complete website parity remains in the
[Android roadmap](ANDROID_ROADMAP.md).

Writes are serialized and use revision checks. If another session changes the
position, the reader preserves the newer record and asks the user to reopen.
Old editions and other reader formats are retained; an incompatible or invalid
position is not silently applied. A position that EPUB.js cannot restore offers
an explicit start-over action. Save errors are shown, and leaving with unsaved
navigation requires a choice. Saving on backgrounding is best effort: an abrupt
process stop immediately after navigation can precede the next write. Backups
contain positions, not EPUB files, and matching EPUB bytes are needed to resume.

Find opens a search overlay without resizing the reader. Searches are local to
the open EPUB and are not saved by the app. A result opens its location and uses
the normal local position-saving path; opening or dismissing search alone does
not save a new position. Android Back closes search first. The initial search
matches case-insensitive text within individual text nodes, so phrases split by
formatting can be missed. It requires 3–128 characters and reports incomplete
results when it encounters a limit or an unsearchable section. Search inspects at
most 1,000 spine sections, 4 MiB of declared uncompressed data per section,
32 MiB total, 100,000 text nodes and 256 Ki characters per text node, and shows
at most 100 matches. It uses an independent EPUB instance so searching cannot
unload the currently displayed reader section. These bounds use declared archive
sizes and do not constitute complete protection against malformed EPUBs.

The non-exported reader activity opens only an app-private saved book by catalog
ID. It fingerprints and retains an open file descriptor, so replacing or removing
the stored file does not switch the edition being read. The WebView receives only
a local HTML shell, bundled scripts and that open EPUB through an
intercepted synthetic HTTPS origin. Other intercepted requests return 403;
top-level navigation, file access, content access, mixed content, popups and
JavaScript interfaces are disabled. The shell's content-security policy restricts
network connections, and EPUB.js is configured with scripted content and popups
disabled. TOC labels are inserted as text and external-style TOC targets are not
offered. These measures are not a complete security audit or proof that every
WebView version blocks every possible network or EPUB attack.

The current reader loads the archive into WebView memory and performs only the
bounded ZIP structure checks used by the download flow. Large, malformed,
encrypted or unusual EPUBs may fail, use excessive resources or render
incorrectly. Search may require additional memory. It does not implement continuous mode, typography, image
zoom, external links, proven reliable position restoration or read aloud. The existing
[reader evaluation](ANDROID_READER_EVALUATION.md) documents unresolved location
and reflow cases; this early EPUB.js integration does not close that comparison.
Real-world books, network-enabled isolation, lifecycle behavior, accessibility
and physical-device acceptance remain open.

## Verification

The [offline API 28 emulator run 41387542517](https://github.com/skypie0102/ShadowGarden/actions/runs/41387542517)
at source `b6b0f4e` searched a generated 12-chapter EPUB without Internet
permission. A case-insensitive result opened a visibly checked paragraph and
saved its location; activity recreation reopened the same chapter. The test also
checked the minimum query length, search without a position write, excluded
script text, the result cap, rapid replacement of a query, session-only
search input and Android Back closing the overlay. Its fixture's scripted EPUB
content was not observed executing. The ordinary suite skipped the live-catalog
test, staged process probe and known strict Readium reflow case; both explicit
process stages passed separately. This does not establish exact placement after
reflow, search coverage across formatted text nodes, real-book compatibility,
security against all malformed EPUBs or physical-device behavior.

The [API 28 offline emulator run 41337006453](https://github.com/skypie0102/ShadowGarden/actions/runs/41337006453)
at source `945ca15` passed an instrumentation test that opens a generated
12-chapter illustrated EPUB from private storage, checks chapter text, navigates
with the contents selector and next-page button, verifies the illustration
decodes, and reopens the activity at the beginning after recreation. The fixture
contains a script that was not observed running; the test also calls the WebView
navigation and resource-blocking policy for an external URL. The app under test
had no Internet permission. The ordinary suite skipped the live-only test, manual
process stage and known strict Readium reflow case; both separate prototype
process stages passed. The detailed report could not be downloaded in this
environment, but the run log records the suite and stages passing. The unsigned
release APK was also checked for the reader shell and both pinned vendor scripts.

That earlier run used one synthetic EPUB on one emulator and did not establish
saved progress or force-stop restoration. Exact visible passage placement, real
network isolation with Internet enabled, real-book compatibility, a comprehensive
EPUB security review and physical-device acceptance remain open.

The [API 28 offline emulator run 41338936949](https://github.com/skypie0102/ShadowGarden/actions/runs/41338936949)
at source `ef40f57` exercised the experimental reader with the generated EPUB.
It saved a location reached through contents and next-page navigation, included
it in a position backup, and resumed its chapter after activity recreation. It
also checked that a competing position update is preserved and reported, and
that a replacement EPUB starts separately while the old edition's position is
retained. A separate two-stage test saved an app-reader position, force-stopped
the app, and resumed the saved chapter in a new process without Internet
permission. This checks chapter-level recovery for one generated book; it does
not prove the exact visible passage after reflow, a real-book backup restore, or
physical-device behavior. The ordinary suite skipped its manual process stage,
the live-catalog test and the known strict Readium reflow case; both explicit
process stages passed separately.
