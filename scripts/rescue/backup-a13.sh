#!/usr/bin/env bash
set -euo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required." >&2
  exit 2
fi
if ! command -v sha256sum >/dev/null 2>&1; then
  echo "sha256sum is required." >&2
  exit 2
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to write the local manifest." >&2
  exit 2
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
destination="${1:-$HOME/Symbiodroid-Rescue/A13_BACKUP_$stamp}"

case "$destination" in
  ""|"/"|"."|".."|"$HOME")
    echo "Refusing unsafe destination: $destination" >&2
    exit 2
    ;;
esac

mapfile -t authorized_devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  serial="$ANDROID_SERIAL"
elif [[ "${#authorized_devices[@]}" -eq 1 ]]; then
  serial="${authorized_devices[0]}"
elif [[ "${#authorized_devices[@]}" -eq 0 ]]; then
  echo "No authorized ADB device. Accept the RSA dialog before acquisition." >&2
  exit 3
else
  echo "Multiple authorized devices. Set ANDROID_SERIAL explicitly." >&2
  exit 4
fi

device_state="$(adb devices | awk -v target="$serial" '$1 == target { print $2; exit }')"
if [[ "$device_state" != "device" ]]; then
  echo "Selected device is not authorized: ${device_state:-missing}" >&2
  exit 3
fi

mkdir -p -- "$destination/data"
failed_file="$destination/FAILED_PATHS.txt"
: > "$failed_file"

requested_paths=(
  "/sdcard/DCIM"
  "/sdcard/Pictures"
  "/sdcard/Download"
  "/sdcard/Documents"
  "/sdcard/Movies"
  "/sdcard/Android/media/com.whatsapp"
  "/sdcard/WhatsApp"
)

for remote_path in "${requested_paths[@]}"; do
  local_name="${remote_path#/sdcard/}"
  echo "Copying $remote_path"
  if adb -s "$serial" pull "$remote_path" "$destination/data/$local_name"; then
    :
  else
    printf '%s\n' "$remote_path" >> "$failed_file"
  fi
done

(
  cd "$destination"
  find data -type f -print0 | sort -z | xargs -0 -r sha256sum > SHA256SUMS.txt
)

if [[ ! -s "$destination/SHA256SUMS.txt" ]]; then
  echo "STATE=ACQUISITION_FAILED_EMPTY" >&2
  echo "No files were copied; acquisition cannot be marked verified." >&2
  exit 5
fi

model="$(adb -s "$serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || true)"
android_version="$(adb -s "$serial" shell getprop ro.build.version.release 2>/dev/null | tr -d '\r' || true)"
completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

export SYMBIODROID_DESTINATION="$destination"
export SYMBIODROID_SERIAL="$serial"
export SYMBIODROID_MODEL="${model:-unknown}"
export SYMBIODROID_ANDROID_VERSION="${android_version:-unknown}"
export SYMBIODROID_STARTED_AT="$started_at"
export SYMBIODROID_COMPLETED_AT="$completed_at"

python3 - <<'PY'
import hashlib
import json
import os
from pathlib import Path

destination = Path(os.environ["SYMBIODROID_DESTINATION"])
data_root = destination / "data"
requested = [
    "/sdcard/DCIM",
    "/sdcard/Pictures",
    "/sdcard/Download",
    "/sdcard/Documents",
    "/sdcard/Movies",
    "/sdcard/Android/media/com.whatsapp",
    "/sdcard/WhatsApp",
]
failed_path = destination / "FAILED_PATHS.txt"
failed = [line.strip() for line in failed_path.read_text().splitlines() if line.strip()]
files = []
for path in sorted(p for p in data_root.rglob("*") if p.is_file()):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    files.append({
        "relativePath": path.relative_to(data_root).as_posix(),
        "bytes": path.stat().st_size,
        "sha256": digest.hexdigest(),
    })

manifest = {
    "schemaVersion": 1,
    "tool": "symbiodroid-rescue",
    "mode": "RESCUE",
    "device": {
        "serial": os.environ["SYMBIODROID_SERIAL"],
        "model": os.environ["SYMBIODROID_MODEL"],
        "androidVersion": os.environ["SYMBIODROID_ANDROID_VERSION"],
    },
    "startedAt": os.environ["SYMBIODROID_STARTED_AT"],
    "completedAt": os.environ["SYMBIODROID_COMPLETED_AT"],
    "requestedPaths": requested,
    "copiedPaths": [path for path in requested if path not in failed],
    "failedPaths": failed,
    "files": files,
    "totals": {
        "files": len(files),
        "bytes": sum(item["bytes"] for item in files),
    },
    "destructiveActions": 0,
}
manifest_path = destination / "MANIFEST.json"
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
(destination / "MANIFEST.sha256").write_text(f"{manifest_hash}  MANIFEST.json\n")
PY

(
  cd "$destination"
  sha256sum -c MANIFEST.sha256
  sha256sum -c SHA256SUMS.txt
)

echo "STATE=ACQUISITION_VERIFIED"
echo "DESTINATION=$destination"
echo "MANIFEST=$destination/MANIFEST.json"
echo "HASH=$destination/MANIFEST.sha256"
