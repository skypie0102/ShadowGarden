#!/usr/bin/env bash
# Runs only isolated fixture services; never connects to production.
set -euo pipefail
accesslab_dir="$(cd "$(dirname "$0")" && pwd)"
android_dir="$(cd "$accesslab_dir/.." && pwd)"
repo_dir="$(cd "$android_dir/.." && pwd)"
fixture_log="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/shadowgarden-access-fixture.log"
fixture_pid=""
probe_needs_cleanup=0
probe_component="dev.shadowgarden.app.test/androidx.test.runner.AndroidJUnitRunner"
probe_class="dev.shadowgarden.app.ReaderProcessRecoveryTest"
cleanup() {
  if [[ "$probe_needs_cleanup" == 1 ]]; then
    adb shell am instrument -w -r -e class "$probe_class" -e processPhase cleanup "$probe_component" >/dev/null 2>&1 || true
  fi
  adb reverse --remove tcp:18443 >/dev/null 2>&1 || true
  if [[ -n "$fixture_pid" ]]; then
    kill "$fixture_pid" >/dev/null 2>&1 || true
    wait "$fixture_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT
cd "$repo_dir"
node --test android/accesslab/fixture/server.test.mjs
SG_ACCESSLAB_FIXTURE=1 node android/accesslab/fixture/server.mjs >"$fixture_log" 2>&1 &
fixture_pid=$!
ready=0
for ((attempt=0; attempt<20; attempt++)); do
  if curl -fsS --noproxy localhost --cacert "$accesslab_dir/src/debug/res/raw/access_lab_ca.pem" --max-time 1 https://localhost:18443/ >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$fixture_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  cat "$fixture_log"
  printf '%s\n' 'The isolated HTTPS fixture did not start.' >&2
  exit 1
fi
adb reverse tcp:18443 tcp:18443
cd "$android_dir"
if ./gradlew --no-daemon connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.accessBackend=true; then
  result=0
else
  result=$?
fi
run_probe() {
  local phase="$1" output
  if ! output="$(adb shell am instrument -w -r -e class "$probe_class" -e processPhase "$phase" "$probe_component" 2>&1)"; then
    printf '%s\n' "$output"
    return 1
  fi
  printf '%s\n' "$output"
  [[ "$output" == *"OK (1 test)"* && "$output" == *"INSTRUMENTATION_CODE: -1"* ]]
}
if [[ "$result" == 0 ]]; then
  if [[ "$(adb shell getprop ro.kernel.qemu | tr -d '\r')" == 1 ]]; then
    # Gradle removes its instrumentation APK after connected tests finish.
    # Reinstall only on an emulator and preserve any existing app data.
    if ! adb install -r -t "$android_dir/app/build/outputs/apk/debug/app-debug.apk" ||
      ! adb install -r -t "$android_dir/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"; then
      printf '%s\n' 'Could not install the debug app and instrumentation APK.' >&2
      result=1
    elif run_probe prepare; then
      probe_needs_cleanup=1
      # Only the disposable debug test app is stopped. No app data is cleared.
      if adb shell am force-stop dev.shadowgarden.app &&
        ! adb shell pidof dev.shadowgarden.app >/dev/null 2>&1 && run_probe restore; then
        probe_needs_cleanup=0
      else
        result=1
      fi
    else
      result=1
    fi
  else
    printf '%s\n' 'Process-recovery probe skipped: an emulator is required.'
  fi
fi
adb logcat -d -s SGReaderProbe:I '*:S' || true
exit "$result"
