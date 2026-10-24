# Symbiodroid v0.6 — Explicit diagnostic bootstrap and Expo adapter regression

## Critical correction
v0.5 mounted `/delegation-audit` and automatically called `SQLite.openDatabaseAsync()` plus `DurableDelegationJournal.initialize()`, creating/mutating a local persistent SQLite schema **before the user opted in**. The page was presented as read-only, which was misleading.

v0.6 removes the on-mount database access. On page entry it displays **NÃO INICIADO**, with no SQLite, crypto or biometric calls. A single clearly worded button **"Iniciar diagnóstico (cria banco SQLite local não criptografado)"** is the only entry point for SQLite open/bootstrap. Later presses refresh the projection.

The explicit tap authorizes **creation of an experimental diagnostic database only**, not the constitutional grant of agent authority. No external actions are enabled. Data at rest encryption remains unverified: do not put secrets or sensitive records in this database.

## Native and test scope
- Existing `expo-sqlite`, `expo-crypto`, `expo-local-authentication`, and the current `expo-sqlite-port` are reused; no parallel persistence and no dependency upgrade.
- 8 new Node 22 structural adapter and UI guard tests:
  - Expo `execAsync`/exclusive transaction contracts.
  - Readiness projection performs SELECT-only access (no mutation inside projection).
  - Atomic claim + replay hold, revocation and rollback.
  - Native failure fail closed.
  - Static check that the diagnostic screen has **no automatic mount invocation**, and the explicit-action button remains.
- CI total isolated tests: **94** (26 + 17 + 15 + 18 + 10 + 8), plus standalone TypeScript, Expo screen/settings syntax parsing and sandbox demo.
- The adapter uses a **Node SQLite-backed simulated Expo interface**, not a physically exercised native module.

## Foundational cross-platform limitations
- Expo SDK 53 declared in `package.json`; no root `package-lock.json` found in this branch, so deterministic full dependency reconstruction and full Android build are NOT claimed.
- `openDatabaseAsync` may create files by design. The UI avoids invoking it on mount, but a user tap does create/initialize a database.
- Platform permission challenge via `expo-local-authentication` is only a local-presence measurement; no account identity, passkey signing, human consent capability or canonical Ω authorization can be inferred.
- Existing MatVerse Bridge functions `evaluate_hdb()` and `omega_gate()` are found in `MatVerse-py/Gpt-project-bridge/app/core.py` but do not establish an authenticated Android-to-Bridge API.
- SQLite durability at single-device scope does not imply device federation or remote effect exactly-once semantics.
- The production database encryption, Android signing/build, real device smoke, real Ω/HDB binding and external executor remain HOLD.

## Manual reproducibility gate
1. Install a controlled development build on an **owned** Android device.
2. Open Configurações → Diagnóstico de delegação. Expect **NÃO INICIADO** before tapping any button.
3. Explicitly tap the SQLite initialization button; only then should counts appear or a usable error.
4. Repeat the diagnostic and restart the app. Counts should persist (no artificial PASS for empty data).
5. Optionally test local presence; successful biometric presence does NOT unlock actions.
6. Never enable external action executors based on this result.

**Status: LOCAL_ADAPTER_SIM_PASS (upon CI) / EXPLICIT_BOOTSTRAP_PASS / ANDROID_RUNTIME_HOLD / IDENTITY_HOLD / Ω_GATE_BINDING_HOLD.**
