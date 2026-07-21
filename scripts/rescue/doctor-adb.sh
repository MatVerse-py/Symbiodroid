#!/usr/bin/env bash
set -uo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "STATE=ADB_TOOL_MISSING"
  echo "Install Android platform-tools in the local host environment."
  exit 2
fi

output="$(adb devices -l 2>&1)"
printf '%s\n' "$output"

device_lines="$(printf '%s\n' "$output" | awk 'NR > 1 && NF > 1 { print }')"
if [[ -z "$device_lines" ]]; then
  echo "STATE=DISCONNECTED"
  exit 1
fi

if printf '%s\n' "$device_lines" | grep -q '[[:space:]]unauthorized'; then
  echo "STATE=ADB_UNAUTHORIZED"
  echo "Use AOA-HID or scrcpy --otg only to accept the RSA dialog on the Android device."
  exit 3
fi

if printf '%s\n' "$device_lines" | grep -q '[[:space:]]offline'; then
  echo "STATE=ADB_OFFLINE"
  exit 4
fi

authorized_count="$(printf '%s\n' "$device_lines" | awk '$2 == "device" { count++ } END { print count + 0 }')"
if [[ "$authorized_count" -eq 1 ]]; then
  echo "STATE=ADB_AUTHORIZED"
  exit 0
fi

if [[ "$authorized_count" -gt 1 ]]; then
  echo "STATE=MULTIPLE_ADB_DEVICES"
  echo "Set ANDROID_SERIAL before acquisition."
  exit 5
fi

echo "STATE=USB_DETECTED_ADB_UNKNOWN"
exit 6
