# Symbiodroid Delegation Kernel — experimental v0.2 hardening

## Purpose and architectural placement

This patch hardens the existing v0.1 in `src/delegation` rather than creating a second runtime.
Symbiodroid is the owner's presentation/device surface; the independent Ω-Gate/Trust Kernel remains the authoritative policy plane; SymbiOS executes approved work; Bridge handles external boundaries; Cassandra/MNB concern contextual continuity; URANO is the **experimental lab**, not a production executor.

**Status: contract-level local tests PASS; Android / real identity / durable execution HOLD.**

## Changed API (intentional breaking hardening)

```ts
const kernel = new DelegationKernel(executor, authorityPort, identityBoundary);
await kernel.issueLease(request, authenticatedOwnerProof, humanApproval);
await kernel.execute(action, authenticatedAgentProof);
await kernel.revokeLease(leaseId, authenticatedOwnerProof, humanApproval);
```

Production constructors default to `DenyAllAuthority` + `DenyAllIdentity`. The demo injects **hardcoded simulation-only** adapters which are NOT acceptable for real accounts or devices.

- Authenticated owner must match the requested `principalId` before any lease is issued.
- Authenticated agent AND principal must match the lease, even for an idempotent cached action result.
- Every grant requires an independently implemented `AuthorityPort` consent decision.
- All received lease and action inputs are snapshotted before crossing async boundaries.
- Action payloads are JSON-subset canonicalized, immutable, bounded in size/depth and reject prototype pollution keys, symbols, getters, sparse arrays, cycles and non-finite numbers.
- Duplicate action IDs use same-request single-flight within the process, and refuse conflicting payloads.
- Lease lifetime <= 24h, max uses <= 100; resource allocations capped and fail closed.
- Expired, revoked, exhausted, mismatched or unapproved requests cannot execute.
- An action completed after a mid-flight revocation is explicitly recorded as `COMPLETED_AFTER_REVOCATION`. **This does not reverse the action.**
- Audit event entries exclude raw payloads. Audit data is in-memory and not cryptographically signed.

## Commands

```bash
tsc -p tsconfig.delegation.json
node .delegation-build/tests/delegation.test.js
node .delegation-build/examples/delegation-demo.js
```

## Threat model / explicit unclosed P0 issues

1. IdentityBoundary has no real Android passkey/biometric, device/session trust anchor or transport binding. Adapters are privileged trusted code and must not be instantiated or selected by untrusted prompts.
2. Consent UI has not been integrated; simulated strings are **not authentication or consent**.
3. Lease, idempotency records, audit and revocations are process-local; crashes/restarts reset the state. Multi-device synchronization and exactly-once external operations are **not supported**.
4. The executor may finish in flight after revocation; cancellation/compensation and eventual external outcome reconciliation are not implemented.
5. External side-effectful connectors remain out of scope. A remote adapter must not be enabled without transactional reserve/commit/reconciliation semantics.
6. Audit capacity limits prevent unlimited memory growth in this reference, but production requires durable, atomic reservations; concurrent in-flight events reaching saturation must be handled before side effects.
7. Repo-level Expo/Android integration, threat testing on actual devices, WCAG/UX consent flows and measured latency/energy remain unverified.
8. This patch is stacked on v0.1; no change to the PR #1 `R1 broken-screen continuity` branch.

## Production acceptance criteria (all binary)

- Authenticated owner binding: fake owner and fake agent requests BLOCK; real identity/device sessions tested on device.
- Independent policy binding: exact canonical Omega/HDB interface inspected, no alternate policy implementation.
- Durable revocation and idempotency: power-cycle, process-crash, simultaneous-device and retry tests PASS with atomic storage.
- Mid-flight revocation: state explicitly acknowledges the irreversible window, with cancellation/reconciliation where supported.
- Complete end-to-end approved action on authorized owned device: world-real test supervised, without financial or sensitive external side effects.
- CI passes, mobile typecheck passes, real Android execution PASS, production deployment gated separately.

## Design discipline

No new independent MatVerse core, no agent self-promotion, no marketing claims of scientific validation and no early merge to `main`.
