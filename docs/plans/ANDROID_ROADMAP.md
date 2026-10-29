# Android app roadmap

This is the current development cycle for the ShadowGarden repository. The
Android app lives in `android/` alongside the existing website and backend; the
website's operational and security contracts remain in force. The prior
[UI/UX roadmap](../archive/plans/UI_UX_ROADMAP.md) is archived and its remaining
device and evidence limits are tracked in [follow-ups](FOLLOW_UPS.md).

## Product decisions

- Include reader-facing website features and Keeper in the Android app. Keep
  website-compatible catalog, book-access and administrative behavior.
- Reading progress is local to Android and independent of browser data. No reader
  account, website progress migration or cross-device sync is required. Provide
  explicit Android progress export and restore. Keeper catalog backups are a
  different feature from personal reading-data backups.
- Download EPUBs for offline reading. Protect stored files and preserve reading
  data when a download is removed. Define handling for replaced EPUB editions.
- Keep Android builds, versions, signing and releases independent of the website.
- The first distribution channel is a direct APK download. Release identity,
  signing key custody and download hosting remain decisions before publication.

## Status and delivery order

| Phase | Status | Outcome |
| --- | --- | --- |
| 0. Scaffold and discovery | In progress | Buildable Android shell, current roadmap and a feature inventory; no app features are claimed |
| 1. Reader and access prototypes | In discovery | Compare approaches, then prove offline locations and protected access |
| 2. Library and offline reader | Planned | Reader-facing library, protected downloads, EPUB reader and local state |
| 3. Progress backup and restore | Planned | Portable, validated Android reading-data export and restore |
| 4. Keeper | Planned | All website Keeper workflows usable and protected on Android |
| 5. Parity and release | Planned | Complete feature parity, accessibility, device acceptance and release preparation |

The first scaffold is a placeholder. A roadmap item is complete only after its
acceptance evidence is recorded; source changes, CI, real-device verification
and production acceptance are distinct.

## Phase 0 — Scaffold and discovery

- [x] Establish a Gradle/Kotlin/Compose Android project and independently versioned app shell.
- [x] Establish this roadmap and archive the previous UI/UX plan.
- [x] Verify the debug build and lint with Android SDK 35 and JDK 17; subsequent protocol tests run in the local JVM.
- [x] Launch the scaffold and verify activity recreation on an emulator.
- [ ] Verify the scaffold and later relevant milestones on a physical device; record device/OS and results separately.
- [x] Add a manual-only emulator workflow for a launch/recreation smoke test; routine Android CI compiles the test without starting an emulator.
- [x] Inventory Library, Reader and Keeper workflows with proposed Android screens and acceptance cases: [parity inventory](ANDROID_PARITY_INVENTORY.md).
- [x] Select direct APK download for initial distribution. Use API 26 as the provisional development minimum.
- [ ] Decide final application ID, supported minimum Android version, release signing/key custody and APK hosting before publishing; do not treat the scaffold ID as a release commitment.
- [x] Select Android-aware CI without weakening website checks or publishing for Android-only changes. Backend changes also run the Android build; actual cross-platform contract tests remain future work once consumers exist.

