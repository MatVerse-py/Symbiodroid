# Galaxy A13 Broken-Screen Recovery

Target used for the R1 acceptance test: Samsung Galaxy A13 4G, `SM-A135M/DS`.

## Safety rules

- Do not factory-reset, flash firmware, unlock the bootloader or erase partitions.
- Do not restart the phone merely for diagnosis.
- If ChromeOS Files already exposes `DCIM`, `Pictures`, `Download` or `Documents`, copy them before
  changing the USB session.
- Close Files, Quick Share, ADB tools and other WebUSB pages before registering HID.
- Enter the PIN only in the local Rescue keypad. Never paste it into an issue, log or chat.

## Phase 1: input before ADB

1. Run the Symbiodroid web target on HTTPS or localhost and open the **Rescue** tab directly in
   Chrome.
2. Connect the A13 with a known data-capable cable.
3. Select **Connect Samsung once** and choose the Samsung device in the Chrome picker.
4. Require state `HID_READY`. Anything else is not a successful bridge.
5. Send Space to wake the display, enter the known PIN locally and send Enter.
6. Use the virtual mouse, Tab, Shift+Tab and Enter to accept the device owner's ADB RSA dialog.

AOA/HID supplies input only. It cannot provide video, files or ADB access before authorization.

## Phase 2: prove ADB authorization

On a local host with Android platform-tools:

```bash
./scripts/rescue/doctor-adb.sh
```

Required output:

```text
STATE=ADB_AUTHORIZED
```

`ADB_UNAUTHORIZED` means the RSA dialog still has not been accepted. Do not claim mirroring or
start acquisition.

## Phase 3: preserve before prolonged mirroring

Run:

```bash
./scripts/rescue/backup-a13.sh
```

The script copies only common shared-storage paths, never deletes target data, hashes every copied
file and produces:

```text
MANIFEST.json
MANIFEST.sha256
SHA256SUMS.txt
FAILED_PATHS.txt
data/
```

The acquisition is verified only when the manifest hash can be checked locally:

```bash
cd "$HOME/Symbiodroid-Rescue/A13_BACKUP_<timestamp>"
sha256sum -c MANIFEST.sha256
sha256sum -c SHA256SUMS.txt
```

If no file is copied, the script exits with `STATE=ACQUISITION_FAILED_EMPTY` and must not be
reported as a verified acquisition.

## Phase 4: mirror

After `ADB_AUTHORIZED` and the initial acquisition:

```bash
scrcpy --max-size 1024 --video-bit-rate 6M --max-fps 25 --stay-awake --window-title "Symbiodroid Rescue"
```

Protected banking windows can intentionally appear blank in screenshots or mirroring. That is not
an ADB failure and must not be worked around. Use the physical display or an optical camera view.

## Hardware boundary

If the phone answers AOA 2.0 but refuses HID registration while locked, and no previously
authorized ADB key exists, the remaining safe options are a temporary test display, screen-module
replacement or a physical OTG input device. R1 must report this boundary honestly.
