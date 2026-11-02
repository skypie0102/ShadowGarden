# Android private book storage foundation

The app contains an internal storage component and a [ticketed transfer foundation](ANDROID_BOOK_TRANSFER.md)
for the experimental foreground download flow and basic local reader. Volume
details and the downloaded-books shelf allow removing a downloaded EPUB while
keeping its reading positions, even if it no longer appears in the catalog.
Live protected access, full EPUB validation, background work and broader storage management remain open in the
[Android roadmap](ANDROID_ROADMAP.md).

Removal requires confirmation. The app fingerprints the saved file before the
prompt and checks the edition again before deleting; if another in-process
download has replaced it, the newer file is kept and the user is told to review
it again. The operation does not modify the position database or existing backup
files. Re-downloading the exact same edition allows the reader to use its saved
position. Failures are reported, and the UI refreshes the local saved state.
The shelf identifies an unmatched book by ID and warns that it might no longer
be available to download before removal. Bulk removal and
management of files excluded from the shelf as unavailable remain open.

The downloaded-books shelf lists private EPUB files independently of catalog
availability. It shows catalog series and volume titles when known, otherwise a
book ID, and can open either kind in the offline reader. Its displayed size is
the total of the listed files. Enumeration considers regular, non-symlink files
with valid book IDs and sizes within the storage limit; it reports unavailable
recognized files, ignores unrelated and temporary files, and fails visibly if
the directory cannot be read or contains more than 50,000 entries. It does not
validate EPUB contents or delete anything by itself. Listing reflects a snapshot and the
reader still handles files removed or changed before they are opened.

The caller must choose an app-private, no-backup directory and run the blocking
operations off the UI thread. A validated catalog book ID determines each file
name; titles and network paths are not used as filenames. The component allows
up to 50 MiB per file, matching the current website upload limit. It streams into
a same-directory temporary file, calculates SHA-256 and length, syncs the file,
and renames it over the prior copy only after the transfer completes. A caller
may supply an independently trusted expected fingerprint to reject a changed or
truncated transfer; a fingerprint computed from the incoming stream alone is an
edition identity, not proof of integrity or EPUB validity. A cancellation callback
is checked during copying and immediately before replacement; the caller remains
responsible for interrupting a blocked input or network request.

The EPUB-specific write path checks the temporary file before replacement. It
requires the first stored ZIP entry to contain the EPUB mimetype, a container
entry and at least one `.opf` entry; bounds the archive, entry count and declared
uncompressed total; rejects unsafe paths, duplicate names, encrypted or
unsupported entries, inconsistent headers, overlapping entry regions and ZIP64;
and supports stored and deflated entries. Names must be valid UTF-8. It does not
extract the archive, decompress and verify every entry, parse the container or
package XML, verify CRCs or validate EPUB semantics. Its checks are not EPUBCheck,
a malicious-content sandbox, or proof that a reader will open the file. The raw
byte-storage entry point remains available for infrastructure tests; future
download integration uses the checked EPUB path; additional reader checks remain open.

Failed, cancelled, empty, oversized or mismatched writes leave the old book in
place. An interrupted temporary file is removed on the next replacement attempt
for that ID. An opened file is fingerprinted through the same descriptor used for
reading, then rewound; a later rename or removal does not change that open
descriptor. Removing a book does not modify the separate reading-position store.
The component serializes its operations within one app process; multiprocess
access, directory-sync guarantees after sudden power loss and app-level eviction
or orphan cleanup are not established. The file sync and rename can temporarily
require space for both editions. Callers must surface failures and must not assume
that an open file is valid EPUB content or that the reader can safely render it.

This storage is separate from the disposable cover cache and the position-only
backup format. The experimental flow uses a no-backup directory and retains
server-side authorization. Reader validation, trusted integrity metadata,
background retries, interruptions, concurrent access, editions and real storage
exhaustion remain open before release. No website browser progress or Keeper
credentials are involved.

## Verification

The [offline API 28 emulator run 41376565995](https://github.com/skypie0102/ShadowGarden/actions/runs/41376565995)
at source `e03b38f` passed shelf tests with a simulated catalog failure, fallback
book IDs, later catalog titles, an unmatched book, list refresh and a storage
error. A separate offline process-recovery probe found the generated app-reader
book in the shelf's storage listing after force-stop, then reopened the reader.
Local tests also cover invalid-size files and symbolic links without deleting
them. The ordinary suite skipped its staged process probe, live-catalog test and
known strict Readium reflow case; both explicit process stages passed separately.
This does not establish behavior with real books, inaccessible storage on a
physical device, live downloads or removal of unmatched books.

The [offline API 28 emulator run 41341581678](https://github.com/skypie0102/ShadowGarden/actions/runs/41341581678)
at source `b266253` passed the volume-screen removal test using generated bytes
and an isolated position database. It checked cancellation, preservation of a
replacement edition when the file changes during confirmation, confirmed removal,
and retention of the original edition's position after the same bytes are saved
again. The ordinary suite skipped the live-catalog test, manual process stage and
known strict Readium reflow case; the explicit process stages ran separately.
This does not establish live re-download, physical-device behavior, power-loss
durability or recovery of books absent from the catalog.

Local JVM tests cover exact-byte reopening, size and fingerprint rejection,
interrupted and cancelled writes, temporary-file cleanup, replacement and
removal while an earlier file is open. Debug and release builds and lint passed.
The [offline API 28 emulator run 41313634601](https://github.com/skypie0102/ShadowGarden/actions/runs/41313634601)
at source `ef76e29` passed two Android storage tests covering replacement,
open descriptors and retained reading positions. Its separate staged probe
stored a generated EPUB, force-stopped the app and reopened the same bytes and
fingerprint in a new process without Internet permission. The ordinary suite
skipped the live-only test, manual process stage and known strict Readium reflow
case; both process stages passed separately. The detailed instrumentation report
could not be downloaded in this environment; the run log records the suite and
both stages passing. This is not a protected production download, EPUB safety,
power-loss, real disk-exhaustion or physical-device acceptance test.

The [offline API 28 emulator run 41315790488](https://github.com/skypie0102/ShadowGarden/actions/runs/41315790488)
at source `7e20da3` passed an Android test accepting an original generated,
illustrated EPUB and preserving it when a later invalid replacement is rejected.
The separate force-stop probe stored the generated EPUB through the checked path
and reopened it without Internet permission. Local JVM tests exercised missing
entries, unsafe paths, altered headers, size declarations, truncation and
cancellation. The ordinary suite skipped the live-only test, manual process stage
and known strict Readium reflow case; both process stages passed separately. The
detailed report could not be downloaded in this environment; the run log records
the suite and both stages passing. Real-world EPUB compatibility and full reader,
security and physical-device acceptance remain open.
