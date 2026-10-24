# Symbiodroid v0.5 — Native readiness diagnostic (experimental)

## Intent and narrow scope
First Expo UI integration of the existing Delegation Kernel branch, without simulated consent becoming operational authority.

**This feature is intentionally observational.** Open `Configurações → Diagnóstico de delegação` on an Android/iOS development install. Route: `/delegation-audit`.

- Initializes/migrates the existing v0.4 SQLite schema using the shared `expoSqlitePort` on the device. The schema initialization is the only database mutation triggered by this screen.
- Queries aggregate counts of leases by active/expired/revoked, and actions by UNKNOWN/EXECUTED/FAILED/dispatch-claimed.
- Never renders payloads, agent IDs, principal IDs, receipt contents or biometric metadata.
- Verifies the native `expo-crypto` SHA-256 implementation against an independently computed known-answer vector.
- Offers an optional local `expo-local-authentication` prompt with strong biometric setting. Success **means local physical presence ONLY**, not authenticated owner identity, signed consent or OAuth/WebAuthn login.
- Declares identity binding, canonical Ω, SymbiOS executor, at-rest database encryption and WORLD_REAL_PASS as HOLD.
- Configurações now explicitly labels historical Omega/ledger switches as *interface preferences* rather than constitutional enforcement, and removes an unsupported 'identity protected' claim.

## Verified canonical source boundary

The connected repository `MatVerse-py/Gpt-project-bridge` provides `app/core.py` with `evaluate_hdb(human)` and `omega_gate(hdb,action,ontology_ok,signature_valid,transition_valid)`. The latter returns `PASS/BLOCK/HOLD` and may block invalid signatures, transitions or human-data consent. **This inspection does not establish a remotely authenticated HTTP/MCP endpoint accepting Symbiodroid requests.** No alternate Ω implementation or invented production endpoint was added.

## Tests and reproduction

CI compiles the standalone TypeScript delegation contracts, runs existing 76 contract/SQLite/guard/migration tests, and adds **10** read-only projection, privacy and SQLite aggregate regression tests (86 total). The native React Native TSX screen and settings file are syntax-parsed via esbuild without dependencies.

Device execution is still unverified. The TSX parse check is **not** an Expo typecheck, Android build, runtime smoke or proof of biometric functionality. Expo SDK 53 is used as-is; dependency upgrades require separate compatibility validation.

## Exact physical test procedure

1. Open the authenticated app source in a controlled Expo 53 Android development build on an owned device; check current permissions and ensure no external agent effects are enabled.
2. Navigate to Configurações → Diagnóstico de delegação.
3. Tap Atualizar diagnóstico local: confirm either honest SQLite+SHA256 results or an actionable error, not fabricated PASS.
4. Optionally tap Testar presença biométrica; accept only local PRESENCE_PASS, not OWNER_AUTH_PASS.
5. Restart the app and repeat. Verify stable counts and that no arbitrary lease was issued.
6. Preserve a redacted test report (OS, Expo version, SQLite file/schema version, errors, SHA vector and consent limitations).
7. Only after a cryptographically authenticated identity session, real consent UI and the actual MatVerse Ω-Gate are bound to the executor can #4/#5 be assessed for closure.

## Production blockers
- Not a real principal or agent credential; local biometrics are only a presence signal.
- No canonical HTTP/MCP Ω endpoint, authenticated transport, signatures or live decision receipts inspected.
- No trusted executor connection and no two-device federation.
- SQLite file is not independently verified encrypted at rest.
- The initialized local database is initially empty, not evidence of a functioning organism.
- No independent physical-device test or WORLD_REAL_PASS.

**Status: LOCAL_REFERENCE_PASS / NATIVE_SCREEN_PARSE_PASS / ANDROID_RUNTIME_HOLD / PRODUCTION_HOLD.**
