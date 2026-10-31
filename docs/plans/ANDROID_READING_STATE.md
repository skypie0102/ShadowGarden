# Android reading-position foundation

This is an Android app component under development, not a user-facing reader or
complete personal-data backup. The [Android roadmap](ANDROID_ROADMAP.md) remains
the current development plan. The early position-only backup screen uses the
store; progress will not be recorded until a reader is integrated.

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

An early position-only JSON format and manual backup screen are under development.
This is not a complete personal-data backup: the format does not include
bookmarks, finished state, pins or preferences. It has not been tested across
devices. Future format changes must retain a way to read version 1 files or
provide an explicit migration path. Backups are user-selected and independent of
website progress; EPUB files and Keeper credentials are outside their scope.

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
partial write: an export must stage the entire validated backup privately before
sending it to a user-selected destination, and report any copy failure.
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

The early screen uses Android's system document picker. Export first prepares a
bounded backup in memory, then asks the user for a destination; an empty store
does not create a file. A provider error may still leave the selected file
incomplete, and the screen reports that possibility. Restore validates the entire
selected file, displays new, unchanged and conflicting counts with book IDs,
edition fingerprint prefixes and reader formats for conflicts, and requires an extra
confirmation before overwriting. Stale previews require the user to select and
review the file again. Only `content:` document URIs are accepted, and access is
used only for the chosen operation. If the
process dies while the export picker is open, the in-memory backup is lost and
the user must retry; an old picker result cannot write without prepared data.

A full personal-data format, actual cross-device recovery, interrupted transfers
with real document providers, backup retention, uninstall behavior and reader
handling of changed editions remain open. Book titles are not yet available in
the restore preview. The reader must later record positions and validate restored
locators before users can resume a book.

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

The position-restore foundation was exercised in the
[API 28 emulator run 41221272423](https://github.com/skypie0102/ShadowGarden/actions/runs/41221272423)
at source `6a5bb58`. The six new instrumentation cases cover conflict choices,
unchanged and separate edition/reader slots, changes after preview, an injected
SQLite failure and rollback, a backup transferred between two independent test
databases, and duplicate or foreign previews. The app suite and both staged
process-recovery invocations passed; the regular suite skipped the manual-only
stage and the known Readium reflow test. The retained report could not be
downloaded in this environment; the run log reports six more app tests started
than the previous successful run and no failures. Separate databases on one
emulator do not establish real cross-device recovery or file-picker behavior.

The early backup screen was exercised in the
[API 28 emulator run 41224001650](https://github.com/skypie0102/ShadowGarden/actions/runs/41224001650)
at source `5aabd76`. The seven screen tests simulate system-picker results with
a private debug-only document provider. They cover export, restore preview and
overwrite confirmation, invalid input, a failing output, empty and interrupted
exports, a stale preview, picker cancellation and rejection of a non-document URI.
A separate test checks that a closed store cannot reopen; the launch test checks
the controls after activity recreation. The app suite and staged process-recovery
invocations passed, with the manual-only stage and known Readium reflow test
skipped in the ordinary suite. The run log reports eight additional app tests and
no failures; the retained detailed report could not be downloaded from this
environment. A local release build excluded the debug provider and did not add
Internet permission. These results do not verify a real file-manager UI, cloud
provider, low-storage interruption, physical device or cross-device restore.
