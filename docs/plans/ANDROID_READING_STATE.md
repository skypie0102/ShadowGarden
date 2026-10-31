# Android reading-position foundation

This is an internal app component under development, not a user-facing reader,
progress screen, or backup feature. The [Android roadmap](ANDROID_ROADMAP.md)
remains the current development plan. The placeholder app does not yet call this
store; progress will not be saved for users until a reader is integrated.

## Identity and safe resume

The store keys a reading position by the website catalog's opaque book ID, an
edition fingerprint, and an explicitly identified reader-location format. The
fingerprint is the SHA-256 and byte count of the exact EPUB bytes, calculated from
a bounded stream without loading the whole file. It identifies bytes; it does
not validate an EPUB, authenticate its publisher, or prevent the file changing
after hashing. A future downloader/reader must fingerprint the finalized private
file and guard against changes between verification and use.

An exact match returns the saved location. If the current edition cannot be
fingerprinted, differs from the saved edition, or only another reader's format is
available, lookup reports that condition without returning an incompatible
location. Old edition and reader-format records are retained when another slot is
saved. Byte-for-byte changes, including harmless EPUB repackaging, are treated as
a different edition; a future UI must explain and resolve that conservatively.
Reader locators remain opaque and are not interchangeable or validated by this
store. It accepts the two currently evaluated format identifiers, not a decision
that either reader has been selected.

## Local storage and writes

The internal SQLite database resides in the Android app's private data directory;
it has no website/browser storage or network integration. Existing Android
configuration disables system backup and device transfer. Each slot contains one
bounded locator, its edition identity, an advisory timestamp and a revision.
Compare-and-save requires the last observed revision; stale writes return a
conflict instead of overwriting a newer position. SQLite transactions commit each
slot atomically. Call these synchronous operations off the UI thread.

Invalid data and database errors are surfaced to the caller. Unsupported schema
upgrades fail rather than deleting stored positions; the SQLite corruption handler
preserves the damaged file instead of using Android's default deletion behavior.
This does not provide repair or guarantee recovery from every storage failure.
The future reader must surface failures, preserve the last good location, and
handle concurrent updates, removed books, editions and reader migrations explicitly.

There is no backup or restore format yet. Future manual exports must be versioned,
validated, user-selected and independent of website progress, and must not include
EPUB files or Keeper credentials. Bookmark, finished-state, pin and preference
storage also remain separate work.

## Verification

JVM tests cover stream hashing, size and I/O failures, same-size changed EPUBs and
input validation. Android instrumentation covers private SQLite persistence,
edition/reader mismatch handling, stale and concurrent writes, and corruption
preservation. The [API 28 emulator run 41189346274](https://github.com/skypie0102/ShadowGarden/actions/runs/41189346274)
at source `7cac2bd` passed all seven storage instrumentation tests and both stages
of the generated-book process-recovery experiment. The latter reopened the test
database in a new process after a force-stop and checked both reader-format
records and mismatch decisions. The ordinary suite skipped its manual-only stage
and the previously documented Readium current-location reflow test.

These tests do not establish real-book compatibility, automatic page capture,
reader integration, backup, disk-full handling, physical-device behavior or
production acceptance.
