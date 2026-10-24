# Symbiodroid v0.3 — Durable Delegation P0 (experimental)

## Scope
This change is stacked on PR #3, which itself is stacked on PR #2. **No merge to main; no real external execution.**
This is an additive transaction journal and authorizing facade, not a second organism, second constitutional Ω-Gate, or new Bridge.

## Implemented
- `DurableDelegationJournal`: local SQLite lease metadata, revocations, action IDs, SHA-256 fingerprints, use budgets and reconciliation statuses.
- Atomic transaction reserves a use and an action ID together. **Before dispatch the result is UNKNOWN**, and repeats are HOLD until separately verified. No fabricated FAILED on timeout.
- Reopen after a process crash retains UNKNOWN and revocation. Concurrent attempts on SQLite connections cannot exceed the stored budget; lock contention may fail closed.
- `GuardedDelegationJournal` requires authenticated owner + approval for grant/revoke, authenticated agent + an independently injected Ω policy decision for reservation, and verified evidence for outcome promotion.
- Structural `expoSqlitePort` for the already present `expo-sqlite` dependency (Android runtime not yet instrumented).
- CI adds 17 transactional crash/recovery tests and 15 guard/identity tests to the existing 26 tests: 58 isolated tests total.

## Security and scope
**Identity, Ω and evidence adapters in tests are fake fixtures.** A real identity anchor, biometric/passkey session binding, policy decision from the existing Trust Kernel/Ω-Gate, independent effect witness, secure local database handling and ownership UX are NOT implemented.

This component does **not** automatically execute side effects; the existing SymbiOS/Bridge executor must enforce identity and an Ω decision **again immediately before dispatch**. Revocation cannot undo already transmitted effects.

Never treat a transient failure as proof an external action did not happen. UNKNOWN must reconcile through the provider with a deterministic operation key, or require human review. No unconditional automatic retry. Exactly-once delivery is not guaranteed across services that lack their own idempotency mechanisms.

The `DurableDelegationJournal` mutators are privileged internal APIs, not a public UI surface. Untrusted callers should only traverse an authenticated server/device boundary. Multi-device federation is **not** proven by two SQLite connections against one local file.

## Tests
```sh
tsc -p tsconfig.delegation.json
node .delegation-build/tests/delegation.test.js
node tests/durable-sqlite.test.cjs
node tests/guarded-journal.test.cjs
node .delegation-build/examples/delegation-demo.js
```
Node 22 `node:sqlite` is experimental and is **only used in tests**. Android uses a separate Expo adapter.

## GO/HOLD criteria
1. #4 remains HOLD until real authenticated owner/agent proof, consent UX, canonical Ω policy binding, independent evidence and executor recheck pass on an actual authorized device.
2. #5 remains HOLD until a trusted persistent executor uses the journal, crash-after-dispatch reconciliation is verified, policy/revocation is enforced at effect boundary, encrypted local storage and cross-device federation tests pass.
3. GitHub Actions PASS means **reference contract/in-memory/SQLite simulation PASS**, not Android or WORLD_REAL_PASS.
4. Review changes against the MatVerse canonical contracts before merging stacked PRs. Existing Symbiodroid recovery PR #1 is unaffected.

Status: `LOCAL_SQLITE_REFERENCE_PASS` / `WORLD_REAL_HOLD` / `PRODUCTION_HOLD`.