Scaffold verification on 2026-10-28: `assembleDebug` and `lintDebug` passed
with JDK 17 and SDK 35; `testDebugUnitTest` had no sources at that time. No Android device
was attached to the development environment. Its 4.9 GiB filesystem and lack of
KVM prevented emulator acceptance: installing API 35 and API 28 system images
both failed for insufficient disk space. Device and emulator launch remain
unverified at that point and must not be inferred from the successful APK build.
On 2026-10-29 the manual [emulator run](https://github.com/skypie0102/ShadowGarden/actions/runs/40833427129)
at source `3c192da` passed one instrumented launch and activity-recreation test
on an Android 9 / API 28 x86_64 emulator. This is not reader or physical-device
acceptance. The user's phone is reserved for milestones where physical-device
behavior is essential.

## Phase 1 — Reader and protected access prototypes

- [ ] Compare a native EPUB toolkit (including licensing) with the existing reader in a secure Android shell. The [preliminary evaluation](ANDROID_READER_EVALUATION.md) records candidates and a prototype protocol; a choice requires evidence.
- [x] Validate the isolated EPUB.js test harness on the manual emulator: generated local EPUB, chapter navigation and CFI restoration after activity recreation. The [evidence](ANDROID_READER_EVALUATION.md#epubjs-test-harness) is not a production reader or process-death test.
- [x] Validate the Readium debug-only prototype on the same generated EPUB, including rendering, chapter navigation and locator restoration after activity recreation. See [test evidence](ANDROID_READER_EVALUATION.md#readium-test-harness).
- [x] Run both prototypes against a generated 12-chapter EPUB with a table of contents and embedded illustration, checking final-chapter restoration after activity recreation. See [test evidence](ANDROID_READER_EVALUATION.md#extended-generated-fixture).
- [ ] Test representative real-world text-heavy, illustrated and long EPUBs, Pages and Continuous modes, search, table-of-contents navigation, bookmarks, image zoom and lifecycle recovery.
- [ ] Validate reading-location capture and restoration, including EPUB CFIs, font/viewport changes, process death and changed editions. An [EPUB.js layout experiment](ANDROID_READER_EVALUATION.md#epubjs-passage-and-layout-experiment) exposed an initial wrong-page restore and tested a conditional retry; a [Readium experiment](ANDROID_READER_EVALUATION.md#readium-passage-and-layout-experiment) restored the selected passage after a similar change. A [current-location experiment](ANDROID_READER_EVALUATION.md#readium-current-location-experiment) found an earlier visible passage outside the viewport after reflow; a follow-up observed the first visible paragraph remained the same in one synthetic case. The strict test remains disabled pending investigation. Production capture and reliable recovery remain open. Do not assume different reader engines interpret locations identically.
- [x] Exercise a debug-only access-flow sketch with local JVM tests and fake responses; see the [access evaluation](ANDROID_ACCESS_EVALUATION.md).
- [ ] Prove Garden Pass verification, short-lived book tickets and download renewal on Android with the existing same-origin/session requirements; preserve server-side checks. A [debug-only protocol sketch](ANDROID_ACCESS_EVALUATION.md) tests simulated success and failure paths; real verification, cookies and networking remain untested. Document any backend change and test it without production credentials.
- [ ] Prototype Keeper's verification and authenticated session, including lock/logout and session expiry. The [protocol sketch](ANDROID_ACCESS_EVALUATION.md) uses fake responses only; authenticated Android integration and race-safe lock remain outstanding. Never embed Keeper secrets in the APK.

Acceptance: a documented reader/access decision and repeatable emulator and
physical-device evidence with authorized test content. Failed verification or
network access must not prevent reading an already downloaded book.

## Phase 2 — Library and offline reader

- [ ] Implement main and age-gated libraries, series and volume details, search, filters, sorting, pins, recently added and reading-state actions.
- [ ] Implement background-capable downloads, progress, retry/cancel, ticket expiry handling, integrity checks and private storage. Provide storage management and removal without deleting reading state.
- [ ] Implement offline reading, table of contents, in-book search, bookmarks, paginated/continuous layouts, typography, themes, image focus and accessible navigation.
- [ ] Persist location, bookmarks, finished state, pins and preferences locally. Show save failures and retain data across app restarts; no website sync.
- [ ] Reconcile removed or replaced catalog books and editions without silently treating an old location as valid.

Acceptance: download with valid access, read and resume in airplane mode after
process termination, remove and re-download without losing progress, and recover
from interrupted transfers and expired verification. Test on representative
Android versions, screen sizes and physical hardware.

## Phase 3 — Personal progress backup

- [ ] Define and document a versioned format containing book/edition identity, location, bookmarks, reading status, pins and applicable preferences. Do not include Keeper credentials or browser storage.
- [ ] Export via Android's system file picker to a user-selected destination; report failures and explain that EPUB files are not included in the initial progress backup.
- [ ] Validate version, size and records before restore; preview contents, define merge/replace behavior and confirm before overwriting existing data. Preserve the current state on failed restore.
- [ ] Preserve data for unavailable or changed books and make mismatches visible rather than silently discarding it.
- [ ] Test exports and restores across devices, interrupted and malformed files, duplicate entries and changed editions. Explain uninstall and user-controlled backup retention.

Acceptance: restore a backup on another Android device, re-download a matching
book and resume its saved position; invalid input cannot silently corrupt the
existing library. The website remains unaffected.

## Phase 4 — Keeper

- [ ] Provide Keeper entry, verification, authentication, lock/logout and session expiration handling using the established server contract.
- [ ] Adapt uploads, EPUB inspection, cover selection, destination and duplicate choices, upload progress, failures, retries and queues.
- [ ] Adapt catalog and series/volume editing, file replacement, translation credits, banners and taxonomy.
- [ ] Adapt catalog health, snapshots and backups, Trash, purge, recovery readiness, restore, abuse controls and maintenance.
- [ ] Retain revision preconditions, confirmation steps, cancellation, server validation and safe handling of stale sessions and conflicting edits. Keep secrets out of logs, backups and app packages.

Acceptance: exercise all Keeper workflows against isolated test infrastructure,
including failure, conflict, cancellation and recovery cases. Validate usable
layouts and file selection on phones and tablets; record live protected-flow
acceptance separately with authorized credentials and test content.

## Phase 5 — Parity and release

- [ ] Finish the reader-facing parity checklist, including read aloud, Android audio focus and media controls. Evaluate Android offline speech separately; current website Edge TTS is online.
- [ ] Test screen readers, contrast, scalable text, large touch targets, reduced motion, rotation, background/foreground and low-storage behavior.
- [ ] Review age-gate behavior, content rights, privacy, dependency licenses and distribution requirements for the selected release channel.
- [ ] Prepare Android CI, versioning, signed release and rollback instructions; do not bundle credentials or production content.
- [ ] Record emulator and physical-device results, including locked-screen audio; retain the existing website test and deployment process.

Potential later features include highlights and notes, reading reminders, a
continue-reading shortcut, Wi-Fi-only downloads and optional offline speech.
Prioritize them after the parity and reliability requirements above.
