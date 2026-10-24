# Symbiodroid v0.4 — single-use dispatch claim

## Purpose
Hardens the local delegation journal from PR #6; stacked on `feat/delegation-p0-recovery-v0-3`. This is an **experimental persistence and policy boundary**, not Android production execution.

## Invariant: reserve != dispatch

1. `reserve(action, authProof)`: trusted identity + independent Ω decision, then SQLite atomically reserves budget and action ID as `UNKNOWN`.
2. `claimForDispatch(action, authProof)`: independently **reauthenticates** agent and **rechecks Ω** just before dispatch, and checks lease revocation/expiry **inside the same SQLite transaction** that marks `dispatch_started_ms`.
3. A second dispatch claim, even after restart or lock contention, returns HOLD; only the first claim succeeds.
4. Revocation before claim blocks the claim; revocation after claim cannot reverse effects already in motion.
5. `reconcile(...)` still requires verified independent outcome evidence; UNKNOWN never allows automatic retry.
6. `initialize()` adds the new column to existing v0.3 SQLite tables without deleting historical actions. Legacy UNKNOWN actions remain on hold until verified.

## Security boundaries
- Both `DurableDelegationJournal` and `GuardedDelegationJournal` must be called only within the trusted app/executor boundary; never expose internal mutators as callable model tools.
- The injected `IdentityBoundary` and `OmegaDecisionPort` implementations are simulated **only in tests**. Real device credential, real consent UI, canonical Ω/HDB adapter and SymbiOS execution are **HOLD**.
- An existing adapter is not silently substituted; no real external network, financial or messaging effects are enabled.
- Local SQLite contention is **not** distributed cross-device agreement. The executor/provider must still support authenticated operation identity and independent reconciliation.
- The interval between claim and external effect remains an irreversible race window. A mid-flight revocation prevents no already claimed action, but subsequent dispatch claims are blocked.
- Existing `UNKNOWN` records must remain unresolved until the independent observer proves the outcome. Do not fabricate status from local timeouts.

## Validation
Run `tsc -p tsconfig.delegation.json` followed by `node .delegation-build/tests/delegation.test.js`, `node tests/durable-sqlite.test.cjs`, `node tests/guarded-journal.test.cjs`, `node tests/dispatch-claim.test.cjs`, and the local demo.

Expected reference suite: 26+17+15+17 = **75** unit/regression tests. Node 22 `node:sqlite` is an experimental **test-only** adapter; production Expo SQLite runtime remains unverified.

**Status:** LOCAL_REFERENCE_PASS; real identity/Ω/Android/world-real execution HOLD.
