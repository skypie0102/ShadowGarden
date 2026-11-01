# Android experimental offline reader

Saved Main-library EPUBs can be opened in an early local reader. It uses the
website's pinned EPUB.js and JSZip files packaged in the app, with previous/next
buttons and a table-of-contents selector. The reader starts at the beginning
each time: it does not yet capture or restore reading positions, bookmarks or
preferences. The position-only backup screen therefore still cannot export new
reading progress from this reader. Complete website parity remains in the
[Android roadmap](ANDROID_ROADMAP.md).

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
zoom, external links, reliable position restoration or read aloud. The existing
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

This is one synthetic EPUB on one emulator. It does not establish exact visible
passage placement, saved progress, real network isolation with Internet enabled,
force-stop restoration of this reader, real-book compatibility, a comprehensive
EPUB security review or physical-device acceptance.
