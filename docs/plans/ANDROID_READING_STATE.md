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

## Experimental position interchange

An internal position-only JSON format is under development. It is not yet a
personal-data backup feature: the app does not expose an export or restore
screen, and the format does not include bookmarks, finished state, pins or
preferences. It has not been tested across devices and is not a commitment to a
final public format. Future manual backups must be user-selected and independent
of website progress; EPUB files and Keeper credentials are outside their scope.

The initial envelope has `kind` equal to `shadowgarden-android-positions`,
integer `version` 1 and a `positions` array. Each entry contains `bookId`,
`editionSha256`, `editionBytes`, `locatorFormat`, `locator` and
`recordedAtMillis`. It contains no database revision, EPUB bytes, browser data
or explicit credential fields. Locators are opaque: future reader integrations
must avoid placing credentials or other secrets in them. A timestamp is advisory,
not a conflict-resolution rule. Edition fingerprints match exact bytes, not a
guarantee that different downloads represent the same work.

The codec reads at most 4 MiB and 5,000 positions, checks UTF-8, field types,
required fields, duplicate fields and duplicate identity slots, and rejects
unknown versions, fields and reader formats. It validates every record before
returning any; decoding does not modify the database. A store snapshot contains
all known positions in one transaction and fails on malformed or unknown records
rather than silently omitting them. It also bounds the total locator bytes held
while gathering the snapshot; final JSON overhead can still exceed the file limit.
Encoding enforces the file limit and can fail after a
partial write: a future export must stage the entire validated file privately
before sending it to a user-selected destination, and report any copy failure.
Neither stream is closed by the codec. Run these synchronous operations off the
UI thread.

## Experimental position restore

The store can preview already validated position records without writing. Each
exact book/edition/reader slot is classified as new, unchanged or conflicting;
the preview is bound to the store instance that created it. It checks duplicate
slots and bounds the number and total size of both incoming and existing
locators. Preview and apply are synchronous and belong on an I/O thread.

Applying a preview requires the caller to choose either **keep existing** or
**overwrite conflicts**. Both insert new slots and leave unchanged slots alone;
the first preserves conflicts and the second updates them with a new local
revision. Neither mode deletes entries absent from the backup or infers a winner
from timestamps. A single SQLite transaction compares every slot to the state
seen during preview before applying any changes. If a slot changed, it returns a
stale-preview result and writes nothing; database errors also roll back the
entire transaction. Changed editions, other reader formats and unavailable books
remain as separate slots. A locator's syntax and meaning remain the owning
reader's responsibility.

This is not yet a user-facing restore. The future UI must show the preview,
obtain confirmation before overwrite, handle stale previews and errors, and
explain edition mismatches. File-picker operations, a full personal-data format,
interrupted transfers, backup retention, uninstall behavior and actual
cross-device recovery remain open. No user-facing screen calls this component.

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

The experimental position codec and snapshot were exercised in the
[API 28 emulator run 41217839215](https://github.com/skypie0102/ShadowGarden/actions/runs/41217839215)
at source `54ffbfe`. The six new Android cases cover round trips, malformed and
ambiguous files, size and record limits, stream failures, complete snapshots and
rejection without deleting stored positions. The app instrumentation suite and
both process-recovery stages passed; the ordinary suite skipped the manual-only
stage and the previously documented Readium reflow test. This does not test a
file picker, restore, interruption during export, cross-device use or a complete
personal-data backup. The retained report could not be downloaded from this
environment; the run log reports six more app tests started than the preceding
successful run and no failures.
