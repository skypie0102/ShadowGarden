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
./gradlew lintDebug testDebugUnitTest
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
