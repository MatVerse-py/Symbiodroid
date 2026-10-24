# Symbiodroid Delegation Kernel v0.1 — experimental

## Purpose
Implement revocable and scoped local agent delegation inside Symbiodroid. This is NOT a standalone project and does not replace the existing Organismo, Omega-Gate, Bridge, Cassandra, SymbiOS/MAG or URANO components.

## Security boundary
- `AuthorityPort` is deny-by-default. Human approval is not inferred from natural language.
- A lease has principal, agent, capability, scope, expiry and use budget (maximum 24 hours / 100 uses).
- Allowlisted demo operations are `local.note.append`, `local.note.read`, `local.math.sum`.
- A revoked, expired, exhausted or mismatched lease is denied before execution.
- Duplicate action IDs coalesce within one kernel instance; reuse with different serialized payload is rejected.
- Failed executor attempts consume reserved uses.
- Audit records exclude raw action payloads. Audit events and action receipts are NOT cryptographic proof.
- Sandbox is volatile and never accesses payments, calls, external services, disk or networking.
- Revocation does not cancel a previously dispatched in-flight action.

## Local commands
Requires TypeScript compiler (`tsc`) and Node, but no new project dependencies.

```bash
tsc -p tsconfig.delegation.json
node .delegation-build/tests/delegation.test.js
node .delegation-build/examples/delegation-demo.js
```

## Integration contracts
1. **Symbiodroid:** owner-facing consent and active lease display.
2. **Organismo / Omega-Gate:** independently verified policy decision and authority; replace the demo approval port.
3. **SymbiOS/MAG:** implementation-specific executor port.
4. **Bridge:** external adapters behind canonical ActionRequest contracts, idempotency and reconciliation.
5. **Cassandra:** contextual continuity; must never autonomously elevate capability privileges.
6. **URANO:** adversarial, reliability, cost and thermodynamic experiments.

## Release blocks
- Bind agent identity to authenticated device/session transport; caller-supplied agentId is insufficient.
- Replace demo approval string with real human verification, device attestation and signed capability lease.
- Persist idempotency keys, usage, revocations and executions atomically across restarts and devices.
- Add race-safe revocation and cancellation/compensation policy for long-running external actions.
- Integrate the canonical Omega-Gate and Bridge contracts without policy bypass.
- Run repository CI, Expo and physical Android validation; local TypeScript tests are not Android tests.

Status: **LOCAL PROTOTYPE PASS; PRODUCTION / REAL-WORLD EXECUTION HOLD**.
