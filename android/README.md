# ShadowGarden for Android

This directory contains the initial Android scaffold. The app currently opens a
placeholder screen; it does not yet connect to ShadowGarden, read EPUBs, save or
restore progress, or provide Keeper. See the [Android roadmap](../docs/plans/ANDROID_ROADMAP.md)
for scope, sequence and acceptance criteria.

## Development

Install Android Studio with a JDK 17 or newer, Android SDK Platform 35 and the
corresponding SDK build tools. Open `android/` as the Android Studio project and
let Gradle sync. Alternatively, configure `ANDROID_HOME` or an untracked
`android/local.properties` containing `sdk.dir`, then from this directory run:

```sh
./gradlew assembleDebug
./gradlew assembleDebugAndroidTest lintDebug testDebugUnitTest
```

The debug APK is generated at `app/build/outputs/apk/debug/app-debug.apk`.
Run it on an emulator or Android device running API 26 or later. The Gradle
wrapper pins and verifies its distribution. Android versioning and release
signing are independent of the website. The first intended distribution is a
direct APK download; the current ID, API 26 minimum and version are development
values. Final release identity, support range, signing and hosting still need
decisions before distribution.

Android automatic system backup is disabled in the scaffold, with extraction
rules excluding app data from cloud backup and device transfer. The planned
explicit progress export/restore is not implemented yet. Keep signing keys,
local SDK paths, Keeper tokens, real book files and personal backups out of Git.

## Manual emulator smoke test

The emulator smoke test in [Android checks](../.github/workflows/android.yml) is
manual-only; it is not part of normal pull request or push checks. From GitHub,
open **Actions → Android checks → Run workflow**, choose the branch, enable
**Run the emulator smoke test instead of the regular build**, and start it. The
job uses an API 28 emulator and runs the instrumented launch/recreation test and
the experimental offline EPUB.js and Readium harnesses, plus the separate local
HTTPS access test, with `connectedDebugAndroidTest`. Instrumentation reports
are retained for seven days when generated. KVM must be available on the
GitHub-hosted runner; a setup failure does not establish app behavior.

For a local emulator or attached device, run `./gradlew connectedDebugAndroidTest`.
To include the isolated real-handler fixture, use `bash accesslab/run-emulator-tests.sh`
from `android/` with Node 24, `curl` and `adb` available. The fixture is not
started by normal Android builds. Physical-device testing is reserved for milestones that require it, such as
touch behavior, background audio and release acceptance.

The EPUB.js harness is test-only: it creates a small original EPUB in app-private
cache, reads it offline through an isolated WebView, and tests chapter navigation
and CFI restoration after activity recreation. The website's pinned vendor files
are packaged only into the test APK. It does not implement the application reader,
save user progress or prove the website's reader extensions work on Android.

The Readium comparison is a non-exported debug-only test host using the same
generated EPUB. It does not provide an app reader or implement progress backup.
The [reader evaluation](../docs/plans/ANDROID_READER_EVALUATION.md) records the
prototype constraints and results.

The separate [access test module](accesslab/README.md) uses a disposable local
HTTPS fixture and simulated responses to investigate WebView cookies and request
origins. It has its own debug-only Internet permission and test trust anchor;
these do not apply to the ShadowGarden app. Real Garden Pass, Keeper and backend
integration remain unimplemented. See the [access evaluation](../docs/plans/ANDROID_ACCESS_EVALUATION.md).
