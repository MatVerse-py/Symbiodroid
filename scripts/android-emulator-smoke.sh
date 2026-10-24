#!/usr/bin/env bash
# Only run on an isolated emulator with the CI-produced verified debug APK.
# No production credentials, grant authority or external agent execution.
set -euo pipefail

PKG="com.matverse.symbiodroid.dev"
APK="$ANDROID_TEST_APK"
OUT="$ANDROID_SMOKE_OUTPUT"
mkdir -p "$OUT"
test -s "$APK"

adb wait-for-device
adb shell input keyevent 82 || true
echo "[SMOKE] Installing known debug APK..."
adb install -r "$APK"
adb shell pm path "$PKG" | grep -q '^package:'
echo "PASS ANDROID_EMULATOR_INSTALL"

check_no_delegation_db() {
  local evidence
  evidence="$(adb shell run-as "$PKG" sh -c 'find . -type f -name matverse-delegation-v0-4.db -print' 2>&1)"
  if [[ -n "$evidence" ]]; then
    echo "FAIL: delegation SQLite DB created before explicit opt-in: $evidence" >&2
    return 1
  fi
}

echo "[SMOKE] Establishing local Metro dev-server connection..."
adb reverse tcp:8081 tcp:8081
CI=1 EXPO_NO_TELEMETRY=1 pnpm exec expo start --localhost --port 8081 >"$OUT/metro.log" 2>&1 &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null || true' EXIT
METRO_OK=0
for i in $(seq 1 90); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    METRO_OK=1
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "FAIL: Metro terminated unexpectedly" >&2
    tail -80 "$OUT/metro.log" >&2
    exit 1
  fi
  sleep 2
done
[[ "$METRO_OK" == 1 ]] || { echo 'FAIL: Metro status not ready' >&2; tail -80 "$OUT/metro.log" >&2; exit 1; }
echo "PASS EMULATOR_METRO_READY"

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 | tee "$OUT/launch.log"
for i in $(seq 1 40); do
  if adb shell pidof "$PKG" | grep -q '[0-9]'; then break; fi
  sleep 2
done
adb shell pidof "$PKG" | grep -q '[0-9]' || { echo 'FAIL: app process never started' >&2; exit 1; }
echo "PASS EMULATOR_PROCESS_STARTED"

# Check diagnostic route without grants, SQLite access or a biometric prompt.
adb shell am start -W -a android.intent.action.VIEW \
  -d 'onspaceapp://delegation-audit' -p "$PKG" | tee "$OUT/deep-link.log"

UI_READY=0
for i in $(seq 1 24); do
  adb shell uiautomator dump /sdcard/matverse-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/matverse-window.xml "$OUT/window.xml" >/dev/null 2>&1 || true
  if grep -q 'NÃO INICIADO' "$OUT/window.xml" 2>/dev/null; then
    UI_READY=1
    break
  fi
  sleep 5
done
adb exec-out screencap -p >"$OUT/emulator-screen.png" || true
adb logcat -d -t 1500 -v time > "$OUT/logcat-tail.txt" || true

if [[ "$UI_READY" != 1 ]]; then
  echo "HOLD: diagnostic screen marker was not verified on emulator" >&2
  if [[ -f "$OUT/window.xml" ]]; then
    grep -o 'text="[^"]*"' "$OUT/window.xml" | head -30 >&2 || true
  fi
  exit 1
fi
echo "PASS EMULATOR_DIAGNOSTIC_ROUTE"

check_no_delegation_db
echo "PASS EMULATOR_NO_SILENT_SQLITE_BOOTSTRAP"
echo "ANDROID_EMULATOR_SMOKE_PASS (NOT physical Android, NOT identity/Ω/production)"
