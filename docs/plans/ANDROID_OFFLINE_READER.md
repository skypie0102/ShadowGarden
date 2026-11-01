# Android experimental offline reader

Saved Main-library EPUBs can be opened in an early local reader. It uses the
website's pinned EPUB.js and JSZip files packaged in the app, with previous/next
buttons and a table-of-contents selector. It saves position after user navigation
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

The non-exported reader activity opens only an app-private saved book by catalog
ID. It fingerprints and retains an open file descriptor, so replacing or removing
the stored file does not switch the edition being read. The WebView receives only
a local HTML shell, the two bundled scripts and that open EPUB through an
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
incorrectly. It does not implement continuous mode, search, typography, image
zoom, external links, proven reliable position restoration or read aloud. The existing
[reader evaluation](ANDROID_READER_EVALUATION.md) documents unresolved location
and reflow cases; this early EPUB.js integration does not close that comparison.
Real-world books, network-enabled isolation, lifecycle behavior, accessibility
and physical-device acceptance remain open.

## Verification

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
