# Symbiodroid v0.9 — Android emulator smoke, known APK

## Confirmed input

- Source: GitHub Actions native debug build #40067689095, PR #11.
- `assembleDebug`: PASS; debug APK built without production signing.
- APK SHA-256 from job log:
  `1cf02c5af94ef58507ca680210b4a28e6b423216a4125940a0cd6aaf5984b1d8`.
- Archive: `symbiodroid-debug-apk-v0-8` (artifact ID 12551035356), scheduled to expire 2026-10-25 06:15:54 UTC. Do not assume it remains available after that time.
- APK build used CI-only Android identifier `com.matverse.symbiodroid.dev`.

## Method

Workflow: `.github/workflows/android-emulator-smoke.yml` on the single same-repository draft branch; readonly GitHub token with actions download capability.

1. Download the *existing* APK artifact rather than repeat the native Gradle compilation.
2. SHA-256 verify bytes against the recorded source job checksum before installation. Reject changed or missing archives.
3. Inspect actual Android package identifier and declared permissions with `aapt`.
4. Install on isolated Google APIs Android 35 x86_64 emulator. No production accounts, personal records or device enrollment.
5. Start local Expo Metro dev server on port 8081 and connect via `adb reverse`. The debug APK may require Metro, unlike a self-contained release APK.
6. Launch the app process; open `onspaceapp://delegation-audit` through the Android intent dispatcher.
7. Request a UI hierarchy dump; require the text `NÃO INICIADO`. Then ensure no `matverse-delegation-v0-4.db` file exists in app private storage, confirming that navigating to diagnostic did not silently create the database.
8. Keep short synthetic emulator evidence for one day if emitted.

## Interpretation

- `APK_HASH_PASS`: exact previously built APK verified.
- `EMULATOR_INSTALL_PASS`: app installed on emulator, not physical device.
- `EMULATOR_PROCESS_PASS`: process exists; may still have broken JS rendering.
- `EMULATOR_ROUTE_PASS`: diagnostic marker actually rendered.
- `EMULATOR_NO_SILENT_DB_PASS`: no test database appeared before explicit tap.
- `ANDROID_PHYSICAL_DEVICE_PASS`, real biometric owner binding, Ω decision service, SymbiOS executor and WORLD_REAL remain HOLD regardless.

An emulator smoke failure is a legitimate regression signal. The workflow may fail due to emulator boot/Android SDK/action limitations, Android deep-link routing, Metro networking or genuine React Native UI faults. Diagnose the actual logs before editing anything. **Do not infer app functionality from Gradle or Metro bundle success.**
