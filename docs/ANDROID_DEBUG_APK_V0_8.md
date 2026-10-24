# MatVerse Symbiodroid — Android debug APK CI v0.8

## Purpose and trust scope

Stacked development increment on PR #10. Verifies whether existing Expo 53 project can generate a **real local debug Android APK** in a restricted GitHub Actions runner, after the validated v0.7 Android JS/Hermes export.

It does **not** sign a production app, deploy to a store, install on a phone, remotely authenticate an account/device, or authorize any agent execution. The previous 94/94 isolated security tests are independent and do not establish native OS integration.

## Controlled build
Workflow: `.github/workflows/android-debug-apk.yml`.

- Runs on PRs from same repository with head exactly `feat/android-debug-apk-ci-v0-8`; never from fork PRs; read-only repository token, no EAS or production signing keys.
- Node 22, pnpm 9.15.9, Java 17, GitHub Ubuntu Android SDK.
- Verifies `package.json` vs updated `pnpm-lock.yaml` and uses `pnpm install --frozen-lockfile --ignore-scripts --config.node-linker=hoisted`.
- Sets Android package identifier `com.matverse.symbiodroid.dev` **only within ephemeral CI workspace**, not canonical `app.json`, because original manifest lacks a package ID and noninteractive prebuild requires one.
- `pnpm exec expo prebuild --platform android --no-install --clean --non-interactive`.
- Executes Android Gradle `assembleDebug`. The resulting debug APK is **development-only**.
- Prints SHA-256 and publishes short-lived workflow artifact `symbiodroid-debug-apk-v0-8` for 1 day, if Gradle succeeds. Do not publicly redistribute development app binaries without permission.

## Test on owned Android device (manual; separate pass criterion)
1. Review PR source and CI logs for any permissions, unexpected embedded credentials, or changes in the native Android manifest.
2. Retrieve debug APK from the successful Actions artifact before one-day expiry.
3. Compare downloaded APK SHA-256 against artifact manifest.
4. Install only on a device you own and have explicitly authorized for testing, with the OS installing from this debug APK knowingly.
5. Open Configurações → Diagnóstico de delegação. Before tapping the button it MUST show `NÃO INICIADO`, with no diagnostic database creation.
6. Tap the explicit diagnostic bootstrap action and verify SQLite counts plus SHA-256 known-answer test.
7. Try local biometric presence check; record only `LOCAL_PRESENCE`, not owner authentication.
8. Restart the app; repeat SQLite observation. No background third-party agent actions should be enabled.
9. Collect redacted device OS, device model, APK SHA-256, crash traces and SQLite migration results (without account tokens, names or biometric data).

## HOLDs
- `NATIVE_APK_PASS` is only granted after verified Gradle/CI build success and actual APK artifact.
- `ANDROID_INSTALL_PASS` needs separate device installation evidence.
- `ANDROID_RUNTIME_PASS` needs user-supervised test and redacted logs.
- `WORLD_REAL_PASS`, `PRODUCTION_PASS`, canonical Ω/HDB enforcement, real identity, encrypted persistence, federation and remote executor reconciliation remain HOLD.

**Fail-closed:** do not merge stacked draft PRs into main or expose real external actions on the basis of a debug APK alone.
