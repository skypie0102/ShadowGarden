# Android private book storage foundation

The app contains an internal storage component and a [ticketed transfer foundation](ANDROID_BOOK_TRANSFER.md)
for the experimental foreground download flow. The reader, live protected access,
full EPUB validation, background work and storage-management UI remain open in the
[Android roadmap](ANDROID_ROADMAP.md).

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
