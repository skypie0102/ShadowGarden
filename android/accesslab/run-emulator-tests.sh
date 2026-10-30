#!/usr/bin/env bash
# Runs only isolated fixture services; never connects to production.
set -euo pipefail
accesslab_dir="$(cd "$(dirname "$0")" && pwd)"
android_dir="$(cd "$accesslab_dir/.." && pwd)"
repo_dir="$(cd "$android_dir/.." && pwd)"
fixture_log="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/shadowgarden-access-fixture.log"
fixture_pid=""
cleanup() {
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
adb logcat -d -s SGReaderProbe:I '*:S' || true
exit "$result"
