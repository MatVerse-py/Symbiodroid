# Symbiodroid Rescue Protocol R1

## Purpose

R1 is a fail-closed recovery host for an Android device whose display or touch layer has failed.
It does not bypass a lock screen, recover a forgotten credential, root a device, or weaken Android
security. It provides input so the owner can enter a credential they already know and can approve
their own ADB key.

The host path is designed for Chrome/ChromeOS:

```text
Chrome secure top-level page
  -> WebUSB control endpoint zero
  -> Android Open Accessory 2.0 HID
  -> owner enters PIN locally
  -> owner accepts the ADB RSA dialog
  -> authorized ADB host
  -> acquisition, verification, then mirroring
```

The installed Android app is a separate product surface. It cannot act as the USB host for the same
phone on which it is running.

## State machine

The current state is a claim backed by a typed proof. UI text must never advance a state manually.

| State | Required proof |
| --- | --- |
| `DISCONNECTED` | Initial or operator-closed session |
| `USB_DETECTED` | WebUSB device with vendor/product identifiers |
| `AOA_PROBED` | Successful AOA protocol control response |
| `AOA_SUPPORTED` | Protocol value 2 or greater |
| `AOA_UNAVAILABLE` | Valid response below protocol 2 |
| `HID_READY` | Keyboard and mouse descriptors registered without transfer failure |
| `ADB_UNAUTHORIZED` | `adb devices -l` reports `unauthorized` |
| `ADB_AUTHORIZED` | `adb devices -l` reports `device` |
| `MIRROR_AVAILABLE` | First decoded frame plus SHA-256 |
| `ACQUISITION_RUNNING` | Explicit destination and requested paths |
| `ACQUISITION_VERIFIED` | File inventory and SHA-256 manifest |
| `FAILED_REQUIRES_HARDWARE_REPAIR` | Specific, recorded physical/security failure |

The implementation lives in `services/rescue/stateMachine.ts`. Invalid transitions throw and are
covered by tests.

## Direct AOA HID

`services/rescue/aoaHid.ts` performs one Samsung WebUSB selection, opens the device and sends the
AOA 2.0 requests directly:

| Request | Function |
| --- | --- |
| `51` | Get AOA protocol |
| `54` | Register HID |
| `55` | Unregister HID |
| `56` | Send HID report descriptor |
| `57` | Send HID input event |

It deliberately does not send `ACCESSORY_START` and does not switch the phone into Android
Accessory mode. No app is installed on the target.

## Diagnostic contract

Diagnostics may contain:

- runtime capability booleans;
- USB vendor/product identifiers;
- AOA version;
- state transitions and proof kinds;
- sanitized error categories.

Diagnostics must not contain:

- PIN digits or keystrokes;
- passwords, OTPs or banking data;
- ADB private keys;
- full ADB serials;
- local acquisition destinations.

`createSafeDiagnostic` applies these redactions before copying text to the clipboard.

## Completion boundary

Source compilation is not physical validation. R1 remains pending hardware acceptance until the
test in `docs/R1_ACCEPTANCE.md` is completed on an owned Android device and the evidence artifacts
are retained locally.
