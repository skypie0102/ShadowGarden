# Android private book storage foundation

The app contains an internal storage component for future book downloads. It is
not yet connected to a downloader, reader or user interface. Production access,
EPUB validation, background work and storage-management UI remain open in the
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
backup format. The future integration must use a no-backup directory, retain
server-side authorization, validate EPUBs and handle integrity metadata, retries,
interruptions, concurrent access, editions and real storage exhaustion before it
is presented as a download feature. No website browser progress or Keeper
credentials are involved.
